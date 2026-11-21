// WebAudio synth: engine hum, siren, gunshot, cash, punch, music loop.
// Everything is generated — no audio files, no network. All calls are guarded
// so a missing or suspended AudioContext can never throw.

export function createAudio() {
  const A = {
    ctx: null,
    master: null,
    musicOn: true,
    engineOsc: null,
    engineGain: null,
    muted: false,
    init() {
      if (this.ctx) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      } catch (e) { /* audio unavailable: game stays silent */ }
    },
    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    },
    tone(freq, dur, type, vol, slideTo) {
      if (!this.ctx || this.muted) return;
      try {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
        g.gain.setValueAtTime(vol || 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.02);
      } catch (e) { /* ignore */ }
    },
    noise(dur, vol, lowpass) {
      if (!this.ctx || this.muted) return;
      try {
        const t = this.ctx.currentTime;
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const g = this.ctx.createGain();
        g.gain.value = vol || 0.3;
        let node = src;
        if (lowpass) {
          const f = this.ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = lowpass;
          src.connect(f);
          node = f;
        }
        node.connect(g);
        g.connect(this.master);
        src.start(t);
      } catch (e) { /* ignore */ }
    },
    shot() { this.noise(0.12, 0.5, 1800); this.tone(160, 0.08, 'square', 0.12, 60); },
    punch() { this.noise(0.08, 0.35, 900); },
    cash() { this.tone(880, 0.09, 'sine', 0.18); setTimeout(() => this.tone(1174, 0.09, 'sine', 0.18), 90); setTimeout(() => this.tone(1568, 0.16, 'sine', 0.2), 180); },
    pickup() { this.tone(520, 0.07, 'triangle', 0.2, 780); },
    error() { this.tone(140, 0.18, 'sawtooth', 0.15, 90); },
    siren() { this.tone(700, 0.35, 'sine', 0.07, 950); setTimeout(() => this.tone(950, 0.35, 'sine', 0.07, 700), 350); },
    engineStart() { this.tone(90, 0.4, 'sawtooth', 0.12, 180); },
    setEngine(on, speedFrac) {
      if (!this.ctx || this.muted) { this.stopEngine(); return; }
      try {
        if (on && !this.engineOsc) {
          this.engineOsc = this.ctx.createOscillator();
          this.engineGain = this.ctx.createGain();
          this.engineOsc.type = 'sawtooth';
          this.engineGain.gain.value = 0.03;
          const f = this.ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 500;
          this.engineOsc.connect(f);
          f.connect(this.engineGain);
          this.engineGain.connect(this.master);
          this.engineOsc.start();
        }
        if (this.engineOsc) {
          this.engineOsc.frequency.value = 60 + speedFrac * 160;
          this.engineGain.gain.value = on ? 0.02 + speedFrac * 0.05 : 0;
        }
      } catch (e) { /* ignore */ }
    },
    stopEngine() {
      try {
        if (this.engineOsc) { this.engineOsc.stop(); this.engineOsc = null; this.engineGain = null; }
      } catch (e) { this.engineOsc = null; this.engineGain = null; }
    },
  };
  return A;
}

// A tiny step-sequenced bass + hat loop, scheduled from the game tick.
export function musicTick(audio, tick) {
  if (!audio.ctx || audio.muted || !audio.musicOn) return;
  const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
  const step = tick % 16;
  const note = bass[step];
  if (note) audio.tone(note, 0.22, 'triangle', 0.12);
  if (step % 4 === 2) audio.noise(0.03, 0.05, 6000);
}
