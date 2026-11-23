[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/kornztt/solmar-streets/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/kornztt/solmar-streets/reward.svg)](https://make.fun/bounty/gta6-01)

# SOLMAR STREETS — 索尔玛街头

一座原创的开放世界犯罪游戏：在阳光与霓虹交替的索尔玛市里，步行、偷车、甩掉警车、
接剧情任务、拉客送货、买枪修车，从街头小混混一路做到午夜大劫案。

## 城市

9×9 个街区，9 个不同风貌的城区：市中心高楼（夜里窗户亮灯）、海港码头、
湖畔公园、砖砌老城、北郊住宅、中央广场（带直升机坪的地标）、集市区、
游艇码头、大学城。完整的昼夜循环：白天阳光明媚，夜里车灯光锥划破黑暗、
路灯亮起、楼窗透出暖光。

## 玩法

- **步行 + 开车**：6 种车型（轿车、出租车、跑车、面包车、卡车、肌肉车）、12 种车漆，
  路边看到就能偷，偷车涨通缉。
- **交通与行人**：交通车沿路网巡游，8 种行人在人行道散步，出事就四散逃跑。
- **通缉 0–5 星**：警车追捕、撞停你的车；躲一阵子热度会自己降下来。
- **5 个剧情任务**：M1 逃出生天、M2 火线送货、M3 码头清场、M4 港口追逐、
  M5 午夜劫案（天黑后截停运钞车、抢 3 袋现金、顶着 3 星通缉回到藏匿点）。
- **2 个支线工作**：出租车拉客、快递送货，可重复赚钱。
- **战斗**：SPACE 出拳，鼠标点击开枪（手枪和子弹去 GUN BARN 买）。
- **3 家店**：PIT STOP 修车行（修车、买护甲）、GUN BARN 枪店（手枪、子弹）、
  DINER 餐馆（吃饭回血、打点降通缉）。
- **表现**：HUD + 小地图、标题 / 暂停 / WASTED 画面、localStorage 存档读档、
  WebAudio 合成音效与音乐循环（无任何音频文件）。

## 操作

| 按键 | 动作 |
| --- | --- |
| W A S D / 方向键 | 走路 / 开车 |
| E | 上下车 / 进店 / 抢现金 |
| SPACE | 出拳 |
| 鼠标点击 | 开枪（需先买手枪） |
| 1–5 | 开始剧情任务 M1–M5 |
| T | 出租车工作 |
| C | 快递工作 |
| P / ESC | 暂停 |
| S（暂停时） | 保存进度 |
| M | 静音 |
| L（标题画面） | 读取存档继续 |

## 运行

纯静态文件，无构建、无网络请求：

```sh
cd game && python3 -m http.server 8123
# 浏览器打开 http://127.0.0.1:8123/index.html
```

## 技术

Canvas 2D，源码按职责分文件：`js/city.js`（城市与碰撞）、`js/vehicles.js`（车辆与交通）、
`js/people.js`（行人与警察）、`js/missions.js`（任务与支线工作）、`js/shops.js`（商店）、
`js/hud.js`（HUD、小地图与提示）、`js/audio.js`（WebAudio 合成音）、`js/main.js`（主循环与通缉系统）。
