// Archipelago Run — rings.js
// Target rings: glowing hoops the plane flies through. Passing through
// the centre scores, refuels and grows the combo; missing one breaks it.

import { RING_RADIUS } from "./config.js";

export class Rings {
  constructor(leg) {
    this.list = leg.rings.map((r, i) => ({
      x: r.x,
      alt: r.alt,
      index: i,
      state: "pending", // pending | hit | missed
      burst: 0, // sparkle timer after a hit
    }));
    this.nextIndex = 0;
  }

  // Returns "hit" | "miss" | null. Plane pos in metres.
  check(px, palt) {
    if (this.nextIndex >= this.list.length) return null;
    const r = this.list[this.nextIndex];
    const dx = px - r.x;
    const dy = palt - r.alt;
    const dist = Math.hypot(dx, dy);
    if (dist < RING_RADIUS * 0.8) {
      r.state = "hit";
      r.burst = 1;
      this.nextIndex++;
      return "hit";
    }
    // passed it by: flew beyond the ring without entering
    if (px > r.x + RING_RADIUS) {
      r.state = "missed";
      this.nextIndex++;
      return "miss";
    }
    return null;
  }

  get remaining() {
    return this.list.length - this.nextIndex;
  }

  get done() {
    return this.nextIndex >= this.list.length;
  }

  update(dt) {
    for (const r of this.list) {
      if (r.burst > 0) r.burst = Math.max(0, r.burst - dt * 1.6);
    }
  }

  draw(ctx, camX, scale, horizonY, time) {
    const px = (wx) => (wx - camX) * scale;
    const py = (alt) => horizonY - alt * scale;
    for (const r of this.list) {
      const sx = px(r.x);
      if (sx < -120 || sx > 1400) continue;
      const sy = py(r.alt);
      const rad = RING_RADIUS * scale;
      if (r.state === "hit") {
        // fading sparkle burst
        const a = r.burst;
        ctx.strokeStyle = `rgba(120, 255, 190, ${a.toFixed(2)})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(sx, sy, rad * (1 + (1 - a) * 0.5), 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const an = (i / 8) * Math.PI * 2 + time;
          const rr = rad * (1 + (1 - a) * 1.4);
          ctx.fillStyle = `rgba(255, 240, 150, ${a.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(sx + Math.cos(an) * rr, sy + Math.sin(an) * rr, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      if (r.state === "missed") {
        ctx.strokeStyle = "rgba(160, 160, 170, 0.4)";
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      // pending: pulsing golden hoop with a chevron pointing through it
      const pulse = 1 + Math.sin(time * 3 + r.index) * 0.05;
      const glow = ctx.createRadialGradient(sx, sy, rad * 0.4, sx, sy, rad * 1.5);
      glow.addColorStop(0, "rgba(255, 200, 80, 0.0)");
      glow.addColorStop(0.75, "rgba(255, 200, 80, 0.16)");
      glow.addColorStop(1, "rgba(255, 200, 80, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sx - rad * 1.6, sy - rad * 1.6, rad * 3.2, rad * 3.2);
      ctx.strokeStyle = "#ffc84d";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(sx, sy, rad * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#fff3c4";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, sy, rad * pulse - 5, 0, Math.PI * 2);
      ctx.stroke();
      // chevrons above the ring
      ctx.fillStyle = "#ffc84d";
      const cy = sy - rad - 18 + Math.sin(time * 3) * 4;
      ctx.beginPath();
      ctx.moveTo(sx - 10, cy);
      ctx.lineTo(sx, cy - 10);
      ctx.lineTo(sx + 10, cy);
      ctx.lineTo(sx, cy - 3);
      ctx.closePath();
      ctx.fill();
      // index label
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(r.index + 1), sx, sy + 5);
      ctx.textAlign = "left";
    }
  }
}
