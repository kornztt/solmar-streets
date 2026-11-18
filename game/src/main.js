// Boot and game loop: canvas, world, input, audio, a fixed-step update and
// the render call. Also the debug hook the playtests drive the game through.
import { VIEW_W, VIEW_H } from './config.js';
import { AudioSys } from './audio.js';
import { World } from './world.js';
import { draw } from './render.js';
import { Input } from './input.js';
import { stageShot, shotInput } from './shots.js';
import { startMission } from './missions.js';

const STEP = 1 / 60;

function params() {
  const q = new URLSearchParams(window.location.search);
  const seed = Number(q.get('seed'));
  return {
    seed: Number.isFinite(seed) && seed > 0 ? Math.floor(seed) : 7,
    shot: q.get('shot'),
  };
}

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

const { seed, shot } = params();
const audio = new AudioSys();
const world = new World(seed, audio);
const input = new Input();
input.attach(canvas);

if (shot) {
  // A staged screenshot scene: skip the title screen, set the scene up,
  // and keep driving it with the scripted input while the page runs.
  world.screen = 'play';
  stageShot(shot, world);
}

let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard < 5) {
    const effective = shot ? shotInput(shot, world) : input;
    world.step(STEP, effective);
    acc -= STEP;
    guard += 1;
  }
  draw(ctx, world);
  input.endFrame();
  requestAnimationFrame(frame);
}

// The debug hook: state and cheats the verification scripts use. The game
// itself never reads it; it only makes live testing possible.
window.__SOLMAR__ = {
  world,
  teleport(x, y) {
    world.teleport(x, y);
  },
  startMission(id) {
    if (id === 'm3') {
      world.mission.done = { m1: true, m2: true };
      world.mission.next = 'm3';
    } else if (id === 'm2') {
      world.mission.done = { m1: true };
      world.mission.next = 'm2';
    }
    startMission(world, id);
  },
  setMoney(n) {
    world.player.money = n;
  },
  giveAmmo(n) {
    world.player.ammo += n;
  },
  setWanted(n) {
    world.setWanted(n);
  },
  spawnPolice(n) {
    world.spawnPolice(n);
  },
  save() {
    world.save();
  },
};

requestAnimationFrame(frame);
