import * as PIXI from 'https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.mjs';
import { ROOM_COLS, ROOM_ROWS, TILE_SIZE, PLAY_W, PLAY_H, HUD_H, VIEW_W, VIEW_H, DIR, STATE, TILE } from './constants.js';

// Custom PixiJS v8 GLSL Filter: Refractive Shockwave + 9-Tap Bloom + Hit Chromatic Aberration
const ZELDA_FILTER_FRAG = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uAberration;
uniform float uShockTime;
uniform vec2 uShockCenter;
uniform float uBloom;

vec3 sampleBright(vec2 uv) {
  vec3 c = texture2D(uTexture, clamp(uv, 0.001, 0.999)).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return c * smoothstep(0.70, 0.96, l);
}

void main() {
  vec2 uv = vTextureCoord;

  if (uShockTime < 0.72) {
    vec2 diff = uv - uShockCenter;
    float d = length(diff);
    float radius = uShockTime * 1.1;
    float band = 1.0 - smoothstep(0.0, 0.085, abs(d - radius));
    float fade = 1.0 - (uShockTime / 0.72);
    vec2 dir = d > 0.0001 ? diff / d : vec2(0.0);
    uv -= dir * band * fade * 0.02;
  }

  vec2 centered = uv - vec2(0.5);
  float dist = length(centered);
  vec2 cdir = dist > 0.0001 ? centered / dist : vec2(0.0);
  float ca = uAberration * (0.003 + dist * 0.014);

  vec3 base = vec3(
    texture2D(uTexture, clamp(uv + cdir * ca, 0.001, 0.999)).r,
    texture2D(uTexture, clamp(uv, 0.001, 0.999)).g,
    texture2D(uTexture, clamp(uv - cdir * ca, 0.001, 0.999)).b
  );

  vec2 px = vec2(0.0022, 0.0034);
  vec3 bloom = sampleBright(uv) * 0.24;
  bloom += (sampleBright(uv + vec2(px.x, 0.0)) + sampleBright(uv - vec2(px.x, 0.0))
          + sampleBright(uv + vec2(0.0, px.y)) + sampleBright(uv - vec2(0.0, px.y))) * 0.12;
  bloom += (sampleBright(uv + px * 1.4) + sampleBright(uv - px * 1.4)
          + sampleBright(uv + vec2(px.x, -px.y) * 1.4) + sampleBright(uv + vec2(-px.x, px.y) * 1.4)) * 0.07;

  gl_FragColor = vec4(base + bloom * uBloom, 1.0);
}
`;

function toNearestTexture(canvas) {
  const tex = PIXI.Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return tex;
}

function hexNum(css) {
  return parseInt(css.replace('#', ''), 16);
}

class SpritePool {
  constructor(parent) {
    this.parent = parent;
    this.pool = [];
    this.used = 0;
  }
  begin() { this.used = 0; }
  draw(tex, x, y, opts = {}) {
    let spr = this.pool[this.used];
    if (!spr) {
      spr = new PIXI.Sprite(tex);
      this.parent.addChild(spr);
      this.pool.push(spr);
    } else if (spr.texture !== tex) {
      spr.texture = tex;
    }
    spr.visible = true;
    spr.x = x;
    spr.y = y;
    spr.alpha = opts.alpha ?? 1;
    spr.tint = opts.tint ?? 0xffffff;
    spr.rotation = opts.rotation ?? 0;
    spr.scale.set(opts.scaleX ?? 1, opts.scaleY ?? 1);
    spr.anchor.set(opts.anchorX ?? 0, opts.anchorY ?? 0);
    this.used++;
    return spr;
  }
  end() {
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false;
  }
}

export class ZeldaPixiRenderer {
  constructor(mountEl, atlas) {
    this.mountEl = mountEl;
    this.atlas = atlas;
    this.app = null;
    this.textures = { tiles: {}, hero: {}, enemies: {}, items: {}, npcs: {} };
    this.filtersEnabled = true;
    this.aberration = 0;
    this.shockTime = 2.0;
    this.shockCenter = new Float32Array([0.5, 0.5]);
    this.activeSprites = 0;
  }

  async init() {
    const app = new PIXI.Application();
    const rect = this.mountEl.getBoundingClientRect();
    await app.init({
      width: Math.max(960, Math.round(rect.width || 960)),
      height: Math.max(600, Math.round(rect.height || 600)),
      backgroundColor: 0x0c1018,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    this.app = app;
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';
    app.canvas.style.display = 'block';
    this.mountEl.innerHTML = '';
    this.mountEl.appendChild(app.canvas);

    this._bakeTextures();

    // --- PIXI SCENE GRAPH ---
    this.worldMask = new PIXI.Graphics().rect(0, HUD_H, PLAY_W, PLAY_H).fill(0xffffff);
    this.sceneContainer = new PIXI.Container();
    this.playContainer = new PIXI.Container();
    this.playContainer.mask = this.worldMask;

    this.tileSprites = new PIXI.Container();
    this.worldGfx = new PIXI.Graphics();
    this.entitySprites = new PIXI.Container();
    this.fxGfx = new PIXI.Graphics();
    this.fxGfx.blendMode = 'add';

    this.playContainer.addChild(this.tileSprites, this.worldGfx, this.entitySprites, this.fxGfx);
    this.sceneContainer.addChild(this.worldMask, this.playContainer);

    // Crisp Hi-Res HUD Container (960x648 logical)
    this.hudContainer = new PIXI.Container();
    this.hudGfx = new PIXI.Graphics();
    this.hudSprites = new PIXI.Container();
    this.hudTexts = new PIXI.Container();
    this.hudContainer.addChild(this.hudGfx, this.hudSprites, this.hudTexts);

    app.stage.addChild(this.sceneContainer, this.hudContainer);

    this.tilePool = new SpritePool(this.tileSprites);
    this.entPool = new SpritePool(this.entitySprites);
    this.hudIconPool = new SpritePool(this.hudSprites);

    const font = '"Noto Sans TC", "Microsoft JhengHei", ui-monospace, sans-serif';
    this.txtRoom = this._mkText('', 15, 0xa8ffb8, font, true);
    this.txtEquip = this._mkText('', 13, 0xeaf4ff, font, true);
    this.txtRupees = this._mkText('', 18, 0x6df598, 'ui-monospace, monospace', true);
    this.txtKeys = this._mkText('', 18, 0xffd54f, 'ui-monospace, monospace', true);
    this.txtBombs = this._mkText('', 18, 0xc8d6f0, 'ui-monospace, monospace', true);
    this.txtLife = this._mkText('— LIFE —', 13, 0xff8a9e, font, true);
    this.txtGpu = this._mkText('', 11, 0x7dffb2, 'ui-monospace, monospace', true);
    this.txtBoss = this._mkText('IGNIS GUARDIAN — 炎核守衛', 14, 0xff9868, font, true, 0.5);

    this.txtDlgSpeaker = this._mkText('', 18, 0xffd561, font, true);
    this.txtDlgBody = this._mkText('', 18, 0xf2f7ff, font, false);
    this.txtDlgBody.style.wordWrap = true;
    this.txtDlgBody.style.wordWrapWidth = 780;
    this.txtDlgNext = this._mkText('按 [SPACE / ENTER] 繼續 ▼', 13, 0x8effb0, font, true, 1);

    this.txtOverlayTitle = this._mkText('', 58, 0xffe066, 'ui-monospace, monospace', true, 0.5);
    this.txtOverlaySub = this._mkText('', 23, 0x9effb8, font, true, 0.5);
    this.txtOverlayBody = this._mkText('', 16, 0xd4e8d8, font, false, 0.5);
    this.txtOverlayPrompt = this._mkText('', 21, 0xfff096, font, true, 0.5);

    this.floatingTexts = [];

    try {
      this.filter = new PIXI.Filter({
        glProgram: PIXI.GlProgram.from({ vertex: PIXI.defaultFilterVert, fragment: ZELDA_FILTER_FRAG }),
        resources: {
          zeldaUniforms: {
            uAberration: { value: 0, type: 'f32' },
            uShockTime: { value: 2.0, type: 'f32' },
            uShockCenter: { value: this.shockCenter, type: 'vec2<f32>' },
            uBloom: { value: 0.30, type: 'f32' },
          },
        },
      });
      this.sceneContainer.filters = [this.filter];
    } catch (err) {
      console.warn('PixiJS filter fallback:', err);
      this.filter = null;
    }

    this.resize();
  }

  _mkText(str, size, fill, fontFamily, bold = false, anchorX = 0) {
    const t = new PIXI.Text({
      text: str,
      style: {
        fontFamily,
        fontSize: size,
        fontWeight: bold ? '800' : '600',
        fill,
        dropShadow: { color: 0x0a0c14, distance: 2, alpha: 0.85 },
      },
    });
    t.anchor.set(anchorX, 0);
    this.hudTexts.addChild(t);
    return t;
  }

  _bakeTextures() {
    for (const grp of ['tiles', 'hero', 'enemies', 'items', 'npcs']) {
      for (const [k, c] of Object.entries(this.atlas[grp])) {
        this.textures[grp][k] = toNearestTexture(c);
      }
    }
  }

  get canvas() { return this.app ? this.app.canvas : null; }

  resize() {
    if (!this.app) return;
    const rect = this.mountEl.getBoundingClientRect();
    const w = Math.max(640, Math.round(rect.width || 960));
    const h = Math.max(400, Math.round(rect.height || 600));
    this.app.renderer.resize(w, h);
    this.sceneContainer.scale.set(w / VIEW_W, h / VIEW_H);
    this.hudContainer.scale.set(w / 960, h / 648);
  }

  pulse(strength = 0.85, nx = 0.5, ny = 0.55) {
    this.aberration = Math.max(this.aberration, strength);
    this.shockTime = 0.0;
    this.shockCenter[0] = Math.max(0.05, Math.min(0.95, nx));
    this.shockCenter[1] = Math.max(0.12, Math.min(0.95, ny));
  }

  updateEffects(dt) {
    if (this.aberration > 0.002) this.aberration *= Math.pow(0.004, dt);
    else this.aberration = 0;
    if (this.shockTime < 1.2) this.shockTime += dt * 1.35;

    if (this.filter) {
      const u = this.filter.resources.zeldaUniforms.uniforms;
      u.uAberration = this.aberration;
      u.uShockTime = this.shockTime;
      u.uShockCenter = this.shockCenter;
      this.sceneContainer.filters = this.filtersEnabled ? [this.filter] : null;
    }
  }

  render(game, fps = 60) {
    if (!this.app) return;
    this.tilePool.begin();
    this.entPool.begin();
    this.worldGfx.clear();
    this.fxGfx.clear();

    const baseOx = Math.round(game.shakeX);
    const baseOy = HUD_H + Math.round(game.shakeY);

    if (game.state === STATE.TRANSITION && game.transition) {
      const tr = game.transition;
      const ease = 1 - Math.pow(1 - tr.t, 3);
      const ox = Math.round(-tr.dx * PLAY_W * ease);
      const oy = Math.round(-tr.dy * PLAY_H * ease);
      this._drawRoomTiles(tr.fromRoom, game.world.crystalState, game.time, baseOx + ox, baseOy + oy);
      this._drawRoomTiles(tr.toRoom, game.world.crystalState, game.time, baseOx + ox + tr.dx * PLAY_W, baseOy + oy + tr.dy * PLAY_H);
    } else {
      this._drawRoomTiles(game.room, game.world.crystalState, game.time, baseOx, baseOy);
      this._drawEntities(game, baseOx, baseOy);
      this._drawHero(game, baseOx, baseOy);
      this._drawParticles(game, baseOx, baseOy);
      this._drawLighting(game, baseOx, baseOy);
    }

    this.tilePool.end();
    this.entPool.end();
    this.activeSprites = this.tilePool.used + this.entPool.used;

    this._drawHUD(game, fps);
  }

  _drawRoomTiles(room, crystalState, time, ox, oy) {
    const t = this.textures.tiles;
    const wg = this.worldGfx;
    const baseFloor = room.isDungeon ? t.dungeonFloor : t.grass;

    for (let y = 0; y < ROOM_ROWS; y++) {
      for (let x = 0; x < ROOM_COLS; x++) {
        const tile = room.tiles[y * ROOM_COLS + x];
        const px = ox + x * TILE_SIZE;
        const py = oy + y * TILE_SIZE;
        switch (tile) {
          case TILE.GRASS: this.tilePool.draw(t.grass, px, py); break;
          case TILE.FLOWERS: this.tilePool.draw(t.flowers, px, py); break;
          case TILE.PATH: this.tilePool.draw(t.path, px, py); break;
          case TILE.TREE: this.tilePool.draw(t.tree, px, py); break;
          case TILE.BUSH: this.tilePool.draw(t.bush, px, py); break;
          case TILE.ROCK: this.tilePool.draw(t.rock, px, py); break;
          case TILE.CRACKED_WALL: this.tilePool.draw(t.cracked, px, py); break;
          case TILE.DUNGEON_FLOOR: this.tilePool.draw(t.dungeonFloor, px, py); break;
          case TILE.DUNGEON_WALL: this.tilePool.draw(t.dungeonWall, px, py); break;
          case TILE.PUSH_BLOCK: this.tilePool.draw(t.pushBlock, px, py); break;
          case TILE.SWITCH: this.tilePool.draw(room.switchSolved ? t.switchOn : t.switchOff, px, py); break;
          case TILE.LOCKED_DOOR: this.tilePool.draw(t.lockedDoor, px, py); break;
          case TILE.BRIDGE: this.tilePool.draw(t.bridge, px, py); break;
          case TILE.STAIRS_IN: this.tilePool.draw(t.stairsIn, px, py); break;
          case TILE.STAIRS_OUT: this.tilePool.draw(t.stairsOut, px, py); break;
          case TILE.SIGN: this.tilePool.draw(t.sign, px, py); break;
          case TILE.PEDESTAL: this.tilePool.draw(t.pedestal, px, py); break;
          case TILE.POT:
            this.tilePool.draw(baseFloor, px, py);
            this.tilePool.draw(t.pot, px, py);
            break;
          case TILE.CRYSTAL_ORB:
            this.tilePool.draw(baseFloor, px, py);
            this.tilePool.draw(crystalState === 0 ? t.crystalRed : t.crystalBlue, px, py);
            break;
          case TILE.RED_BLOCK:
            this.tilePool.draw(baseFloor, px, py);
            this.tilePool.draw(crystalState === 0 ? t.redUp : t.redDown, px, py);
            break;
          case TILE.BLUE_BLOCK:
            this.tilePool.draw(baseFloor, px, py);
            this.tilePool.draw(crystalState === 1 ? t.blueUp : t.blueDown, px, py);
            break;
          case TILE.BRAZIER_OFF:
            this.tilePool.draw(baseFloor, px, py);
            this.tilePool.draw(t.brazierOff, px, py);
            break;
          case TILE.BRAZIER_ON:
            this.tilePool.draw(baseFloor, px, py);
            this.tilePool.draw(t.brazierOn, px, py);
            break;
          case TILE.FAIRY_SPRING:
            this.tilePool.draw(t.fairySpring, px, py);
            wg.rect(px + 8 + Math.cos(time * 4 + x) * 4, py + 8 + Math.sin(time * 5 + y) * 4, 2, 2).fill(0xfff5b0);
            break;
          case TILE.WATER: {
            wg.rect(px, py, 16, 16).fill(0x247bb8);
            const sh = Math.floor(Math.sin(time * 3 + x + y) * 2);
            wg.rect(px + 2 + sh, py + 4, 5, 1).fill(0x52b8f0);
            wg.rect(px + 8 - sh, py + 11, 5, 1).fill(0x52b8f0);
            break;
          }
          case TILE.TORCH: {
            this.tilePool.draw(room.isDungeon ? t.dungeonFloor : t.path, px, py);
            wg.rect(px + 6, py + 7, 4, 8).fill(0x473124);
            wg.rect(px + 5, py + 2, 6, 6).fill(Math.sin(time * 18 + x) > 0 ? 0xff9838 : 0xff5e2e);
            wg.rect(px + 6, py + 3, 4, 3).fill(0xfff3a8);
            break;
          }
        }
      }
    }
  }

  _drawEntities(game, ox, oy) {
    const { room, time } = game;
    const wg = this.worldGfx;
    const ti = this.textures.items;
    const te = this.textures.enemies;

    for (const c of room.chests) {
      this.entPool.draw(c.opened ? ti.chestOpen : ti.chestClosed, ox + c.x, oy + c.y);
    }
    if (room.npc) {
      this.entPool.draw(room.npc.kind === 'merchant' ? this.textures.npcs.merchant : this.textures.npcs.elder, ox + room.npc.x, oy + room.npc.y);
    }
    for (const s of room.shopItems || []) {
      if (s.sold) continue;
      wg.rect(ox + s.x - 1, oy + s.y + 6, 14, 6).fill(0x3b2e26);
      this.entPool.draw(ti[s.icon] || ti.bomb, ox + s.x + 1, oy + s.y - 1 + Math.sin(time * 4 + s.x) * 1.2);
    }
    for (const tr of game.traps || []) {
      const tx = Math.round(ox + tr.x), ty = Math.round(oy + tr.y);
      wg.rect(tx, ty, 14, 14).fill(0x1b1d2b);
      wg.rect(tx + 2, ty + 2, 10, 10).fill(0x8b96b8);
      wg.rect(tx + 5, ty + 5, 4, 4).fill(0xff4b64);
    }
    for (const d of game.drops) {
      const tex = d.kind === 'rupee' ? ti.rupee : d.kind === 'heart' ? ti.heartFull : ti.bomb;
      this.entPool.draw(tex, Math.round(ox + d.x), Math.round(oy + d.y + Math.sin(time * 6 + d.x) * 1.5));
    }
    for (const b of game.bombs) {
      this.entPool.draw(ti.bomb, Math.round(ox + b.x), Math.round(oy + b.y), {
        tint: b.fuse < 0.5 && Math.floor(time * 22) % 2 === 0 ? 0xff6450 : 0xffffff,
      });
    }
    if (game.boomerang) {
      this.entPool.draw(ti.boomerang, ox + game.boomerang.x + 4, oy + game.boomerang.y + 4, {
        anchorX: 0.5,
        anchorY: 0.5,
        rotation: time * 18,
      });
    }
    for (const e of game.enemies) {
      if (!e.alive) continue;
      if (e.hurtTimer > 0 && Math.floor(time * 24) % 2 === 0) continue;
      const tex = e.type === 'octorok' ? te.octorok : e.type === 'stalfos' ? te.stalfos : e.type === 'bat' ? te.bat : te.slime;
      const jit = e.stunTimer > 0 ? Math.sin(time * 40) * 1.5 : 0;
      this.entPool.draw(tex, Math.round(ox + e.x - 2 + jit), Math.round(oy + e.y - 2));
    }
    if (game.boss && game.boss.alive) {
      const b = game.boss;
      const flash = b.hurtTimer > 0 && Math.floor(time * 24) % 2 === 0;
      const bx = Math.round(ox + b.x), by = Math.round(oy + b.y);
      wg.rect(bx, by, 28, 28).fill(flash ? 0xffffff : b.stunTimer > 0 ? 0x3aa8d8 : 0x7a1f24);
      wg.rect(bx + 2, by + 2, 24, 24).fill(flash ? 0xffffff : 0xd9452e);
      wg.rect(bx + 6, by + 8, 5, 5).fill(0xffe066);
      wg.rect(bx + 17, by + 8, 5, 5).fill(0xffe066);
      wg.rect(bx + 10, by + 16, 8, 6).fill(0xfff8c4);
    }
    if (game.relic) {
      const rx = ox + game.relic.x + 6;
      const ry = oy + game.relic.y + 6 + Math.sin(time * 5) * 2;
      wg.poly([rx, ry - 7, rx + 7, ry + 5, rx - 7, ry + 5]).fill(0xffe066);
    }
    for (const pr of game.projectiles) {
      const px = Math.round(ox + pr.x), py = Math.round(oy + pr.y);
      if (pr.kind === 'beam') {
        wg.rect(px, py, 6, 6).fill(game.player.swordLevel >= 2 ? 0xffd54f : 0x7ef7ff);
        wg.rect(px + 1, py + 1, 4, 4).fill(0xffffff);
      } else if (pr.kind === 'fire' || pr.kind === 'player_fire') {
        wg.rect(px, py, 7, 7).fill(0xff5e2e);
        wg.rect(px + 1, py + 1, 4, 4).fill(0xfff08a);
      } else {
        wg.rect(px, py, 6, 6).fill(0x9c7858);
      }
    }
  }

  _drawHero(game, ox, oy) {
    const p = game.player;
    if (p.invulnTimer > 0 && Math.floor(game.time * 20) % 2 === 0) return;
    const wg = this.worldGfx;
    wg.rect(Math.round(ox + p.x + 1), Math.round(oy + p.y + 10), 10, 4).fill({ color: 0x000000, alpha: 0.32 });

    if (p.chargeTimer >= 0.3) {
      wg.circle(ox + p.x + 6, oy + p.y + 6, 9 + Math.sin(game.time * 24) * 1.5).stroke({
        width: 1.5,
        color: p.chargeTimer >= 0.45 ? 0x7ef7ff : 0xffe066,
      });
    }

    const th = this.textures.hero;
    const tex = p.dir === DIR.UP ? th.up : p.dir === DIR.LEFT ? th.left : p.dir === DIR.RIGHT ? th.right : th.down;
    const bob = p.rollTimer > 0 ? -2 : Math.sin(p.walkAnim) * 0.8;
    this.entPool.draw(tex, Math.round(ox + p.x - 2), Math.round(oy + p.y - 3 + bob));

    if (p.spinTimer > 0) {
      wg.circle(ox + p.x + 6, oy + p.y + 6, 18).stroke({ width: 3, color: 0x9effe8 });
    } else if (p.attackTimer > 0) {
      const prog = 1 - p.attackTimer / 0.16;
      const base = p.dir === DIR.RIGHT ? 0 : p.dir === DIR.DOWN ? Math.PI * 0.5 : p.dir === DIR.LEFT ? Math.PI : -Math.PI * 0.5;
      const a0 = base - 1.1 + prog * 1.8;
      wg.moveTo(ox + p.x + 6, oy + p.y + 6)
        .lineTo(ox + p.x + 6 + Math.cos(a0) * 16, oy + p.y + 6 + Math.sin(a0) * 16)
        .stroke({ width: 2.5, color: p.swordLevel >= 2 ? 0xffd54f : 0x7ef7ff });
    }
  }

  _drawParticles(game, ox, oy) {
    const fg = this.fxGfx;
    for (const pt of game.particles) {
      fg.rect(ox + pt.x, oy + pt.y, pt.size, pt.size).fill({ color: hexNum(pt.color), alpha: Math.max(0, pt.life / pt.maxLife) });
    }
  }

  _drawLighting(game, ox, oy) {
    const fg = this.fxGfx;
    if (game.room.isDungeon) {
      fg.circle(ox + game.player.x + 6, oy + game.player.y + 6, 30).fill({ color: 0x82e6ff, alpha: 0.12 });
      for (let y = 0; y < ROOM_ROWS; y++) {
        for (let x = 0; x < ROOM_COLS; x++) {
          const t = game.room.tiles[y * ROOM_COLS + x];
          if (t === TILE.TORCH || t === TILE.BRAZIER_ON) {
            fg.circle(ox + x * 16 + 8, oy + y * 16 + 6, 28 + Math.sin(game.time * 12 + x) * 3).fill({ color: 0xffa43e, alpha: 0.22 });
          }
        }
      }
      if (game.boss && game.boss.alive) {
        fg.circle(ox + game.boss.x + 14, oy + game.boss.y + 14, 42).fill({ color: 0xff6e30, alpha: 0.25 });
      }
    } else {
      // PixiJS Overworld Canopy Godrays
      for (let i = 0; i < 3; i++) {
        const rx = ox + 40 + i * 110 + Math.sin(game.time * 0.6 + i) * 12;
        fg.poly([rx, oy, rx + 26, oy, rx - 30, oy + PLAY_H, rx - 60, oy + PLAY_H]).fill({ color: 0xfff3b0, alpha: 0.05 });
      }
    }
  }

  _drawHUD(game, fps) {
    const hg = this.hudGfx;
    hg.clear();
    this.hudIconPool.begin();

    // Floating texts + Shop price labels
    const labels = [];
    for (const s of game.room.shopItems || []) {
      if (!s.sold) {
        labels.push({
          text: `${s.label} ${s.price}R`,
          x: (s.x + 6) * 3,
          y: (HUD_H + s.y + 16) * 3,
          color: game.player.rupees >= s.price ? 0xffe066 : 0xff8a9e,
          alpha: 1,
        });
      }
    }
    for (const t of game.texts) {
      labels.push({
        text: t.text,
        x: t.x * 3,
        y: (HUD_H + t.y) * 3,
        color: hexNum(t.color),
        alpha: Math.min(1, (t.life / t.maxLife) * 1.4),
      });
    }
    for (let i = 0; i < labels.length; i++) {
      let ft = this.floatingTexts[i];
      if (!ft) {
        ft = this._mkText('', 15, 0xffe66d, '"Noto Sans TC", ui-monospace, sans-serif', true, 0.5);
        this.floatingTexts.push(ft);
      }
      ft.visible = true;
      ft.text = labels[i].text;
      ft.style.fill = labels[i].color;
      ft.alpha = labels[i].alpha;
      ft.position.set(labels[i].x, labels[i].y);
    }
    for (let i = labels.length; i < this.floatingTexts.length; i++) this.floatingTexts[i].visible = false;

    // Top HUD bar
    const p = game.player;
    const isD = game.zone === 'dungeon';
    hg.rect(0, 0, 960, 72).fill(0x0d1218);
    hg.rect(0, 71, 960, 2).fill({ color: 0xffffff, alpha: 0.12 });

    // Minimap
    hg.rect(14, 10, 96, 52).fill(0x18212b).stroke({ width: 1, color: 0x3a4a5e });
    const cols = isD ? 2 : 3;
    const ox = isD ? 36 : 23;
    for (let ry = 0; ry < 2; ry++) {
      for (let rx = 0; rx < cols; rx++) {
        const visited = game.world.visited.has(`${game.zone}:${rx},${ry}`);
        const curr = rx === game.rx && ry === game.ry;
        hg.rect(ox + rx * 29, 16 + ry * 21, 26, 18).fill(curr ? 0xffd54f : visited ? (isD ? 0x5d6b8f : 0x3a9958) : 0x232c38);
      }
    }

    this.txtRoom.text = game.room.name;
    this.txtRoom.style.fill = isD ? 0xffd085 : 0xa8ffb8;
    this.txtRoom.position.set(126, 12);

    hg.rect(126, 36, 162, 26).fill(0x1b2430).stroke({ width: 1, color: 0x4f6580 });
    const ti = this.textures.items;
    const eqTex = p.equipped === 'boomerang' ? ti.boomerang : p.equipped === 'fire_rod' ? ti.fireRod : ti.bomb;
    this.hudIconPool.draw(eqTex, 134, 41, { scaleX: 2, scaleY: 2 });
    this.txtEquip.text = p.equipped === 'boomerang' ? '裝備：迴力鏢 [E]' : p.equipped === 'fire_rod' ? '裝備：聖火法杖 [E]' : `裝備：炸彈 x${p.bombs} [E]`;
    this.txtEquip.position.set(158, 41);

    this.hudIconPool.draw(ti.rupee, 304, 24, { scaleX: 2.2, scaleY: 2.2 });
    this.txtRupees.text = `${p.rupees}`;
    this.txtRupees.position.set(328, 25);

    this.hudIconPool.draw(ti.key, 396, 24, { scaleX: 2.2, scaleY: 2.2 });
    this.txtKeys.text = `${p.keys}`;
    this.txtKeys.position.set(420, 25);

    this.hudIconPool.draw(ti.bomb, 470, 24, { scaleX: 2.2, scaleY: 2.2 });
    this.txtBombs.text = `${p.bombs}`;
    this.txtBombs.position.set(496, 25);

    this.txtLife.position.set(744, 8);
    const totalHearts = Math.ceil(p.maxHp / 2);
    for (let i = 0; i < totalHearts; i++) {
      const full = p.hp >= (i + 1) * 2;
      const hx = 680 + i * 32;
      this.hudIconPool.draw(full ? ti.heartFull : ti.heartEmpty, hx, 30, { scaleX: 2.6, scaleY: 2.6 });
    }

    this.txtGpu.text = `PIXI v8 GPU | ${fps} FPS | SPRITES: ${this.activeSprites} | FILTER: ${this.filtersEnabled ? 'ON' : 'OFF'}`;
    this.txtGpu.position.set(14, 78);

    // Boss HP Bar
    const showBoss = Boolean(game.boss && game.boss.alive);
    this.txtBoss.visible = showBoss;
    if (showBoss) {
      hg.rect(280, 86, 400, 38).fill({ color: 0x0c0a12, alpha: 0.85 });
      this.txtBoss.position.set(480, 90);
      hg.rect(296, 112, 368, 8).fill(0x2d1c24);
      hg.rect(296, 112, 368 * (game.boss.hp / game.boss.maxHp), 8).fill(0xff5e38);
    }

    // Dialogue Box
    const isDlg = game.state === STATE.DIALOGUE;
    this.txtDlgSpeaker.visible = isDlg;
    this.txtDlgBody.visible = isDlg;
    this.txtDlgNext.visible = isDlg;
    if (isDlg) {
      hg.rect(60, 472, 840, 144).fill({ color: 0x0a0e18, alpha: 0.92 }).stroke({ width: 3, color: 0xffd561 });
      this.txtDlgSpeaker.text = game.dialogueSpeaker;
      this.txtDlgSpeaker.position.set(86, 488);
      this.txtDlgBody.text = game.dialogueText;
      this.txtDlgBody.position.set(86, 522);
      this.txtDlgNext.position.set(876, 586);
    }

    // Center Overlays
    const isOv = game.state === STATE.TITLE || game.state === STATE.PAUSED || game.state === STATE.GAME_OVER || game.state === STATE.VICTORY;
    this.txtOverlayTitle.visible = isOv;
    this.txtOverlaySub.visible = isOv;
    this.txtOverlayBody.visible = game.state === STATE.TITLE || game.state === STATE.VICTORY;
    this.txtOverlayPrompt.visible = isOv;

    if (game.state === STATE.TITLE) {
      hg.rect(0, 72, 960, 576).fill({ color: 0x08100c, alpha: 0.72 });
      const bob = Math.sin(game.time * 3) * 6;
      this.txtOverlayTitle.text = 'AETHER BLADE';
      this.txtOverlayTitle.style.fill = 0xffe066;
      this.txtOverlayTitle.position.set(480, 174 + bob);
      this.txtOverlaySub.text = '— PixiJS v8 GPU 引擎版 • 空間折射震波 & 森林光束 —';
      this.txtOverlaySub.position.set(480, 250 + bob);
      this.txtOverlayBody.text = '10 房間大地圖與古神殿  •  紅藍水晶開關  •  聖火法杖點燈  •  森林商店  •  炎核守衛 BOSS';
      this.txtOverlayBody.position.set(480, 326);
      this.txtOverlayPrompt.text = '按 [ENTER] 或 [SPACE] 展開冒險';
      this.txtOverlayPrompt.alpha = 0.65 + 0.35 * Math.sin(game.time * 5);
      this.txtOverlayPrompt.position.set(480, 412);
    } else if (game.state === STATE.PAUSED) {
      hg.rect(0, 72, 960, 576).fill({ color: 0x060a0e, alpha: 0.76 });
      this.txtOverlayTitle.text = 'PAUSED 暫停中';
      this.txtOverlayTitle.style.fill = 0xffffff;
      this.txtOverlayTitle.position.set(480, 260);
      this.txtOverlaySub.text = '[ESC / P] 繼續    [R] 重新開始';
      this.txtOverlaySub.position.set(480, 344);
      this.txtOverlayPrompt.visible = false;
    } else if (game.state === STATE.GAME_OVER) {
      hg.rect(0, 72, 960, 576).fill({ color: 0x10060a, alpha: 0.78 });
      this.txtOverlayTitle.text = '勇者倒下了⋯⋯';
      this.txtOverlayTitle.style.fill = 0xff647e;
      this.txtOverlayTitle.position.set(480, 255);
      this.txtOverlaySub.visible = false;
      this.txtOverlayPrompt.text = '按 [ENTER / SPACE] 重新展開冒險';
      this.txtOverlayPrompt.alpha = 1;
      this.txtOverlayPrompt.position.set(480, 348);
    } else if (game.state === STATE.VICTORY) {
      hg.rect(0, 72, 960, 576).fill({ color: 0x0a0e16, alpha: 0.84 });
      this.txtOverlayTitle.text = 'LEGEND FULFILLED!';
      this.txtOverlayTitle.style.fill = 0xffe066;
      this.txtOverlayTitle.position.set(480, 200);
      this.txtOverlaySub.text = '你擊敗了炎核守衛，奪回【聖樹之印】！';
      this.txtOverlaySub.position.set(480, 286);
      this.txtOverlayBody.text = `收集盧比：${p.rupees}    最大生命：${p.maxHp / 2} 顆心`;
      this.txtOverlayBody.position.set(480, 342);
      this.txtOverlayPrompt.text = '按 [ENTER / SPACE] 再次踏上旅程';
      this.txtOverlayPrompt.alpha = 1;
      this.txtOverlayPrompt.position.set(480, 412);
    }

    this.hudIconPool.end();
  }
}
