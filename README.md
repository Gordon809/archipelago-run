# Archipelago Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Gordon809/archipelago-run/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Gordon809/archipelago-run/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

Fly the dawn mail run across four island legs in **Archipelago Run**, an original 2D side-view flight game that runs in a desktop browser from static files, no network needed.

Take off from a lit runway, thread golden rings for fuel and points, mind your throttle and pitch, and grease every landing — then do it again at noon, at dusk, and at night, with the wind picking up each leg.

## How to play

- **↑ / ↓ (W / S)** — pitch up / down
- **→ / ← (D / A)** — throttle up / down
- **F** — flaps (more lift, more drag: your friend on final approach)
- **SPACE** — brake
- **P** — pause, **M** — mute, **R** — restart leg, **Enter** — start / continue
- Mouse: click the on-screen buttons.

## The flying

- **Stall discipline:** below stall speed the mail plane sinks — keep the speed up, or drop the flaps.
- **Fuel:** burns with throttle. Rings give +14% fuel; a smooth landing refills the tank.
- **Damage:** hard landings hurt. Terrain and water end the sortie — three lives per tour.
- **Score:** rings pay 100 × combo, smooth landings up to +300, each leg +250. High score is kept in localStorage.
- **Instruments:** the lit panel shows an artificial horizon, airspeed and altimeter dials, fuel and throttle — plus altitude, speed and heading on the HUD.

## Build

- `game/` — plain static files: `index.html` + ES modules under `game/src/` (one job per file), no libraries, no network requests.
- `main.ts` — copies `game/` and `screenshots/` to `/output` and writes `dossier.json` (Node 22 stdlib only).
- Sounds are synthesised with WebAudio (engine drone, wind, ring chimes, touchdown, crash) — no audio files.

Made for the [best flight game bounty](https://make.fun/c/best-flight-game-20261126-0057) on make.fun. Play it via my referral: https://make.fun/r/5g7k5t7n
