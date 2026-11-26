// Archipelago Run — terrain.js
// Seeded island chain + runway generation, and all scenery drawing:
// sky gradient, sun/moon, stars, clouds, sea, parallax hills, islands
// with beaches, palms and towns, and lit runways. No imports besides config.

import { DAY_PHASES, RUNWAY_HEIGHT } from "./config.js";
import { mulberry32, range, clamp } from "./random.js";

// One island: a hump of land rising out of the sea.
export class Terrain {
  constructor(legIndex, leg) {
    this.leg = leg;
    this.rng = mulberry32(1000 + legIndex * 77 + 7);
    this.islands = [];
    this.clouds = [];
    this.stars = [];
    this.birds = [];
    this._buildIslands();
    this._buildSky();
  }

  _buildIslands() {
    const { startRunway, endRunway } = this.leg;
    const rng = this.rng;
    // runway islands first (flat, at runway height)
    this.islands.push(this._runwayIsland(startRunway.x, startRunway.len, rng));
    this.islands.push(this._runwayIsland(endRunway.x, endRunway.len, rng));
    // filler islands between runways
    let x = 800;
    const endX = endRunway.x + 600;
    while (x < endX - 500) {
      const w = range(rng, 500, 1100);
      if (this._clearOfRunways(x, w)) {
        const kind = rng();
        this.islands.push({
          x0: x,
          x1: x + w,
          peak: range(rng, 55, 190),
          peakAt: range(rng, 0.3, 0.7),
          town: kind < 0.55,
          palms: Math.floor(range(rng, 2, 7)),
          seed: Math.floor(rng() * 1e9),
        });
      }
      x += w + range(rng, 350, 900);
    }
    this.islands.sort((a, b) => a.x0 - b.x0);
  }

  _clearOfRunways(x, w) {
    for (const r of [this.leg.startRunway, this.leg.endRunway]) {
      if (x < r.x + r.len + 260 && x + w > r.x - 260) return false;
    }
    return true;
  }

  _runwayIsland(x, len, rng) {
    return {
      x0: x - 160,
      x1: x + len + 160,
      peak: RUNWAY_HEIGHT,
      peakAt: 0.5,
      runway: { x, len },
      town: rng() < 0.4,
      palms: Math.floor(range(rng, 1, 4)),
      seed: Math.floor(rng() * 1e9),
    };
  }

  _buildSky() {
    const rng = this.rng;
    for (let i = 0; i < 26; i++) {
      this.clouds.push({
        x: rng() * 4000,
        y: range(rng, 40, 260),
        s: range(rng, 0.6, 1.8),
        v: range(rng, 2, 7),
      });
    }
    for (let i = 0; i < 90; i++) {
      this.stars.push({ x: rng(), y: rng() * 0.55, r: range(rng, 0.6, 1.8), tw: range(rng, 0, 6) });
    }
    for (let i = 0; i < 5; i++) {
      this.birds.push({ x: rng() * 3000, y: range(rng, 120, 300), s: range(rng, 0.7, 1.2), ph: rng() * 6 });
    }
  }

  // Ground height (m above sea) at route position x. 0 = open sea.
  groundAt(x) {
    for (const isl of this.islands) {
      if (x >= isl.x0 && x <= isl.x1) {
        if (isl.runway) return RUNWAY_HEIGHT;
        const t = (x - isl.x0) / (isl.x1 - isl.x0);
        const hump = Math.sin(Math.PI * Math.pow(t, 0.8));
        // flatten the edges into beaches
        const edge = Math.min(1, Math.min(t, 1 - t) * 6);
        return Math.max(0, isl.peak * hump * edge);
      }
    }
    return 0;
  }

  isOnRunway(x) {
    for (const r of [this.leg.startRunway, this.leg.endRunway]) {
      if (x >= r.x && x <= r.x + r.len) return r;
    }
    return null;
  }

  // --- drawing -------------------------------------------------------------
  // camX: route metres at the left screen edge. scale: px per metre (zoom).
  // horizonY: screen y of the sea level. phase: DAY_PHASES entry. time: seconds.
  draw(ctx, camX, scale, horizonY, phase, time) {
    this._drawSky(ctx, phase, time);
    this._drawClouds(ctx, camX, scale, horizonY, phase, time);
    this._drawFarHills(ctx, camX, scale, horizonY, phase);
    this._drawSea(ctx, horizonY, phase, time, camX);
    this._drawIslands(ctx, camX, scale, horizonY, phase, time);
  }

  _drawSky(ctx, phase, time) {
    const g = ctx.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, phase.skyTop);
    g.addColorStop(0.55, phase.skyMid);
    g.addColorStop(1, phase.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 720);

    // stars
    if (phase.stars > 0) {
      for (const s of this.stars) {
        const a = phase.stars * (0.5 + 0.5 * Math.sin(time * 1.5 + s.tw));
        ctx.fillStyle = `rgba(255, 255, 255, ${a.toFixed(2)})`;
        ctx.fillRect(s.x * 1280, s.y * 720, s.r, s.r);
      }
    }
    // sun / moon
    const sx = phase.sunX * 1280;
    const sy = phase.sunY * 720;
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 120);
    glow.addColorStop(0, phase.sun);
    glow.addColorStop(0.25, phase.sun + "55");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 130, sy - 130, 260, 260);
    ctx.fillStyle = phase.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawClouds(ctx, camX, scale, horizonY, phase, time) {
    ctx.fillStyle = phase.cloud;
    for (const c of this.clouds) {
      // parallax 0.35: clouds drift slowly with the camera + their own speed
      const wx = (c.x + time * c.v - camX * 0.35) % 2600;
      const sx = ((wx + 2600) % 2600) / 2600 * 1280 - 100;
      const sy = c.y;
      const s = c.s;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 70 * s, 20 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(sx + 44 * s, sy + 6 * s, 46 * s, 15 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(sx - 48 * s, sy + 7 * s, 40 * s, 13 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // birds
    ctx.strokeStyle = "rgba(40, 30, 40, 0.7)";
    ctx.lineWidth = 2;
    for (const b of this.birds) {
      const bx = ((b.x - camX * 0.6) % 2600 + 2600) % 2600 / 2600 * 1280 - 60;
      const flap = Math.sin(time * 7 + b.ph) * 5 * b.s;
      ctx.beginPath();
      ctx.moveTo(bx - 9 * b.s, b.y + flap);
      ctx.quadraticCurveTo(bx, b.y - 3 * b.s, bx + 9 * b.s, b.y + flap);
      ctx.stroke();
    }
  }

  _drawFarHills(ctx, camX, scale, horizonY, phase) {
    // distant island silhouettes, parallax 0.5, two layers
    for (const [par, col, amp, base] of [
      [0.5, phase.hillFar, 46, 0],
      [0.7, phase.hillNear, 30, 18],
    ]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, horizonY + 2);
      for (let sx = 0; sx <= 1280; sx += 32) {
        const wx = (camX * par + sx / scale) * 0.004;
        const y = horizonY + 2 - (Math.sin(wx * 1.7) * 0.5 + Math.sin(wx * 3.1 + 2) * 0.5) * amp - base;
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(1280, horizonY + 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  _drawSea(ctx, horizonY, phase, time, camX) {
    const g = ctx.createLinearGradient(0, horizonY, 0, 720);
    g.addColorStop(0, phase.sea);
    g.addColorStop(1, phase.seaDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY, 1280, 720 - horizonY);
    // sun glint on the water: short soft shimmer under the sun
    const sx = phase.sunX * 1280;
    for (let i = 0; i < 6; i++) {
      const y = horizonY + 10 + i * 12;
      const w = 26 + i * 8 + Math.sin(time * 1.8 + i * 1.7) * 8;
      ctx.fillStyle = `rgba(255, 230, 170, ${0.14 - i * 0.015})`;
      ctx.fillRect(sx - w / 2 + Math.sin(time + i) * 6, y, w, 2.5);
    }
    // wave lines
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      const y = horizonY + 26 + i * 34;
      ctx.beginPath();
      for (let sx = 0; sx <= 1280; sx += 40) {
        const yy = y + Math.sin(sx * 0.02 + time * 1.6 + i * 2.4) * 2.5;
        if (sx === 0) ctx.moveTo(sx, yy);
        else ctx.lineTo(sx, yy);
      }
      ctx.stroke();
    }
  }

  _drawIslands(ctx, camX, scale, horizonY, phase, time) {
    const px = (wx) => (wx - camX) * scale;
    const py = (alt) => horizonY - alt * scale;
    for (const isl of this.islands) {
      const x0 = px(isl.x0);
      const x1 = px(isl.x1);
      if (x1 < -80 || x0 > 1360) continue;
      const rng = mulberry32(isl.seed);

      if (isl.runway) {
        this._drawRunwayIsland(ctx, isl, x0, x1, px, py, phase, time, rng);
        continue;
      }
      // land mass
      ctx.beginPath();
      ctx.moveTo(x0, horizonY + 2);
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const wx = isl.x0 + (isl.x1 - isl.x0) * t;
        ctx.lineTo(px(wx), py(this.groundAt(wx)));
      }
      ctx.lineTo(x1, horizonY + 2);
      ctx.closePath();
      const lg = ctx.createLinearGradient(0, py(isl.peak), 0, horizonY);
      lg.addColorStop(0, phase.hillNear);
      lg.addColorStop(1, phase.hillFar);
      ctx.fillStyle = lg;
      ctx.fill();
      // beach rim
      ctx.strokeStyle = "#e8d9a0";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x0, horizonY);
      ctx.lineTo(x1, horizonY);
      ctx.stroke();
      // palms
      for (let i = 0; i < isl.palms; i++) {
        const wx = isl.x0 + (isl.x1 - isl.x0) * (0.15 + rng() * 0.7);
        const gy = this.groundAt(wx);
        if (gy < 8) continue;
        this._drawPalm(ctx, px(wx), py(gy), 0.8 + rng() * 0.5, phase);
      }
      // town: little houses with (lit) windows
      if (isl.town) {
        const n = 3 + Math.floor(rng() * 4);
        for (let i = 0; i < n; i++) {
          const wx = isl.x0 + (isl.x1 - isl.x0) * (0.2 + rng() * 0.6);
          const gy = this.groundAt(wx);
          if (gy < 10) continue;
          const hx = px(wx);
          const hy = py(gy);
          ctx.fillStyle = "#f2e6c8";
          ctx.fillRect(hx - 9, hy - 12, 18, 12);
          ctx.fillStyle = "#b0503c";
          ctx.beginPath();
          ctx.moveTo(hx - 11, hy - 12);
          ctx.lineTo(hx, hy - 20);
          ctx.lineTo(hx + 11, hy - 12);
          ctx.closePath();
          ctx.fill();
          if (phase.townLight) {
            ctx.fillStyle = "#ffd76a";
            ctx.fillRect(hx - 4, hy - 8, 8, 6);
          }
        }
      }
    }
  }

  _drawRunwayIsland(ctx, isl, x0, x1, px, py, phase, time, rng) {
    const horizonY = py(0);
    // flat island slab
    ctx.fillStyle = phase.hillNear;
    ctx.beginPath();
    ctx.moveTo(x0, horizonY + 2);
    ctx.lineTo(x0, py(RUNWAY_HEIGHT));
    ctx.lineTo(x1, py(RUNWAY_HEIGHT));
    ctx.lineTo(x1, horizonY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#e8d9a0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, py(RUNWAY_HEIGHT));
    ctx.lineTo(x1, py(RUNWAY_HEIGHT));
    ctx.stroke();
    // runway strip
    const r = isl.runway;
    const rx0 = px(r.x);
    const rx1 = px(r.x + r.len);
    const ry = py(RUNWAY_HEIGHT);
    ctx.fillStyle = "#3c4148";
    ctx.fillRect(rx0, ry - 7, rx1 - rx0, 14);
    // centre line dashes
    ctx.fillStyle = "#f5f5f5";
    for (let wx = r.x + 12; wx < r.x + r.len - 12; wx += 44) {
      ctx.fillRect(px(wx), ry - 1.5, 22 * ((rx1 - rx0) / r.len), 3);
    }
    // threshold bars
    ctx.fillRect(rx0 + 4, ry - 6, 10, 12);
    ctx.fillRect(rx1 - 14, ry - 6, 10, 12);
    // edge + threshold lights (lit at dawn/dusk/night)
    if (phase.runwayLight) {
      const blink = 0.6 + 0.4 * Math.sin(time * 3);
      ctx.fillStyle = `rgba(80, 255, 150, ${blink.toFixed(2)})`;
      for (let wx = r.x; wx <= r.x + r.len; wx += 52) {
        ctx.beginPath();
        ctx.arc(px(wx), ry - 9, 3, 0, Math.PI * 2);
        ctx.arc(px(wx), ry + 9, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // windsock
    const wx = px(r.x + r.len + 40);
    const wy = py(RUNWAY_HEIGHT);
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx, wy - 34);
    ctx.stroke();
    const flap = Math.sin(time * 5) * 4;
    ctx.fillStyle = "#ff7a3c";
    ctx.beginPath();
    ctx.moveTo(wx, wy - 34);
    ctx.lineTo(wx + 26, wy - 30 + flap);
    ctx.lineTo(wx + 26, wy - 22 + flap);
    ctx.lineTo(wx, wy - 24);
    ctx.closePath();
    ctx.fill();
    // control tower hut
    ctx.fillStyle = "#f2e6c8";
    ctx.fillRect(rx0 + 30, ry - 30, 22, 23);
    ctx.fillStyle = "#2f5d8a";
    ctx.fillRect(rx0 + 30, ry - 38, 22, 9);
    if (phase.townLight) {
      ctx.fillStyle = "#ffd76a";
      ctx.fillRect(rx0 + 36, ry - 24, 10, 7);
    }
    // destination beacon: a rotating light beam so the next runway can be
    // spotted from far away (only on the leg's end runway)
    if (isl.runway.x === this.leg.endRunway.x) {
      const bx = px(r.x + r.len - 24);
      const by = py(RUNWAY_HEIGHT);
      ctx.strokeStyle = "#8a8f96";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, by - 52);
      ctx.stroke();
      const ang = time * 0.9;
      for (const dir of [ang, ang + Math.PI]) {
        const ex = bx + Math.cos(dir) * 150;
        const ey = by - 52 + Math.sin(dir) * 34;
        const beam = ctx.createLinearGradient(bx, by - 52, ex, ey);
        beam.addColorStop(0, "rgba(255, 244, 190, 0.34)");
        beam.addColorStop(1, "rgba(255, 244, 190, 0)");
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(bx, by - 52);
        ctx.lineTo(ex + Math.sin(dir) * 10, ey + Math.cos(dir) * 10);
        ctx.lineTo(ex - Math.sin(dir) * 10, ey - Math.cos(dir) * 10);
        ctx.closePath();
        ctx.fill();
      }
      const blinkOn = Math.sin(time * 4) > 0;
      ctx.fillStyle = blinkOn ? "#ff4d4d" : "#7a1f1f";
      ctx.beginPath();
      ctx.arc(bx, by - 54, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawPalm(ctx, x, y, s, phase) {
    ctx.strokeStyle = "#5a3d22";
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 4 * s, y - 16 * s, x + 9 * s, y - 24 * s);
    ctx.stroke();
    ctx.strokeStyle = "#2f7a3d";
    ctx.lineWidth = 2.4 * s;
    for (const a of [-2.4, -1.4, -0.4, 0.6, 1.6]) {
      ctx.beginPath();
      ctx.moveTo(x + 9 * s, y - 24 * s);
      ctx.quadraticCurveTo(
        x + 9 * s + Math.cos(a) * 14 * s,
        y - 24 * s + Math.sin(a) * 6 * s - 4 * s,
        x + 9 * s + Math.cos(a) * 20 * s,
        y - 24 * s + Math.sin(a) * 12 * s + 3 * s
      );
      ctx.stroke();
    }
  }
}
