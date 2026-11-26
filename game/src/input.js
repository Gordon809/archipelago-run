// Archipelago Run — input.js
// Keyboard + mouse input. Keys are held in a live set; edge-triggered
// actions (flaps, pause, mute, restart, confirm) fire once per press.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, cleared each frame by consume()
    this.mouse = { x: 0, y: 0, clicked: false };
    this._buttons = []; // {x,y,w,h,id} hit areas for the current screen

    window.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * 1280;
      this.mouse.y = ((e.clientY - r.top) / r.height) * 720;
    });
    canvas.addEventListener("pointerdown", (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * 1280;
      this.mouse.y = ((e.clientY - r.top) / r.height) * 720;
      this.mouse.clicked = true;
    });
    canvas.addEventListener("blur", () => this.keys.clear());
    window.addEventListener("blur", () => this.keys.clear());
  }

  down(...names) {
    return names.some((n) => this.keys.has(n));
  }

  // True once on the frame the key went down.
  hit(...names) {
    return names.some((n) => this.pressed.has(n));
  }

  // Register clickable rectangles for this frame's screen; returns the id clicked.
  buttons(list) {
    this._buttons = list;
    if (!this.mouse.clicked) return null;
    this.mouse.clicked = false;
    for (const b of list) {
      if (
        this.mouse.x >= b.x && this.mouse.x <= b.x + b.w &&
        this.mouse.y >= b.y && this.mouse.y <= b.y + b.h
      ) {
        return b.id;
      }
    }
    return null;
  }

  hover(b) {
    return (
      this.mouse.x >= b.x && this.mouse.x <= b.x + b.w &&
      this.mouse.y >= b.y && this.mouse.y <= b.y + b.h
    );
  }

  endFrame() {
    this.pressed.clear();
  }
}
