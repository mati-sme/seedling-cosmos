Rework this mobile incremental game (vanilla JS PWA, deployed via GitHub Pages from this repo root). Owner feedback: it feels like Cookie Clicker. Redesign the core loop:
- Timed runs (30-90s, extendable by upgrades) where the player actively taps/acts (e.g. tap moving targets/resources, combos, active abilities). Run ends -> summary screen -> collect currency -> spend.
- ONLY upgrades. No repeatedly buying generators/helpers.
- Upgrades shown as a visual MAP/tree: pannable (touch drag) and pinch-zoomable node graph, nodes connected by lines, states locked/available/purchased/maxed visible, future nodes greyed. Upgrades extend run time, boost yield, unlock new mechanics/zones/active abilities. Aim ~60-100 nodes.
- Prestige as its own separate visual map/tree, with 2 prestige layers if sensible.
- Very long (weeks of play), satisfying juice (particles, screen shake, number popups, combo feedback), mobile-first portrait, PWA, autosave to localStorage, export/import save.
- Theme: cosmic garden or anything fun, your choice.
- Old saves: detect old save format, reset, show a one-time notice.
- Bump the service worker cache version in sw.js and make sure all new files are in the cache list.
- Write/replace the pacing sim in sim/ (node) modelling a reasonable active player (runs/day, taps efficiency) and output to SIM_RESULTS.md: time of first runs and their rewards, time between upgrade purchases (constant visible progress), time to full map completion (should be weeks, e.g. 3-6 weeks at a few sessions/day). Tune balance until targets are met. Run it with node.
- Make sure there are no JS syntax errors (node --check each file).
Do not git commit or push; I will. Update README.md.
