// HUD, prompts, toasts, and the title / pause / WASTED / BUSTED screens.
import { CFG, fmtClock, districtAt } from './config.js';
import { clamp } from './random.js';
import { landmarkPos } from './city.js';
import { missionObjective, nextMissionIdx } from './missions.js';
import { dist } from './random.js';
import { nearestCar } from './entities.js';
import { hasSave } from './save.js';

export function drawHud(G, ctx, vw, vh) {
  ctx.textAlign = 'left';
  // Top-left: money, health, ammo.
  ctx.fillStyle = 'rgba(10,14,24,0.75)';
  ctx.fillRect(12, 12, 250, 86);
  ctx.fillStyle = '#f2b705';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${G.money}`, 24, 44);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText(`HP ${Math.ceil(G.hp)}`, 24, 66);
  ctx.fillStyle = '#222';
  ctx.fillRect(70, 56, 120, 10);
  ctx.fillStyle = G.hp > 40 ? '#37b24d' : '#e33f2f';
  ctx.fillRect(70, 56, 120 * clamp(G.hp / 100, 0, 1), 10);
  ctx.fillStyle = '#fff';
  ctx.fillText(`Ammo ${G.ammo} (+${G.reserve})`, 24, 88);
  // Top-right: wanted stars, clock, district.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(10,14,24,0.75)';
  ctx.fillRect(vw - 232, 12, 220, 66);
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
  ctx.fillStyle = G.wanted > 0 ? '#ff5a5a' : '#888';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(stars, vw - 24, 42);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  const bx = Math.floor(G.player.x / CFG.pitch);
  const by = Math.floor(G.player.y / CFG.pitch);
  ctx.fillText(`${fmtClock(G.clock)}  ${districtAt(bx, by)}`, vw - 24, 64);
  // Objective, bottom-left.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,14,24,0.75)';
  ctx.fillRect(12, vh - 52, 560, 40);
  ctx.fillStyle = '#f2b705';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(missionObjective(G), 24, vh - 26);
  if (G.taxi.active) {
    ctx.fillStyle = '#19b8a6';
    ctx.fillText(`Taxi: ${Math.ceil(G.taxi.timer)}s — $${G.taxi.pay}`, 24, vh - 62);
  }
  // Interaction prompt.
  const prompt = interactionPrompt(G);
  if (prompt) {
    ctx.fillStyle = 'rgba(10,14,24,0.8)';
    ctx.fillRect(vw / 2 - 190, vh - 120, 380, 34);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(prompt, vw / 2, vh - 97);
    ctx.textAlign = 'left';
  }
  // Toasts.
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px sans-serif';
  let ty = 120;
  for (const t of G.toasts) {
    ctx.fillStyle = 'rgba(10,14,24,0.8)';
    const w = ctx.measureText(t.text).width + 28;
    ctx.fillRect(vw / 2 - w / 2, ty, w, 30);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text, vw / 2, ty + 21);
    ty += 38;
  }
  ctx.textAlign = 'left';
}

export function interactionPrompt(G) {
  const p = G.player;
  const h = landmarkPos('hideout');
  if (p.onFoot && dist(p.x, p.y, h.x, h.y) < 90 && G.mission.id === null) {
    return nextMissionIdx(G) >= 0 ? '[E] Talk to Vera — start the next job' : '[E] Talk to Vera';
  }
  if (p.onFoot) {
    const car = nearestCar(G, p.x, p.y, 70);
    if (car) return '[E] Steal the car';
    const gb = landmarkPos('gunbarn');
    if (dist(p.x, p.y, gb.x, gb.y) < 80) return '[B] Gun Barn — ammo +30 for $150';
    return null;
  }
  const ps = landmarkPos('pitstop');
  if (dist(p.x, p.y, ps.x, ps.y) < 95 && p.car && p.car.hp < p.car.maxHp) {
    return '[F] Pit Stop — repair $120';
  }
  if (p.car && p.car.hp >= p.car.maxHp && dist(p.x, p.y, ps.x, ps.y) < 95) {
    return 'Pit Stop — already mint, no charge';
  }
  return '[T] Hail a taxi fare';
}

export function drawScreen(G, ctx, vw, vh) {
  if (G.screen === 'playing') return;
  ctx.fillStyle = 'rgba(8,10,20,0.82)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  if (G.screen === 'title') {
    ctx.fillStyle = '#f2b705';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('SOLMAR STREETS', vw / 2, 170);
    ctx.fillStyle = '#fff';
    ctx.font = '22px sans-serif';
    ctx.fillText('An open-world crime game in the spirit of GTA 6', vw / 2, 215);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#cfd6e4';
    const lines = [
      'WASD / Arrows — walk & drive    E — enter car / talk to Vera',
      'Space — punch / handbrake    Click — shoot    R — reload',
      'T — taxi fare    F — Pit Stop repair    B — Gun Barn ammo',
      'P / Esc — pause    M — mute    Steal cars, lose the cops, do Vera\'s jobs.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, vw / 2, 290 + i * 30));
    ctx.fillStyle = '#f2b705';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(hasSave() ? 'Click to play — or press C to Continue your save' : 'Click to play', vw / 2, 470);
    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText('100% original: its own city, characters, vehicles, story and music.', vw / 2, 520);
  } else if (G.screen === 'paused') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('PAUSED', vw / 2, 300);
    ctx.font = '20px sans-serif';
    ctx.fillText('P / Esc — resume    Click — resume', vw / 2, 350);
  } else if (G.screen === 'wasted') {
    ctx.fillStyle = '#e33f2f';
    ctx.font = 'bold 80px sans-serif';
    ctx.fillText('WASTED', vw / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('You wake up at the hideout, $100 lighter.', vw / 2, 350);
    ctx.fillText('Press Enter to get back up.', vw / 2, 385);
  } else if (G.screen === 'busted') {
    ctx.fillStyle = '#2d6bff';
    ctx.font = 'bold 80px sans-serif';
    ctx.fillText('BUSTED', vw / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('The police take you in. You post bail and walk out $100 lighter.', vw / 2, 350);
    ctx.fillText('Press Enter to get back up.', vw / 2, 385);
  }
  ctx.textAlign = 'left';
}
