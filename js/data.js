/* Seedling Cosmos - game data & balance. Usable in browser (window.SC_DATA) and Node (module.exports). */
(function (root) {
  'use strict';
  const D = { VERSION: 1 };

  // ---- Balance knobs (tuned with sim/pacing.js) ----
  D.T = {
    TAP_BASE: 1,
    ACH_BONUS: 0.01,        // +1% all production per achievement
    MEM_BONUS: 0.5, MEM_EXP: 0.5,    // production x(1 + 0.5 * seeds^0.5), seeds earned this supernova cycle
    CORE_BONUS: 1, CORE_EXP: 0.5,    // production x(1 + cores^0.5), cores earned (lifetime)
    RE_REQ: 1.6e11,          // run stardust needed for first Rebloom
    RE_EXP: 0.3, RE_K: 5,
    SN_REQ: 1e6,          // Seeds of Memory earned (this cycle) needed for the first Supernova
    SN_SCALE: 1.35,          // requirement multiplier per Supernova already done
    SN_EXP: 0.6, SN_K: 6,
    OFF_CAP: 4 * 3600, OFF_EFF: 0.5,
    COST_R: 13, OUT_R: 7.2, BASE_COST: 15, BASE_OUT: 0.3, GROWTH: 1.15,
    SAP_EXP: 0.15, POL_EXP: 0.12, SL_EXP: 0.10
  };

  D.RES = {
    sd: { name: 'Stardust', icon: '✦', color: '#ffd86b', zone: 0 },
    sap: { name: 'Sap', icon: '💧', color: '#5fe3a1', zone: 1 },
    pol: { name: 'Pollen', icon: '🌼', color: '#ffae42', zone: 3 },
    sl: { name: 'Starlight', icon: '🌟', color: '#9cc8ff', zone: 5 }
  };
  D.RES_ORDER = ['sd', 'sap', 'pol', 'sl'];

  // ---- Zones (thresholds are Stardust produced during the current run) ----
  D.ZONES = [
    { name: 'Seed Pod', thr: 0, hue: 140, desc: 'A single glowing seed hums in the dark.' },
    { name: 'Sprout Moon', thr: 2e3, hue: 120, desc: 'A tiny moon sprouts green. Sap begins to flow.' },
    { name: 'Garden Planet', thr: 1e5, hue: 150, desc: 'Continents of blossoms wrap a living world.' },
    { name: 'Bloom System', thr: 5e7, hue: 45, desc: 'A young sun warms a whole system of flowers. Pollen drifts between worlds.' },
    { name: 'Nebula Grove', thr: 1e11, hue: 290, desc: 'Gas clouds condense into glowing orchards.' },
    { name: 'Galactic Arbor', thr: 1e18, hue: 210, desc: 'Spiral arms grow like branches. Starlight gathers in the leaves.' },
    { name: 'Cosmic Canopy', thr: 1e27, hue: 170, desc: 'A canopy of galaxies shades the dark between clusters.' },
    { name: 'Void Orchard', thr: 1e33, hue: 260, desc: 'Fruit of pure dark matter ripens in the void.' },
    { name: 'Eternal Meadow', thr: 1e36, hue: 330, desc: 'Time itself blooms in endless meadows.' },
    { name: 'The Worldtree', thr: 1e39, hue: 55, desc: 'Every seed remembers. The Worldtree awakens, and the cosmos is whole.' }
  ];

  // ---- Generators (helpers) ----
  const T = D.T;
  const SDG = [
    ['firefly', 'Firefly Gardener', '✨', 0, 'Tends the seed with tiny lanterns.'],
    ['moth', 'Moth Pollinator', '🦋', 0, 'Dusts blossoms with glittering pollen.'],
    ['dew', 'Dewdrop Sprite', '💧', 1, 'Rolls stardust into every furrow.'],
    ['vine', 'Vine Weaver', '🌿', 2, 'Braids living trellises across the land.'],
    ['petal', 'Petal Drifter', '🌸', 2, 'Sails the winds shedding stardust.'],
    ['comet', 'Pollen Comet', '☄️', 3, 'A blazing courier between worlds.'],
    ['nebgard', 'Nebula Gardener', '🌌', 4, 'Prunes the glowing clouds.'],
    ['shepherd', 'Star Shepherd', '⭐', 5, 'Herds young stars to fertile ground.'],
    ['arborist', 'Cosmic Arborist', '🌳', 6, 'Grafts galaxies onto the canopy.'],
    ['spirit', 'Worldtree Spirit', '🔮', 7, 'Whispers growth into the void.'],
    ['eternal', 'Eternal Bloom', '🌺', 8, 'A flower that never closes.']
  ];
  D.GENS = SDG.map((g, i) => ({
    id: g[0], name: g[1], icon: g[2], zone: g[3], desc: g[4], makes: 'sd', costRes: 'sd',
    base: T.BASE_COST * Math.pow(T.COST_R, i), growth: T.GROWTH, out: T.BASE_OUT * Math.pow(T.OUT_R, i)
  }));
  D.GENS.push(
    { id: 'siphon', name: 'Root Siphon', icon: '🌱', zone: 1, desc: 'Draws Sap up from the moon\'s core.', makes: 'sap', costRes: 'sd', base: 4e3, growth: 1.15, out: 0.5 },
    { id: 'hive', name: 'Pollen Hive', icon: '🐝', zone: 3, desc: 'Moth-keepers brew Pollen from Sap.', makes: 'pol', costRes: 'sap', base: 400, growth: 1.15, out: 0.4 },
    { id: 'prism', name: 'Starlight Prism', icon: '🔆', zone: 5, desc: 'Refracts Pollen into pure Starlight.', makes: 'sl', costRes: 'pol', base: 800, growth: 1.15, out: 0.3 }
  );
  D.GEN_BY_ID = {};
  D.GENS.forEach((g) => { D.GEN_BY_ID[g.id] = g; });
  D.SD_GENS = D.GENS.filter((g) => g.makes === 'sd');

  // ---- Upgrades ----
  const U = [];
  const up = (id, name, desc, res, cost, fx, req) => U.push({ id, name, desc, res, cost, fx, req: req || null });
  // Tap upgrades
  [['Dewy Fingertips', 25], ['Seedwhisperer', 400], ['Sunwarm Palms', 6e3], ['Moonlit Touch', 1e5], ['Starbrush Hands', 2e6],
    ['Nebula Grip', 4e7], ['Galaxy Palms', 1e9], ['Orchard Touch', 3e10], ['Cosmic Caress', 1e12], ['Worldtree Grasp', 5e13]]
    .forEach((t, i) => up('tap' + i, t[0], 'Tapping is twice as strong.', 'sd', t[1], { tap: 2 }));
  // Resonant touch: taps also yield a share of production
  [['Resonant Touch I', 2e4, 0.01], ['Resonant Touch II', 5e7, 0.02], ['Resonant Touch III', 1e11, 0.04],
    ['Resonant Touch IV', 1e16, 0.08], ['Resonant Touch V', 1e22, 0.15]]
    .forEach((t, i) => up('rt' + i, t[0], 'Each tap also yields +' + (t[2] * 100) + '% of your Stardust per second.', 'sd', t[1], { tapSps: t[2] }));
  // Crits
  up('crit0', 'Lucky Sprout', 'Taps have +5% chance to crit for x10.', 'sd', 3e3, { crit: 0.05, critMul: 5 });
  up('crit1', 'Fortune Petals', '+5% crit chance.', 'sd', 8e6, { crit: 0.05 });
  up('crit2', 'Shooting-Star Luck', 'Crits hit +10x harder.', 'sd', 5e12, { critMul: 10 });
  // Auto tappers
  [['Wind Chime Tapper', 1500, 1], ['Hummingbird Tapper', 4e5, 2], ['Aurora Tapper', 3e8, 5], ['Comet Tapper', 5e11, 10], ['Nova Tapper', 1e17, 20]]
    .forEach((t, i) => up('at' + i, t[0], 'Taps the seed for you: +' + t[2] + ' tap/s.', 'sd', t[1], { autoTap: t[2] }));
  // Generator tier upgrades
  const PFX = ['Gleaming', 'Radiant', 'Blazing', 'Transcendent'];
  const NS = [10, 25, 50, 100], MULT = [2, 2, 2, 3], CM = [10, 150, 3000, 200000];
  D.SD_GENS.forEach((g) => {
    NS.forEach((n, k) => {
      up('g_' + g.id + k, PFX[k] + ' ' + g.name + 's', g.name + 's produce x' + MULT[k] + '.', 'sd',
        g.base * CM[k], { g: g.id, x: MULT[k] }, { gen: g.id, n });
    });
  });
  // Resource generator upgrades (cost the resource they make)
  [['siphon', 'sap', [150, 3e3, 6e4], 'Deepwood Siphons'], ['hive', 'pol', [100, 2e3, 4e4], 'Honeyed Hives'], ['prism', 'sl', [80, 1500, 3e4], 'Faceted Prisms']]
    .forEach((r) => {
      [10, 25, 50].forEach((n, k) => up('g_' + r[0] + k, ['Fine ', 'Prime ', 'Perfect '][k] + r[3],
        D.GEN_BY_ID[r[0]].name + 's produce x2.', r[1], r[2][k], { g: r[0], x: 2 }, { gen: r[0], n }));
    });
  // Global
  up('all0', 'Warm Soil', 'All Stardust production x1.25.', 'sd', 2e3, { all: 1.25 });
  up('all1', 'Rich Compost', 'All Stardust production x1.5.', 'sap', 500, { all: 1.5 });
  up('all2', 'Companion Planting', 'All Stardust production x1.5.', 'sd', 5e7, { all: 1.5 });
  up('all3', 'Pollen Breeze', 'All Stardust production x1.5.', 'pol', 2e3, { all: 1.5 });
  up('all4', 'Starlit Dew', 'All Stardust production x2.', 'sl', 1e3, { all: 2 });
  up('all5', 'Mycelial Network', 'All Stardust production x2.', 'sd', 1e14, { all: 2 });
  up('all6', 'Harmonic Bloom', 'All Stardust production x2.', 'pol', 5e6, { all: 2 });
  up('all7', 'Cosmic Mulch', 'All Stardust production x2.', 'sl', 5e5, { all: 2 });
  // Costs
  up('cost0', 'Bulk Seeds', 'All helpers cost 10% less.', 'sd', 1e5, { costMul: 0.9 });
  up('cost1', 'Fairy Contracts', 'All helpers cost 10% less.', 'sap', 2e4, { costMul: 0.9 });
  up('cost2', 'Wholesale Wings', 'All helpers cost 10% less.', 'pol', 2e5, { costMul: 0.9 });
  // Resource boosts
  up('res0', 'Deep Roots', 'Sap production x2.', 'sap', 2e3, { r: 'sap', x: 2 });
  up('res1', 'Bee Dance', 'Pollen production x2.', 'pol', 1e3, { r: 'pol', x: 2 });
  up('res2', 'Prism Focus', 'Starlight production x2.', 'sl', 500, { r: 'sl', x: 2 });
  // Automation
  up('auto0', 'Gardener\'s Almanac I', 'Auto-buys your first 3 Stardust helpers.', 'sd', 2e5, { autoGens: 3 });
  up('auto1', 'Gardener\'s Almanac II', 'Auto-buys your first 6 Stardust helpers.', 'sd', 5e9, { autoGens: 6 });
  up('auto2', 'Gardener\'s Almanac III', 'Auto-buys all Stardust helpers.', 'sd', 5e15, { autoGens: 11 });
  up('auto3', 'Resource Steward', 'Auto-buys Sap, Pollen and Starlight helpers.', 'sd', 1e9, { autoRes: 1 });
  // Offline
  up('off0', 'Dream Lanterns', 'Offline efficiency +10%.', 'sd', 1e7, { offEff: 0.1 });
  up('off1', 'Night Watch Moths', 'Offline cap +2 hours.', 'pol', 5e3, { offCap: 7200 });
  D.UPGRADES = U;
  D.UPG_BY_ID = {};
  U.forEach((u) => { D.UPG_BY_ID[u.id] = u; });

  // ---- Prestige trees ----
  // fx(m, level) mutates the modifier object
  const N = (id, name, desc, max, base, gr, fx) => ({ id, name, desc, max, base, gr, fx });
  D.MEM_TREE = [
    N('mdust', 'Seed of Plenty', 'x1.25 all production per level.', 15, 1, 1.7, (m, l) => { m.all *= Math.pow(1.25, l); }),
    N('mtap', 'Echoing Touch', 'x1.5 tap power per level.', 10, 1, 1.8, (m, l) => { m.tap *= Math.pow(1.5, l); }),
    N('mstart', 'Head Start', 'Begin each run with more Stardust (x10 per level).', 8, 2, 1.9, (m, l) => { m.startSD = 100 * Math.pow(10, l); }),
    N('mauto', 'Muscle Memory', '+1 auto-tap per second per level.', 5, 3, 2.2, (m, l) => { m.autoTap += l; }),
    N('mgen', 'Helper Lineage', 'x1.2 helper output per level.', 12, 2, 1.75, (m, l) => { m.genAll *= Math.pow(1.2, l); }),
    N('mcost', 'Frugal Seedlings', 'Helpers cost 4% less per level.', 8, 4, 2, (m, l) => { m.costMul *= Math.pow(0.96, l); }),
    N('moffc', 'Dream Sleep', 'Offline cap +2 hours per level.', 6, 3, 2, (m, l) => { m.offCap += 7200 * l; }),
    N('moffe', 'Deep Dreams', 'Offline efficiency +10% per level.', 5, 5, 2, (m, l) => { m.offEff += 0.1 * l; }),
    N('mres', 'Waterlogged Memory', 'x1.5 Sap, Pollen & Starlight per level.', 8, 3, 1.9, (m, l) => { for (const r in m.res) m.res[r] *= Math.pow(1.5, l); }),
    N('mgain', 'Seed Harvest', '+15% Seeds of Memory gained per level.', 10, 5, 1.9, (m, l) => { m.memGain *= Math.pow(1.15, l); }),
    N('mcrit', 'Lucky Memory', '+3% crit chance per level.', 5, 4, 1.9, (m, l) => { m.crit += 0.03 * l; }),
    N('mtapsps', 'Harmonic Taps', 'Taps yield +2% of production per level.', 5, 10, 2, (m, l) => { m.tapSps += 0.02 * l; }),
    N('mautoup', 'Auto-Bloom Almanac', 'Unlocks auto-buying of upgrades.', 1, 25, 1, (m) => { m.autoUps = true; }),
    N('mautore', 'Rebloom Reflex', 'Unlocks automatic Rebloom.', 1, 100, 1, (m) => { m.autoRe = true; })
  ];
  D.CORE_TREE = [
    N('cdust', 'Stellar Forge', 'x1.7 all production per level.', 12, 1, 1.5, (m, l) => { m.all *= Math.pow(1.7, l); }),
    N('cmem', 'Memory Bloom', 'x1.4 Seeds of Memory per level.', 10, 1, 1.7, (m, l) => { m.memGain *= Math.pow(1.4, l); }),
    N('cstartmem', 'Ancestral Echo', 'Begin each Supernova cycle with Seeds of Memory.', 8, 2, 2, (m, l) => { m.startMem = 8 * (Math.pow(2, l) - 1); }),
    N('coff', 'Star Dreams', 'Offline cap +4 hours per level.', 5, 2, 2, (m, l) => { m.offCap += 14400 * l; }),
    N('coffe', 'Lucid Slumber', 'Offline efficiency +10% per level.', 5, 2, 2.2, (m, l) => { m.offEff += 0.1 * l; }),
    N('cres', 'Core Springs', 'x1.7 Sap, Pollen & Starlight per level.', 10, 2, 1.7, (m, l) => { for (const r in m.res) m.res[r] *= Math.pow(1.7, l); }),
    N('cgen', 'Constellation Helpers', 'x1.35 helper output per level.', 10, 1, 1.6, (m, l) => { m.genAll *= Math.pow(1.35, l); }),
    N('ccost', 'Cosmic Frugality', 'Helpers cost 7% less per level.', 8, 3, 1.8, (m, l) => { m.costMul *= Math.pow(0.93, l); }),
    N('ctap', 'Supernova Touch', 'x2 tap power per level.', 8, 1, 1.7, (m, l) => { m.tap *= Math.pow(2, l); }),
    N('croots', 'Perennial Roots', 'Begin each run with 10 of your first 4 helpers per level.', 10, 2, 1.6, (m, l) => { m.startGens = 10 * l; }),
    N('cgainc', 'Nova Harvest', 'x1.25 Star Cores gained per level.', 10, 3, 1.9, (m, l) => { m.coreGain *= Math.pow(1.25, l); }),
    N('cmuse', 'Constellation Muse', 'Achievements are twice as powerful.', 1, 5, 1, (m) => { m.achMul = 2; }),
    N('cautosn', 'Eternal Reflex', 'Unlocks automatic Supernova.', 1, 50, 1, (m) => { m.autoSn = true; })
  ];
  D.MEM_BY_ID = {}; D.MEM_TREE.forEach((n) => { D.MEM_BY_ID[n.id] = n; });
  D.CORE_BY_ID = {}; D.CORE_TREE.forEach((n) => { D.CORE_BY_ID[n.id] = n; });

  // ---- Achievements ----  stat keys come from Core.stats()
  const A = [];
  const ach = (stat, list) => list.forEach((e) => A.push({ id: stat + '_' + e[0], name: e[1], desc: e[2], stat, min: e[0] }));
  ach('taps', [[1, 'First Touch', 'Tap the seed.'], [100, 'Green Thumb', 'Tap 100 times.'], [1000, 'Tireless Fingers', 'Tap 1,000 times.'],
    [10000, 'Seed Whisperer', 'Tap 10,000 times.'], [100000, 'Hands of the Gardener', 'Tap 100,000 times.'], [1e6, 'One With The Seed', 'Tap 1,000,000 times.']]);
  ach('sd', [[1e3, 'Dust Collector', 'Produce 1K Stardust.'], [1e6, 'Stardust Millionaire', 'Produce 1M Stardust.'], [1e9, 'Glittering Billions', 'Produce 1B Stardust.'],
    [1e12, 'Trillion Twinkles', 'Produce 1T Stardust.'], [1e15, 'Cosmic Dust Storm', 'Produce 1e15 Stardust.'], [1e20, 'Galactic Glitter', 'Produce 1e20 Stardust.'],
    [1e30, 'Beyond Counting', 'Produce 1e30 Stardust.'], [1e40, 'Stardust Ocean', 'Produce 1e40 Stardust.'], [1e50, 'Infinite Shimmer', 'Produce 1e50 Stardust.'],
    [1e60, 'Dust to Dust', 'Produce 1e60 Stardust.'], [1e80, 'Universe of Dust', 'Produce 1e80 Stardust.'], [1e100, 'Googol Garden', 'Produce 1e100 Stardust.']]);
  ach('gens', [[1, 'Hired Help', 'Own 1 helper.'], [10, 'Small Crew', 'Own 10 helpers.'], [50, 'Busy Garden', 'Own 50 helpers.'], [100, 'Bustling Grove', 'Own 100 helpers.'],
    [250, 'Swarm of Wings', 'Own 250 helpers.'], [500, 'Living Cloud', 'Own 500 helpers.'], [1000, 'Legion of Light', 'Own 1,000 helpers.']]);
  ach('upsb', [[1, 'Better Tools', 'Buy an upgrade.'], [10, 'Tinkerer', 'Buy 10 upgrades (lifetime).'], [30, 'Gadget Gardener', 'Buy 30 upgrades (lifetime).'],
    [100, 'Upgrade Addict', 'Buy 100 upgrades (lifetime).'], [300, 'Master Cultivator', 'Buy 300 upgrades (lifetime).']]);
  ach('zone', D.ZONES.slice(1).map((z, i) => [i + 1, 'Welcome to ' + z.name, 'Reach the ' + z.name + '.']));
  ach('reb', [[1, 'First Rebloom', 'Rebloom for the first time.'], [5, 'Cycle of Seasons', 'Rebloom 5 times.'], [10, 'Eternal Spring', 'Rebloom 10 times.'],
    [25, 'Perennial', 'Rebloom 25 times.'], [50, 'Evergreen', 'Rebloom 50 times.']]);
  ach('sup', [[1, 'Stellar Birth', 'Trigger a Supernova.'], [3, 'Nova Gardener', 'Trigger 3 Supernovas.'], [10, 'Stellar Nursery', 'Trigger 10 Supernovas.']]);
  ach('mem', [[10, 'Remembered', 'Earn 10 Seeds of Memory.'], [100, 'Memory Garden', 'Earn 100 Seeds of Memory.'], [1000, 'Library of Seeds', 'Earn 1,000 Seeds of Memory.'],
    [10000, 'Ancient Memory', 'Earn 10,000 Seeds of Memory.']]);
  ach('cores', [[1, 'Core Curious', 'Earn a Star Core.'], [25, 'Core Collector', 'Earn 25 Star Cores.'], [250, 'Heart of Stars', 'Earn 250 Star Cores.']]);
  ach('time', [[600, 'Settling In', 'Play for 10 minutes.'], [3600, 'Patient Gardener', 'Play for 1 hour.'], [86400, 'A Day in the Garden', 'Play for 24 hours.'],
    [604800, 'Week of Growth', 'Play for 7 days.'], [1814400, 'Three Weeks Deep', 'Play for 21 days.']]);
  ach('crits', [[1, 'Lucky Spark', 'Land a critical tap.'], [100, 'Fortune Favours', 'Land 100 critical taps.'], [1000, 'Jackpot Garden', 'Land 1,000 critical taps.']]);
  ach('sps', [[1, 'First Flow', 'Reach 1 Stardust/s.'], [100, 'River of Dust', 'Reach 100 Stardust/s.'], [1e4, 'Torrent', 'Reach 10K Stardust/s.'],
    [1e6, 'Stardust Falls', 'Reach 1M Stardust/s.'], [1e9, 'Cosmic Current', 'Reach 1B Stardust/s.'], [1e12, 'Stellar Wind', 'Reach 1T Stardust/s.'],
    [1e18, 'Quasar Flow', 'Reach 1e18 Stardust/s.'], [1e30, 'Endless Torrent', 'Reach 1e30 Stardust/s.']]);
  ach('offl', [[1, 'Sweet Dreams', 'Return from an offline absence.'], [10, 'Dream Regular', 'Return from 10 absences.']]);
  ach('exp', [[1, 'Careful Keeper', 'Export your save.']]);
  D.ACH = A;

  // ---- Milestones: unlock mechanics/tabs gradually. test(stats) ----
  D.MILESTONES = [
    { id: 'helpers', name: 'A Firefly Stirs', text: 'Helpers tab unlocked: hire little gardeners to tend the seed for you.', test: (s) => s.sd >= 10 },
    { id: 'upgrades', name: 'Ideas Take Root', text: 'Upgrades tab unlocked: improve your touch and your helpers.', test: (s) => s.sd >= 8 },
    { id: 'trophies', name: 'Garden Journal', text: 'Trophies tab unlocked: each achievement grants +1% production.', test: (s) => s.sd >= 100 },
    { id: 'bulk', name: 'Bulk Buying', text: 'You can now buy helpers x10, x100 or Max at a time.', test: (s) => s.gens >= 10 },
    { id: 'automation', name: 'Hands-Free Gardening', text: 'Automation unlocked. Manage auto-buyers in the Helpers tab.', test: (s) => s.autoUnlocked },
    { id: 'prestige', name: 'Memory Stirs', text: 'Prestige tab unlocked: a Rebloom resets your garden for permanent Seeds of Memory.', test: (s) => s.zone >= 3 },
    { id: 'supernova', name: 'A Distant Star Hums', text: 'Supernova revealed: gather enough Seeds of Memory to ignite a star and earn Star Cores.', test: (s) => s.reb >= 3 },
    { id: 'complete', name: 'The Cosmos Is Whole', text: 'You awakened the Worldtree. Seedling Cosmos is complete. Keep growing as long as you like!', test: (s) => s.zone >= D.ZONES.length - 1 }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = D;
  else root.SC_DATA = D;
})(typeof self !== 'undefined' ? self : this);
