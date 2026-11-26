// Archipelago Run — main.js
// Game bootstrap, loop, state machine, camera, scoring, collisions,
// leg flow, particles and screens. The plane always flies left to right
// over a seeded island chain; each leg ends with a runway landing.

import { VIEW_W, VIEW_H, LEGS, DAY_PHASES, SCORE, RING_RADIUS, PHYS, RUNWAY_HEIGHT } from "./config.js";
import { clamp, lerp } from "./random.js";
import { Input } from "./input.js";
import { AudioEngine } from "./audio.js";
import { Plane } from "./plane.js";
import { Terrain } from "./terrain.js";
import { Rings } from "./rings.js";
import { drawHUD, drawInstruments } from "./hud.js";
import { applyShot } from "./shots.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const input = new Input(canvas);
const audio = new AudioEngine();

const HIGH_KEY = "archipelago-run-high";

const state = {
  mode: "title", // title | playing | paused | crashed | legdone | gameover | tourcomplete | shot
  legIndex: 0,
  terrain: null,
  rings: null,
  plane: new Plane(),
  score: 0,
  combo: 0,
  lives: 3,
  high: 0,
  message: "",
  messageT: 0,
  camX: 0,
  time: 0,
  frozen: false,
  shotName: null,
  crashT: 0,
  legBonus: 0,
  landingBonus: 0,
  maxX: 0,
  particles: [],
  stallWarnT: 0,
  shake: 0,
  tourTime: 0,
};

try {
  state.high = Number(localStorage.getItem(HIGH_KEY) || 0) || 0;
} catch (e) {
  state.high = 0;
}

function saveHigh() {
  if (state.score > state.high) {
    state.high = state.score;
    try {
      localStorage.setItem(HIGH_KEY, String(state.high));
    } catch (e) {}
  }
}

// --- leg setup ---------------------------------------------------------------
state.loadLeg = function (i) {
  const leg = LEGS[i];
  state.terrain = new Terrain(i, leg);
  state.rings = new Rings(leg);
  state.leg = leg;
  state.phase = DAY_PHASES[leg.phase];
  state.combo = 0;
  state.maxX = 0;
  state.particles = [];
  state.plane.reset(leg.startRunway.x + 40, RUNWAY_HEIGHT);
  state.plane.throttle = 0;
  state.camX = state.plane.x - 380;
};

state.loadLeg(0);

function startLeg(i) {
  state.legIndex = i;
  state.loadLeg(i);
  state.mode = "playing";
  state.message = LEGS[i].name;
  state.messageT = 2.6;
}

function startGame() {
  state.score = 0;
  state.lives = 3;
  state.tourTime = 0;
  audio.unlock();
  startLeg(0);
}

function respawn() {
  const leg = LEGS[state.legIndex];
  state.plane.reset(leg.startRunway.x + 40, RUNWAY_HEIGHT);
  state.plane.fuel = 60;
  state.combo = 0;
  state.camX = state.plane.x - 380;
  state.mode = "playing";
  state.message = "BACK ON THE RUNWAY";
  state.messageT = 2;
}

// --- particles ---------------------------------------------------------------
function burst(x, y, n, colors, speed, life, size) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 20,
      life: life * (0.6 + Math.random() * 0.7),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color: colors[Math.floor(Math.random() * colors.length)],
      grav: 60,
    });
  }
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.grav * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

// --- crash / landing -----------------------------------------------------------
function crash(reason) {
  const p = state.plane;
  p.justLanded = false; // never re-score a landing after a crash/respawn
  state.mode = "crashed";
  state.crashT = 1.4;
  state.shake = 14;
  state.combo = 0;
  const ground = state.terrain.groundAt(p.x);
  const inWater = ground <= 0.5;
  if (inWater) {
    audio.splash();
    burst(p.x, 0, 40, ["#cfeefb", "#7ec2ee", "#ffffff"], 90, 0.9, 4);
  } else {
    audio.crash();
    burst(p.x, ground, 46, ["#ff7a3c", "#ffc84d", "#5a5a5a", "#2b2b2b"], 130, 1.1, 5);
  }
  state.message = reason === "water" ? "DITCHED IN THE SEA!" : "CRASHED!";
  state.messageT = 1.4;
}

function tryLanding() {
  const p = state.plane;
  const runway = state.terrain.isOnRunway(p.x);
  if (!runway) {
    const g = state.terrain.groundAt(p.x);
    if (g <= 0.5) {
      crash("water");
      return;
    }
    // flat ground short of the strip (beach / island top): a rough
    // landing, not a crash — damage, bounce, no points, no leg bonus
    if (g >= RUNWAY_HEIGHT - 1 && Math.abs(p.vspeed) <= 6.5 && p.speed <= 62) {
      p.damage += 20;
      audio.touchdown(false);
      burst(p.x, RUNWAY_HEIGHT, 18, ["#8a8a8a", "#ffc84d"], 70, 0.7, 4);
      state.shake = 8;
      if (p.damage >= 100) {
        crash("terrain");
        return;
      }
      p.speed *= 0.6;
      p.vspeed = 2.5;
      p.airborne = true;
      state.mode = "playing";
      state.message = "LANDED SHORT — GRASS!";
      state.messageT = 1.8;
      return;
    }
    crash("terrain");
    return;
  }
  const smooth = Math.abs(p.vspeed) <= 5.5 && Math.abs(p.pitch) <= 12 && p.speed <= 62;
  // A touchdown only counts after a real flight: bouncing on the runway
  // right after takeoff (or a stale flag) pays nothing.
  const legitFlight = state.airTime > 3;
  if (smooth && legitFlight) {
    const bonus = SCORE.landingBase + Math.round(SCORE.landingSmooth * (1 - Math.abs(p.vspeed) / 5.5) * (1 - Math.abs(p.pitch) / 24));
    state.landingBonus = bonus;
    state.score += bonus;
    audio.touchdown(true);
    burst(p.x, RUNWAY_HEIGHT, 14, ["#ffffff", "#e8d9a0"], 40, 0.6, 3);
    p.fuel = 100;
    p.damage = 0;
    if (runway === state.leg.endRunway) {
      state.legBonus = SCORE.legBonus;
      state.score += SCORE.legBonus;
      audio.legFanfare();
      state.mode = "legdone";
      state.message = `${state.leg.name} — COMPLETE!`;
      state.messageT = 3;
    } else {
      state.mode = "playing";
      state.message = `SMOOTH LANDING +${bonus}`;
      state.messageT = 2.2;
    }
  } else if (smooth) {
    // touch-and-go: refuel, no points, never completes a leg
    p.fuel = 100;
    p.damage = 0;
    state.mode = "playing";
    state.message = "TOUCH AND GO";
    state.messageT = 1.6;
  } else {
    // hard landing: damage, bounce, keep going if the plane survives
    p.damage += 30;
    audio.touchdown(false);
    burst(p.x, RUNWAY_HEIGHT, 20, ["#8a8a8a", "#ffc84d"], 70, 0.7, 4);
    state.shake = 8;
    if (p.damage >= 100) {
      crash("terrain");
      return;
    }
    p.speed *= 0.55;
    p.vspeed = 2.5;
    p.airborne = true;
    state.message = "HARD LANDING! DAMAGE +30";
    state.messageT = 1.8;
  }
}

// --- update ---------------------------------------------------------------------
function update(dt) {
  state.time += dt;
  state.tourTime += dt;
  const p = state.plane;

  if (input.hit("p", "P")) {
    if (state.mode === "playing") {
      state.mode = "paused";
    } else if (state.mode === "paused") {
      state.mode = "playing";
    }
  }
  if (input.hit("m", "M")) {
    audio.setMuted(!audio.muted);
  }
  if (input.hit("r", "R")) {
    if (state.mode === "gameover" || state.mode === "tourcomplete") startGame();
    else if (state.mode === "playing" || state.mode === "paused") startLeg(state.legIndex);
  }

  if (state.mode === "title") {
    // idle demo: plane parked, prop turning slowly
    p.propAngle += dt * 3;
    if (input.hit("Enter", " ")) {
      audio.click();
      startGame();
    }
    const b = input.buttons([{ x: 520, y: 470, w: 240, h: 64, id: "start" }]);
    if (b === "start") {
      audio.click();
      startGame();
    }
    return;
  }

  if (state.mode === "paused") {
    if (input.hit("Enter")) state.mode = "playing";
    return;
  }

  if (state.mode === "crashed") {
    state.crashT -= dt;
    updateParticles(dt);
    if (state.crashT <= 0) {
      state.lives -= 1;
      saveHigh();
      if (state.lives <= 0) {
        state.mode = "gameover";
      } else {
        respawn();
      }
    }
    return;
  }

  if (state.mode === "legdone") {
    updateParticles(dt);
    if (input.hit("Enter", " ")) {
      audio.click();
      if (state.legIndex + 1 >= LEGS.length) {
        state.mode = "tourcomplete";
        saveHigh();
      } else {
        startLeg(state.legIndex + 1);
      }
    }
    const b = input.buttons([{ x: 520, y: 470, w: 240, h: 64, id: "next" }]);
    if (b === "next") {
      audio.click();
      if (state.legIndex + 1 >= LEGS.length) {
        state.mode = "tourcomplete";
        saveHigh();
      } else {
        startLeg(state.legIndex + 1);
      }
    }
    return;
  }

  if (state.mode === "gameover" || state.mode === "tourcomplete") {
    if (input.hit("Enter", " ")) {
      audio.click();
      startGame();
    }
    const b = input.buttons([{ x: 520, y: 470, w: 240, h: 64, id: "again" }]);
    if (b === "again") {
      audio.click();
      startGame();
    }
    return;
  }

  if (state.mode !== "playing") return;

  // --- playing ---------------------------------------------------------------
  if (p.airborne) state.airTime += dt;
  else state.airTime = 0;
  const inp = {
    pitchUp: input.down("ArrowUp", "w"),
    pitchDown: input.down("ArrowDown", "s"),
    throttleUp: input.down("ArrowRight", "d"),
    throttleDown: input.down("ArrowLeft", "a"),
    brake: input.down(" "),
    flaps: input.hit("f", "F"),
  };
  if (input.hit("Enter")) audio.unlock();

  const events = p.update(dt, inp, state.leg.wind, (x) => state.terrain.groundAt(x));

  // distance score
  if (p.x > state.maxX) {
    const gained = Math.floor((p.x - state.maxX) / 100) * SCORE.distancePer100m;
    state.score += gained;
    state.maxX = p.x;
  }

  // stall warning
  if (events.stalled && p.airborne) {
    state.stallWarnT -= dt;
    if (state.stallWarnT <= 0) {
      audio.stallWarn();
      state.stallWarnT = 0.9;
    }
  }

  // rings
  const ringResult = state.rings.check(p.x, p.alt);
  if (ringResult === "hit") {
    state.combo = Math.min(state.combo + 1, 8);
    const pts = SCORE.ring * state.combo;
    state.score += pts;
    p.fuel = clamp(p.fuel + PHYS.ringFuel, 0, 100);
    audio.ring();
    state.message = state.combo > 1 ? `RING +${pts}  COMBO ×${state.combo}` : `RING +${pts}`;
    state.messageT = 1.4;
    burst(p.x, p.alt, 18, ["#ffc84d", "#fff3c4", "#35e08a"], 70, 0.8, 3.5);
  } else if (ringResult === "miss") {
    state.combo = 0;
    state.message = "RING MISSED";
    state.messageT = 1.2;
  }
  state.rings.update(dt);

  // exhaust puffs
  if (p.airborne && p.throttle > 20 && Math.random() < 0.5) {
    state.particles.push({
      x: p.x - 34, y: p.alt + 1,
      vx: -14 - Math.random() * 10, vy: (Math.random() - 0.5) * 8,
      life: 0.5, maxLife: 0.5, size: 3 + Math.random() * 2,
      color: "rgba(220,220,220,0.5)", grav: -8,
    });
  }
  // damage smoke
  if (p.damage > 0 && p.airborne && Math.random() < 0.3) {
    state.particles.push({
      x: p.x - 20, y: p.alt + 4,
      vx: -20, vy: -14,
      life: 0.9, maxLife: 0.9, size: 5,
      color: "rgba(60,60,60,0.55)", grav: -20,
    });
  }
  updateParticles(dt);

  // rolled off the runway into the sea
  if (!p.airborne && state.terrain.groundAt(p.x) <= 0.5 && p.speed > 8) {
    p.justLanded = false;
    crash("water");
    return;
  }

  // camera
  const targetCam = p.x - 380;
  state.camX += (targetCam - state.camX) * Math.min(1, 4 * dt);
  if (state.messageT > 0) state.messageT -= dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);

  audio.setFlight(p.throttle / 100, p.speed, p.airborne);

  // touchdown detection: plane.update() lands the plane when alt hits ground.
  // We detect the transition here via a flag set in update().
  if (p.justLanded) {
    p.justLanded = false;
    tryLanding();
  }
}

// plane.update sets justLanded on ground contact; patch it in via wrapper:
const _planeUpdate = state.plane.update.bind(state.plane);
state.plane.update = function (dt, inp, wind, groundAt) {
  const wasAir = this.airborne;
  const ev = _planeUpdate(dt, inp, wind, groundAt);
  if (wasAir && !this.airborne && this.alt <= groundAt(this.x) + 0.01) {
    this.justLanded = true;
  }
  return ev;
};

// --- drawing ---------------------------------------------------------------------
function planeScreenY() {
  const alt = state.plane.alt;
  return clamp(330 - (alt - 12) * 0.18, 200, 330);
}

function horizonY() {
  return Math.min(planeScreenY() + state.plane.alt * 0.92, 648);
}

function draw() {
  const p = state.plane;
  const phase = state.phase;
  const scale = 1;
  const hy = horizonY();
  const camX = state.camX + (state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0);

  state.terrain.draw(ctx, camX, scale, hy, phase, state.time);
  state.rings.draw(ctx, camX, scale, hy, state.time);

  // plane shadow on the ground/water
  const groundY = hy - state.terrain.groundAt(p.x) * scale;
  const shadowA = clamp(0.30 - (p.alt - state.terrain.groundAt(p.x)) * 0.0012, 0.04, 0.30);
  if (p.alt - state.terrain.groundAt(p.x) < 260) {
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowA.toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(380, groundY + 4, 34, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // particles (world space: pt.y is altitude in metres)
  for (const pt of state.particles) {
    const sx = 380 + (pt.x - p.x) * scale;
    const sy = hy - pt.y * scale;
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(sx, sy, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // plane
  const py = planeScreenY();
  ctx.save();
  ctx.translate(380, py);
  ctx.rotate((-p.pitch * Math.PI) / 180);
  p.draw(ctx, state.time);
  ctx.restore();

  // HUD + instruments (not during title; dimmed on overlays)
  if (state.mode !== "title") {
    drawHUD(ctx, {
      alt: p.alt,
      speedKts: p.speed * 1.94384,
      heading: 90,
      fuel: p.fuel,
      score: state.score,
      combo: state.combo,
      lives: state.lives,
      legName: state.leg.name,
      objective: state.rings.done
        ? `ALL RINGS DONE — LAND ${state.legIndex + 1 === LEGS.length ? "FINAL" : ""} RUNWAY  •  WIND ${state.leg.wind > 0 ? "+" : ""}${state.leg.wind} M/S`
        : `RING ${state.rings.nextIndex + 1}/${state.rings.list.length}  →  LAND RUNWAY ${state.legIndex + 1}  •  WIND ${state.leg.wind > 0 ? "+" : ""}${state.leg.wind} M/S`,
      message: state.message,
      messageT: state.messageT,
      stalled: p.airborne && p.speed < p.stallSpeed,
      lowFuel: p.fuel < 25,
    });
    drawInstruments(ctx, {
      pitch: p.pitch,
      speedKts: p.speed * 1.94384,
      altFt: p.alt * 3.28084,
      fuel: p.fuel,
      throttle: p.throttle,
      flaps: p.flaps,
      time: state.time,
    });
  }

  if (state.mode === "title") drawTitle();
  if (state.mode === "paused") drawPaused();
  if (state.mode === "legdone") drawLegDone();
  if (state.mode === "gameover") drawGameOver();
  if (state.mode === "tourcomplete") drawTourComplete();
}

function panel(x, y, w, h, title) {
  ctx.fillStyle = "rgba(8, 14, 28, 0.82)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 200, 80, 0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
  if (title) {
    ctx.fillStyle = "#ffc84d";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, x + w / 2, y + 30);
    ctx.textAlign = "left";
  }
}

function bigButton(x, y, w, h, label, hover) {
  ctx.fillStyle = hover ? "#ffd76a" : "#ffc84d";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.fillStyle = "#241a05";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + h / 2 + 8);
  ctx.textAlign = "left";
}

function drawTitle() {
  ctx.fillStyle = "rgba(8, 14, 28, 0.45)";
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffc84d";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("ISLAND MAIL SERVICE  •  EST. 1962", 640, 128);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 84px sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 18;
  ctx.fillText("ARCHIPELAGO RUN", 640, 222);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffe9a8";
  ctx.font = "20px sans-serif";
  ctx.fillText("Fly the dawn mail run across four island legs — thread the rings,", 640, 262);
  ctx.fillText("mind your fuel, and grease every landing.", 640, 290);
  ctx.fillStyle = "#cfe0f2";
  ctx.font = "17px sans-serif";
  ctx.fillText("↑ ↓  pitch      ← →  throttle      F  flaps      SPACE  brake      P  pause      M  mute", 640, 340);
  ctx.fillText("Fly through golden rings for fuel and points. Land smooth for a bonus.", 640, 368);
  ctx.fillText("Three lives. Four legs: dawn, noon, dusk and night.", 640, 394);
  const hover = input.hover({ x: 520, y: 470, w: 240, h: 64 });
  bigButton(520, 470, 240, 64, "▶  TAKE OFF", hover);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px monospace";
  ctx.fillText(state.high > 0 ? `HIGH SCORE  ${state.high}` : "NO FLIGHTS LOGGED YET — BE THE FIRST", 640, 570);
  ctx.textAlign = "left";
}

function drawPaused() {
  ctx.fillStyle = "rgba(8, 14, 28, 0.6)";
  ctx.fillRect(0, 0, 1280, 720);
  panel(440, 250, 400, 200, "PAUSED");
  ctx.fillStyle = "#ffffff";
  ctx.font = "17px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Press P or Enter to keep flying.", 640, 320);
  ctx.fillText("M mute   •   R restart leg", 640, 352);
  ctx.textAlign = "left";
}

function drawLegDone() {
  ctx.fillStyle = "rgba(8, 14, 28, 0.55)";
  ctx.fillRect(0, 0, 1280, 720);
  panel(390, 190, 500, 300, `${state.leg.name} — COMPLETE!`);
  ctx.fillStyle = "#ffffff";
  ctx.font = "20px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`LANDING BONUS   +${state.landingBonus}`, 640, 270);
  ctx.fillText(`LEG BONUS       +${state.legBonus}`, 640, 302);
  ctx.fillText(`SCORE           ${state.score}`, 640, 334);
  ctx.fillText(`FUEL REFILLED — TANK FULL`, 640, 366);
  ctx.fillStyle = "#ffe9a8";
  ctx.font = "18px sans-serif";
  const next = state.legIndex + 1 >= LEGS.length ? "TOUR COMPLETE" : `NEXT: ${LEGS[state.legIndex + 1].name}`;
  ctx.fillText(next, 640, 410);
  ctx.textAlign = "left";
  const hover = input.hover({ x: 520, y: 470, w: 240, h: 64 });
  bigButton(520, 470, 240, 64, state.legIndex + 1 >= LEGS.length ? "FINISH ▶" : "NEXT LEG ▶", hover);
}

function drawGameOver() {
  ctx.fillStyle = "rgba(20, 8, 8, 0.62)";
  ctx.fillRect(0, 0, 1280, 720);
  panel(390, 190, 500, 300, "OUT OF LIVES");
  ctx.fillStyle = "#ffffff";
  ctx.font = "20px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`FINAL SCORE   ${state.score}`, 640, 280);
  ctx.fillText(`HIGH SCORE    ${state.high}`, 640, 312);
  ctx.fillText(`LEGS FLOWN    ${state.legIndex} / 4`, 640, 344);
  ctx.fillStyle = "#ffe9a8";
  ctx.font = "18px sans-serif";
  ctx.fillText("The mail must go through — try again, pilot.", 640, 392);
  ctx.textAlign = "left";
  const hover = input.hover({ x: 520, y: 470, w: 240, h: 64 });
  bigButton(520, 470, 240, 64, "↻  FLY AGAIN", hover);
}

function drawTourComplete() {
  ctx.fillStyle = "rgba(8, 14, 28, 0.6)";
  ctx.fillRect(0, 0, 1280, 720);
  panel(340, 170, 600, 330, "TOUR COMPLETE — ALL FOUR LEGS!");
  ctx.fillStyle = "#ffffff";
  ctx.font = "22px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`FINAL SCORE   ${state.score}`, 640, 270);
  ctx.fillText(`HIGH SCORE    ${state.high}`, 640, 306);
  const mins = Math.floor(state.tourTime / 60);
  const secs = Math.floor(state.tourTime % 60);
  ctx.fillText(`TOUR TIME     ${mins}:${String(secs).padStart(2, "0")}`, 640, 342);
  ctx.fillStyle = "#ffe9a8";
  ctx.font = "18px sans-serif";
  ctx.fillText("Dawn, noon, dusk and night — the islands are yours, captain.", 640, 392);
  ctx.textAlign = "left";
  const hover = input.hover({ x: 520, y: 470, w: 240, h: 64 });
  bigButton(520, 470, 240, 64, "↻  FLY AGAIN", hover);
}

// --- loop ----------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!state.frozen) update(dt);
  draw();
  input.endFrame();
  if (state.mode === "shot" && !window.__shotReady) {
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

// --- boot ----------------------------------------------------------------------
const params = new URLSearchParams(location.search);
const isShot = applyShot(state, params);
if (!isShot) {
  // title screen: park the plane on the first runway at dawn
  state.loadLeg(0);
  state.plane.throttle = 0;
}
window.__game = state;
window.__shotReady = false;
requestAnimationFrame(frame);
