export default class AudioManager {
  constructor() {
    this._ctx = null;
    this._master = null;
    this._muted = false;
    this._bgmSource = null;
    this._bgmGain = null;
    this._musicVol = 0.5;
    this._sfxVol   = 0.7;
  }

  init() {
    if (this._ctx) return;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._master = this._ctx.createGain();
    this._master.gain.value = 0.5;
    this._master.connect(this._ctx.destination);
  }

  _resume() {
    if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume();
  }

  toggleMute() {
    this._muted = !this._muted;
    if (this._master) this._master.gain.value = this._muted ? 0 : this._musicVol;
    return this._muted;
  }

  setMusicVol(v) {
    this._musicVol = Math.max(0, Math.min(1, v));
    if (this._master && !this._muted) this._master.gain.value = this._musicVol;
  }

  setSfxVol(v) {
    this._sfxVol = Math.max(0, Math.min(1, v));
  }

  // Synthesised sound effects
  play(name, options = {}) {
    this._resume();
    if (!this._ctx) return;
    const vol = options.volume ?? 1;
    const pitch = options.pitch ?? 1;
    switch (name) {
      case 'dig':      this._playDig(vol * this._sfxVol, pitch); break;
      case 'collect':  this._playCollect(vol * this._sfxVol, pitch); break;
      case 'fall':     this._playFall(vol * this._sfxVol, pitch); break;
      case 'death':    this._playDeath(vol * this._sfxVol); break;
      case 'complete': this._playComplete(vol * this._sfxVol); break;
      case 'trap':     this._playTrap(vol * this._sfxVol); break;
      case 'walk':     this._playWalk(vol * this._sfxVol, pitch); break;
      case 'powerup':  this._playPowerUp(vol * this._sfxVol); break;
    }
  }

  _osc(type, freq, dur, vol, attack = 0.005, release = 0.05) {
    const ctx = this._ctx;
    const g = ctx.createGain();
    g.connect(this._master);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + attack);
    g.gain.setValueAtTime(vol, now + dur - release);
    g.gain.linearRampToValueAtTime(0, now + dur);
    o.start(now);
    o.stop(now + dur + 0.01);
  }

  _noise(dur, vol) {
    const ctx = this._ctx;
    const bufSize = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 400;
    src.connect(filt);
    filt.connect(g);
    g.connect(this._master);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(vol, now);
    g.gain.linearRampToValueAtTime(0, now + dur);
    src.start(now);
  }

  _playDig(vol, pitch) {
    const f = 220 * pitch;
    this._osc('square', f,    0.04, vol * 0.6);
    this._osc('square', f*0.75, 0.08, vol * 0.4);
    this._noise(0.08, vol * 0.3);
  }

  _playCollect(vol, pitch) {
    const f = 880 * pitch;
    this._osc('sine', f,    0.06, vol * 0.7);
    this._osc('sine', f*1.5, 0.1, vol * 0.5);
  }

  _playFall(vol, pitch) {
    const ctx = this._ctx;
    const g = ctx.createGain();
    g.connect(this._master);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const now = ctx.currentTime;
    o.frequency.setValueAtTime(400 * pitch, now);
    o.frequency.linearRampToValueAtTime(80 * pitch, now + 0.15);
    o.connect(g);
    g.gain.setValueAtTime(vol * 0.5, now);
    g.gain.linearRampToValueAtTime(0, now + 0.15);
    o.start(now);
    o.stop(now + 0.16);
  }

  _playDeath(vol) {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        if (!this._ctx) return;
        this._osc('square', 330 - i * 60, 0.12, vol * 0.6);
      }, i * 80);
    }
    this._noise(0.5, vol * 0.4);
  }

  _playComplete(vol) {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => {
        if (!this._ctx) return;
        this._osc('sine', f, 0.2, vol * 0.7);
      }, i * 120);
    });
  }

  _playTrap(vol) {
    this._osc('square', 110, 0.15, vol * 0.5);
    this._noise(0.1, vol * 0.4);
  }

  _playWalk(vol, pitch) {
    this._osc('square', 80 * pitch, 0.03, vol * 0.15);
  }

  _playPowerUp(vol) {
    const notes = [440, 660, 880, 1320];
    notes.forEach((f, i) => {
      setTimeout(() => {
        if (!this._ctx) return;
        this._osc('sine', f, 0.1, vol * 0.6);
      }, i * 60);
    });
  }

  startBGM() {
    this._resume();
    if (!this._ctx || this._bgmSource) return;
    // Simple arpeggiated BGM using oscillators
    this._scheduleBGM();
  }

  stopBGM() {
    if (this._bgmSource) {
      try { this._bgmSource.stop(); } catch (e) { /* ignore */ }
      this._bgmSource = null;
    }
  }

  _scheduleBGM() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const baseNotes = [220, 277, 330, 440, 330, 277];
    let t = ctx.currentTime + 0.1;
    const step = 0.18;
    const playNote = (freq, when) => {
      const g = ctx.createGain();
      g.connect(this._master);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.connect(g);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.08, when + 0.02);
      g.gain.setValueAtTime(0.08, when + step - 0.04);
      g.gain.linearRampToValueAtTime(0, when + step);
      o.start(when);
      o.stop(when + step + 0.01);
    };
    for (let rep = 0; rep < 8; rep++) {
      baseNotes.forEach((f, i) => {
        playNote(f, t);
        playNote(f * 2, t + 0.01);
        t += step;
      });
    }
    // reschedule after ~8 seconds
    setTimeout(() => {
      if (!this._muted) this._scheduleBGM();
    }, 7500);
  }
}
