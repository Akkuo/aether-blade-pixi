import { ROOM_COLS, ROOM_ROWS, TILE } from './constants.js';

/*
  Legend (20 cols x 12 rows):
  . = Grass (Overworld) / Dungeon Floor (Dungeon)
  p = Dirt Path
  f = Flowers
  T = Tree
  ~ = Water
  = = Bridge
  b = Cuttable Bush
  r = Rock
  W = Dungeon Wall
  X = Cracked Wall (Bombable!)
  P = Pushable Stone Block
  S = Floor Pressure Switch
  D = Locked Door (uses Small Key)
  t = Glowing Torch
  v = Stairs Down (enter dungeon)
  ^ = Stairs Up (exit dungeon)
  i = Signpost
  O = Pedestal
  o = Smashable Pot (drops rupees/hearts/bombs!)
  C = Crystal Switch Orb (toggles Red/Blue barriers!)
  R = Red Barrier Block
  B = Blue Barrier Block
  U = Unlit Brazier (ignite with Fire Rod!)
  F = Fairy Healing Spring (refills full HP!)
*/

const OVERWORLD_ROOMS = {
  '0,1': {
    name: '聖樹平原 — 旅途起點',
    isDungeon: false,
    grid: [
      'TTTTTTTTTppTTTTTTTTT',
      'T..f....pppp....f..T',
      'T..oo...p..p...bb..T',
      'T.......p..p.......T',
      'T..i....pppp.......T',
      'T.......pppppppppppp',
      'T..f....pppppppppppp',
      'T.......p..........T',
      'T..bbb..p....ooo...T',
      'T..b.b..p....f.....T',
      'T.......f..........T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    npc: {
      x: 10 * 16,
      y: 2 * 16 + 4,
      kind: 'elder',
      name: '長老',
      text: '勇者啊！打碎陶罐與草叢可收集盧比！東方有迴力鏢與道具市集（可買聖火法杖與金劍），北方裂岩用炸彈炸開即可取得鑰匙！',
    },
    signText: '路標：往東 → 低語森林（迴力鏢＋水晶機關）｜ 往北 ↑ 裂岩密道',
    enemies: [{ type: 'slime', x: 14 * 16, y: 8 * 16 }],
    chests: [],
    shopItems: [],
    traps: [],
  },
  '1,1': {
    name: '低語森林 — 紅藍水晶機關',
    isDungeon: false,
    grid: [
      'TTTTTTTTTppTTTTTTTTT',
      'T..bbbb..pp..RRRR..T',
      'T..b..b..pp..R..R..T',
      'T..b..b..pp..R..R..T',
      'T........pp..C..R..T',
      'pppppppppppppppppppp',
      'pppppppppppppppppppp',
      'T..f.....bb.....f..T',
      'T..oo...bbbb...oo..T',
      'T.......b..b.......T',
      'T...f..........f...T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    signText: '敲擊紅藍水晶球 [C] 可切換紅藍石柱升降！用迴力鏢也能隔空觸發！',
    enemies: [
      { type: 'slime', x: 5 * 16, y: 3 * 16 },
      { type: 'slime', x: 14 * 16, y: 8 * 16 },
      { type: 'octorok', x: 15 * 16, y: 3 * 16 },
    ],
    chests: [
      { id: 'forest_boomerang', x: 4 * 16, y: 2 * 16, reward: 'boomerang', text: '獲得【疾風迴力鏢】！按 Q 切換、E 投擲，可隔空敲水晶球、擊暈敵人並回收掉落物！' },
      { id: 'forest_rupee_vault', x: 14 * 16, y: 2 * 16, reward: 'rupees_30', text: '破解紅藍水晶機關！獲得【30 盧比】！快去東北方市集升級裝備！' },
    ],
    shopItems: [],
    traps: [],
  },
  '2,1': {
    name: '湖畔聖泉 — 妖精之泉',
    isDungeon: false,
    grid: [
      'TTTTTTTTTppTTTTTTTTT',
      'T~~~~~~~pppp~~~~~~~T',
      'T~~~~~~~p..p~~~~~~~T',
      'T~~~....p..p....~~~T',
      'T~~~.oo.pFFp.bb.~~~T',
      'pppp====pFFp====...T',
      'pppp====pppp====...T',
      'T~~~.f..p..p..f.~~~T',
      'T~~~....p..p....~~~T',
      'T~~~~~~~....~~~~~~~T',
      'T~~~~~~~~~~~~~~~~~~T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    enemies: [
      { type: 'octorok', x: 15 * 16, y: 3 * 16 },
      { type: 'octorok', x: 15 * 16, y: 8 * 16 },
    ],
    chests: [{ id: 'lake_heart', x: 17 * 16, y: 5 * 16, reward: 'heart_container', text: '獲得【生命之心容器】！最大生命值永久 +1 顆心！' }],
    shopItems: [],
    traps: [],
  },
  '0,0': {
    name: '裂岩密道 — 聖火秘寶',
    isDungeon: false,
    grid: [
      'TTTTTTTTTTTTTTTTTTTT',
      'TWWWWWWWXWWWWWWWW..T',
      'TW.....W.W..U.U.W..T',
      'TW.....W.W..oo..W..T',
      'TW.....WXW......W..T',
      'TWWWWWWW.WWWWWW.pppp',
      'T........p......pppp',
      'T..f.....p...r.....T',
      'T..i.....p.........T',
      'T........pp........T',
      'T..bb....pp....f...T',
      'TTTTTTTTTppTTTTTTTTT',
    ],
    signText: '裂石可用炸彈炸開！右側兩個熄滅火盆用【聖火法杖】點燃會出現隱藏秘寶！',
    enemies: [{ type: 'slime', x: 12 * 16, y: 8 * 16 }],
    chests: [{ id: 'ravine_key', x: 4 * 16, y: 2 * 16, reward: 'key', text: '獲得【古神殿小鑰匙】！可以用來開啟神殿深處的上鎖大門！' }],
    brazierChest: { id: 'ravine_brazier_heart', x: 13 * 16, y: 3 * 16, reward: 'heart_container', text: '點燃雙火盆！獲得隱藏【生命之心容器】！最大生命 +1 顆心！' },
    shopItems: [],
    traps: [],
  },
  '1,0': {
    name: '古神殿前庭 — 聖殿入口',
    isDungeon: false,
    grid: [
      'TTTTTTTTTTTTTTTTTTTT',
      'T..WWWWWWWWWWWWWW..T',
      'T..W..o......o..W..T',
      'T..W....t..t....W..T',
      'T..W.....vv.....W..T',
      'pppp....pppp....pppp',
      'pppp....pppp....pppp',
      'T..f....pppp....f..T',
      'T..oo....pp....bb..T',
      'T........pp........T',
      'T...i....pp........T',
      'TTTTTTTTTppTTTTTTTTT',
    ],
    signText: '古神殿入口：裡面有推箱機關、紅藍水晶、尖刺陷阱與炎核守衛！',
    enemies: [
      { type: 'octorok', x: 5 * 16, y: 8 * 16 },
      { type: 'slime', x: 14 * 16, y: 8 * 16 },
    ],
    chests: [],
    shopItems: [],
    traps: [],
  },
  '2,0': {
    name: '東境市集 — 森林道具屋',
    isDungeon: false,
    grid: [
      'TTTTTTTTTTTTTTTTTTTT',
      'T..WWWWWWWWWWWWWW..T',
      'T..W.t........t.W..T',
      'T..W............W..T',
      'T..W............W..T',
      'pppp............o..T',
      'pppp............o..T',
      'T..WWWW..pp..WWWW..T',
      'T..f.....pp.....f..T',
      'T..oo....pp....oo..T',
      'T........pp........T',
      'TTTTTTTTTppTTTTTTTTT',
    ],
    npc: {
      x: 9 * 16 + 8,
      y: 2 * 16,
      kind: 'merchant',
      name: '森林商人',
      text: '歡迎光臨！靠近下方展台按 [Space] 就能用盧比購買【炸彈】、【聖火法杖】或【黃金聖樹劍】！',
    },
    shopItems: [
      { id: 'shop_bombs', x: 6 * 16, y: 4 * 16, price: 10, reward: 'bombs', icon: 'bomb', label: '炸彈x5', sold: false },
      { id: 'shop_firerod', x: 9 * 16 + 8, y: 4 * 16, price: 20, reward: 'fire_rod', icon: 'fireRod', label: '聖火法杖', sold: false },
      { id: 'shop_sword', x: 13 * 16, y: 4 * 16, price: 30, reward: 'master_sword', icon: 'masterSword', label: '黃金聖樹劍', sold: false },
    ],
    enemies: [],
    chests: [],
    traps: [],
  },
};

const DUNGEON_ROOMS = {
  '0,1': {
    name: '古神殿 1F — 幽暗玄關',
    isDungeon: true,
    grid: [
      'WWWWWWWWW..WWWWWWWWW',
      'W..t...o....o...t..W',
      'W..................W',
      'W....W........W....W',
      'W..................W',
      'W..................D',
      'W..................D',
      'W..................W',
      'W....W........W....W',
      'W........^^........W',
      'W..t............t..W',
      'WWWWWWWWWWWWWWWWWWWW',
    ],
    enemies: [
      { type: 'stalfos', x: 6 * 16, y: 4 * 16 },
      { type: 'stalfos', x: 13 * 16, y: 6 * 16 },
    ],
    chests: [],
    shopItems: [],
    traps: [{ x: 4 * 16, y: 5 * 16 + 8, minX: 3 * 16, maxX: 15 * 16, minY: 5 * 16 + 8, maxY: 5 * 16 + 8, vx: 68, vy: 0 }],
  },
  '0,0': {
    name: '古神殿 1F — 雙重機關石室',
    isDungeon: true,
    grid: [
      'WWWWWWWWWWWWWWWWWWWW',
      'W..t..BBBBBBBB..t..W',
      'W.....B......B.....W',
      'W.....BS....PB.....W',
      'W.....B..CC..B.....W',
      'W....W........W....W',
      'W....W...oo...W....W',
      'W..................W',
      'W..................W',
      'W..t............t..W',
      'W..................W',
      'WWWWWWWWW..WWWWWWWWW',
    ],
    puzzleChest: { id: 'dungeon_switch_key', x: 9 * 16 + 8, y: 2 * 16, reward: 'key', text: '解開推箱與水晶機關！獲得【古神殿小鑰匙】！' },
    enemies: [{ type: 'bat', x: 5 * 16, y: 6 * 16 }, { type: 'bat', x: 14 * 16, y: 6 * 16 }],
    chests: [],
    shopItems: [],
    traps: [],
  },
  '1,1': {
    name: '古神殿 1F — 聖火迴廊',
    isDungeon: true,
    grid: [
      'WWWWWWWWWDDWWWWWWWWW',
      'W..t..U......U..t..W',
      'W....W........W....W',
      'W..................W',
      'W......WWXXWW......W',
      '...................W',
      '...................W',
      'W...o..........o...W',
      'W....W........W....W',
      'W..t............t..W',
      'W..................W',
      'WWWWWWWWWWWWWWWWWWWW',
    ],
    enemies: [
      { type: 'bat', x: 6 * 16, y: 3 * 16 },
      { type: 'bat', x: 13 * 16, y: 3 * 16 },
      { type: 'stalfos', x: 10 * 16, y: 7 * 16 },
    ],
    chests: [{ id: 'dungeon_bombs', x: 16 * 16, y: 2 * 16, reward: 'bombs', text: '獲得【炸彈補給袋】！炸彈 +5 顆！' }],
    brazierChest: { id: 'dungeon_brazier_key', x: 9 * 16 + 8, y: 2 * 16, reward: 'key', text: '聖火重燃！獲得隱藏【古神殿小鑰匙】！' },
    shopItems: [],
    traps: [{ x: 15 * 16, y: 6 * 16, minX: 4 * 16, maxX: 16 * 16, minY: 6 * 16, maxY: 6 * 16, vx: -74, vy: 0 }],
  },
  '1,0': {
    name: '古神殿最深處 — 炎核聖壇 (BOSS)',
    isDungeon: true,
    grid: [
      'WWWWWWWWWWWWWWWWWWWW',
      'W..t.o........o.t..W',
      'W..................W',
      'W..................W',
      'W..................W',
      'W.........O........W',
      'W..................W',
      'W..................W',
      'W..................W',
      'W..t.o........o.t..W',
      'W..................W',
      'WWWWWWWWW..WWWWWWWWW',
    ],
    enemies: [],
    hasBoss: true,
    chests: [],
    shopItems: [],
    traps: [],
  },
};

function parseGrid(grid, isDungeon) {
  const tiles = new Uint8Array(ROOM_COLS * ROOM_ROWS);
  for (let y = 0; y < ROOM_ROWS; y++) {
    const row = grid[y];
    for (let x = 0; x < ROOM_COLS; x++) {
      const ch = row[x] || '.';
      let t = isDungeon ? TILE.DUNGEON_FLOOR : TILE.GRASS;
      switch (ch) {
        case '.': t = isDungeon ? TILE.DUNGEON_FLOOR : TILE.GRASS; break;
        case 'p': t = TILE.PATH; break;
        case 'f': t = TILE.FLOWERS; break;
        case 'T': t = TILE.TREE; break;
        case '~': t = TILE.WATER; break;
        case '=': t = TILE.BRIDGE; break;
        case 'b': t = TILE.BUSH; break;
        case 'r': t = TILE.ROCK; break;
        case 'W': t = TILE.DUNGEON_WALL; break;
        case 'X': t = TILE.CRACKED_WALL; break;
        case 'P': t = TILE.PUSH_BLOCK; break;
        case 'S': t = TILE.SWITCH; break;
        case 'D': t = TILE.LOCKED_DOOR; break;
        case 't': t = TILE.TORCH; break;
        case 'v': t = TILE.STAIRS_IN; break;
        case '^': t = TILE.STAIRS_OUT; break;
        case 'i': t = TILE.SIGN; break;
        case 'O': t = TILE.PEDESTAL; break;
        case 'o': t = TILE.POT; break;
        case 'C': t = TILE.CRYSTAL_ORB; break;
        case 'R': t = TILE.RED_BLOCK; break;
        case 'B': t = TILE.BLUE_BLOCK; break;
        case 'U': t = TILE.BRAZIER_OFF; break;
        case 'F': t = TILE.FAIRY_SPRING; break;
      }
      tiles[y * ROOM_COLS + x] = t;
    }
  }
  return tiles;
}

export class World {
  constructor() {
    this.maps = { overworld: {}, dungeon: {} };
    this.visited = new Set();
    this.crystalState = 0; // 0 = RED up / BLUE down, 1 = BLUE up / RED down

    for (const [key, def] of Object.entries(OVERWORLD_ROOMS)) {
      this.maps.overworld[key] = this._instantiateRoom(key, def);
    }
    for (const [key, def] of Object.entries(DUNGEON_ROOMS)) {
      this.maps.dungeon[key] = this._instantiateRoom(key, def);
    }
  }

  _instantiateRoom(key, def) {
    return {
      key,
      name: def.name,
      isDungeon: def.isDungeon,
      tiles: parseGrid(def.grid, def.isDungeon),
      npc: def.npc ? { ...def.npc } : null,
      signText: def.signText || null,
      enemySpawns: (def.enemies || []).map((e) => ({ ...e })),
      chests: (def.chests || []).map((c) => ({ ...c, opened: false })),
      puzzleChest: def.puzzleChest ? { ...def.puzzleChest, revealed: false, opened: false } : null,
      brazierChest: def.brazierChest ? { ...def.brazierChest, revealed: false, opened: false } : null,
      shopItems: (def.shopItems || []).map((s) => ({ ...s })),
      trapSpawns: (def.traps || []).map((tr) => ({ ...tr })),
      switchSolved: false,
      brazierSolved: false,
      hasBoss: Boolean(def.hasBoss),
      bossDefeated: false,
      relicSpawned: false,
    };
  }

  getRoom(zone, rx, ry) {
    return this.maps[zone][`${rx},${ry}`] || null;
  }

  markVisited(zone, rx, ry) {
    this.visited.add(`${zone}:${rx},${ry}`);
  }

  isSolidTile(t) {
    if (t === TILE.RED_BLOCK) return this.crystalState === 0;
    if (t === TILE.BLUE_BLOCK) return this.crystalState === 1;
    return (
      t === TILE.TREE ||
      t === TILE.WATER ||
      t === TILE.BUSH ||
      t === TILE.ROCK ||
      t === TILE.CRACKED_WALL ||
      t === TILE.DUNGEON_WALL ||
      t === TILE.PUSH_BLOCK ||
      t === TILE.LOCKED_DOOR ||
      t === TILE.TORCH ||
      t === TILE.SIGN ||
      t === TILE.POT ||
      t === TILE.CRYSTAL_ORB ||
      t === TILE.BRAZIER_OFF ||
      t === TILE.BRAZIER_ON
    );
  }
}
