// Archipelago Run — shots.js
// Screenshot scenes (?shot=start|ring|landing|dusk). Each scene sets the
// game to a fixed, composed state and freezes it so Playwright captures a
// clean frame. The game loop calls applyShot(state) once at boot when a
// shot parameter is present; window.__shotReady is set when the first
// frozen frame has been drawn.

export const SHOT_NAMES = ["start", "ring", "landing", "dusk"];

// state: the live game state object from main.js. Returns true if a shot
// scene was applied (game is frozen for the screenshot).
export function applyShot(state, params) {
  const shot = params.get("shot");
  if (!shot || !SHOT_NAMES.includes(shot)) return false;

  const conf = {
    start: { leg: 0, x: 150, alt: 12, speed: 42, throttle: 85, pitch: 6, fuel: 96, score: 0, combo: 0, msg: "LEG 1 — FIRST LIGHT", msgT: 2.5, airborne: false },
    ring: { leg: 1, x: 3850, alt: 335, speed: 78, throttle: 72, pitch: 4, fuel: 81, score: 1240, combo: 3, msg: "RING 3/6!", msgT: 1.6, airborne: true },
    landing: { leg: 2, x: 8650, alt: 64, speed: 50, throttle: 28, pitch: -5, fuel: 44, score: 3480, combo: 2, msg: "FINAL APPROACH", msgT: 2.5, airborne: true },
    dusk: { leg: 2, x: 5300, alt: 330, speed: 84, throttle: 78, pitch: 8, fuel: 29, score: 4210, combo: 5, msg: "LOW FUEL — RING AHEAD", msgT: 2.5, airborne: true },
  }[shot];

  state.mode = "shot";
  state.shotName = shot;
  state.legIndex = conf.leg;
  state.loadLeg(conf.leg);
  const p = state.plane;
  p.x = conf.x;
  p.alt = conf.alt;
  p.speed = conf.speed;
  p.throttle = conf.throttle;
  p.pitch = conf.pitch;
  p.fuel = conf.fuel;
  p.airborne = conf.airborne;
  p.vspeed = conf.airborne ? 1.5 : 0;
  p.flaps = shot === "landing";
  state.score = conf.score;
  state.combo = conf.combo;
  state.message = conf.msg;
  state.messageT = conf.msgT;
  // mark rings before the plane as already hit so the next ring is the one ahead
  if (shot === "ring") {
    state.rings.list.forEach((r, i) => {
      if (r.x < conf.x - 40) {
        r.state = "hit";
        state.rings.nextIndex = i + 1;
      }
    });
  }
  if (shot === "landing") {
    state.rings.list.forEach((r) => (r.state = "hit"));
    state.rings.nextIndex = state.rings.list.length;
  }
  if (shot === "dusk") {
    state.rings.list.forEach((r, i) => {
      if (r.x < conf.x - 40) {
        r.state = "hit";
        state.rings.nextIndex = i + 1;
      }
    });
  }
  state.frozen = true;
  state.camX = conf.x - 380;
  return true;
}
