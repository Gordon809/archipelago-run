// Archipelago Run — audio.js
// Synthesised WebAudio sounds only: no audio files. The engine is a
// sawtooth drone through a low-pass filter plus wind noise; events are
// short oscillator/noise bursts. Created lazily on first user gesture.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._engineOsc = null;
    this._engineOsc2 = null;
    this._engineGain = null;
    this._engineFilter = null;
    this._windSrc = null;
    this._windGain = null;
    this._windFilter = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    // master
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    // engine: two detuned saws through a lowpass
    this._engineOsc = ctx.createOscillator();
    this._engineOsc.type = "sawtooth";
    this._engineOsc.frequency.value = 55;
    this._engineOsc2 = ctx.createOscillator();
    this._engineOsc2.type = "sawtooth";
    this._engineOsc2.frequency.value = 55 * 1.007;
    this._engineFilter = ctx.createBiquadFilter();
    this._engineFilter.type = "lowpass";
    this._engineFilter.frequency.value = 320;
    this._engineGain = ctx.createGain();
    this._engineGain.gain.value = 0;
    this._engineOsc.connect(this._engineFilter);
    this._engineOsc2.connect(this._engineFilter);
    this._engineFilter.connect(this._engineGain);
    this._engineGain.connect(this.master);
    this._engineOsc.start();
    this._engineOsc2.start();

    // wind: looped noise buffer through a bandpass
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._windSrc = ctx.createBufferSource();
    this._windSrc.buffer = buf;
    this._windSrc.loop = true;
    this._windFilter = ctx.createBiquadFilter();
    this._windFilter.type = "bandpass";
    this._windFilter.frequency.value = 700;
    this._windFilter.Q.value = 0.6;
    this._windGain = ctx.createGain();
    this._windGain.gain.value = 0;
    this._windSrc.connect(this._windFilter);
    this._windFilter.connect(this._windGain);
    this._windGain.connect(this.master);
    this._windSrc.start();
  }

  // Called every frame while flying: throttle 0..1, speed m/s, airborne bool.
  setFlight(throttle, speed, airborne) {
    if (!this.ctx || this.muted) {
      if (this._engineGain) this._engineGain.gain.value = 0;
      if (this._windGain) this._windGain.gain.value = 0;
      return;
    }
    const t = this.ctx.currentTime;
    const eng = airborne ? 0.05 + throttle * 0.11 : throttle * 0.05;
    this._engineGain.gain.setTargetAtTime(eng, t, 0.1);
    const freq = 48 + throttle * 62 + speed * 0.35;
    this._engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
    this._engineOsc2.frequency.setTargetAtTime(freq * 1.007, t, 0.08);
    this._engineFilter.frequency.setTargetAtTime(240 + throttle * 900, t, 0.1);
    const wind = Math.max(0, (speed - 18) / 90) * 0.12;
    this._windGain.gain.setTargetAtTime(airborne ? wind : 0, t, 0.15);
    this._windFilter.frequency.setTargetAtTime(500 + speed * 9, t, 0.1);
  }

  _tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _noise(dur, vol, filterFreq, type = "lowpass", when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  ring() {
    this._tone(880, 0.16, "sine", 0.22);
    this._tone(1318, 0.24, "sine", 0.2, 0.07);
  }

  click() {
    this._tone(1200, 0.05, "square", 0.08);
  }

  touchdown(smooth) {
    this._tone(90, 0.22, "sine", 0.5, 0, 45);
    this._noise(0.18, 0.25, 300);
    if (smooth) {
      this._tone(660, 0.14, "sine", 0.18, 0.08);
      this._tone(990, 0.2, "sine", 0.16, 0.16);
    }
  }

  crash() {
    this._noise(0.7, 0.5, 500);
    this._tone(70, 0.6, "sine", 0.5, 0, 30);
    this._noise(0.4, 0.3, 2400, "highpass", 0.05);
  }

  splash() {
    this._noise(0.5, 0.35, 900);
  }

  stallWarn() {
    this._tone(440, 0.09, "square", 0.07);
    this._tone(440, 0.09, "square", 0.07, 0.12);
  }

  legFanfare() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this._tone(n, 0.22, "triangle", 0.2, i * 0.11));
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
}
