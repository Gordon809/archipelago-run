// Archipelago Run — config.js
// Constants, time-of-day palettes and leg definitions. No imports.

export const VIEW_W = 1280;
export const VIEW_H = 720;

// --- flight model ---------------------------------------------------------
export const PHYS = {
  maxSpeed: 96, // m/s at full throttle, clean
  minSpeed: 28, // stall speed, clean (m/s) — approach stays safe
  minSpeedFlaps: 22, // stall speed with flaps
  accel: 14, // m/s^2 toward throttle target
  drag: 0.55, // extra drag per unit of |pitch| + flaps
  climbRate: 0.92, // how strongly pitch converts speed into climb
  sinkRate: 9.5, // m/s sink when stalled or idle
  pitchSpeed: 52, // deg/s of pitch change (snappy, answers at every speed)
  maxPitchUp: 32,
  maxPitchDown: -26,
  fuelBurn: 0.7, // fuel %/s at 100% throttle
  fuelIdle: 0.12, // fuel %/s at 0% throttle
  ringFuel: 12, // fuel % gained per ring
  brake: 26, // m/s^2 when braking
  flapDrag: 9, // extra drag with flaps
};

// --- scoring ---------------------------------------------------------------
export const SCORE = {
  ring: 100,
  landingBase: 100,
  landingSmooth: 200, // extra for a gentle touchdown
  legBonus: 250,
  distancePer100m: 1,
};

// --- time-of-day palettes ---------------------------------------------------
export const DAY_PHASES = [
  {
    name: "DAWN",
    skyTop: "#2b3a6e",
    skyMid: "#e8825e",
    skyBot: "#f7c489",
    sun: "#ffd9a0",
    sunX: 0.78,
    sunY: 0.30,
    sea: "#3d6f8e",
    seaDeep: "#274b66",
    cloud: "rgba(255, 214, 180, 0.85)",
    hillFar: "#6d5a8a",
    hillNear: "#4a7a52",
    townLight: false,
    runwayLight: true,
    stars: 0.25,
  },
  {
    name: "NOON",
    skyTop: "#2f7fd0",
    skyMid: "#7ec2ee",
    skyBot: "#cfeefb",
    sun: "#fff3b0",
    sunX: 0.22,
    sunY: 0.16,
    sea: "#2e7fb8",
    seaDeep: "#1d5a86",
    cloud: "rgba(255, 255, 255, 0.92)",
    hillFar: "#7fae7d",
    hillNear: "#4f8f4f",
    townLight: false,
    runwayLight: false,
    stars: 0,
  },
  {
    name: "DUSK",
    skyTop: "#3a2350",
    skyMid: "#d95f43",
    skyBot: "#f7a54d",
    sun: "#ff9d5c",
    sunX: 0.5,
    sunY: 0.42,
    sea: "#54486e",
    seaDeep: "#3a2f52",
    cloud: "rgba(255, 170, 130, 0.8)",
    hillFar: "#5a3d63",
    hillNear: "#3d5a44",
    townLight: true,
    runwayLight: true,
    stars: 0.45,
  },
  {
    name: "NIGHT",
    skyTop: "#060a1e",
    skyMid: "#101c3f",
    skyBot: "#274b66",
    sun: "#e8ecff",
    sunX: 0.8,
    sunY: 0.18,
    sea: "#12283e",
    seaDeep: "#0a1a2c",
    cloud: "rgba(140, 160, 200, 0.5)",
    hillFar: "#1c2b45",
    hillNear: "#14263a",
    townLight: true,
    runwayLight: true,
    stars: 1,
  },
];

// --- legs: start runway, rings, end runway, wind ----------------------------
// x in metres along the route. Each leg is ~7-9 km of flying.
export const LEGS = [
  {
    name: "LEG 1 — FIRST LIGHT",
    phase: 0,
    wind: 0,
    startRunway: { x: 0, len: 320 },
    rings: [
      { x: 1400, alt: 170 },
      { x: 2600, alt: 260 },
      { x: 3800, alt: 200 },
      { x: 5000, alt: 320 },
      { x: 6200, alt: 180 },
    ],
    endRunway: { x: 7400, len: 320 },
  },
  {
    name: "LEG 2 — BLUE HOUR",
    phase: 1,
    wind: 4,
    startRunway: { x: 0, len: 320 },
    rings: [
      { x: 1500, alt: 300 },
      { x: 2700, alt: 180 },
      { x: 3900, alt: 340 },
      { x: 5100, alt: 230 },
      { x: 6300, alt: 360 },
      { x: 7400, alt: 260 },
    ],
    endRunway: { x: 8600, len: 320 },
  },
  {
    name: "LEG 3 — GOLDEN RUN",
    phase: 2,
    wind: -6,
    startRunway: { x: 0, len: 320 },
    rings: [
      { x: 1600, alt: 240 },
      { x: 2900, alt: 380 },
      { x: 4200, alt: 220 },
      { x: 5400, alt: 330 },
      { x: 6600, alt: 190 },
      { x: 7800, alt: 300 },
    ],
    endRunway: { x: 9000, len: 320 },
  },
  {
    name: "LEG 4 — NIGHT MAIL",
    phase: 3,
    wind: 7,
    startRunway: { x: 0, len: 320 },
    rings: [
      { x: 1700, alt: 280 },
      { x: 3000, alt: 200 },
      { x: 4300, alt: 360 },
      { x: 5600, alt: 260 },
      { x: 6900, alt: 380 },
      { x: 8100, alt: 240 },
      { x: 9200, alt: 300 },
    ],
    endRunway: { x: 10400, len: 320 },
  },
];

export const RING_RADIUS = 46; // metres, pass-through radius
export const RUNWAY_HEIGHT = 12; // metres above sea level
