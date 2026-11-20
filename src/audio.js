// Procedural 8/16-bit Zelda-style Adventure Web Audio Synthesizer

const NF = {
  A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, Ab3: 207.65, A3: 220, Bb3: 233.08, B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392, Ab4: 415.3, A4: 440, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5,
};

const OVERWORLD_MEL = [
  'D5', null, 'A4', null, 'D5', 'D5', 'E5', 'Fs5',
  'G5', null, 'A5', null, 'A5', null, 'G5', 'Fs5',
  'E5', null, 'D5', 'E5', 'Fs5', null, 'D5', null,
  'B4', 'C5', 'D5', 'E5', 'A4', null, null, null,
];

const OVERWORLD_BAS = [
  'D3', null, 'A3', null, 'D3', null, 'A3', null,
  'G3', null, 'D3', null, 'G3', null, 'D3', null,
  'A3', null, 'E3', null, 'D3', null, 'A3', null,
  'G3', null, 'A3', null, 'D3', null, 'A3', null,
];

const DUNGEON_MEL = [
  'E4', 'G4', 'A4', 'Bb4', 'A4', 'G4', 'E4', null,
  'D4', 'F4', 'G4', 'Ab4', 'G4', 'F4', 'D4', null,
  'E4', 'B4', 'A4', 'G4', 'Fs4', 'E4', 'D4', null,
  'C4', 'E4', 'G4', 'Fs4', 'E4', null, null, null,
];

const DUNGEON_BAS = [
  'E3', null, 'B3', null, 'E3', null, 'B3', null,
  'D3', null, 'A3', null, 'D3', null, 'A3', null,
  'C3', null, 'G3', null, 'B3', null, 'Fs4', null,
  'C3', null, 'B3', null, 'E3', null, null, null,
];

const BOSS_MEL = [
  'E5', 'E5', 'G5', 'E5', 'A5', 'G5', 'Fs5', 'E5',
  'D5', 'D5', 'F5', 'D5', 'G5', 'F5', 'E5', 'D5',
  'C5', 'E5', 'G5', 'B5', 'A5', 'G5', 'Fs5', 'E5',
  'B4', 'E5', 'Fs5', 'G5', 'E5', null, null, null,
];

const BOSS_BAS = [
  'E3', 'E3', 'G3', 'E3', 'A3', 'E3', 'G3', 'E3',
  'D3', 'D3', 'F3', 'D3', 'G3', 'D3', 'F3', 'D3',
  'C3', 'C3', 'G3', 'C3', 'B3', 'B3', 'Fs4', 'B3',
  'E3', 'G3', 'A3', 'B3', 'E3', null, 'B3', null,
];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.bgmMode = 'overworld';
    this.step = 0;
    this.stepTimer = 0;
    this.unlocked = false;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.25;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.unlocked = true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.25, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  setBgmMode(mode) {
    if (this.bgmMode !== mode) {
      this.bgmMode = mode;
      this.step = 0;
    }
  }

  update(dt) {
    if (!this.unlocked || !this.ctx || this.muted || this.bgmMode === 'off') return;
    if (this.ctx.state !== 'running') return;
    const dur = this.bgmMode === 'boss' ? 0.13 : this.bgmMode === 'dungeon' ? 0.21 : 0.165;
    this.stepTimer += dt;
    if (this.stepTimer >= dur) {
      this.stepTimer -= dur;
      this._stepBgm();
      this.step = (this.step + 1) % 32;
    }
  }

  _stepBgm() {
    const mode = this.bgmMode;
    const mel = mode === 'boss' ? BOSS_MEL : mode === 'dungeon' ? DUNGEON_MEL : OVERWORLD_MEL;
    const bas = mode === 'boss' ? BOSS_BAS : mode === 'dungeon' ? DUNGEON_BAS : OVERWORLD_BAS;
    const m = mel[this.step];
    const b = bas[this.step];
    if (m && NF[m]) {
      this._tone({
        freq: NF[m],
        type: mode === 'dungeon' ? 'triangle' : mode === 'boss' ? 'sawtooth' : 'square',
        dur: mode === 'dungeon' ? 0.22 : 0.14,
        vol: mode === 'dungeon' ? 0.075 : 0.045,
      });
    }
    if (b && NF[b]) {
      this._tone({ freq: NF[b], type: 'triangle', dur: 0.17, vol: 0.08 });
    }
  }

  _tone({ freq, freqEnd = null, type = 'square', dur = 0.12, vol = 0.15, delay = 0 }) {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  _noise(dur = 0.08, vol = 0.14, filterFreq = 1600) {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    const count = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, count, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < count; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(filterFreq, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(this.master);
    src.start(now);
  }

  playSword() {
    this._noise(0.075, 0.14, 2400);
    this._tone({ freq: 520, freqEnd: 180, type: 'triangle', dur: 0.08, vol: 0.13 });
  }

  playSpinAttack() {
    this._noise(0.16, 0.18, 2800);
    this._tone({ freq: 340, freqEnd: 920, type: 'sawtooth', dur: 0.16, vol: 0.14 });
  }

  playSwordBeam() {
    this._tone({ freq: 880, freqEnd: 1520, type: 'square', dur: 0.11, vol: 0.11 });
  }

  playRoll() {
    this._noise(0.09, 0.1, 1100);
  }

  playBoomerang() {
    this._tone({ freq: 420, freqEnd: 620, type: 'triangle', dur: 0.08, vol: 0.1 });
  }

  playBombExplode() {
    this._noise(0.28, 0.25, 380);
    this._tone({ freq: 130, freqEnd: 32, type: 'sawtooth', dur: 0.28, vol: 0.2 });
  }

  playHit() {
    this._noise(0.06, 0.14, 1300);
    this._tone({ freq: 260, freqEnd: 120, type: 'square', dur: 0.08, vol: 0.14 });
  }

  playHurt() {
    this._tone({ freq: 290, freqEnd: 88, type: 'sawtooth', dur: 0.2, vol: 0.17 });
    this._noise(0.12, 0.15, 700);
  }

  playRupee() {
    this._tone({ freq: 988, type: 'square', dur: 0.06, vol: 0.1 });
    this._tone({ freq: 1318, type: 'square', dur: 0.1, vol: 0.1, delay: 0.05 });
  }

  playHeart() {
    this._tone({ freq: 660, freqEnd: 990, type: 'triangle', dur: 0.14, vol: 0.14 });
  }

  playSecret() {
    const seq = ['G5', 'Fs5', 'Eb5', 'A4', 'Ab4', 'E5', 'Ab5', 'C6'];
    seq.forEach((n, i) => this._tone({ freq: NF[n], type: 'square', dur: 0.11, vol: 0.12, delay: i * 0.075 }));
  }

  playChest() {
    const seq = ['A4', 'Bb4', 'B4', 'C5'];
    seq.forEach((n, i) =>
      this._tone({ freq: NF[n], type: 'square', dur: i === 3 ? 0.36 : 0.11, vol: 0.13, delay: i * 0.1 })
    );
  }

  playDoorOpen() {
    this._noise(0.18, 0.16, 620);
    this._tone({ freq: 180, freqEnd: 320, type: 'triangle', dur: 0.18, vol: 0.15 });
  }

  playVictory() {
    const seq = ['D5', 'Fs5', 'A5', 'D6' in NF ? 'D6' : 'C6', 'A5', 'C6'];
    const freqs = [587.33, 739.99, 880, 1174.66, 880, 1174.66];
    freqs.forEach((f, i) =>
      this._tone({ freq: f, type: 'square', dur: i === 5 ? 0.5 : 0.13, vol: 0.13, delay: i * 0.12 })
    );
  }
}
