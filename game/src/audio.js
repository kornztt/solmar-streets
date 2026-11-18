// Synthesised sound: every effect and the music loop are built from plain
// WebAudio oscillators and noise, so the game ships no audio files at all.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.sirenNodes = null;
  }

  // Create the context on the first user gesture; browsers block it before.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  // One short oscillator blip: frequency slide, gain envelope, done.
  blip(freqFrom, freqTo, seconds, type, volume) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freqFrom, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t + seconds);
    gain.gain.setValueAtTime(volume || 0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  // A burst of filtered noise (gunshots, punches, crashes).
  noise(seconds, volume, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(t);
  }

  shoot() {
    this.noise(0.09, 0.5, 2600);
    this.blip(220, 60, 0.08, 'square', 0.22);
  }
  punch() {
    this.noise(0.1, 0.4, 500);
    this.blip(140, 50, 0.1, 'sine', 0.3);
  }
  hit() {
    this.blip(300, 180, 0.07, 'triangle', 0.2);
  }
  reload() {
    this.blip(900, 700, 0.05, 'square', 0.12);
    setTimeout(() => this.blip(700, 900, 0.05, 'square', 0.12), 90);
  }
  cash() {
    this.blip(880, 880, 0.09, 'sine', 0.22);
    setTimeout(() => this.blip(1318, 1318, 0.14, 'sine', 0.22), 90);
  }
  denied() {
    this.blip(160, 110, 0.18, 'sawtooth', 0.2);
  }
  pickup() {
    this.blip(520, 780, 0.1, 'sine', 0.22);
  }
  missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, n, 0.16, 'triangle', 0.22), i * 110));
  }
  wasted() {
    const notes = [392, 330, 262, 196];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, n * 0.94, 0.3, 'sawtooth', 0.16), i * 200));
  }
  carStart() {
    this.blip(90, 180, 0.25, 'sawtooth', 0.14);
  }

  // A quiet two-tone police siren while the player is wanted.
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenNodes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 700;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.7;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      lfo.start();
      this.sirenNodes = { osc, lfo, gain };
    } else if (!on && this.sirenNodes) {
      try {
        this.sirenNodes.osc.stop();
        this.sirenNodes.lfo.stop();
      } catch (e) { /* already stopped */ }
      this.sirenNodes = null;
    }
  }

  // A laid-back 8-step loop: walking bass plus a bright lead every 4 bars.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 0, 65.4, 0];
    const lead = [220, 0, 0, 262, 0, 0, 330, 0, 294, 0, 0, 262, 0, 330, 0, 0];
    const stepMs = 210;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const i = this.musicStep % 16;
      const t = this.ctx.currentTime;
      if (bass[i] > 0) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = bass[i];
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 0.22);
      }
      if (lead[i] > 0 && this.musicStep % 64 >= 32) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = lead[i] * 2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 0.2);
      }
      this.musicStep += 1;
    }, stepMs);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
