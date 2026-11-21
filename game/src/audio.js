// WebAudio synth: sound effects and a small music loop. No audio files.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.step = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      // Engine hum: a low sawtooth whose pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 400;
      this.engineOsc.connect(filt);
      filt.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    } catch (e) {
      this.ctx = null;
    }
  }

  setEngine(speed01) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(46 + speed01 * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.015 + speed01 * 0.03, t, 0.1);
  }

  tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.2, freq = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filt);
    filt.connect(g);
    g.connect(this.ctx.destination);
    src.start(t);
  }

  sfx(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'shot': this.noise(0.12, 0.25, 2500); this.tone(180, 0.1, 'square', 0.08, 60); break;
      case 'eshot': this.noise(0.1, 0.12, 1800); break;
      case 'dryfire': this.tone(900, 0.05, 'square', 0.05); break;
      case 'punch': this.noise(0.08, 0.2, 500); this.tone(120, 0.08, 'sine', 0.12, 70); break;
      case 'hit': this.tone(220, 0.08, 'square', 0.06, 140); break;
      case 'cash': this.tone(880, 0.08, 'sine', 0.1); setTimeout(() => this.tone(1320, 0.12, 'sine', 0.1), 70); break;
      case 'pickup': this.tone(660, 0.09, 'sine', 0.1); setTimeout(() => this.tone(990, 0.1, 'sine', 0.1), 80); break;
      case 'mission': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'sine', 0.11), i * 110)); break;
      case 'start': this.tone(392, 0.12, 'sine', 0.1); setTimeout(() => this.tone(523, 0.14, 'sine', 0.1), 100); break;
      case 'fail': this.tone(220, 0.25, 'sawtooth', 0.08, 110); break;
      case 'crash': this.noise(0.3, 0.3, 700); break;
      case 'explosion': this.noise(0.7, 0.4, 400); this.tone(90, 0.5, 'sine', 0.2, 30); break;
      case 'alarm': this.tone(700, 0.18, 'square', 0.06, 900); setTimeout(() => this.tone(900, 0.18, 'square', 0.06, 700), 180); break;
      case 'wasted': [400, 350, 300, 200].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'sawtooth', 0.09), i * 220)); break;
      default: break;
    }
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    // A slow bassline with a sparse lead, scheduled every 200 ms.
    const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
    const lead = [220, 0, 261.6, 0, 293.7, 0, 261.6, 196];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const i = this.step % 8;
      this.tone(bass[i], 0.22, 'triangle', 0.07);
      if (lead[i]) this.tone(lead[i], 0.16, 'sine', 0.045);
      if (this.step % 2 === 0) this.noise(0.03, 0.02, 6000);
      this.step++;
    }, 210);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}
