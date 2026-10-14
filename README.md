# Seedling Cosmos

A mobile-first, active incremental game with a cosmic-garden theme. Play short timed runs, tap glowing targets, chain combos, then spend your Stardust on a giant pannable upgrade map. Vanilla JS, no build step, installable PWA.

- **Play:** open `index.html` through any static server (`python3 -m http.server`), or host the folder at `/seedling-cosmos/` on GitHub Pages.

## How it plays
- **Runs (10 s growing to ~90 s).** The first run is 10 s and pays a handful of Stardust; Time upgrades stretch it toward 90 s. Glowing seeds, golden blooms, comets, multi-hit star pods and time petals float around a portrait field. Tap them before they fade. Each hit builds a **combo multiplier**; a missed tap costs part of it. Crits, screen shake, particles, number popups and combo milestone banners give feedback.
- **Auto-pops are fair.** Pollen Sprites (auto-pop), the Gravity Well, Nova and the Hammer all pop targets through the *same* hit code as a tap (`hit()` in `js/core.js`), so they build combo, refresh the combo timer, crit and score exactly like taps. Nothing is ever claimed ahead of a tap, no overlay takes pointer input, and a tap on a target an auto-pop beat you to by a split second (0.3 s) is forgiven instead of counting as a miss.
- **Auto-Hammer** (Garden map, bottom branch): a mallet that swings at a target on its own, with a visible wind-up, aim ring, slam and shockwave. It starts slow and weak (0.35 swings/s, 1 damage) and grows through Quick Swing (rate), Heavy Head (damage, breaks multi-hit pods), Wide Swing (splash radius), Echo Strike (double-strike chance) and Sweet Spot (hammer crit). You can always tap too.
- **Active abilities** (unlocked on the map, with cooldown buttons in the run): Stardust Nova, Time Bloom, Photosynthesis, Gravity Well, Second Dawn.
- **Summary -> collect -> spend.** A run ends on a summary screen; Stardust is only banked when you collect it (an uncollected summary survives a reload).
- **Upgrades only.** There are no generators or helpers to buy repeatedly. Every purchase is a node on a map.
  - **Garden map** (82 nodes, 7 branches: Time, Sprites, Combo, Yield, Abilities, Zones, Hammer): longer runs, bigger yield, new zones (7 total) and abilities. Drag to pan, pinch to zoom, tap a node for details. Locked, available, owned and maxed states are visible and future nodes are greyed. "Grow all" buys the cheapest affordable nodes.
  - **Rebloom** (prestige 1): reset the Garden for **Seeds of Memory**, spent on the 20-node Memory map (head starts, yield, time, cost cuts...).
  - **Supernova** (prestige 2): reset Garden *and* Memory for **Star Cores**, spent on the 14-node Constellation map.
- **Length:** weeks. At ~12 runs a day the pacing sim finishes everything in about 5.4 weeks (dedicated ~3.3, casual ~8.9); the first upgrade costs about 1.5 runs and early upgrades arrive nearly every run (see `SIM_RESULTS.md`).
- **Saves:** localStorage autosave every 10 s, on tab hide and after key actions. More tab: base64 export/import and hard reset. A save from the old (v1, Cookie-Clicker-style) game is detected, reset, and a one-time notice is shown.

## Layout
- `js/data.js` - balance knobs (`BAL`), zones, abilities, and the three node tables with auto-laid-out map positions (UMD, Node-safe)
- `js/costs.js` - **generated** per-level Garden costs (see calibration)
- `js/core.js` - pure logic: stats, headless run engine, upgrades, prestige, save format (UMD)
- `js/fx.js` starfield, zone orb, particles/popups - `js/map.js` pan/zoom SVG node map - `js/game.js` run screen - `js/ui.js` tabs, sheets, saving, PWA registration
- `sim/pacing.js` + `sim/bot.js` - pacing simulation; `sim/test-autopop.js` - fairness tests (`node sim/test-autopop.js`); `tools/calibrate.js` - cost calibrator; `tools/make-icons.js` - regenerates `icons/`
- `sw.js` + `manifest.webmanifest` - PWA. **Bump `CACHE` in `sw.js` and list any new file in `ASSETS` on every release** (currently `seedling-cosmos-v5`).

## Balance tooling
- `node sim/pacing.js` drives the real run engine with a bot (tap rate, precision, reaction time, ability use), plays N sessions/day, shops greedily, prestiges with a human-like rule, and writes `SIM_RESULTS.md` (first runs and rewards, time between purchases, per-week progress, prestige timeline, completion time per player type). Options: `--days= --seed= --sessions= --runs= --taps= --precision= --quick --brief --noprestige --set=KNOB=value` (any `BAL` knob).
- `node tools/calibrate.js` rewrites `js/costs.js`: it walks the Garden in intended order, measures the bot's income per run in that exact state, and sets cost = income x a "runs to afford" schedule that starts at ~1.5 runs for the opening upgrades and eases down to ~0.7 runs, so cheap upgrades keep compounding. Re-run it after changing node effects, zone multipliers or the bot, then re-run the sim.
- Prestige gains scale with the order of magnitude reached (log-depth for Seeds, square root for Cores), so currency stays bounded and tree costs can be balanced against it.

## Checks
`node sim/test-autopop.js` (auto-pop/hammer combo + score parity, manual taps never blocked, no hazard targets, hammer branch connected)

`for f in js/*.js sw.js sim/*.js tools/*.js; do node --check $f; done`
