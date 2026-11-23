// audio.js — all sound is synthesized with WebAudio: no audio files, no network.
// Effects: gunshot, punch, pickup, siren, engine hum, mission jingle, crash.
// Music: a small step sequencer (bass + hats + lead) that loops while playing.
var AudioSys = {
  ctx: null, master: null, musicGain: null, muted: false,
  engineOsc: null, engineGain: null, sirenTimer: 0, musicTimer: null, musicStep: 0,

  init: function () {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      // Engine hum: two detuned saws through a lowpass, gain driven by speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 58;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp); osc2.connect(lp);
      lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start(); osc2.start();
      this.engineOsc2 = osc2;
    } catch (e) { this.ctx = null; }
  },
  resume: function () {
    if (this.ctx && this.ctx.state === 'suspended') {
      try { const p = this.ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* tearing down */ }
    }
  },
  setMuted: function (m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  },
  setEngine: function (on, speedFrac) {
    if (!this.ctx || !this.engineGain || this.ctx.state === 'closed') return;
    try {
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speedFrac * 0.07 : 0, t, 0.1);
    const f = 50 + speedFrac * 130;
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.08);
    if (this.engineOsc2) this.engineOsc2.frequency.setTargetAtTime(f * 1.01 + 2, t, 0.08);
    } catch (e) { /* context tearing down on navigation */ }
  },
  blip: function (freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted || this.ctx.state === 'closed') return;
    try {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* context tearing down on navigation */ }
  },
  noise: function (dur, vol, filterFreq) {
    if (!this.ctx || this.muted || this.ctx.state === 'closed') return;
    try {
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
    } catch (e) { /* context tearing down on navigation */ }
  },
  gunshot: function () { this.noise(0.14, 0.5, 2800); this.blip(160, 0.1, 'square', 0.25, 60); },
  punch: function () { this.noise(0.08, 0.35, 700); },
  pickup: function () { this.blip(660, 0.09, 'sine', 0.25); setTimeout(() => this.blip(990, 0.12, 'sine', 0.25), 90); },
  cash: function () { this.blip(880, 0.08, 'triangle', 0.25); setTimeout(() => this.blip(1174, 0.1, 'triangle', 0.25), 80); setTimeout(() => this.blip(1568, 0.14, 'triangle', 0.22), 160); },
  crash: function () { this.noise(0.25, 0.5, 500); },
  siren: function () {
    if (!this.ctx || this.muted) return;
    this.blip(720, 0.28, 'sine', 0.07, 950);
    setTimeout(() => this.blip(950, 0.28, 'sine', 0.07, 720), 300);
  },
  missionDone: function () {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'triangle', 0.28), i * 130));
  },
  fail: function () { this.blip(220, 0.4, 'sawtooth', 0.2, 110); },
  // Music sequencer: A-minor groove, 8 steps a bar, bass + hat + sparse lead.
  startMusic: function () {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
    const lead = [220, 0, 0, 261.6, 0, 0, 329.6, 0, 0, 392, 0, 0, 329.6, 0, 261.6, 0];
    this.musicStep = 0;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state === 'closed') return;
      try {
      const s = this.musicStep % 16;
      const t = this.ctx.currentTime;
      if (bass[s]) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = bass[s];
        g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.26);
      }
      if (s % 2 === 0) { // hat tick
        const len = Math.floor(this.ctx.sampleRate * 0.03);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
        const g = this.ctx.createGain(); g.gain.value = s % 4 === 0 ? 0.25 : 0.12;
        src.connect(f); f.connect(g); g.connect(this.musicGain); src.start(t);
      }
      if (lead[s]) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'square'; o.frequency.value = lead[s];
        g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.22);
      }
      this.musicStep++;
      } catch (e) { /* context tearing down on navigation */ }
    }, 190);
  },
  stopMusic: function () {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
};
