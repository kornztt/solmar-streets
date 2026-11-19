// WebAudio synth SFX + a small music loop. Everything is guarded: no audio
// context (headless, no gesture yet) means silence, never an error.
let ac = null;
let master = null;

export function initAudio() {
  try {
    if (!ac) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      ac = new Ctx();
      master = ac.createGain();
      master.gain.value = 0.16;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return true;
  } catch {
    return false;
  }
}

function tone(freq, dur, type = 'square', vol = 1, slideTo = null) {
  if (!ac || !master) return;
  try {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ac.currentTime + dur + 0.02);
  } catch { /* silence */ }
}

export function sfx(name) {
  if (!ac) return;
  try {
    switch (name) {
      case 'shoot': tone(880, 0.09, 'square', 0.7, 220); break;
      case 'punch': tone(160, 0.12, 'sawtooth', 0.8, 60); break;
      case 'cash': tone(660, 0.1, 'sine', 0.9); setTimeout(() => tone(990, 0.16, 'sine', 0.9), 90); break;
      case 'pickup': tone(520, 0.08, 'sine', 0.8, 780); break;
      case 'crash': tone(120, 0.25, 'sawtooth', 0.9, 40); break;
      case 'click': tone(440, 0.05, 'sine', 0.6); break;
      case 'siren': tone(700, 0.4, 'sine', 0.25, 950); break;
      case 'fail': tone(220, 0.4, 'sawtooth', 0.7, 110); break;
      case 'repair': tone(330, 0.12, 'triangle', 0.8, 660); break;
      default: break;
    }
  } catch { /* silence */ }
}

// A sparse bassline loop: one note per beat while playing.
const BASS = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
export function musicTick(G, dt) {
  if (!ac || G.screen !== 'playing') return;
  G.musicT += dt;
  const beat = 0.32;
  const n = Math.floor(G.musicT / beat);
  if (G.musicT - n * beat < dt) {
    tone(BASS[n % BASS.length], 0.28, 'triangle', 0.5);
    if (n % 4 === 2) tone(BASS[n % BASS.length] * 2, 0.12, 'sine', 0.25);
  }
}
