Build a complete, original mobile-browser incremental/idle game called "Seedling Cosmos" in THIS directory as a static site (index.html, style.css, js files, manifest.webmanifest, sw.js, icons as SVG/PNG generated). No build step, no external paid APIs, vanilla JS. English UI. Mobile-first portrait, touch friendly.
Theme: player tends a single cosmic seed that grows into a living planet garden, then a star system, nebula, galaxy (zones: Seed Pod, Sprout Moon, Garden Planet, Bloom System, Nebula Grove, Galactic Arbor, Cosmic Canopy, ... at least 8 zones). Not mining.
Requirements:
- Core loop: tap the seed/planet to earn Stardust; buy upgrades; idle income.
- Multiple resources (Stardust, Sap, Pollen, Starlight etc.), unlocked gradually.
- 50+ upgrades across tiers, exponential cost curves (growth ~1.12-1.2) tuned so full progression takes WEEKS of play.
- Automation/helpers (e.g. Firefly gardeners, Moth pollinators, auto-tappers, auto-buy unlocks).
- Offline progress (capped, with a welcome-back summary).
- Two+ prestige layers with permanent upgrade trees: "Rebloom" (Seeds of Memory) and "Supernova" (Star Cores), optionally a third "Big Bloom". Prestige requirements scale so first rebloom ~1-2h, first supernova ~days.
- Achievements (40+), milestones that gradually unlock new mechanics/tabs.
- Big-number formatting (K, M, B, T, then aa/ab or scientific), handle numbers up to 1e308 via doubles or a simple log-based approach.
- Juice: tap feedback (scale bounce), particles, floating number popups, progress bars, unlock fanfare toasts/modals, subtle animated starfield background.
- PWA manifest + service worker (cache-first, relative paths since it is hosted at /seedling-cosmos/ on GitHub Pages).
- localStorage autosave every 10s + on visibility change, export/import save as base64 text, hard reset with confirm.
- Put the game balance/data and the pure simulation-friendly logic in a module usable from Node (e.g. js/data.js and js/core.js with UMD or plain globals plus `if (typeof module!=='undefined') module.exports=...`).
- Also write sim/pacing.js (Node) that simulates a reasonable player strategy (tapping a few times/sec while active for early game, buying cheapest-best upgrades, prestiging when sensible) and prints time to key milestones: first upgrade, each zone, first rebloom, first supernova, game completion. Tune the balance until: first upgrade < 15s, something new every minute or two in first 30 min, first rebloom 45-120 min, first supernova several days, full completion > 3 weeks of simulated play. Run it and include its output in SIM_RESULTS.md.
- Run `node --check` on every js file. Fix all errors.
- README.md short.
Do not ask questions; finish everything autonomously.
