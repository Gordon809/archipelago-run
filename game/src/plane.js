// Archipelago Run — plane.js
// Flight model + side-view drawing of the mail plane "Kutilang".
// The plane flies left to right; x is distance along the route (m),
// alt is height above sea level (m). Pitch in degrees, nose up positive.

import { PHYS } from "./config.js";
import { clamp } from "./random.js";

export class Plane {
  constructor() {
    this.reset(0, 12);
  }

  reset(x, alt) {
    this.x = x;
    this.alt = alt;
    this.vspeed = 0; // m/s vertical
    this.speed = 0; // m/s horizontal
    this.pitch = 0; // degrees
    this.throttle = 0; // 0..100
    this.fuel = 100;
    this.flaps = false;
    this.airborne = false;
    this.damage = 0;
    this.propAngle = 0;
    this.navBlink = 0;
    this.justLanded = false;
  }

  get stallSpeed() {
    return this.flaps ? PHYS.minSpeedFlaps : PHYS.minSpeed;
  }

  get onGround() {
    return !this.airborne;
  }

  // dt seconds, input {pitchUp, pitchDown, throttleUp, throttleDown, brake, flaps}
  // wind in m/s (positive = tailwind). Returns events: {stalled, fuelEmpty}.
  update(dt, input, wind, groundHeightAt) {
    const events = { stalled: false, fuelEmpty: false };
    const wasAirborne = this.airborne;

    // --- controls ---------------------------------------------------------
    if (input.pitchUp) this.pitch += PHYS.pitchSpeed * dt;
    if (input.pitchDown) this.pitch -= PHYS.pitchSpeed * dt;
    this.pitch = clamp(this.pitch, PHYS.maxPitchDown, PHYS.maxPitchUp);
    if (input.throttleUp) this.throttle = clamp(this.throttle + 55 * dt, 0, 100);
    if (input.throttleDown) this.throttle = clamp(this.throttle - 55 * dt, 0, 100);
    if (input.flaps) {
      this.flaps = !this.flaps;
    }

    // --- fuel ---------------------------------------------------------------
    const burn = (PHYS.fuelIdle + (PHYS.fuelBurn - PHYS.fuelIdle) * (this.throttle / 100)) * dt;
    if (this.fuel > 0) {
      this.fuel = Math.max(0, this.fuel - burn);
      if (this.fuel === 0) events.fuelEmpty = true;
    }
    const thrust = this.fuel > 0 ? this.throttle / 100 : 0;

    // --- horizontal speed ---------------------------------------------------
    const targetSpeed = thrust * PHYS.maxSpeed + wind;
    const drag = 1 + Math.abs(this.pitch) * 0.012 + (this.flaps ? PHYS.flapDrag / 40 : 0);
    const accel = PHYS.accel / drag;
    if (this.speed < targetSpeed) {
      this.speed = Math.min(targetSpeed, this.speed + accel * dt);
    } else {
      this.speed = Math.max(targetSpeed, this.speed - accel * 0.7 * dt);
    }
    if (input.brake) this.speed = Math.max(0, this.speed - PHYS.brake * dt);

    // --- takeoff / vertical -------------------------------------------------
    const ground = groundHeightAt(this.x);
    if (!this.airborne) {
      this.alt = ground;
      if (this.speed > this.stallSpeed + 6 && this.pitch > 4) {
        this.airborne = true;
        this.vspeed = 2;
      }
    }
    if (this.airborne) {
      const stalled = this.speed < this.stallSpeed;
      if (stalled) events.stalled = true;
      const pitchRad = (this.pitch * Math.PI) / 180;
      const targetV = stalled
        ? -PHYS.sinkRate
        : Math.sin(pitchRad) * this.speed * PHYS.climbRate;
      const rate = stalled ? 2.2 : 1.6;
      this.vspeed += (targetV - this.vspeed) * Math.min(1, rate * dt);
      // wind shear pushes the nose a little
      this.alt += this.vspeed * dt;
      if (this.alt <= ground) {
        this.alt = ground;
        this.airborne = false;
        this.vspeed = 0;
      }
    }

    this.x += this.speed * dt;
    this.propAngle += dt * (4 + this.speed * 0.9 + thrust * 14);
    this.navBlink += dt;
    return events;
  }

  // --- drawing -------------------------------------------------------------
  // ctx is already translated to the plane's screen position and rotated to
  // the plane's pitch. Draws the plane facing right, ~64 px long.
  draw(ctx, time) {
    ctx.save();
    // soft shadow on the water/ground far below is drawn by the caller.

    // engine flame when throttled (behind the nose prop)
    if (this.throttle > 55 && this.fuel > 0) {
      const f = 10 + Math.sin(time * 40) * 3 + (this.throttle / 100) * 8;
      ctx.fillStyle = "rgba(255, 170, 60, 0.9)";
      ctx.beginPath();
      ctx.moveTo(-34, -4);
      ctx.lineTo(-34 - f, 0);
      ctx.lineTo(-34, 4);
      ctx.closePath();
      ctx.fill();
    }

    // tail
    ctx.fillStyle = "#c23b2e";
    ctx.beginPath();
    ctx.moveTo(-26, -2);
    ctx.lineTo(-34, -16);
    ctx.lineTo(-28, -16);
    ctx.lineTo(-20, -3);
    ctx.closePath();
    ctx.fill();
    // horizontal stabiliser
    ctx.fillStyle = "#8e2a20";
    ctx.fillRect(-34, 0, 14, 3);

    // fuselage
    const grad = ctx.createLinearGradient(0, -10, 0, 8);
    grad.addColorStop(0, "#f6e8c8");
    grad.addColorStop(0.55, "#e8b64c");
    grad.addColorStop(1, "#b97f24");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-28, -4);
    ctx.quadraticCurveTo(8, -11, 28, -3);
    ctx.quadraticCurveTo(33, 0, 28, 3);
    ctx.quadraticCurveTo(8, 9, -28, 5);
    ctx.quadraticCurveTo(-32, 0, -28, -4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 50, 10, 0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // cabin windows
    ctx.fillStyle = "#1d3a4d";
    ctx.beginPath();
    ctx.ellipse(10, -4, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(20, -3, 5, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // door line + registration
    ctx.strokeStyle = "rgba(90, 50, 10, 0.5)";
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, 6);
    ctx.stroke();
    ctx.fillStyle = "#5a320a";
    ctx.font = "bold 6px sans-serif";
    ctx.fillText("PK-ARK", -24, 2);

    // main wing (low wing, amber with red tip)
    ctx.fillStyle = "#c23b2e";
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.lineTo(10, 2);
    ctx.lineTo(16, 20);
    ctx.lineTo(6, 20);
    ctx.lineTo(-8, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e8b64c";
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.lineTo(10, 2);
    ctx.lineTo(13, 14);
    ctx.lineTo(4, 14);
    ctx.closePath();
    ctx.fill();

    // propeller (spinning disc + blades)
    ctx.save();
    ctx.translate(31, 0);
    ctx.fillStyle = "rgba(60, 60, 70, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(this.propAngle);
    ctx.fillStyle = "#3a2e28";
    ctx.fillRect(-1.2, -13, 2.4, 26);
    ctx.fillRect(-13, -1.2, 26, 2.4);
    ctx.restore();
    ctx.fillStyle = "#8e2a20";
    ctx.beginPath();
    ctx.arc(31, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // navigation lights (blink)
    const blink = Math.sin(this.navBlink * 6) > 0;
    if (blink) {
      ctx.fillStyle = "#ff3b30";
      ctx.beginPath();
      ctx.arc(-28, -14, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#35e08a";
      ctx.beginPath();
      ctx.arc(12, 18, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // landing light cone
    if (this.airborne && this.alt < 120) {
      ctx.fillStyle = "rgba(255, 244, 190, 0.10)";
      ctx.beginPath();
      ctx.moveTo(30, -2);
      ctx.lineTo(150, -26);
      ctx.lineTo(150, 34);
      ctx.lineTo(30, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
