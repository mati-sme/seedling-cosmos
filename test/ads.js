// Rewarded-ad offer test (mobile + desktop). Serve the repo (python3 -m http.server 8766) then: node test/ads.js [url]
// Plays real runs by tapping targets on the run canvas (real pointer events), then checks the receipt:
// no offer on the first runs, offer later, "No thanks" leaves Stardust unchanged, closing the mock early gives nothing,
// watching to the end doubles the run's Stardust exactly once (saved in S.pending, survives reload), settings toggle hides it.
const { chromium } = require('playwright-core');
const URL = process.argv[2] || 'http://localhost:8766/';
const VPS = [
  { name: 'mobile', opts: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 800 } } },
];
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const vp of VPS) {
    const P = `[ads ${vp.name}] `;
    const ctx = await browser.newContext(vp.opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    const r = await page.goto(URL, { waitUntil: 'load' });
    ok(r.status() === 200, P + 'page 200');
    await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(500);
    const ev = (fn, a) => page.evaluate(fn, a);
    const playRun = async () => {
      await page.click('#nav button[data-tab=play]'); await page.waitForTimeout(200);
      await page.click('#btn-start');
      // tap the nearest live target through the canvas (same path as a finger), about 6 taps/s
      await ev(() => {
        clearInterval(window.__tap);
        window.__tap = setInterval(() => {
          const run = window.__SC.game.getRun(); if (!run || run.over || !run.targets.length) return;
          const t = run.targets.find((x) => !x.hazard) || run.targets[0], cv = document.getElementById('run-canvas'), b = cv.getBoundingClientRect();
          const o = { clientX: b.left + t.x * b.width, clientY: b.top + t.y * b.width, bubbles: true, pointerId: 1, isPrimary: true };
          cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o));
        }, 160);
      });
      await page.waitForSelector('#summary:not([hidden])', { timeout: 60000 });
      await ev(() => clearInterval(window.__tap));
      await page.waitForTimeout(1400); // receipt count-up
      return ev(() => { const S = window.__SC.S; return { total: S.pending.total, stardust: S.stardust, runs: S.runs, offer: !document.getElementById('sum-ad').hidden }; });
    };
    const collect = async () => { await page.click('#sum-spend'); await page.waitForTimeout(500); };

    ok(await ev(() => !!window.Ads && window.Ads.backend() === 'mock' && window.Ads.isAvailable()), P + 'Ads module loaded (mock backend, available)');
    const r1 = await playRun();
    ok(r1.runs === 0 && !r1.offer, P + `no offer on the very first run (earned ${r1.total})`);
    await collect();
    const r2 = await playRun();
    ok(!r2.offer, P + `no offer on the second run (earned ${r2.total})`);
    await collect();
    // run 3: offer, decline
    const r3 = await playRun();
    ok(r3.runs === 2 && r3.offer, P + `offer appears on run 3 (earned ${r3.total})`);
    const btn = await ev(() => { const a = document.getElementById('sum-ad-yes').getBoundingClientRect(), b = document.getElementById('sum-ad-no').getBoundingClientRect(); return { a: [a.width, a.height], b: [b.width, b.height], txt: document.getElementById('sum-ad').innerText }; });
    ok(Math.abs(btn.a[0] - btn.b[0]) < 2 && Math.abs(btn.a[1] - btn.b[1]) < 2 && /No thanks/.test(btn.txt) && /2× Stardust/.test(btn.txt), P + `"Watch ad" and "No thanks" are the same size (${btn.a.map(Math.round)} vs ${btn.b.map(Math.round)})`);
    if (process.env.SHOT && vp.name === 'mobile') await page.screenshot({ path: process.env.SHOT });
    await page.click('#sum-ad-no'); await page.waitForTimeout(200);
    const d = await ev(() => ({ total: window.__SC.S.pending.total, hidden: document.getElementById('sum-ad').hidden, ad: !!document.getElementById('ad-mock') }));
    ok(d.total === r3.total && d.hidden && !d.ad, P + `"No thanks" hides the card, no ad, run total unchanged (${d.total})`);
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1500);
    ok(await ev(() => document.getElementById('sum-ad').hidden && !document.getElementById('summary').hidden), P + 'declined offer stays declined after a reload (receipt restored, no card)');
    await collect();
    ok(await ev(() => window.__SC.S.stardust) === r3.stardust + r3.total, P + 'collecting after "No thanks" banks exactly the normal amount (no penalty)');
    // run 4: close early -> nothing; watch to end -> 2x once
    const r4 = await playRun();
    ok(r4.offer, P + `offer appears again on run 4 (earned ${r4.total})`);
    await page.click('#sum-ad-yes'); await page.waitForTimeout(300);
    const mock = await ev(() => { const m = document.getElementById('ad-mock'); return m && { label: m.innerText.includes('Sample ad (test)'), count: document.getElementById('ad-mock-count').textContent }; });
    ok(mock && mock.label, P + `mock ad shows "Sample ad (test)" with a countdown (${mock && mock.count})`);
    await page.waitForTimeout(1000); await page.click('#ad-mock-close'); await page.waitForTimeout(300);
    const e1 = await ev(() => ({ total: window.__SC.S.pending.total, ad: !!document.getElementById('ad-mock'), yes: !document.getElementById('sum-ad-yes').disabled, card: !document.getElementById('sum-ad').hidden }));
    ok(e1.total === r4.total && !e1.ad && e1.yes && e1.card, P + 'closing the ad early gives no reward (total unchanged, offer still there)');
    await page.click('#sum-ad-yes');
    await page.waitForSelector('#ad-mock-done', { state: 'visible', timeout: 9000 });
    ok(await ev(() => window.__SC.S.pending.total) === r4.total, P + 'no reward before the ad finishes');
    await page.click('#ad-mock-done'); await page.waitForTimeout(300);
    const g = await ev(() => ({ total: window.__SC.S.pending.total, bonus: window.__SC.S.pending.adBonus, shown: document.getElementById('sum-total').textContent, txt: document.getElementById('sum-ad').innerText }));
    ok(g.total === r4.total * 2 && g.bonus === r4.total && /Bonus/.test(g.txt), P + `watching to the end doubles the run: ${r4.total} -> ${g.total} (receipt shows ${g.shown})`);
    await ev(() => window.__SC.watchAd()); await page.waitForTimeout(400);
    ok(await ev((t) => window.__SC.S.pending.total === t && !document.getElementById('ad-mock'), g.total), P + 'a second claim for the same run is refused');
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1500);
    const g3 = await ev(() => ({ total: window.__SC.S.pending && window.__SC.S.pending.total, card: !document.getElementById('sum-ad').hidden }));
    ok(g3.total === g.total && !g3.card, P + 'doubled receipt survives a reload and is not offered again');
    await collect();
    ok(await ev(() => window.__SC.S.stardust) === r4.stardust + g.total, P + `collect banks the doubled amount once (+${g.total})`);
    // settings toggle
    await page.click('#nav button[data-tab=more]'); await page.waitForTimeout(300);
    ok(await ev(() => document.getElementById('set-adsOffer').checked), P + '"Offer reward ads" setting is on by default');
    await page.click('#set-adsOffer'); await page.waitForTimeout(100);
    await ev(() => { window.Ads.CONFIG.minReward = 0; window.Ads.CONFIG.minFracOfBest = 0; }); // only the toggle can block run 5
    const r5 = await playRun();
    ok(!r5.offer && await ev(() => window.__SC.S.settings.adsOffer === false), P + `toggle off: no offer on run 5 (earned ${r5.total})`);
    ok(errors.length === 0, P + 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await ctx.close();
  }
  await browser.close();
})();
