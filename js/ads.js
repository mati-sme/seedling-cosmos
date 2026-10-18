/* ads.js - tiny shared rewarded-ads module (identical file in Deep Buddies, Glimmerwild and Seedling Cosmos).
 *
 * Game-facing API (the games only ever use these; swapping the backend needs no game changes):
 *   Ads.isAvailable()               -> boolean   can a rewarded ad be shown right now?
 *   Ads.showRewarded(placement)     -> Promise<{ rewarded: boolean }>   resolves rewarded:true ONLY if the ad was watched to the end
 *   Ads.shouldOffer({ enabled, runsBefore, reward, best, claimed }) -> boolean   shared "should we offer it this round?" policy
 *   Ads.CONFIG                      offer frequency, mock length, AdMob ids (see below)
 *
 * Backends:
 *   - Mock (default, web/PWA): a full-screen overlay labelled "Sample ad (test)" with a 5 s countdown and a Close button.
 *     The countdown pauses while the tab is hidden. Closing early resolves { rewarded: false }.
 *   - AdMob (later): picked automatically when the game runs inside a Capacitor native app (window.Capacitor.isNativePlatform())
 *     that has @capacitor-community/admob installed (npm i @capacitor-community/admob && npx cap sync).
 *     It is reached through window.Capacitor.Plugins.AdMob, so no bundler or import is needed.
 *
 * TODO(AdMob): before publishing a native build
 *   1. Put your real REWARDED ad unit ids in CONFIG.admob.rewardedId below (AdMob console > Apps > Ad units > Rewarded),
 *      and set CONFIG.admob.isTesting = false. The defaults are Google's official TEST ids, which are always safe to use:
 *        Android rewarded test id: ca-app-pub-3940256099942544/5224354917
 *        iOS     rewarded test id: ca-app-pub-3940256099942544/1712485313
 *   2. Put the AdMob APPLICATION id (not an ad unit id) in AndroidManifest.xml (com.google.android.gms.ads.APPLICATION_ID)
 *      and Info.plist (GADApplicationIdentifier). Google's sample app ids: Android ca-app-pub-3940256099942544~3347511713,
 *      iOS ca-app-pub-3940256099942544~1458002511.
 *   3. These games are kid-friendly: keep childDirected = true and maxAdContentRating = 'General' unless the store
 *      listing says otherwise, and review Google Play Families / Apple Kids-category ad rules (certified ad SDKs only).
 */
(function (root) {
  'use strict';
  const CONFIG = {
    // ---- offer policy (shared by all three games) ----
    offerEveryNRuns: 1,    // frequency: 1 = offer on every eligible round, 2 = every other round, ...
    skipFirstRuns: 2,      // never offer on the player's first N rounds
    minReward: 3,          // never offer for a round that earned less than this...
    minFracOfBest: 0.1,    // ...or less than this fraction of the player's best round
    // ---- mock ----
    mock: true,            // web/PWA builds use the mock overlay (set false to hide offers entirely on the web)
    mockSeconds: 5,
    // ---- AdMob (native Capacitor builds) ----
    admob: {
      rewardedId: {
        android: 'ca-app-pub-3940256099942544/5224354917', // TODO(AdMob): real Android rewarded unit id (this is Google's TEST id)
        ios: 'ca-app-pub-3940256099942544/1712485313',     // TODO(AdMob): real iOS rewarded unit id (this is Google's TEST id)
      },
      isTesting: true,               // TODO(AdMob): false for release builds
      childDirected: true,           // COPPA tagForChildDirectedTreatment
      underAgeOfConsent: true,       // GDPR TFUA tag
      maxAdContentRating: 'General',
    },
  };

  let busy = null; // the promise of the ad currently showing (never two at once)

  /* ---------- AdMob backend (Capacitor) ---------- */
  const cap = () => root.Capacitor;
  const admob = () => {
    const c = cap();
    return c && typeof c.isNativePlatform === 'function' && c.isNativePlatform() && c.Plugins && c.Plugins.AdMob || null;
  };
  let initP = null;
  function admobInit(A) {
    if (initP) return initP;
    const o = CONFIG.admob;
    initP = (async () => {
      try { // UMP consent (GDPR etc.). If it can't be requested we still try to initialize; canRequestAds=false stops us.
        let ci = await A.requestConsentInfo({ tagForUnderAgeOfConsent: o.underAgeOfConsent });
        if (ci && ci.isConsentFormAvailable && ci.status === 'REQUIRED') ci = await A.showConsentForm();
        if (ci && ci.canRequestAds === false) { initP = null; return false; }
      } catch (e) { /* consent API unavailable: continue */ }
      await A.initialize({ initializeForTesting: o.isTesting, tagForChildDirectedTreatment: o.childDirected, tagForUnderAgeOfConsent: o.underAgeOfConsent, maxAdContentRating: o.maxAdContentRating });
      return true;
    })().catch(() => { initP = null; return false; });
    return initP;
  }
  async function showAdmob(A, placement) {
    if (!(await admobInit(A))) return { rewarded: false, reason: 'no-consent' };
    const o = CONFIG.admob, ios = cap().getPlatform && cap().getPlatform() === 'ios';
    const handles = [];
    let rewarded = false;
    const on = async (ev, fn) => { try { handles.push(await A.addListener(ev, fn)); } catch (e) { /* ignore */ } };
    try {
      await on('onRewardedVideoAdReward', () => { rewarded = true; });
      let finish; const closed = new Promise((r) => { finish = r; });
      await on('onRewardedVideoAdDismissed', () => finish());
      await on('onRewardedVideoAdFailedToShow', () => finish());
      await A.prepareRewardVideoAd({ adId: ios ? o.rewardedId.ios : o.rewardedId.android, isTesting: o.isTesting, npa: o.childDirected });
      A.showRewardVideoAd().then(() => { rewarded = true; }, () => finish()); // resolves when the reward is earned
      await closed;
      await new Promise((r) => setTimeout(r, 250)); // the reward event can land just after dismiss
    } catch (e) {
      return { rewarded: false, reason: 'error' };
    } finally {
      handles.forEach((h) => { try { h.remove(); } catch (e) { /* ignore */ } });
    }
    return { rewarded, placement };
  }

  /* ---------- mock backend (web) ---------- */
  const CSS = `
#ad-mock{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(8,10,24,.94);font:600 16px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;touch-action:none;user-select:none;-webkit-user-select:none}
#ad-mock .ad-box{position:relative;width:min(92vw,420px);max-height:92vh;padding:22px 20px 18px;border-radius:22px;background:linear-gradient(160deg,#3b2a8a,#1c6b8a);box-shadow:0 12px 40px rgba(0,0,0,.5);text-align:center}
#ad-mock .ad-tag{position:absolute;top:12px;left:14px;padding:3px 9px;border-radius:999px;background:#ffd84a;color:#2a1a00;font-size:12px;font-weight:800;letter-spacing:.02em}
#ad-mock .ad-x{position:absolute;top:8px;right:10px;min-width:44px;height:44px;border:0;border-radius:12px;background:rgba(255,255,255,.16);color:#fff;font-size:15px;font-weight:800;cursor:pointer;padding:0 12px}
#ad-mock .ad-art{font-size:64px;margin:34px 0 6px;animation:adbob 1.2s ease-in-out infinite alternate}
#ad-mock h3{margin:4px 0 6px;font-size:21px}
#ad-mock p{margin:0 0 12px;opacity:.9;font-size:15px}
#ad-mock .ad-bar{height:12px;border-radius:99px;background:rgba(255,255,255,.18);overflow:hidden;margin:6px 0 8px}
#ad-mock .ad-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7dff8a,#ffd84a);border-radius:99px}
#ad-mock .ad-count{font-size:14px;opacity:.95;min-height:20px}
#ad-mock .ad-done{display:none;margin-top:12px;width:100%;min-height:52px;border:0;border-radius:14px;background:#7dff8a;color:#0d3a12;font-size:18px;font-weight:900;cursor:pointer}
#ad-mock.done .ad-done{display:block}
#ad-mock.done .ad-x{display:none}
@keyframes adbob{from{transform:translateY(0) rotate(-4deg)}to{transform:translateY(-8px) rotate(4deg)}}
@media (prefers-reduced-motion:reduce){#ad-mock .ad-art{animation:none}}`;
  function showMock(placement) {
    return new Promise((resolve) => {
      const doc = root.document;
      if (!doc.getElementById('ad-mock-css')) { const st = doc.createElement('style'); st.id = 'ad-mock-css'; st.textContent = CSS; doc.head.appendChild(st); }
      const el = doc.createElement('div');
      el.id = 'ad-mock'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Sample ad (test)');
      el.dataset.placement = placement || '';
      el.innerHTML = '<div class="ad-box"><span class="ad-tag">Sample ad (test)</span>' +
        '<button class="ad-x" id="ad-mock-close" aria-label="Close the ad (no bonus)">✕ Close</button>' +
        '<div class="ad-art">🎬</div><h3>This is a pretend ad</h3><p>A real game would show a short video here.</p>' +
        '<div class="ad-bar"><i></i></div><div class="ad-count" id="ad-mock-count"></div>' +
        '<button class="ad-done" id="ad-mock-done">🎁 Get my bonus!</button></div>';
      doc.body.appendChild(el);
      const bar = el.querySelector('.ad-bar i'), count = el.querySelector('#ad-mock-count');
      const total = Math.max(0.5, +CONFIG.mockSeconds || 5);
      let watched = 0, last = performance.now(), done = false, raf = 0, ended = false;
      const tick = (now) => {
        const dt = Math.min(0.25, (now - last) / 1000); last = now;
        if (!doc.hidden) watched += dt;
        const left = Math.max(0, total - watched);
        bar.style.width = Math.min(100, (watched / total) * 100).toFixed(1) + '%';
        if (left > 0) { count.textContent = 'Bonus in ' + Math.ceil(left) + '…'; raf = requestAnimationFrame(tick); }
        else { done = true; el.classList.add('done'); count.textContent = '🎉 All done, thanks for watching!'; el.querySelector('#ad-mock-done').focus(); }
      };
      raf = requestAnimationFrame(tick);
      const end = (rewarded) => {
        if (ended) return; ended = true;
        cancelAnimationFrame(raf); doc.removeEventListener('keydown', onKey, true); el.remove();
        resolve({ rewarded: !!rewarded, placement });
      };
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(done); } else if (e.key !== 'Tab') e.stopPropagation(); };
      doc.addEventListener('keydown', onKey, true);
      // stop taps/clicks/keys from reaching the game underneath
      ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'click', 'wheel'].forEach((t) => el.addEventListener(t, (e) => e.stopPropagation()));
      el.querySelector('#ad-mock-close').addEventListener('click', () => end(done));
      el.querySelector('#ad-mock-done').addEventListener('click', () => end(done));
      el.querySelector('#ad-mock-close').focus();
    });
  }

  /* ---------- public API ---------- */
  const Ads = {
    CONFIG,
    backend: () => (admob() ? 'admob' : CONFIG.mock ? 'mock' : 'none'),
    isAvailable: () => !busy && Ads.backend() !== 'none',
    isShowing: () => !!busy,
    showRewarded(placement) {
      if (busy) return Promise.resolve({ rewarded: false, reason: 'busy' });
      const A = admob();
      const p = A ? showAdmob(A, placement) : CONFIG.mock ? showMock(placement) : Promise.resolve({ rewarded: false, reason: 'unavailable' });
      busy = p.catch(() => ({ rewarded: false })).then((r) => { busy = null; return { rewarded: !!(r && r.rewarded) }; });
      return busy;
    },
    shouldOffer(o) {
      o = o || {};
      const runsBefore = o.runsBefore | 0, reward = +o.reward || 0, best = +o.best || 0;
      if (o.enabled === false || o.claimed || !Ads.isAvailable()) return false;
      if (runsBefore < CONFIG.skipFirstRuns) return false;
      if (reward < Math.max(CONFIG.minReward, best * CONFIG.minFracOfBest)) return false;
      const every = Math.max(1, CONFIG.offerEveryNRuns | 0);
      return (runsBefore - CONFIG.skipFirstRuns) % every === 0;
    },
  };
  root.Ads = Ads;
})(typeof window !== 'undefined' ? window : globalThis);
