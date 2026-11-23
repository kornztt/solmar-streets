// shops.js — the three storefronts: Pit Stop (repair + armor), Gun Barn (pistol +
// ammo) and Diner (food + bribing the heat down). E near a shop opens its menu;
// 1/2 buy, E closes. Prices and effects live here, nowhere else.
function nearestShop(x, y, maxD) {
  let best = null, bd = (maxD || 80) * (maxD || 80);
  for (const s of CITY.shops) {
    const d2 = dist2(x, y, s.x, s.y);
    if (d2 < bd) { bd = d2; best = s; }
  }
  return best;
}
function shopMenu(shop) {
  if (shop.id === 'pitstop') return [
    { key: '1', name: '修车（恢复车辆耐久）', price: 50, can: function (G) { return G.inCar && G.car && G.car.health < 100; }, why: '需要先开一辆车过来' },
    { key: '2', name: '买防弹衣（护甲 +100）', price: 80, can: function (G) { return G.armor < 100; }, why: '护甲已满' }
  ];
  if (shop.id === 'gunbarn') return [
    { key: '1', name: '买手枪', price: 200, can: function (G) { return !G.hasGun; }, why: '已经有手枪了' },
    { key: '2', name: '买子弹 ×12', price: 40, can: function (G) { return G.hasGun; }, why: '先买一把手枪' }
  ];
  return [
    { key: '1', name: '吃一顿（生命 +40）', price: 15, can: function (G) { return G.health < 100; }, why: '生命已满' },
    { key: '2', name: '请客“打点”（通缉 −2 星）', price: 100, can: function (G) { return G.wanted > 0; }, why: '现在没有通缉' }
  ];
}
function buyShopItem(G, shop, idx) {
  const items = shopMenu(shop);
  const it = items[idx];
  if (!it) return;
  if (!it.can(G)) { showToast(it.why + '。'); return; }
  if (G.cash < it.price) { showToast('钱不够：需要 ' + fmtMoney(it.price) + '。'); return; }
  G.cash -= it.price;
  if (shop.id === 'pitstop') {
    if (idx === 0) { G.car.health = 100; showToast('车辆修好了！'); }
    else { G.armor = 100; showToast('穿上防弹衣，护甲已满。'); }
  } else if (shop.id === 'gunbarn') {
    if (idx === 0) { G.hasGun = true; G.ammo += 12; showToast('买到手枪一把，子弹 12 发。鼠标点击开枪！'); }
    else { G.ammo += 12; showToast('子弹 +12，现在 ' + G.ammo + ' 发。'); }
  } else {
    if (idx === 0) { G.health = Math.min(100, G.health + 40); showToast('吃饱了，生命恢复。'); }
    else { setWanted(G, Math.max(0, G.wanted - 2)); showToast('风声过去了，通缉降到 ' + G.wanted + ' 星。'); }
  }
  AudioSys.cash();
  saveGame(G);
}
