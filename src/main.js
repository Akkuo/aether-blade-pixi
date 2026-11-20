import { PLAY_W, PLAY_H, HUD_H, VIEW_H } from './constants.js';
import { SoundEngine } from './audio.js';
import { createAtlas } from './sprites.js';
import { ZeldaPixiRenderer } from './pixi-renderer.js';
import { ZeldaGame } from './game.js';

const mountEl = document.getElementById('pixi-mount');
const canvasWrap = document.getElementById('canvas-wrap');
const areaPill = document.getElementById('area-pill');

const sound = new SoundEngine();
const atlas = createAtlas();
const renderer = new ZeldaPixiRenderer(mountEl, atlas);

function syncAreaUI(room) {
  canvasWrap.classList.toggle('in-dungeon', room.isDungeon);
  areaPill.className = `badge ${room.isDungeon ? 'dungeon' : ''}`;
  areaPill.textContent = room.isDungeon ? 'PIXI v8 • 古神殿' : 'PIXI v8 • 聖樹平原';
}

const game = new ZeldaGame(sound, syncAreaUI, (strength) => {
  const nx = (game.player.x + 6) / PLAY_W;
  const ny = (HUD_H + game.player.y + 6) / VIEW_H;
  renderer.pulse(strength, nx, ny);
});

const keys = new Set();
const justPressed = new Set();
const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

window.addEventListener('keydown', (e) => {
  sound.unlock();
  if (PREVENT.has(e.code)) e.preventDefault();
  if (!keys.has(e.code)) justPressed.add(e.code);
  keys.add(e.code);
  if (e.code === 'KeyM') sound.toggleMute();
  if (e.code === 'KeyG') {
    renderer.filtersEnabled = !renderer.filtersEnabled;
    game.spawnText(game.player.x + 6, game.player.y - 8, renderer.filtersEnabled ? 'PIXI FILTER ON' : 'PIXI FILTER OFF', '#7eeeff');
  }
});

window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// Mobile Virtual Gamepad
const touchRoot = document.getElementById('touch-controls');
const touchToggleBtn = document.getElementById('touch-toggle-btn');
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (touchRoot && isTouchDevice) touchRoot.classList.add('visible');
if (touchToggleBtn && touchRoot) {
  touchToggleBtn.addEventListener('click', () => {
    touchRoot.classList.toggle('visible');
    renderer.resize();
  });
}
if (touchRoot) {
  const activePointers = new Map();
  const releasePointer = (pid) => {
    const entry = activePointers.get(pid);
    if (!entry) return;
    activePointers.delete(pid);
    entry.btn.classList.remove('pressed');
    let stillHeld = false;
    for (const v of activePointers.values()) if (v.code === entry.code) stillHeld = true;
    if (!stillHeld) keys.delete(entry.code);
  };
  touchRoot.querySelectorAll('.tbtn[data-key]').forEach((btn) => {
    const code = btn.dataset.key;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sound.unlock();
      btn.setPointerCapture(e.pointerId);
      activePointers.set(e.pointerId, { code, btn });
      if (!keys.has(code)) justPressed.add(code);
      keys.add(code);
      btn.classList.add('pressed');
    });
    btn.addEventListener('pointerup', (e) => { e.preventDefault(); releasePointer(e.pointerId); });
    btn.addEventListener('pointercancel', (e) => releasePointer(e.pointerId));
  });
}

function readInput() {
  const down = (...c) => c.some((k) => keys.has(k));
  const pressed = (...c) => c.some((k) => justPressed.has(k));
  const inp = {
    left: down('ArrowLeft', 'KeyA'),
    right: down('ArrowRight', 'KeyD'),
    up: down('ArrowUp', 'KeyW'),
    down: down('ArrowDown', 'KeyS'),
    attack: down('Space', 'KeyZ', 'KeyJ'),
    attackPressed: pressed('Space', 'KeyZ', 'KeyJ'),
    itemPressed: pressed('KeyE', 'KeyX', 'KeyK'),
    cyclePressed: pressed('KeyQ', 'Tab'),
    rollPressed: pressed('ShiftLeft', 'ShiftRight'),
    startPressed: pressed('Enter'),
    pausePressed: pressed('Escape', 'KeyP'),
    restartPressed: pressed('KeyR'),
  };
  justPressed.clear();
  return inp;
}

async function boot() {
  await renderer.init();
  window.addEventListener('resize', () => renderer.resize());
  renderer.canvas.addEventListener('pointerdown', () => sound.unlock());

  const STEP = 1 / 60;
  let acc = 0;
  let last = performance.now();
  let frames = 0;
  let fpsTimer = 0;
  let fps = 60;

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frames++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      fps = Math.round(frames / fpsTimer);
      frames = 0;
      fpsTimer = 0;
    }
    acc += dt;
    while (acc >= STEP) {
      game.update(STEP, readInput());
      renderer.updateEffects(STEP);
      acc -= STEP;
    }
    renderer.render(game, fps);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

boot();
