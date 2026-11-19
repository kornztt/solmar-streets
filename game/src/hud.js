// HUD, menus and toasts: everything the player reads on top of the world.
// Title screen, pause menu, WASTED screen, mission picker, wanted stars,
// money / health / ammo, the objective line and the toast feed.

import { MISSION_DEFS } from './missions.js';
import { hasSaveData } from './save.js';

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.toasts = [];
    this.menuIndex = 0;
  }

  toast(text) {
    this.toasts.push({ text, life: 3.2 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  update(dt) {
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
  }

  // ---- in-game HUD ----

  draw(world) {
    const { ctx, canvas } = this;
    const p = world.entities.player;
    const wanted = world.wanted;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Top-left: money, health, ammo.
    ctx.fillStyle = 'rgba(20,24,36,0.8)';
    ctx.beginPath();
    ctx.roundRect(14, 14, 220, 84, 8);
    ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`$${Math.floor(p.money)}`, 26, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Health ${Math.ceil(p.hp)}`, 26, 52);
    ctx.fillStyle = '#222831';
    ctx.fillRect(26, 72, 120, 8);
    ctx.fillStyle = p.hp > 30 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(26, 72, 120 * (p.hp / 100), 8);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`Ammo ${p.ammo}`, 160, 52);
    if (p.inCar) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Car ${Math.ceil(p.inCar.hp)}%`, 160, 72);
      ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.36)} km/h`, 26, 92 - 14);
    }

    // Wanted stars, top centre.
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      ctx.font = '26px sans-serif';
      ctx.fillStyle = i < wanted ? '#ffd166' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', canvas.width / 2 - 60 + i * 30, 16);
    }

    // Objective line, bottom centre.
    if (world.objective) {
      ctx.font = '15px sans-serif';
      const w = ctx.measureText(world.objective).width + 28;
      ctx.fillStyle = 'rgba(20,24,36,0.8)';
      ctx.beginPath();
      ctx.roundRect((canvas.width - w) / 2, canvas.height - 52, w, 32, 8);
      ctx.fill();
      ctx.fillStyle = '#ffe66d';
      ctx.fillText(world.objective, canvas.width / 2, canvas.height - 44);
    }

    // Mission timer, under the stars.
    if (world.missions.active && world.missions.active.timer > 0) {
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = world.missions.active.timer < 15 ? '#ff6b6b' : '#ffffff';
      ctx.fillText(`${Math.ceil(world.missions.active.timer)}s`, canvas.width / 2, 52);
    }

    // Toasts, bottom left.
    ctx.textAlign = 'left';
    let ty = canvas.height - 110;
    for (const t of this.toasts) {
      ctx.globalAlpha = Math.min(1, t.life);
      ctx.font = '14px sans-serif';
      const w = ctx.measureText(t.text).width + 20;
      ctx.fillStyle = 'rgba(20,24,36,0.85)';
      ctx.beginPath();
      ctx.roundRect(14, ty, w, 26, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t.text, 24, ty + 6);
      ty -= 32;
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---- screens ----

  drawTitle(world) {
    const { ctx, canvas } = this;
    ctx.save();
    ctx.fillStyle = '#141a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Sun-soaked city banner.
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.55);
    g.addColorStop(0, '#ff9a62');
    g.addColorStop(1, '#1b2340');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.55);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(canvas.width * 0.78, 90, 46, 0, Math.PI * 2);
    ctx.fill();
    // Skyline.
    ctx.fillStyle = '#232a45';
    const base = canvas.height * 0.55;
    for (let i = 0; i < 14; i++) {
      const w = 40 + ((i * 37) % 60);
      const h = 40 + ((i * 53) % 120);
      ctx.fillRect(i * (canvas.width / 13), base - h, w, h);
    }
    ctx.fillStyle = '#141a2e';
    ctx.fillRect(0, base, canvas.width, canvas.height - base);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('SOLMAR STREETS', canvas.width / 2, 150);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ffe66d';
    ctx.fillText('An open-world crime story — drive, steal, run, survive.', canvas.width / 2, 190);
    ctx.fillStyle = '#cdd3e0';
    ctx.font = '15px sans-serif';
    ctx.fillText('Vera needs a driver. The Breakers own the docks. The city is yours to take.', canvas.width / 2, 216);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#ffffff';
    const lines = [
      'WASD / Arrows — move & drive      E — steal / exit car',
      'SPACE — punch (on foot) / handbrake (in car)      Click — shoot pistol',
      'M — jobs menu      T — start a taxi fare      P / Esc — pause',
    ];
    lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, 280 + i * 24));

    const hasSave = hasSaveData();
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#2ecc71';
    ctx.fillText('[ ENTER ]  Start a new game', canvas.width / 2, 380);
    if (hasSave) {
      ctx.fillStyle = '#ffd166';
      ctx.fillText('[ C ]  Continue your saved game', canvas.width / 2, 412);
    }
    ctx.fillStyle = '#8a94a6';
    ctx.font = '13px sans-serif';
    ctx.fillText('SOLMAR STREETS — 100% original. No network, no downloads, just the city.', canvas.width / 2, canvas.height - 24);
    ctx.restore();
  }

  drawPause(world) {
    const { ctx, canvas } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,26,0.72)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 60);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#cdd3e0';
    ctx.fillText('[ P / Esc ] Resume      [ M ] Jobs      [ Q ] Save & quit to title', canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = '#ffe66d';
    ctx.fillText(`Money $${Math.floor(world.entities.player.money)}   •   Missions done: ${Object.values(world.missions.done).filter(Boolean).length} / 4`, canvas.width / 2, canvas.height / 2 + 30);
    ctx.restore();
  }

  drawWasted(world) {
    const { ctx, canvas } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(60,10,10,0.78)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('WASTED', canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '17px sans-serif';
    ctx.fillText('The city chewed you up. Vera patched you up — minus a little cash.', canvas.width / 2, canvas.height / 2 + 24);
    ctx.fillStyle = '#ffe66d';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText('[ ENTER ]  Get back on the street', canvas.width / 2, canvas.height / 2 + 70);
    ctx.restore();
  }

  drawMissionMenu(world) {
    const { ctx, canvas } = this;
    const list = world.missions.availableMissions();
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,26,0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('VERA\'S JOBS', canvas.width / 2, 120);
    if (list.length === 0) {
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#2ecc71';
      ctx.fillText('Every job done. Solmar is yours, driver.', canvas.width / 2, 220);
    }
    list.forEach((m, i) => {
      const y = 190 + i * 92;
      const sel = i === world.menuIndex;
      ctx.fillStyle = sel ? 'rgba(255,230,109,0.18)' : 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.roundRect(canvas.width / 2 - 320, y - 34, 640, 76, 10);
      ctx.fill();
      if (sel) {
        ctx.strokeStyle = '#ffe66d';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = '#ffe66d';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`${m.id.toUpperCase()} — ${m.name}   •   $${m.reward}`, canvas.width / 2, y - 6);
      ctx.fillStyle = '#cdd3e0';
      ctx.font = '14px sans-serif';
      ctx.fillText(m.brief, canvas.width / 2, y + 22);
    });
    ctx.fillStyle = '#8a94a6';
    ctx.font = '15px sans-serif';
    ctx.fillText('[ Up / Down ] choose      [ Enter ] take the job      [ M / Esc ] close', canvas.width / 2, canvas.height - 60);
    ctx.restore();
  }
}
