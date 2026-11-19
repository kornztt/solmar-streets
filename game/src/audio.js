// SOLMAR STREETS — WebAudio synth SFX and a tiny music loop. All calls guarded:
// the game must keep running even when audio is unavailable (headless probe).
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;
  }
  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* audio is optional */ }
  }
  _tone(freq, dur, type = 'square', vol = 0.08, slide = 0) {
    try {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) { /* ignore */ }
  }
  sfx(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'money': this._tone(880, 0.12, 'sine', 0.09); setTimeout(() => this._tone(1320, 0.18, 'sine', 0.09), 90); break;
      case 'shoot': this._tone(220, 0.09, 'sawtooth', 0.1, -140); break;
      case 'punch': this._tone(140, 0.08, 'square', 0.1, -60); break;
      case 'hit': this._tone(90, 0.15, 'sawtooth', 0.12, -40); break;
      case 'pickup': this._tone(660, 0.1, 'sine', 0.09); break;
      case 'mission': [523, 659, 784].forEach((f, i) => setTimeout(() => this._tone(f, 0.16, 'sine', 0.09), i * 110)); break;
      case 'wasted': [400, 300, 200].forEach((f, i) => setTimeout(() => this._tone(f, 0.3, 'sawtooth', 0.08), i * 180)); break;
      case 'car': this._tone(180, 0.12, 'square', 0.07, 120); break;
      case 'siren': this._tone(700, 0.25, 'sine', 0.05, 300); break;
      default: this._tone(440, 0.08, 'sine', 0.06);
    }
  }
  engine(speed01) {
    try {
      if (!this.ctx || this.muted) return;
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
      }
      this.engineOsc.frequency.setValueAtTime(50 + speed01 * 90, this.ctx.currentTime);
      this.engineGain.gain.setValueAtTime(0.015 + speed01 * 0.03, this.ctx.currentTime);
    } catch (e) { /* ignore */ }
  }
  music(on) {
    if (on && !this.musicTimer && this.ctx) {
      const notes = [262, 330, 392, 330, 294, 370, 440, 370];
      let i = 0;
      this.musicTimer = setInterval(() => {
        if (!this.ctx || this.muted) return;
        this._tone(notes[i % notes.length], 0.22, 'triangle', 0.035);
        i++;
      }, 260);
    } else if (!on && this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
