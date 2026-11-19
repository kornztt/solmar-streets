// Sound: everything is synthesized with WebAudio — no audio files, no
// network. Engine hum, sirens, gunshots, thuds, jingles and a small
// bass-driven music loop. Audio starts on the first user gesture.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicTimer = null;
    this.musicOn = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.step = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    this.startMusic();
  }

  // A short synthesized blip/noise for one named effect.
  play(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const mk = (type, freq, dur, vol, slideTo) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    const noise = (dur, vol, low) => {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = low || 1200;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t);
    };
    switch (name) {
      case 'shot': noise(0.14, 0.5, 2600); mk('square', 160, 0.08, 0.25, 60); break;
      case 'punch': noise(0.1, 0.4, 500); mk('sine', 120, 0.1, 0.4, 50); break;
      case 'hit': mk('sine', 220, 0.12, 0.3, 90); break;
      case 'crash': noise(0.3, 0.5, 900); break;
      case 'pickup': mk('sine', 660, 0.09, 0.3, 990); break;
      case 'mission': mk('sine', 440, 0.12, 0.3); mk('sine', 660, 0.14, 0.3); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => mk('triangle', f, 0.18, 0.3), i * 90);
      }); break;
      case 'fail': mk('sawtooth', 220, 0.4, 0.25, 110); break;
      case 'empty': mk('square', 180, 0.06, 0.2); break;
      case 'cash': mk('sine', 880, 0.1, 0.3, 1320); break;
      default: break;
    }
  }

  // Engine hum follows the player's speed; called every frame.
  setEngine(speedRatio, inCar) {
    if (!this.ctx) return;
    if (!inCar || speedRatio <= 0.02) {
      if (this.engineOsc) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      this.engineOsc.connect(f);
      f.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(60 + speedRatio * 160, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + speedRatio * 0.06, t, 0.1);
  }

  // Two-tone siren while any police unit is active.
  setSiren(active) {
    if (!this.ctx) return;
    if (!active) {
      if (this.sirenOsc) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenOsc.frequency.value = 700;
    }
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(0.045, t, 0.2);
    // Alternate the tone every 0.45 s.
    const phase = Math.floor(t / 0.45) % 2;
    this.sirenOsc.frequency.setTargetAtTime(phase ? 700 : 950, t, 0.05);
  }

  // A small loop: walking bass + hats, A minor, 112 BPM.
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    this.musicOn = true;
    const bassLine = [55, 0, 55, 65.4, 0, 55, 82.4, 73.4];
    const beat = 60 / 112 / 2; // eighth notes
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicOn) return;
      const t = this.ctx.currentTime;
      const f = bassLine[this.step % bassLine.length];
      this.step++;
      if (f > 0) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.95);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + beat);
      }
      // Hat tick on every other step.
      if (this.step % 2 === 0) {
        const len = Math.floor(this.ctx.sampleRate * 0.03);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.4;
        const s = this.ctx.createBufferSource();
        s.buffer = buf;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6000;
        s.connect(hp);
        hp.connect(this.master);
        s.start(t);
      }
    }, beat * 1000);
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  }
}
