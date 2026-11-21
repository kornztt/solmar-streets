// On-screen HUD: money, health, ammo, wanted stars, clock, objective text
// and the big centre banner.
import { MISSION_DEFS } from './config.js';

function fmtClock(clock) {
  const h = Math.floor(clock) % 24;
  const m = Math.floor((clock % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function drawHUD(G, ctx, W, H) {
  const P = G.player;
  ctx.textAlign = 'left';
  // Money.
  ctx.fillStyle = 'rgba(10,14,24,0.7)';
  ctx.fillRect(12, 12, 150, 34);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`$${P.money}`, 22, 37);
  // Health bar.
  ctx.fillStyle = 'rgba(10,14,24,0.7)';
  ctx.fillRect(12, 52, 150, 16);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(14, 54, 146 * Math.max(0, P.hp / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`HP ${Math.ceil(P.hp)}`, 18, 64);
  // Ammo + car health.
  ctx.fillStyle = 'rgba(10,14,24,0.7)';
  ctx.fillRect(12, 74, 150, 34);
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`Ammo ${P.ammo}`, 20, 88);
  if (P.car) {
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${P.car.name}  ${Math.ceil(P.car.hp)}/${P.car.maxHp}`, 20, 104);
  }
  // Wanted stars, top centre.
  const cx = W / 2;
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < P.wanted ? '#f1c40f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', cx - 56 + i * 28, 38);
  }
  // Clock + day/night.
  ctx.fillStyle = 'rgba(10,14,24,0.7)';
  ctx.fillRect(W - 178, 12, 80, 26);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(fmtClock(G.clock), W - 168, 30);
  // Mission objective, top left under the bars.
  ctx.textAlign = 'left';
  let obj = '';
  if (G.missionIndex < MISSION_DEFS.length) {
    const def = MISSION_DEFS[G.missionIndex];
    obj = G.missionActive ? `${def.name}` : `${def.name} — go to the yellow marker`;
  } else {
    obj = 'All story missions done — free roam!';
  }
  if (G.taxi) obj += '  |  Taxi fare running';
  if (G.courier) obj += '  |  Courier job running';
  ctx.fillStyle = 'rgba(10,14,24,0.7)';
  const ow = ctx.measureText(obj).width + 20;
  ctx.fillRect(12, H - 44, ow, 28);
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(obj, 22, H - 25);
  // Hint line (contextual).
  if (G.hint) {
    ctx.fillStyle = 'rgba(10,14,24,0.7)';
    const hw = ctx.measureText(G.hint).width + 20;
    ctx.fillRect(12, H - 78, hw, 26);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(G.hint, 22, H - 60);
  }
  // Big centre banner with a fade.
  if (G.bannerText && G.bannerT > 0) {
    const a = Math.min(1, G.bannerT / 0.5);
    ctx.globalAlpha = a;
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    const bw = ctx.measureText(G.bannerText).width + 48;
    ctx.fillStyle = 'rgba(10,14,24,0.75)';
    ctx.fillRect(W / 2 - bw / 2, 84, bw, 48);
    ctx.fillStyle = G.bannerColor || '#fff';
    ctx.fillText(G.bannerText, W / 2, 116);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
  // Controls reminder, bottom right.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move/drive · Mouse aim · Click shoot · E enter/interact · P pause · M mute', W - 12, H - 12);
  ctx.textAlign = 'left';
}
