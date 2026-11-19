// HUD and menu screens, drawn on the same canvas as the world.
import { CFG } from './config.js';
import { isNight } from './render.js';
import { loadGame } from './save.js';

function fmtClock(hours, minutes) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor(minutes);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function drawHUD(G, ctx, W, H) {
  const p = G.player;
  ctx.textAlign = 'left';
  // money + wanted
  ctx.fillStyle = 'rgba(10,14,24,0.75)';
  ctx.fillRect(10, 10, 260, 64);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`$${G.money}`, 22, 38);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('★'.repeat(p.wanted) + '☆'.repeat(5 - p.wanted), 22, 64);
  // clock
  const night = isNight(G.time.hours);
  ctx.fillStyle = 'rgba(10,14,24,0.75)';
  ctx.fillRect(W - 170, 10, 160, 40);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${night ? '🌙' : '☀'} ${fmtClock(G.time.hours, G.time.minutes)}  Day ${G.time.day}`, W - 22, 38);
  ctx.textAlign = 'left';
  // health + ammo
  ctx.fillStyle = 'rgba(10,14,24,0.75)';
  ctx.fillRect(10, H - 66, 240, 56);
  ctx.fillStyle = '#e33';
  ctx.fillRect(22, H - 52, 140 * (p.hp / CFG.maxHp), 14);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  ctx.strokeRect(22, H - 52, 140, 14);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 170, H - 40);
  ctx.fillText(`Ammo ${p.ammo}`, 22, H - 18);
  // speed when driving
  if (p.inCar) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.36 * 3.6)} km/h`, W - 220, H - 24);
    ctx.textAlign = 'left';
  }
  // objective
  ctx.fillStyle = 'rgba(10,14,24,0.75)';
  const obj = G.objective || 'See Vera at her office to start a job.';
  ctx.font = 'bold 15px sans-serif';
  const w = ctx.measureText(obj).width + 24;
  ctx.fillRect((W - w) / 2, 10, w, 30);
  ctx.fillStyle = '#ffd76e';
  ctx.textAlign = 'center';
  ctx.fillText(obj, W / 2, 30);
  ctx.textAlign = 'left';
  // mission timer
  if (G.mission.active && G.mission.timer > 0) {
    ctx.fillStyle = G.mission.timer < 30 ? '#e33' : '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱ ${Math.ceil(G.mission.timer)}s`, W / 2, 62);
    ctx.textAlign = 'left';
  }
  // nearby prompt
  if (G.prompt) {
    ctx.fillStyle = 'rgba(10,14,24,0.8)';
    ctx.font = 'bold 15px sans-serif';
    const pw = ctx.measureText(G.prompt).width + 24;
    ctx.fillRect((W - pw) / 2, H - 110, pw, 30);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(G.prompt, W / 2, H - 90);
    ctx.textAlign = 'left';
  }
}

function panel(ctx, W, H, title, lines, foot) {
  ctx.fillStyle = 'rgba(5,8,18,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f5a623';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, H / 2 - 120);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, H / 2 - 70 + i * 28));
  ctx.fillStyle = '#ffd76e';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(foot, W / 2, H / 2 + 60);
  ctx.textAlign = 'left';
}

export function drawTitle(G, ctx, W, H) {
  const hasSave = !!loadGame();
  panel(ctx, W, H, 'SOLMAR STREETS', [
    'An open-world crime game in the spirit of GTA.',
    'Drive, steal cars, outrun the police, run jobs for Vera.',
    'WASD drive / walk  •  Mouse aim, click to shoot  •  Space punch',
    'E enter a car / interact  •  P pause  •  M mute',
    '',
    'Five story missions, a taxi job and courier runs.',
    'Day and night, a living city, and a wanted level that answers back.',
  ], hasSave ? 'Click to play — or press C to Continue your save' : 'Click to play');
}

export function drawPause(G, ctx, W, H) {
  panel(ctx, W, H, 'PAUSED', [
    `Money $${G.money}  •  Jobs done: ${G.missionsDone.length}/5`,
    G.objective || '',
  ], 'Press P to resume');
}

export function drawWasted(G, ctx, W, H) {
  panel(ctx, W, H, 'WASTED', [
    'The hospital patched you up.',
    `-$${CFG.respawnFine} hospital bill.`,
  ], 'Press Enter to get back on the streets');
}

export function drawBusted(G, ctx, W, H) {
  panel(ctx, W, H, 'BUSTED', [
    'The Solmar PD took you in.',
    `-$${CFG.bustedFine} bail. The job is off.`,
  ], 'Press Enter to get back on the streets');
}
