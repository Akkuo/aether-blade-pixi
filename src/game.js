import { ROOM_COLS, ROOM_ROWS, TILE_SIZE, PLAY_W, PLAY_H, DIR, DIR_VEC, STATE, TILE } from './constants.js';
import { World } from './world.js';

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class ZeldaGame {
  constructor(sound, onAreaChange, onHitPulse) {
    this.sound = sound;
    this.onAreaChange = onAreaChange;
    this.onHitPulse = onHitPulse;

    this.state = STATE.TITLE;
    this.time = 0;
    this.hitstop = 0;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.dialogueText = '';
    this.dialogueSpeaker = '';

    this.resetGame(false);
  }

  resetGame(startPlaying = true) {
    this.world = new World();
    this.zone = 'overworld';
    this.rx = 0;
    this.ry = 1;
    this.room = this.world.getRoom(this.zone, this.rx, this.ry);
    this.world.markVisited(this.zone, this.rx, this.ry);

    this.player = {
      x: 9 * 16 + 2,
      y: 7 * 16,
      w: 12,
      h: 12,
      dir: DIR.DOWN,
      hp: 6,       // 3 full hearts (each heart = 2 half-hearts)
      maxHp: 6,
      rupees: 10,
      keys: 0,
      bombs: 4,
      hasBoomerang: false,
      hasFireRod: false,
      swordLevel: 1,    // 1 = Hero Sword, 2 = Master Blade (Golden)
      equipped: 'bomb', // 'bomb' | 'boomerang' | 'fire_rod'
      attackTimer: 0,
      attackCooldown: 0,
      chargeTimer: 0,
      spinTimer: 0,
      rollTimer: 0,
      rollDir: { x: 0, y: 1 },
      invulnTimer: 0,
      knockVx: 0,
      knockVy: 0,
      walkAnim: 0,
      pushTimer: 0,
      crystalCooldown: 0,
      fairyCooldown: 0,
    };

    this.enemies = [];
    this.traps = [];
    this.projectiles = [];
    this.bombs = [];
    this.boomerang = null;
    this.drops = [];
    this.particles = [];
    this.texts = [];
    this.boss = null;
    this.relic = null;
    this.transition = null;

    this._spawnRoomEntities();
    if (this.onAreaChange) this.onAreaChange(this.room);
    if (startPlaying) {
      this.state = STATE.PLAYING;
      this.sound.setBgmMode('overworld');
    }
  }

  _spawnRoomEntities() {
    this.enemies = [];
    this.traps = (this.room.trapSpawns || []).map((tr) => ({ ...tr, w: 14, h: 14 }));
    this.projectiles = [];
    this.bombs = [];
    this.boomerang = null;
    this.drops = [];
    this.boss = null;
    this.relic = null;

    for (const sp of this.room.enemySpawns) {
      this.enemies.push({
        type: sp.type,
        x: sp.x,
        y: sp.y,
        w: 12,
        h: 12,
        hp: sp.type === 'stalfos' ? 3 : sp.type === 'octorok' ? 2 : 2,
        vx: 0,
        vy: 0,
        dir: Math.floor(Math.random() * 4),
        aiTimer: 0.6 + Math.random() * 0.8,
        shootTimer: 1.5 + Math.random(),
        stunTimer: 0,
        hurtTimer: 0,
        alive: true,
      });
    }

    if (this.room.hasBoss && !this.room.bossDefeated) {
      this.boss = {
        x: 9 * 16,
        y: 3 * 16,
        w: 28,
        h: 28,
        hp: 10,
        maxHp: 10,
        vx: 0,
        vy: 0,
        state: 'patrol', // 'patrol' | 'charge' | 'ring'
        timer: 1.5,
        hurtTimer: 0,
        stunTimer: 0,
        alive: true,
      };
      this.sound.setBgmMode('boss');
    } else if (this.room.relicSpawned) {
      this.relic = { x: 10 * 16 - 6, y: 5 * 16 - 4, w: 12, h: 12 };
    }
  }

  addShake(amt) {
    this.shake = Math.max(this.shake, amt);
  }

  burst(x, y, count, color, speed = 80) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 18 + Math.random() * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.22 + Math.random() * 0.3,
        maxLife: 0.52,
        size: Math.random() < 0.35 ? 3 : 2,
        color,
      });
    }
  }

  spawnText(x, y, text, color = '#ffe66d') {
    this.texts.push({ x, y, vy: -24, text, color, life: 0.9, maxLife: 0.9 });
  }

  openDialogue(speaker, text) {
    this.dialogueSpeaker = speaker;
    this.dialogueText = text;
    this.state = STATE.DIALOGUE;
  }

  getTile(room, tx, ty) {
    if (tx < 0 || tx >= ROOM_COLS || ty < 0 || ty >= ROOM_ROWS) return TILE.DUNGEON_WALL;
    return room.tiles[ty * ROOM_COLS + tx];
  }

  setTile(room, tx, ty, val) {
    if (tx < 0 || tx >= ROOM_COLS || ty < 0 || ty >= ROOM_ROWS) return;
    room.tiles[ty * ROOM_COLS + tx] = val;
  }

  update(dt, input) {
    this.time += dt;
    this.sound.update(dt);

    if (this.shake > 0.1) {
      this.shakeX = (Math.random() - 0.5) * this.shake * 2;
      this.shakeY = (Math.random() - 0.5) * this.shake * 2;
      this.shake *= Math.pow(0.001, dt);
    } else {
      this.shake = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }

    if (this.state === STATE.TITLE) {
      if (input.startPressed || input.attackPressed) {
        this.resetGame(true);
      }
      return;
    }

    if (this.state === STATE.DIALOGUE) {
      if (input.attackPressed || input.startPressed || input.itemPressed) {
        this.state = STATE.PLAYING;
      }
      return;
    }

    if (this.state === STATE.PAUSED) {
      if (input.pausePressed) this.state = STATE.PLAYING;
      if (input.restartPressed) this.resetGame(true);
      return;
    }

    if (this.state === STATE.GAME_OVER || this.state === STATE.VICTORY) {
      this._updateParticles(dt);
      if (input.startPressed || input.attackPressed || input.restartPressed) {
        this.resetGame(true);
      }
      return;
    }

    if (this.state === STATE.TRANSITION) {
      this.transition.t += dt / 0.34;
      if (this.transition.t >= 1) {
        this.rx = this.transition.toRx;
        this.ry = this.transition.toRy;
        this.room = this.transition.toRoom;
        this.world.markVisited(this.zone, this.rx, this.ry);
        this.player.x = this.transition.endPx;
        this.player.y = this.transition.endPy;
        this.transition = null;
        this.state = STATE.PLAYING;
        this._spawnRoomEntities();
        if (this.onAreaChange) this.onAreaChange(this.room);
      }
      return;
    }

    if (input.pausePressed) {
      this.state = STATE.PAUSED;
      return;
    }
    if (input.restartPressed) {
      this.resetGame(true);
      return;
    }

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    this._updatePlayer(dt, input);
    this._updateTraps(dt);
    this._updateBombs(dt);
    this._updateBoomerang(dt);
    this._updateProjectiles(dt);
    this._updateEnemies(dt);
    if (this.boss && this.boss.alive) this._updateBoss(dt);
    this._updateDrops(dt);
    this._updateParticles(dt);
  }

  _updateTraps(dt) {
    const p = this.player;
    for (const tr of this.traps) {
      tr.x += tr.vx * dt;
      tr.y += tr.vy * dt;
      if (tr.x <= tr.minX) { tr.x = tr.minX; tr.vx = Math.abs(tr.vx); }
      if (tr.x >= tr.maxX) { tr.x = tr.maxX; tr.vx = -Math.abs(tr.vx); }
      if (tr.y <= tr.minY) { tr.y = tr.minY; tr.vy = Math.abs(tr.vy); }
      if (tr.y >= tr.maxY) { tr.y = tr.maxY; tr.vy = -Math.abs(tr.vy); }
      if (overlaps(tr, p)) {
        this._hurtPlayer(p.x - tr.x, p.y - tr.y);
      }
    }
  }

  _updatePlayer(dt, input) {
    const p = this.player;
    if (p.invulnTimer > 0) p.invulnTimer -= dt;
    if (p.attackCooldown > 0) p.attackCooldown -= dt;
    if (p.attackTimer > 0) p.attackTimer -= dt;
    if (p.spinTimer > 0) p.spinTimer -= dt;
    if (p.crystalCooldown > 0) p.crystalCooldown -= dt;
    if (p.fairyCooldown > 0) p.fairyCooldown -= dt;

    // Cycle equipped sub-item (bomb -> boomerang -> fire_rod)
    if (input.cyclePressed) {
      const owned = ['bomb'];
      if (p.hasBoomerang) owned.push('boomerang');
      if (p.hasFireRod) owned.push('fire_rod');
      if (owned.length > 1) {
        const nextIdx = (owned.indexOf(p.equipped) + 1) % owned.length;
        p.equipped = owned[nextIdx];
        const label = p.equipped === 'boomerang' ? '疾風迴力鏢' : p.equipped === 'fire_rod' ? '聖火法杖' : '炸彈';
        this.spawnText(p.x + 6, p.y - 4, label, '#8effb0');
      }
    }

    // Interact with NPC / Signpost / Chest when pressing attack
    if (input.attackPressed && p.attackCooldown <= 0) {
      if (this._tryInteract()) return;
    }

    // Sword Attack & Hold-to-Charge Spin Attack
    if (input.attackPressed && p.attackCooldown <= 0 && p.rollTimer <= 0) {
      p.attackTimer = 0.16;
      p.attackCooldown = 0.24;
      this.sound.playSword();
      this._performSwordHit(false);
      // Full HP Sword Beam!
      if (p.hp >= p.maxHp) {
        const dv = DIR_VEC[p.dir];
        this.projectiles.push({
          fromPlayer: true,
          kind: 'beam',
          x: p.x + 3 + dv.x * 10,
          y: p.y + 3 + dv.y * 10,
          w: 6,
          h: 6,
          vx: dv.x * 210,
          vy: dv.y * 210,
          life: 1.4,
          alive: true,
        });
        this.sound.playSwordBeam();
      }
    }

    if (input.attack && p.rollTimer <= 0) {
      p.chargeTimer += dt;
    } else {
      if (p.chargeTimer >= 0.45) {
        p.spinTimer = 0.24;
        p.attackCooldown = 0.3;
        this.sound.playSpinAttack();
        this.addShake(3);
        this.burst(p.x + 6, p.y + 6, 16, '#8effe0', 95);
        this._performSwordHit(true);
      }
      p.chargeTimer = 0;
    }

    // Sub-item use (Bomb / Boomerang / Fire Rod)
    if (input.itemPressed && p.rollTimer <= 0) {
      if (p.equipped === 'boomerang' && p.hasBoomerang && !this.boomerang) {
        const dv = DIR_VEC[p.dir];
        this.boomerang = {
          x: p.x + 2,
          y: p.y + 2,
          w: 8,
          h: 8,
          vx: dv.x * 195,
          vy: dv.y * 195,
          returning: false,
          dist: 0,
        };
        this.sound.playBoomerang();
      } else if (p.equipped === 'fire_rod' && p.hasFireRod) {
        const dv = DIR_VEC[p.dir];
        this.projectiles.push({
          fromPlayer: true,
          kind: 'player_fire',
          x: p.x + 3 + dv.x * 10,
          y: p.y + 3 + dv.y * 10,
          w: 7,
          h: 7,
          vx: dv.x * 185,
          vy: dv.y * 185,
          life: 1.5,
          alive: true,
        });
        this.sound.playSwordBeam();
        this.burst(p.x + 6 + dv.x * 8, p.y + 6 + dv.y * 8, 6, '#ff9838', 55);
      } else if (p.equipped === 'bomb' && p.bombs > 0) {
        p.bombs -= 1;
        const dv = DIR_VEC[p.dir];
        this.bombs.push({
          x: p.x + dv.x * 10,
          y: p.y + dv.y * 10,
          fuse: 1.35,
        });
        this.spawnText(p.x + 6, p.y - 4, 'BOMB!', '#ffd085');
      }
    }

    // Movement & Roll
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (mx !== 0 || my !== 0) {
      if (Math.abs(mx) >= Math.abs(my)) p.dir = mx > 0 ? DIR.RIGHT : DIR.LEFT;
      else p.dir = my > 0 ? DIR.DOWN : DIR.UP;
    }

    if (input.rollPressed && p.rollTimer <= 0 && p.attackTimer <= 0) {
      p.rollTimer = 0.2;
      const len = Math.hypot(mx, my);
      p.rollDir = len > 0 ? { x: mx / len, y: my / len } : { ...DIR_VEC[p.dir] };
      this.sound.playRoll();
      this.burst(p.x + 6, p.y + 10, 5, '#d8e8d0', 45);
    }

    let vx = 0;
    let vy = 0;
    if (p.rollTimer > 0) {
      p.rollTimer -= dt;
      vx = p.rollDir.x * 165;
      vy = p.rollDir.y * 165;
    } else if (p.attackTimer <= 0) {
      const len = Math.hypot(mx, my) || 1;
      const speed = p.chargeTimer > 0.25 ? 58 : 92;
      vx = (mx / len) * speed;
      vy = (my / len) * speed;
      if (mx !== 0 || my !== 0) p.walkAnim += dt * 10;
    }

    vx += p.knockVx;
    vy += p.knockVy;
    p.knockVx *= Math.pow(0.002, dt);
    p.knockVy *= Math.pow(0.002, dt);

    // Move X & Y with corner slide
    this._movePlayerAxis(vx * dt, 0, mx, 0, dt);
    this._movePlayerAxis(0, vy * dt, 0, my, dt);

    // Check Stairs, Fairy Healing Spring & Relic
    const centerTx = Math.floor((p.x + p.w * 0.5) / TILE_SIZE);
    const centerTy = Math.floor((p.y + p.h * 0.5) / TILE_SIZE);
    const under = this.getTile(this.room, centerTx, centerTy);
    if (under === TILE.FAIRY_SPRING && p.hp < p.maxHp && p.fairyCooldown <= 0) {
      p.hp = p.maxHp;
      p.fairyCooldown = 2.0;
      this.sound.playSecret();
      this.burst(p.x + 6, p.y + 6, 20, '#8ef7ff', 95);
      this.spawnText(p.x + 6, p.y - 8, '妖精祝福：體力全滿！', '#9efffa');
    }
    if (under === TILE.STAIRS_IN) {
      this._enterZone('dungeon', 0, 1, 9 * 16 + 2, 7 * 16);
      return;
    } else if (under === TILE.STAIRS_OUT) {
      this._enterZone('overworld', 1, 0, 9 * 16 + 2, 6 * 16);
      return;
    }

    if (this.relic && overlaps(p, this.relic)) {
      this.sound.playVictory();
      this.sound.setBgmMode('off');
      this.burst(this.relic.x + 6, this.relic.y + 6, 36, '#ffe066', 130);
      this.state = STATE.VICTORY;
      return;
    }

    // Check Room Edge Scroll Transitions
    if (p.x < -3) this._startTransition(-1, 0);
    else if (p.x + p.w > PLAY_W + 3) this._startTransition(1, 0);
    else if (p.y < -3) this._startTransition(0, -1);
    else if (p.y + p.h > PLAY_H + 3) this._startTransition(0, 1);
  }

  _movePlayerAxis(dx, dy, inputX, inputY, dt) {
    const p = this.player;
    p.x += dx;
    p.y += dy;

    const l = Math.floor(p.x / TILE_SIZE);
    const r = Math.floor((p.x + p.w - 0.01) / TILE_SIZE);
    const t = Math.floor(p.y / TILE_SIZE);
    const b = Math.floor((p.y + p.h - 0.01) / TILE_SIZE);

    let hit = false;
    for (let ty = t; ty <= b; ty++) {
      for (let tx = l; tx <= r; tx++) {
        if (tx < 0 || tx >= ROOM_COLS || ty < 0 || ty >= ROOM_ROWS) continue;
        const tile = this.getTile(this.room, tx, ty);
        if (tile === TILE.LOCKED_DOOR && p.keys > 0) {
          this._unlockDoor(tx, ty);
          continue;
        }
        if (tile === TILE.PUSH_BLOCK && (inputX !== 0 || inputY !== 0)) {
          p.pushTimer += dt;
          if (p.pushTimer >= 0.22) {
            p.pushTimer = 0;
            this._tryPushBlock(tx, ty, inputX, inputY);
          }
        }
        if (this.world.isSolidTile(tile)) {
          hit = true;
        }
      }
    }

    if (hit) {
      p.x -= dx;
      p.y -= dy;
    }
  }

  _unlockDoor(tx, ty) {
    this.player.keys -= 1;
    const floor = this.room.isDungeon ? TILE.DUNGEON_FLOOR : TILE.PATH;
    // Clear both adjacent tiles of the double door
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (this.getTile(this.room, tx + ox, ty + oy) === TILE.LOCKED_DOOR) {
          this.setTile(this.room, tx + ox, ty + oy, floor);
          this.burst((tx + ox) * 16 + 8, (ty + oy) * 16 + 8, 8, '#ffd54f', 70);
        }
      }
    }
    this.sound.playDoorOpen();
    this.spawnText(tx * 16 + 8, ty * 16, 'UNLOCKED!', '#ffe066');
  }

  _tryPushBlock(tx, ty, dx, dy) {
    const nx = tx + Math.sign(dx);
    const ny = ty + Math.sign(dy);
    const target = this.getTile(this.room, nx, ny);
    if (target === TILE.DUNGEON_FLOOR || target === TILE.SWITCH) {
      this.setTile(this.room, tx, ty, TILE.DUNGEON_FLOOR);
      this.setTile(this.room, nx, ny, TILE.PUSH_BLOCK);
      this.sound.playDoorOpen();
      this.burst(nx * 16 + 8, ny * 16 + 8, 6, '#9aa6cc', 45);
      if (target === TILE.SWITCH && !this.room.switchSolved) {
        this.room.switchSolved = true;
        this.sound.playSecret();
        if (this.room.puzzleChest) {
          this.room.puzzleChest.revealed = true;
          this.room.chests.push(this.room.puzzleChest);
          this.burst(this.room.puzzleChest.x + 8, this.room.puzzleChest.y + 8, 18, '#ffe066', 90);
          this.spawnText(this.room.puzzleChest.x + 8, this.room.puzzleChest.y - 4, 'SECRET!', '#ffe066');
        }
      }
    }
  }

  _tryInteract() {
    const p = this.player;
    const dv = DIR_VEC[p.dir];
    const probe = { x: p.x + dv.x * 12, y: p.y + dv.y * 12, w: 12, h: 12 };

    // NPC Elder
    if (this.room.npc) {
      const n = this.room.npc;
      if (overlaps(probe, { x: n.x, y: n.y, w: 16, h: 16 })) {
        this.openDialogue(n.name, n.text);
        return true;
      }
    }

    // Shop Items
    for (const s of this.room.shopItems || []) {
      if (s.sold) continue;
      if (overlaps(probe, { x: s.x - 4, y: s.y - 4, w: 22, h: 22 })) {
        if (p.rupees < s.price) {
          this.openDialogue('森林商人', `這件【${s.label}】需要 ${s.price} 盧比喔！多打碎陶罐、草叢或解謎寶箱來收集盧比吧。`);
          return true;
        }
        p.rupees -= s.price;
        this.sound.playChest();
        this.burst(s.x + 6, s.y + 6, 18, '#ffe066', 95);
        if (s.reward === 'bombs') {
          p.bombs += 5;
          this.openDialogue('購買成功', '獲得【炸彈 x5】！');
        } else if (s.reward === 'fire_rod') {
          s.sold = true;
          p.hasFireRod = true;
          p.equipped = 'fire_rod';
          this.openDialogue('購買成功', '獲得【聖火法杖】！按 Q 切換、E 發射火球，可點燃熄滅的火盆解謎並灼燒敵人！');
        } else if (s.reward === 'master_sword') {
          s.sold = true;
          p.swordLevel = 2;
          this.openDialogue('購買成功', '獲得【黃金聖樹劍】！劍刃攻擊力永久加倍（2倍傷害）！');
        }
        return true;
      }
    }

    // Chests
    for (const c of this.room.chests) {
      if (!c.opened && overlaps(probe, { x: c.x, y: c.y, w: 16, h: 16 })) {
        c.opened = true;
        this.sound.playChest();
        this.burst(c.x + 8, c.y + 4, 18, '#ffe066', 95);
        if (c.reward === 'boomerang') {
          p.hasBoomerang = true;
          p.equipped = 'boomerang';
        } else if (c.reward === 'key') {
          p.keys += 1;
        } else if (c.reward === 'bombs') {
          p.bombs += 5;
        } else if (c.reward === 'rupees_30') {
          p.rupees += 30;
        } else if (c.reward === 'heart_container') {
          p.maxHp += 2;
          p.hp = p.maxHp;
        }
        this.openDialogue('寶箱', c.text);
        return true;
      }
    }

    // Signpost
    const tx = Math.floor((probe.x + 6) / TILE_SIZE);
    const ty = Math.floor((probe.y + 6) / TILE_SIZE);
    if (this.getTile(this.room, tx, ty) === TILE.SIGN && this.room.signText) {
      this.openDialogue('木牌', this.room.signText);
      return true;
    }

    return false;
  }

  _performSwordHit(isSpin) {
    const p = this.player;
    let box;
    if (isSpin) {
      box = { x: p.x - 16, y: p.y - 16, w: p.w + 32, h: p.h + 32 };
    } else {
      const dv = DIR_VEC[p.dir];
      box = {
        x: p.x + dv.x * 12 - (dv.x === 0 ? 6 : 2),
        y: p.y + dv.y * 12 - (dv.y === 0 ? 6 : 2),
        w: dv.x === 0 ? 24 : 18,
        h: dv.y === 0 ? 24 : 18,
      };
    }

    // Cut bushes, smash pots, flip crystal orbs in sword hitbox
    const l = Math.max(0, Math.floor(box.x / TILE_SIZE));
    const r = Math.min(ROOM_COLS - 1, Math.floor((box.x + box.w) / TILE_SIZE));
    const t = Math.max(0, Math.floor(box.y / TILE_SIZE));
    const b = Math.min(ROOM_ROWS - 1, Math.floor((box.y + box.h) / TILE_SIZE));
    const floor = this.room.isDungeon ? TILE.DUNGEON_FLOOR : TILE.GRASS;
    for (let ty = t; ty <= b; ty++) {
      for (let tx = l; tx <= r; tx++) {
        const tile = this.getTile(this.room, tx, ty);
        if (tile === TILE.BUSH) {
          this.setTile(this.room, tx, ty, TILE.GRASS);
          this.burst(tx * 16 + 8, ty * 16 + 8, 8, '#58df72', 75);
          this._maybeSpawnDrop(tx * 16 + 4, ty * 16 + 4);
        } else if (tile === TILE.POT) {
          this.setTile(this.room, tx, ty, floor);
          this.sound.playHit();
          this.burst(tx * 16 + 8, ty * 16 + 8, 10, '#e0996c', 85);
          this._maybeSpawnDrop(tx * 16 + 4, ty * 16 + 4, true);
        } else if (tile === TILE.CRYSTAL_ORB) {
          this._toggleCrystalSwitch(tx, ty);
        }
      }
    }

    // Hit Enemies
    const dmg = (isSpin ? 2 : 1) * p.swordLevel;
    for (const e of this.enemies) {
      if (e.alive && overlaps(box, e)) {
        this._damageEnemy(e, dmg, e.x - p.x, e.y - p.y);
      }
    }

    // Hit Boss
    if (this.boss && this.boss.alive && overlaps(box, this.boss)) {
      this._damageBoss(dmg);
    }
  }

  _maybeSpawnDrop(x, y, guaranteed = false) {
    const roll = Math.random();
    if (guaranteed) {
      if (roll < 0.5) this.drops.push({ kind: 'rupee', x, y, w: 8, h: 9 });
      else if (roll < 0.8) this.drops.push({ kind: 'heart', x, y, w: 9, h: 9 });
      else this.drops.push({ kind: 'bomb', x, y, w: 9, h: 9 });
      return;
    }
    if (roll < 0.28) this.drops.push({ kind: 'rupee', x, y, w: 8, h: 9 });
    else if (roll < 0.46) this.drops.push({ kind: 'heart', x, y, w: 9, h: 9 });
    else if (roll < 0.56) this.drops.push({ kind: 'bomb', x, y, w: 9, h: 9 });
  }

  _toggleCrystalSwitch(tx, ty) {
    if (this.player.crystalCooldown > 0) return;
    this.player.crystalCooldown = 0.28;
    this.world.crystalState = this.world.crystalState === 0 ? 1 : 0;
    this.sound.playDoorOpen();
    this.addShake(2.5);
    const col = this.world.crystalState === 0 ? '#ff6478' : '#4ae3ff';
    this.burst(tx * 16 + 8, ty * 16 + 8, 12, col, 85);
    this.spawnText(tx * 16 + 8, ty * 16 - 4, this.world.crystalState === 0 ? '紅柱升起' : '藍柱升起', col);
  }

  _igniteBrazier(tx, ty) {
    this.setTile(this.room, tx, ty, TILE.BRAZIER_ON);
    this.sound.playDoorOpen();
    this.burst(tx * 16 + 8, ty * 16 + 4, 14, '#ff9838', 80);
    // Check if any unlit braziers remain in room
    let remaining = 0;
    for (let i = 0; i < this.room.tiles.length; i++) {
      if (this.room.tiles[i] === TILE.BRAZIER_OFF) remaining++;
    }
    if (remaining === 0 && !this.room.brazierSolved) {
      this.room.brazierSolved = true;
      this.sound.playSecret();
      if (this.room.brazierChest) {
        this.room.brazierChest.revealed = true;
        this.room.chests.push(this.room.brazierChest);
        this.burst(this.room.brazierChest.x + 8, this.room.brazierChest.y + 8, 22, '#ffe066', 100);
        this.spawnText(this.room.brazierChest.x + 8, this.room.brazierChest.y - 6, '聖火秘寶出現！', '#ffe066');
      }
    }
  }

  _damageEnemy(e, dmg, kx, ky) {
    if (e.hurtTimer > 0) return;
    e.hp -= dmg;
    e.hurtTimer = 0.22;
    const len = Math.hypot(kx, ky) || 1;
    e.vx = (kx / len) * 140;
    e.vy = (ky / len) * 140;
    this.sound.playHit();
    this.hitstop = 0.03;
    this.addShake(2.5);
    this.burst(e.x + 6, e.y + 6, 8, '#fff099', 80);
    if (e.hp <= 0) {
      e.alive = false;
      this.burst(e.x + 6, e.y + 6, 14, '#ff7582', 100);
      this._maybeSpawnDrop(e.x + 2, e.y + 2);
    }
  }

  _damageBoss(dmg) {
    const b = this.boss;
    if (!b || !b.alive || b.hurtTimer > 0) return;
    b.hp -= dmg;
    b.hurtTimer = 0.45;
    this.sound.playHit();
    this.hitstop = 0.05;
    this.addShake(6);
    if (this.onHitPulse) this.onHitPulse(0.9);
    this.burst(b.x + 14, b.y + 14, 18, '#ffae38', 120);
    this.spawnText(b.x + 14, b.y - 4, `-${dmg}`, '#ffe066');

    if (b.hp <= 0) {
      b.alive = false;
      this.room.bossDefeated = true;
      this.room.relicSpawned = true;
      this.relic = { x: 10 * 16 - 6, y: 5 * 16 - 4, w: 12, h: 12 };
      this.sound.playSecret();
      this.addShake(12);
      this.burst(b.x + 14, b.y + 14, 42, '#ffe066', 150);
      this.spawnText(b.x + 14, b.y - 8, '炎核守衛已擊敗！', '#fff3a8');
    }
  }

  _hurtPlayer(kx, ky) {
    const p = this.player;
    if (p.invulnTimer > 0 || p.rollTimer > 0) return;
    p.hp -= 1;
    p.invulnTimer = 1.1;
    const len = Math.hypot(kx, ky) || 1;
    p.knockVx = (kx / len) * 160;
    p.knockVy = (ky / len) * 160;
    this.sound.playHurt();
    this.addShake(5);
    if (this.onHitPulse) this.onHitPulse(0.75);
    this.burst(p.x + 6, p.y + 6, 10, '#ff4265', 90);
    if (p.hp <= 0) {
      this.state = STATE.GAME_OVER;
      this.sound.setBgmMode('off');
    }
  }

  _updateBombs(dt) {
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.fuse -= dt;
      if (b.fuse <= 0) {
        this.bombs.splice(i, 1);
        this.sound.playBombExplode();
        this.addShake(8);
        if (this.onHitPulse) this.onHitPulse(1.0);
        this.burst(b.x + 6, b.y + 6, 26, '#ff9838', 135);
        this.burst(b.x + 6, b.y + 6, 14, '#fff3a8', 95);

        // Shatter nearby Cracked Walls & Rocks
        const cx = Math.floor((b.x + 6) / TILE_SIZE);
        const cy = Math.floor((b.y + 6) / TILE_SIZE);
        const floor = this.room.isDungeon ? TILE.DUNGEON_FLOOR : TILE.PATH;
        let brokeSecret = false;
        for (let oy = -2; oy <= 2; oy++) {
          for (let ox = -2; ox <= 2; ox++) {
            const t = this.getTile(this.room, cx + ox, cy + oy);
            if (t === TILE.CRACKED_WALL || t === TILE.ROCK || t === TILE.BUSH) {
              this.setTile(this.room, cx + ox, cy + oy, floor);
              if (t === TILE.CRACKED_WALL) brokeSecret = true;
            }
          }
        }
        if (brokeSecret) this.sound.playSecret();

        const blast = { x: b.x - 22, y: b.y - 22, w: 56, h: 56 };
        for (const e of this.enemies) {
          if (e.alive && overlaps(blast, e)) this._damageEnemy(e, 3, e.x - b.x, e.y - b.y);
        }
        if (this.boss && this.boss.alive && overlaps(blast, this.boss)) {
          this.boss.stunTimer = 1.6;
          this._damageBoss(2);
        }
      }
    }
  }

  _updateBoomerang(dt) {
    const bm = this.boomerang;
    if (!bm) return;
    const p = this.player;
    if (!bm.returning) {
      bm.x += bm.vx * dt;
      bm.y += bm.vy * dt;
      bm.dist += Math.hypot(bm.vx, bm.vy) * dt;
      const tx = Math.floor((bm.x + 4) / TILE_SIZE);
      const ty = Math.floor((bm.y + 4) / TILE_SIZE);
      const tile = this.getTile(this.room, tx, ty);
      if (tile === TILE.CRYSTAL_ORB) {
        this._toggleCrystalSwitch(tx, ty);
        bm.returning = true;
      } else if (tile === TILE.POT) {
        this.setTile(this.room, tx, ty, this.room.isDungeon ? TILE.DUNGEON_FLOOR : TILE.GRASS);
        this.burst(tx * 16 + 8, ty * 16 + 8, 8, '#e0996c', 75);
        this._maybeSpawnDrop(tx * 16 + 4, ty * 16 + 4, true);
      } else if (bm.dist > 115 || tile === TILE.TREE || tile === TILE.DUNGEON_WALL || tile === TILE.ROCK) {
        bm.returning = true;
      }
    } else {
      const dx = p.x + 2 - bm.x;
      const dy = p.y + 2 - bm.y;
      const d = Math.hypot(dx, dy);
      if (d < 10) {
        this.boomerang = null;
        return;
      }
      bm.x += (dx / d) * 230 * dt;
      bm.y += (dy / d) * 230 * dt;
    }

    // Pull drops & stun enemies
    for (const drop of this.drops) {
      if (overlaps(bm, drop)) {
        drop.x = bm.x;
        drop.y = bm.y;
      }
    }
    for (const e of this.enemies) {
      if (e.alive && overlaps(bm, e)) {
        e.stunTimer = 2.0;
        bm.returning = true;
        this.sound.playHit();
        this.burst(e.x + 6, e.y + 6, 6, '#5ce6ff', 60);
      }
    }
    if (this.boss && this.boss.alive && overlaps(bm, this.boss)) {
      this.boss.stunTimer = 1.4;
      bm.returning = true;
      this.sound.playHit();
      this.spawnText(this.boss.x + 14, this.boss.y - 4, 'STUNNED!', '#7eeeff');
    }
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.life <= 0 || pr.x < 0 || pr.x > PLAY_W || pr.y < 0 || pr.y > PLAY_H) {
        this.projectiles.splice(i, 1);
        continue;
      }
      const tx = Math.floor((pr.x + 3) / TILE_SIZE);
      const ty = Math.floor((pr.y + 3) / TILE_SIZE);
      const hitTile = this.getTile(this.room, tx, ty);
      if (pr.fromPlayer && hitTile === TILE.CRYSTAL_ORB) {
        this._toggleCrystalSwitch(tx, ty);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (pr.kind === 'player_fire' && hitTile === TILE.BRAZIER_OFF) {
        this._igniteBrazier(tx, ty);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (pr.fromPlayer && hitTile === TILE.POT) {
        this.setTile(this.room, tx, ty, this.room.isDungeon ? TILE.DUNGEON_FLOOR : TILE.GRASS);
        this.burst(tx * 16 + 8, ty * 16 + 8, 8, '#e0996c', 75);
        this._maybeSpawnDrop(tx * 16 + 4, ty * 16 + 4, true);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (this.world.isSolidTile(hitTile) && hitTile !== TILE.WATER) {
        this.burst(pr.x + 3, pr.y + 3, 5, '#ffe680', 55);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (pr.fromPlayer) {
        const pdmg = pr.kind === 'player_fire' ? 2 : 1;
        for (const e of this.enemies) {
          if (e.alive && overlaps(pr, e)) {
            this._damageEnemy(e, pdmg, pr.vx, pr.vy);
            pr.life = 0;
          }
        }
        if (this.boss && this.boss.alive && overlaps(pr, this.boss)) {
          this._damageBoss(pdmg);
          pr.life = 0;
        }
      } else if (overlaps(pr, this.player)) {
        this._hurtPlayer(pr.vx, pr.vy);
        this.projectiles.splice(i, 1);
      }
    }
  }

  _updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.hurtTimer > 0) e.hurtTimer -= dt;
      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        continue;
      }

      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        e.aiTimer = 0.7 + Math.random() * 1.0;
        if (e.type === 'stalfos' || e.type === 'bat') {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          const sp = e.type === 'bat' ? 56 : 44;
          e.vx = (dx / len) * sp;
          e.vy = (dy / len) * sp;
        } else {
          e.dir = Math.floor(Math.random() * 4);
          const dv = DIR_VEC[e.dir];
          e.vx = dv.x * 36;
          e.vy = dv.y * 36;
        }
      }

      if (e.type === 'octorok') {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 2.0 + Math.random();
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          this.projectiles.push({
            fromPlayer: false,
            kind: 'rock',
            x: e.x + 3,
            y: e.y + 3,
            w: 6,
            h: 6,
            vx: (dx / len) * 110,
            vy: (dy / len) * 110,
            life: 2.2,
            alive: true,
          });
        }
      }

      const nx = e.x + e.vx * dt;
      const ny = e.y + e.vy * dt;
      const canPass = (x, y) => {
        if (e.type === 'bat') return x > 16 && x < PLAY_W - 28 && y > 16 && y < PLAY_H - 28;
        const tx = Math.floor((x + 6) / TILE_SIZE);
        const ty = Math.floor((y + 6) / TILE_SIZE);
        return !this.world.isSolidTile(this.getTile(this.room, tx, ty));
      };
      if (canPass(nx, e.y)) e.x = nx;
      else e.vx = -e.vx;
      if (canPass(e.x, ny)) e.y = ny;
      else e.vy = -e.vy;

      if (overlaps(e, p)) {
        this._hurtPlayer(p.x - e.x, p.y - e.y);
      }
    }
  }

  _updateBoss(dt) {
    const b = this.boss;
    const p = this.player;
    if (b.hurtTimer > 0) b.hurtTimer -= dt;
    if (b.stunTimer > 0) {
      b.stunTimer -= dt;
      return;
    }

    b.timer -= dt;
    if (b.timer <= 0) {
      if (b.state === 'patrol') {
        b.state = 'charge';
        b.timer = 0.9;
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const len = Math.hypot(dx, dy) || 1;
        b.vx = (dx / len) * 125;
        b.vy = (dy / len) * 125;
      } else if (b.state === 'charge') {
        b.state = 'ring';
        b.timer = 1.4;
        b.vx = 0;
        b.vy = 0;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + this.time;
          this.projectiles.push({
            fromPlayer: false,
            kind: 'fire',
            x: b.x + 11,
            y: b.y + 11,
            w: 6,
            h: 6,
            vx: Math.cos(a) * 95,
            vy: Math.sin(a) * 95,
            life: 2.5,
            alive: true,
          });
        }
        this.sound.playBombExplode();
      } else {
        b.state = 'patrol';
        b.timer = 1.5;
        b.vx = (Math.random() - 0.5) * 70;
        b.vy = (Math.random() - 0.5) * 70;
      }
    }

    b.x = Math.max(20, Math.min(PLAY_W - 48, b.x + b.vx * dt));
    b.y = Math.max(20, Math.min(PLAY_H - 48, b.y + b.vy * dt));

    if (overlaps(b, p)) {
      this._hurtPlayer(p.x - b.x, p.y - b.y);
    }
  }

  _updateDrops(dt) {
    const p = this.player;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (overlaps(d, p)) {
        if (d.kind === 'rupee') {
          p.rupees += 5;
          this.sound.playRupee();
          this.spawnText(d.x, d.y, '+5', '#6df598');
        } else if (d.kind === 'heart') {
          p.hp = Math.min(p.maxHp, p.hp + 2);
          this.sound.playHeart();
          this.spawnText(d.x, d.y, 'HP+', '#ff758f');
        } else if (d.kind === 'bomb') {
          p.bombs += 2;
          this.sound.playRupee();
          this.spawnText(d.x, d.y, 'BOMB +2', '#ffd085');
        }
        this.drops.splice(i, 1);
      }
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
      else {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.92;
        pt.vy *= 0.92;
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) this.texts.splice(i, 1);
      else t.y += t.vy * dt;
    }
  }

  _startTransition(dx, dy) {
    const nrx = this.rx + dx;
    const nry = this.ry + dy;
    const target = this.world.getRoom(this.zone, nrx, nry);
    if (!target) {
      this.player.x = Math.max(0, Math.min(PLAY_W - this.player.w, this.player.x));
      this.player.y = Math.max(0, Math.min(PLAY_H - this.player.h, this.player.y));
      return;
    }
    const endPx = dx < 0 ? PLAY_W - 18 : dx > 0 ? 6 : this.player.x;
    const endPy = dy < 0 ? PLAY_H - 18 : dy > 0 ? 6 : this.player.y;
    this.transition = {
      fromRoom: this.room,
      toRoom: target,
      toRx: nrx,
      toRy: nry,
      dx,
      dy,
      t: 0,
      endPx,
      endPy,
    };
    this.state = STATE.TRANSITION;
  }

  _enterZone(zone, rx, ry, px, py) {
    this.zone = zone;
    this.rx = rx;
    this.ry = ry;
    this.room = this.world.getRoom(zone, rx, ry);
    this.world.markVisited(zone, rx, ry);
    this.player.x = px;
    this.player.y = py;
    this.sound.playDoorOpen();
    this.sound.setBgmMode(zone === 'dungeon' ? 'dungeon' : 'overworld');
    this._spawnRoomEntities();
    if (this.onAreaChange) this.onAreaChange(this.room);
  }
}
