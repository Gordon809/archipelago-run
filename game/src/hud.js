// Archipelago Run — hud.js
// Top HUD bar (altitude, speed, heading, fuel, score, combo, lives,
// objective) and the lit instrument panel at the bottom: artificial
// horizon, airspeed dial, altimeter dial, fuel gauge, throttle lever.

export function drawHUD(ctx, s) {
  // s: {alt, speedKts, heading, fuel, score, combo, lives, legName,
  //     objective, message, messageT, lowFuel, stalled}
  ctx.save();
  // top bar
  ctx.fillStyle = "rgba(8, 14, 28, 0.72)";
  ctx.fillRect(0, 0, 1280, 52);
  ctx.fillStyle = "rgba(255, 200, 80, 0.9)";
  ctx.fillRect(0, 52, 1280, 2);

  ctx.textBaseline = "alphabetic";
  const label = (x, txt) => {
    ctx.fillStyle = "#8fa8c8";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(txt, x, 16);
  };
  const value = (x, txt, color = "#ffffff") => {
    ctx.fillStyle = color;
    ctx.font = "bold 24px monospace";
    ctx.fillText(txt, x, 44);
  };

  label(16, "ALTITUDE");
  value(16, `${Math.round(s.alt * 3.28084)} FT`);
  label(190, "SPEED");
  value(190, `${Math.round(s.speedKts)} KT`, s.stalled ? "#ff5a4d" : "#ffffff");
  label(330, "HEADING");
  value(330, `${String(s.heading).padStart(3, "0")}°`);
  if (s.stalled) {
    ctx.fillStyle = "#ff5a4d";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText("⚠ STALL", 470, 32);
  }

  // fuel gauge
  label(560, "FUEL");
  ctx.fillStyle = "#1c2b45";
  ctx.fillRect(560, 24, 150, 16);
  const fw = 150 * Math.max(0, s.fuel / 100);
  ctx.fillStyle = s.fuel < 25 ? "#ff5a4d" : s.fuel < 50 ? "#ffc84d" : "#35e08a";
  ctx.fillRect(560, 24, fw, 16);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.strokeRect(560, 24, 150, 16);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px monospace";
  ctx.fillText(`${Math.round(s.fuel)}%`, 718, 38);

  // score block, right side
  ctx.textAlign = "right";
  label(880, "SCORE");
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px monospace";
  ctx.fillText(String(s.score).padStart(6, "0"), 1030, 44);
  if (s.combo > 1) {
    ctx.fillStyle = "#ffc84d";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(`COMBO ×${s.combo}`, 1030, 20);
  }
  // lives as little planes
  for (let i = 0; i < 3; i++) {
    const lx = 1064 + i * 30;
    ctx.fillStyle = i < s.lives ? "#ffc84d" : "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(lx, 30);
    ctx.lineTo(lx + 22, 30);
    ctx.lineTo(lx + 26, 26);
    ctx.lineTo(lx + 4, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(lx + 8, 30, 6, 8);
  }
  ctx.textAlign = "left";

  // objective line under the bar
  ctx.fillStyle = "rgba(8, 14, 28, 0.55)";
  ctx.fillRect(16, 60, 560, 26);
  ctx.fillStyle = "#ffe9a8";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(`${s.legName}  •  ${s.objective}`, 26, 78);

  // centre flash message
  if (s.message && s.messageT > 0) {
    const a = Math.min(1, s.messageT);
    ctx.textAlign = "center";
    ctx.font = "bold 34px sans-serif";
    ctx.fillStyle = `rgba(255, 233, 168, ${a.toFixed(2)})`;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 12;
    ctx.fillText(s.message, 640, 150);
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
  }
  ctx.restore();
}

// --- instruments -----------------------------------------------------------
export function drawInstruments(ctx, s) {
  // s: {pitch, speedKts, altFt, fuel, throttle, flaps, time}
  ctx.save();
  const panelY = 596;
  ctx.fillStyle = "rgba(8, 14, 28, 0.78)";
  ctx.beginPath();
  ctx.roundRect(330, panelY, 620, 112, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 200, 80, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // artificial horizon
  const cx = 410;
  const cy = panelY + 56;
  const R = 44;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  const pitchPx = Math.max(-R, Math.min(R, -s.pitch * 1.1));
  ctx.fillStyle = "#2f7fd0";
  ctx.fillRect(cx - R, cy - R + pitchPx, R * 2, R - pitchPx);
  ctx.fillStyle = "#7a5230";
  ctx.fillRect(cx - R, cy + pitchPx, R * 2, R - pitchPx + 0);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy + pitchPx);
  ctx.lineTo(cx + R, cy + pitchPx);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "#ffc84d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  // fixed wings marker
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.moveTo(cx + 8, cy);
  ctx.lineTo(cx + 26, cy);
  ctx.stroke();
  ctx.fillStyle = "#8fa8c8";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ATTITUDE", cx, panelY + 108);
  ctx.textAlign = "left";

  // airspeed dial
  dial(ctx, 540, cy, R, s.speedKts, 220, "KT", "AIRSPEED", "#35e08a");
  // altimeter dial
  dial(ctx, 670, cy, R, s.altFt, 2000, "FT", "ALTITUDE", "#7ec2ee");
  // fuel gauge (vertical)
  const fx = 790;
  ctx.fillStyle = "#1c2b45";
  ctx.fillRect(fx, panelY + 16, 18, 80);
  const fh = 80 * Math.max(0, s.fuel / 100);
  ctx.fillStyle = s.fuel < 25 ? "#ff5a4d" : "#35e08a";
  ctx.fillRect(fx, panelY + 96 - fh, 18, fh);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.strokeRect(fx, panelY + 16, 18, 80);
  ctx.fillStyle = "#8fa8c8";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FUEL", fx + 9, panelY + 108);
  ctx.textAlign = "left";

  // throttle lever
  const tx = 850;
  ctx.fillStyle = "#1c2b45";
  ctx.fillRect(tx, panelY + 16, 10, 80);
  const ty = panelY + 96 - 80 * (s.throttle / 100);
  ctx.fillStyle = "#ffc84d";
  ctx.fillRect(tx - 6, ty - 4, 22, 8);
  ctx.fillStyle = "#8fa8c8";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("THR", tx + 5, panelY + 108);
  ctx.fillText(`${Math.round(s.throttle)}%`, tx + 5, panelY + 14);
  ctx.textAlign = "left";

  // flaps indicator
  ctx.fillStyle = s.flaps ? "#35e08a" : "rgba(255,255,255,0.35)";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(s.flaps ? "FLAPS ▼" : "FLAPS —", 900, panelY + 40);
  ctx.fillStyle = "#8fa8c8";
  ctx.font = "11px sans-serif";
  ctx.fillText("↑↓ pitch   ←→ throttle", 900, panelY + 62);
  ctx.fillText("F flaps   SPACE brake", 900, panelY + 80);
  ctx.restore();
}

function dial(ctx, cx, cy, R, val, max, unit, label, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = "#0d1626";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  // ticks
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 10; i++) {
    const a = (-210 + i * 24) * (Math.PI / 180);
    const x1 = cx + Math.cos(a) * (R - 4);
    const y1 = cy + Math.sin(a) * (R - 4);
    const x2 = cx + Math.cos(a) * (R - 10);
    const y2 = cy + Math.sin(a) * (R - 10);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  const frac = Math.max(0, Math.min(1, val / max));
  const a = (-210 + frac * 240) * (Math.PI / 180);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12));
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "center";
  ctx.fillText(String(Math.round(val)), cx, cy + 18);
  ctx.fillStyle = "#8fa8c8";
  ctx.font = "bold 9px sans-serif";
  ctx.fillText(unit, cx, cy + 30);
  ctx.fillText(label, cx, cy + R + 12);
  ctx.textAlign = "left";
  ctx.restore();
}
