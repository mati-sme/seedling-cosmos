Generated with `node sim/pacing.js` (deterministic bot; see header of sim/pacing.js for the player model).

# Seedling Cosmos pacing simulation

Simulated player: 2h continuous play, then 4 x 12 min sessions/day; offline cap/efficiency per in-game upgrades.
Balance knobs: {"TAP_BASE":1,"ACH_BONUS":0.01,"MEM_BONUS":0.5,"MEM_EXP":0.5,"CORE_BONUS":1,"CORE_EXP":0.5,"RE_REQ":160000000000,"RE_EXP":0.3,"RE_K":5,"SN_REQ":1000000,"SN_SCALE":1.35,"SN_EXP":0.6,"SN_K":6,"OFF_CAP":14400,"OFF_EFF":0.5,"COST_R":13,"OUT_R":7.2,"BASE_COST":15,"BASE_OUT":0.3,"GROWTH":1.15,"SAP_EXP":0.15,"POL_EXP":0.12,"SL_EXP":0.1}

## Key milestones (simulated wall-clock time)
- First helper bought:  9s
- First upgrade bought: 7s
- Zone 0 Seed Pod        reached: 0s
- Zone 1 Sprout Moon     reached: 2m 0s
- Zone 2 Garden Planet   reached: 10m 45s
- Zone 3 Bloom System    reached: 30m 50s
- Zone 4 Nebula Grove    reached: 47m 4s
- Zone 5 Galactic Arbor  reached: 23h 6m
- Zone 6 Cosmic Canopy   reached: 7d 14h 0m
- Zone 7 Void Orchard    reached: 21d 8h 0m
- Zone 8 Eternal Meadow  reached: 25d 19h 6m
- Zone 9 The Worldtree   reached: 31d 14h 1m
- First Rebloom:        48m 21s
- First Supernova:      3d 23h 7m
- Game completion (The Worldtree): 31d 14h 1m  (31.6 days)

Total reblooms: 500, supernovas: 17, achievements: 67/73, upgrades bought (lifetime): 35772
First 10 reblooms at: 48m 21s, 1h 6m, 1h 18m, 1h 30m, 1h 41m, 1h 53m, 8h 0m, 8h 10m, 14h 2m, 23h 6m
Supernovas at: 3d 23h 7m, 5d 8h 0m, 6d 8h 0m, 7d 19h 0m, 8d 8h 3m, 8d 23h 9m, 10d 19h 0m, 12d 19h 0m, 15d 8h 1m, 18d 19h 0m

## First 30 minutes: 56 unlock events (zones, milestones, achievements, new helpers, upgrades); longest quiet gap 2m 7s
Zone arrivals in first 30 min: 2m 0s, 10m 45s

## Daily snapshots
day   1: zone 5 (Galactic Arbor), reblooms 18, seeds(cycle) 25.91K, supernovas 0, cores 0, run zone 4, sd/s 4.31T, best run sd 95.72ab
day   2: zone 5 (Galactic Arbor), reblooms 24, seeds(cycle) 332.83K, supernovas 0, cores 0, run zone 5, sd/s 76.48ab, best run sd 4.38ad
day   3: zone 5 (Galactic Arbor), reblooms 26, seeds(cycle) 898.41K, supernovas 0, cores 0, run zone 5, sd/s 101.87ab, best run sd 17.21ad
day   4: zone 5 (Galactic Arbor), reblooms 27, seeds(cycle) 0, supernovas 1, cores 7, run zone 4, sd/s 200.31M, best run sd 49.26ad
day   5: zone 5 (Galactic Arbor), reblooms 53, seeds(cycle) 558.17K, supernovas 1, cores 7, run zone 5, sd/s 2.08ac, best run sd 229.39ad
day   6: zone 5 (Galactic Arbor), reblooms 80, seeds(cycle) 773.58K, supernovas 2, cores 13, run zone 5, sd/s 6.03ac, best run sd 735.02ad
day   7: zone 5 (Galactic Arbor), reblooms 107, seeds(cycle) 2.44M, supernovas 3, cores 20, run zone 5, sd/s 9.07ac, best run sd 881.38ad
day   8: zone 6 (Cosmic Canopy), reblooms 138, seeds(cycle) 13.57M, supernovas 4, cores 31, run zone 6, sd/s 450.04ac, best run sd 3.76ae
day   9: zone 6 (Cosmic Canopy), reblooms 191, seeds(cycle) 2.46M, supernovas 6, cores 74, run zone 5, sd/s 353.88ac, best run sd 105.45ae
day  10: zone 6 (Cosmic Canopy), reblooms 198, seeds(cycle) 72.65M, supernovas 6, cores 74, run zone 6, sd/s 4.97ad, best run sd 328.57ae
day  11: zone 6 (Cosmic Canopy), reblooms 224, seeds(cycle) 45.30M, supernovas 7, cores 116, run zone 6, sd/s 16.94ad, best run sd 1.31af
day  12: zone 6 (Cosmic Canopy), reblooms 226, seeds(cycle) 123.10M, supernovas 7, cores 116, run zone 6, sd/s 28.33ad, best run sd 4.50af
day  13: zone 6 (Cosmic Canopy), reblooms 252, seeds(cycle) 97.97M, supernovas 8, cores 176, run zone 6, sd/s 80.94ad, best run sd 7.36af
day  14: zone 6 (Cosmic Canopy), reblooms 253, seeds(cycle) 192.66M, supernovas 8, cores 176, run zone 6, sd/s 163.95ad, best run sd 20.56af
day  15: zone 6 (Cosmic Canopy), reblooms 254, seeds(cycle) 316.38M, supernovas 8, cores 176, run zone 6, sd/s 239.41ad, best run sd 46.88af
day  16: zone 6 (Cosmic Canopy), reblooms 280, seeds(cycle) 260.82M, supernovas 9, cores 265, run zone 6, sd/s 536.79ad, best run sd 63.42af
day  17: zone 6 (Cosmic Canopy), reblooms 281, seeds(cycle) 427.81M, supernovas 9, cores 265, run zone 6, sd/s 984.55ad, best run sd 123.93af
day  18: zone 6 (Cosmic Canopy), reblooms 282, seeds(cycle) 641.76M, supernovas 9, cores 265, run zone 6, sd/s 1.37ae, best run sd 268.06af
day  19: zone 6 (Cosmic Canopy), reblooms 307, seeds(cycle) 174.72M, supernovas 10, cores 407, run zone 6, sd/s 2.16ae, best run sd 588.81af
day  20: zone 6 (Cosmic Canopy), reblooms 309, seeds(cycle) 941.25M, supernovas 10, cores 407, run zone 6, sd/s 4.21ae, best run sd 630.21af
day  21: zone 7 (Void Orchard), reblooms 310, seeds(cycle) 1.41B, supernovas 10, cores 407, run zone 7, sd/s 7.41ae, best run sd 873.82af
day  22: zone 7 (Void Orchard), reblooms 337, seeds(cycle) 1.24B, supernovas 11, cores 651, run zone 7, sd/s 134.96ae, best run sd 10.27ag
day  23: zone 7 (Void Orchard), reblooms 338, seeds(cycle) 2.91B, supernovas 11, cores 651, run zone 7, sd/s 313.51ae, best run sd 39.73ag
day  24: zone 7 (Void Orchard), reblooms 363, seeds(cycle) 7.35B, supernovas 12, cores 996, run zone 7, sd/s 1.17af, best run sd 140.68ag
day  25: zone 7 (Void Orchard), reblooms 386, seeds(cycle) 3.07B, supernovas 13, cores 1.58K, run zone 7, sd/s 4.29af, best run sd 530.98ag
day  26: zone 8 (Eternal Meadow), reblooms 440, seeds(cycle) 15.06B, supernovas 15, cores 4.05K, run zone 7, sd/s 213.16af, best run sd 3.43ah
day  27: zone 8 (Eternal Meadow), reblooms 469, seeds(cycle) 37.56B, supernovas 16, cores 7.13K, run zone 8, sd/s 526.79af, best run sd 88.48ah
day  28: zone 8 (Eternal Meadow), reblooms 470, seeds(cycle) 92.85B, supernovas 16, cores 7.13K, run zone 8, sd/s 1.20ag, best run sd 152.59ah
day  29: zone 8 (Eternal Meadow), reblooms 498, seeds(cycle) 112.10B, supernovas 17, cores 11.43K, run zone 8, sd/s 1.20ag, best run sd 181.96ah
day  30: zone 8 (Eternal Meadow), reblooms 499, seeds(cycle) 184.13B, supernovas 17, cores 11.43K, run zone 8, sd/s 2.15ag, best run sd 274.56ah
day  31: zone 8 (Eternal Meadow), reblooms 500, seeds(cycle) 276.20B, supernovas 17, cores 11.43K, run zone 8, sd/s 2.99ag, best run sd 590.99ah

(simulated 194570 active ticks in 106.5s of CPU time)
