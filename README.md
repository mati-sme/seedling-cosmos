# Seedling Cosmos

A mobile-first incremental/idle game: tend one cosmic seed until it grows into a planet garden, a star system, a nebula and a galaxy.
Vanilla JS, no build step, installable PWA.

- **Play:** open `index.html` through any static server (e.g. `python3 -m http.server`), or host the folder at `/seedling-cosmos/` on GitHub Pages.
- **Loop:** tap the seed for Stardust, hire helpers, buy upgrades, unlock Sap / Pollen / Starlight, 10 zones, 73 achievements.
- **Prestige:** Rebloom (Seeds of Memory tree) and Supernova (Star Core constellation).
- **Saves:** localStorage autosave every 10s and on tab hide; Settings has base64 export/import and hard reset.

## Layout
- `js/data.js` – balance and content (UMD, Node-safe) · `js/core.js` – pure game logic (UMD) · `js/fx.js` – canvas effects · `js/ui.js` – UI/game loop
- `sim/pacing.js` – pacing simulation (`node sim/pacing.js`); results in `SIM_RESULTS.md`. Tweak knobs with `--set=SN_SCALE=1.4 --zone=7:1e33`.
- `tools/make-icons.js` – regenerates `icons/` · `sw.js` + `manifest.webmanifest` – PWA (bump `CACHE` in `sw.js` on release)
