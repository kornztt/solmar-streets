// WebAudio synth: engine hum, gunshots, chimes, siren and a music loop.
// Everything is guarded: no audio context exists until the first click,
// and every call is safe when sound is off.
export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null; this.muted = false;
    this.engineOsc = null; this.engineGain = null; this.musicTimer = null;
    this.musicStep = 0;
  }
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startMusic();
    } catch (e) { this.ctx = null; }
  }
  startEngine() {
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (e) { /* engine stays silent */ }
  }
  setEngine(speed, top) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(50 + (speed / top) * 90, t, 0.1);
    this.engineGain.gain.setTargetAtTime(speed > 10 ? 0.05 : 0, t, 0.1);
  }
  startMusic() {
    // a slow bassline loop: A minor, one note per beat, 112 bpm
    const notes = [110, 0, 130.8, 0, 98, 0, 130.8, 146.8];
    const stepMs = 60000 / 112 / 2;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = notes[this.musicStep % notes.length];
      this.musicStep++;
      if (!f) return;
      try {
        const o = this.ctx.createOscillator();
        o.type = 'triangle'; o.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.09, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
        o.connect(g); g.connect(this.master);
        o.start(); o.stop(this.ctx.currentTime + 0.24);
      } catch (e) { /* skip a note */ }
    }, stepMs);
  }
  blip(freq, dur, type = 'sine', vol = 0.15) {
    if (!this.ctx || this.muted) return;
    try {
      const o = this.ctx.createOscillator();
      o.type = type; o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + dur + 0.02);
    } catch (e) { /* silent */ }
  }
  noise(dur, vol = 0.3) {
    if (!this.ctx || this.muted) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      s.connect(g); g.connect(this.master);
      s.start();
    } catch (e) { /* silent */ }
  }
  shot() { this.noise(0.12, 0.35); this.blip(180, 0.08, 'square', 0.12); }
  thud() { this.noise(0.08, 0.2); }
  swing() { this.blip(300, 0.06, 'sine', 0.05); }
  pickup() { this.blip(660, 0.1); setTimeout(() => this.blip(880, 0.14), 90); }
  hurt() { this.blip(140, 0.2, 'sawtooth', 0.18); }
  siren() { this.blip(720, 0.18, 'sine', 0.06); setTimeout(() => this.blip(540, 0.18, 'sine', 0.06), 200); }
  toggleMute() { this.muted = !this.muted; return this.muted; }
}
