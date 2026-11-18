// SOLMAR STREETS — all sound is synthesized live with WebAudio: engine
// hum, sirens, gunshots, pickups and a bass-driven music loop. No audio
// files, no network. One clear job: make noise when the game asks for it.

export function createAudio() {
  return {
    ctx: null,
    muted: false,
    master: null,
    noiseBuf: null,
    engine: null, // {osc, gain, filter}
    siren: null, // {osc, gain}
    musicStep: 0,
    musicNext: 0,
    musicOn: false,
  };
}

/** Create the context on the first user gesture; browsers demand it. */
export function unlockAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  audio.ctx = ctx;
  audio.master = ctx.createGain();
  audio.master.gain.value = 0.55;
  audio.master.connect(ctx.destination);
  const len = ctx.sampleRate;
  audio.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = audio.noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  // Engine: a sawtooth through a lowpass, pitched by speed.
  const engOsc = ctx.createOscillator();
  engOsc.type = 'sawtooth';
  engOsc.frequency.value = 60;
  const engFilter = ctx.createBiquadFilter();
  engFilter.type = 'lowpass';
  engFilter.frequency.value = 500;
  const engGain = ctx.createGain();
  engGain.gain.value = 0;
  engOsc.connect(engFilter);
  engFilter.connect(engGain);
  engGain.connect(audio.master);
  engOsc.start();
  audio.engine = { osc: engOsc, gain: engGain, filter: engFilter };
  // Siren: a square wave that wails between two notes.
  const sirOsc = ctx.createOscillator();
  sirOsc.type = 'square';
  sirOsc.frequency.value = 750;
  const sirGain = ctx.createGain();
  sirGain.gain.value = 0;
  sirOsc.connect(sirGain);
  sirGain.connect(audio.master);
  sirOsc.start();
  audio.siren = { osc: sirOsc, gain: sirGain };
}

function blip(audio, freq, dur, type, vol, slideTo) {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(g);
  g.connect(audio.master);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}

function noise(audio, dur, vol, filterFreq, type = 'lowpass') {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const src = ctx.createBufferSource();
  src.buffer = audio.noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(f);
  f.connect(g);
  g.connect(audio.master);
  src.start();
  src.stop(ctx.currentTime + dur + 0.02);
}

/** A noise sweep that rises (or falls) in pitch: whooshes and skids. */
function sweep(audio, dur, vol, fromFreq, toFreq, type = 'bandpass') {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const src = ctx.createBufferSource();
  src.buffer = audio.noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(fromFreq, ctx.currentTime);
  f.frequency.exponentialRampToValueAtTime(toFreq, ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(f);
  f.connect(g);
  g.connect(audio.master);
  src.start();
  src.stop(ctx.currentTime + dur + 0.02);
}

/** Play a named one-shot effect. Safe to call before unlock: it no-ops. */
export function sfx(audio, name) {
  if (!audio.ctx || audio.muted) return;
  switch (name) {
    case 'shot':
      noise(audio, 0.12, 0.5, 2800, 'highpass');
      blip(audio, 180, 0.08, 'square', 0.25, 60);
      break;
    case 'punch':
      blip(audio, 140, 0.12, 'sine', 0.4, 50);
      noise(audio, 0.08, 0.2, 600);
      break;
    case 'pickup':
      blip(audio, 660, 0.09, 'sine', 0.25);
      setTimeout(() => blip(audio, 990, 0.12, 'sine', 0.25), 70);
      break;
    case 'coin':
      // Fare paid, or a close call: a bright two-coin chime.
      blip(audio, 988, 0.07, 'triangle', 0.3);
      setTimeout(() => blip(audio, 1319, 0.14, 'triangle', 0.3), 60);
      break;
    case 'tip':
      // A tipped fare: the coin chime, plus a third note on top.
      blip(audio, 988, 0.07, 'triangle', 0.3);
      setTimeout(() => blip(audio, 1319, 0.1, 'triangle', 0.3), 60);
      setTimeout(() => blip(audio, 1568, 0.16, 'triangle', 0.3), 130);
      break;
    case 'buy':
      // Cash register: a cha-ching of two notes and a tick.
      blip(audio, 880, 0.08, 'square', 0.18);
      setTimeout(() => blip(audio, 1175, 0.16, 'square', 0.18), 70);
      noise(audio, 0.05, 0.15, 5000, 'highpass');
      break;
    case 'heal':
      // A soft rising triad for a health pickup.
      [523, 659, 784].forEach((f, i) => setTimeout(() => blip(audio, f, 0.2, 'sine', 0.22), i * 80));
      break;
    case 'horn':
      // A dual-tone car horn: two saws a semitone apart, short and loud.
      blip(audio, 370, 0.32, 'sawtooth', 0.22, 370);
      blip(audio, 392, 0.32, 'sawtooth', 0.18, 392);
      break;
    case 'doorSlam':
      // Getting into a car: a low thud and a latch click.
      blip(audio, 110, 0.12, 'sine', 0.5, 45);
      setTimeout(() => noise(audio, 0.05, 0.25, 1800, 'highpass'), 60);
      break;
    case 'engineStart':
      // The starter cranks, then the engine catches.
      blip(audio, 55, 0.35, 'sawtooth', 0.25, 140);
      noise(audio, 0.3, 0.12, 500);
      break;
    case 'nearMiss':
      // Air rushing past at speed: a quick rising whoosh.
      sweep(audio, 0.35, 0.3, 500, 2400);
      break;
    case 'crash':
      noise(audio, 0.25, 0.5, 900);
      blip(audio, 90, 0.2, 'sine', 0.35, 40);
      break;
    case 'explosion':
      noise(audio, 0.9, 0.8, 500);
      blip(audio, 70, 0.8, 'sine', 0.6, 28);
      break;
    case 'mission':
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(audio, f, 0.18, 'triangle', 0.3), i * 90));
      break;
    case 'fail':
      [392, 330, 262].forEach((f, i) => setTimeout(() => blip(audio, f, 0.22, 'triangle', 0.28), i * 130));
      break;
    case 'click':
      blip(audio, 880, 0.05, 'square', 0.15);
      break;
    case 'denied':
      // Tried to buy without the cash: a low dull buzz, not a crash.
      blip(audio, 160, 0.14, 'sawtooth', 0.2, 110);
      break;
    case 'reload':
      // A pistol reload: two metallic clicks, magazine out and in.
      blip(audio, 1200, 0.05, 'square', 0.18, 700);
      setTimeout(() => blip(audio, 900, 0.06, 'square', 0.2, 1400), 90);
      break;
    case 'sirenBlip':
      blip(audio, 980, 0.1, 'square', 0.12, 700);
      break;
    case 'screech':
      // Tyres giving up under the handbrake: a falling high whine.
      sweep(audio, 0.4, 0.28, 2200, 900);
      break;
    case 'alarm':
      // The stolen-car alarm that draws the law: two alternating wails.
      blip(audio, 620, 0.16, 'square', 0.2, 620);
      setTimeout(() => blip(audio, 830, 0.16, 'square', 0.2, 830), 160);
      break;
    case 'wasted':
      // The long low fall for the game-over screen.
      [330, 262, 196, 131].forEach((f, i) => setTimeout(() => blip(audio, f, 0.4, 'sawtooth', 0.2), i * 220));
      break;
    default:
      break;
  }
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.55;
  return audio.muted;
}

// A 16-step bass loop in A minor, with a kick on the beat and hats off it.
// Every second bar a quiet pentatonic lead answers the bass, so the loop
// never sits still for long. The music scheduler runs off the audio clock,
// a step ahead of the frame.
const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 61.74, 0, 73.42, 0];
const LEAD = [220, 0, 261.63, 0, 329.63, 0, 392, 0, 329.63, 0, 261.63, 0, 220, 0, 196, 0];
// The fourth bar answers higher, so the four-bar phrase lifts before it loops.
const LEAD_B = [261.63, 0, 329.63, 0, 392, 0, 440, 0, 392, 0, 329.63, 0, 261.63, 0, 220, 0];
const STEP_LEN = 60 / 112 / 4;

function musicStep(audio, step, when) {
  const ctx = audio.ctx;
  const bass = BASS[step % 16];
  if (bass > 0) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = bass;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + STEP_LEN * 1.8);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(when);
    osc.stop(when + STEP_LEN * 2);
  }
  // Lead: on the second bar of each four-bar phrase it answers the bass
  // with LEAD; on the fourth bar it answers higher with LEAD_B, so the
  // phrase lifts before it loops instead of sitting still.
  const bar = Math.floor(step / 16) % 4;
  const leadTable = bar === 3 ? LEAD_B : LEAD;
  const lead = leadTable[step % 16];
  if ((bar === 1 || bar === 3) && lead > 0) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = lead;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + STEP_LEN * 2.2);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(when);
    osc.stop(when + STEP_LEN * 2.4);
  }
  if (step % 4 === 0) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, when);
    osc.frequency.exponentialRampToValueAtTime(40, when + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.14);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(when);
    osc.stop(when + 0.16);
  }
  if (step % 2 === 1) {
    const src = ctx.createBufferSource();
    src.buffer = audio.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    src.connect(f);
    f.connect(g);
    g.connect(audio.master);
    src.start(when);
    src.stop(when + 0.06);
  }
  // A soft crash on the first step of each four-bar phrase: the loop
  // turns a corner instead of just repeating.
  if (step % 64 === 0) {
    const src = ctx.createBufferSource();
    src.buffer = audio.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 4500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.5);
    src.connect(f);
    f.connect(g);
    g.connect(audio.master);
    src.start(when);
    src.stop(when + 0.55);
  }
}

/** Per-frame audio: engine pitch, siren wail, music scheduling. */
export function updateAudio(audio, world) {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const p = world.player;
  // Engine hum follows the driven car's speed.
  if (audio.engine) {
    const driving = p.car && !p.car.dead;
    const target = driving ? 0.05 + (Math.abs(p.car.speed) / 520) * 0.09 : 0;
    audio.engine.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    if (driving) {
      audio.engine.osc.frequency.setTargetAtTime(55 + (Math.abs(p.car.speed) / 520) * 130, ctx.currentTime, 0.1);
      audio.engine.filter.frequency.setTargetAtTime(400 + (Math.abs(p.car.speed) / 520) * 900, ctx.currentTime, 0.1);
    }
  }
  // Siren wails while the police are after the player.
  if (audio.siren) {
    const chasing = world.wanted > 0 && world.police.some((c) => !c.dead);
    audio.siren.gain.gain.setTargetAtTime(chasing ? 0.045 : 0, ctx.currentTime, 0.2);
    if (chasing) {
      const phase = Math.floor(ctx.currentTime * 1.6) % 2;
      audio.siren.osc.frequency.setTargetAtTime(phase === 0 ? 720 : 980, ctx.currentTime, 0.05);
    }
  }
  // Music: schedule steps a little ahead of the clock. The phrase is four
  // bars (64 steps) so the lead has somewhere to go.
  if (audio.musicOn && world.screen === 'play') {
    if (audio.musicNext === 0) audio.musicNext = ctx.currentTime + 0.05;
    while (audio.musicNext < ctx.currentTime + 0.25) {
      musicStep(audio, audio.musicStep, audio.musicNext);
      audio.musicStep = (audio.musicStep + 1) % 64;
      audio.musicNext += STEP_LEN;
    }
  }
}
