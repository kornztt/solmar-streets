// The shared mutable game state. Plain data only; modules operate on it.
import { CFG } from './config.js';

export function createGame(seed) {
  return {
    seed,
    time: 0, // seconds since the run started
    clock: 8 * 60, // minutes since midnight, day starts at 08:00
    money: CFG.startMoney,
    hp: 100,
    ammo: 12, // pistol magazine
    reserve: 24, // spare ammo
    wanted: 0, // stars 0..5
    heat: 0, // 0..100, drives the star level
    screen: 'title', // title | playing | paused | wasted | busted
    over: null, // { kind: 'wasted' | 'busted', t: 0 }
    player: { x: 0, y: 0, angle: -Math.PI / 2, speed: 0, onFoot: true, car: null, punchT: 0, shootT: 0 },
    cars: [], // { id, model, color, x, y, angle, speed, hp, kind, driver, wp, wpTarget, stuck }
    peds: [], // { x, y, angle, speed, tx, ty, color, fare: bool, scared }
    cops: [], // { x, y, angle, speed, kind: 'car' | 'officer', car, bustT }
    bullets: [], // { x, y, vx, vy, left, from: 'player' | 'enemy', dmg }
    parts: [], // particles { x, y, vx, vy, life, color, size }
    floats: [], // floating texts { x, y, text, life, color }
    mission: { idx: 0, id: null, stage: 0, timer: 0, target: null, breakers: [], courier: null, ledger: null, runner: null, done: [false, false, false, false] },
    taxi: { active: false, fare: null, dest: null, timer: 0, pay: 0 },
    stats: { earned: 0, fares: 0, kills: 0 },
    camera: { x: 0, y: 0 },
    mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false },
    keys: {},
    toasts: [], // { text, t }
    saveTimer: 0,
    musicT: 0,
    shotName: null,
  };
}
