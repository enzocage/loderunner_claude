import { CANVAS_W, CANVAS_H } from '../constants.js';

const STORAGE_KEY = 'loderunner_scores';
const MAX_ENTRIES = 10;

export default class HighScores {
  constructor() {
    this._scores = this._load();
    // Name entry state
    this._entry  = null;  // { chars, pos, score, level, callback }
    this._frame  = 0;
  }

  _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
    } catch { return []; }
  }

  _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._scores)); } catch {}
  }

  qualifies(score) {
    if (this._scores.length < MAX_ENTRIES) return true;
    return score > this._scores[this._scores.length - 1].score;
  }

  add(name, score, level) {
    this._scores.push({ name: name.substring(0, 3).toUpperCase(), score, level, date: new Date().toISOString().slice(0, 10) });
    this._scores.sort((a, b) => b.score - a.score);
    this._scores = this._scores.slice(0, MAX_ENTRIES);
    this._save();
  }

  // Name entry mini-game (arrow keys to navigate)
  startEntry(score, level, callback) {
    this._entry = { chars: ['A', 'A', 'A'], pos: 0, score, level, callback };
  }

  get isEnteringName() { return !!this._entry; }

  handleInput(input) {
    if (!this._entry) return;
    const e = this._entry;
    if (input.isPressed('ArrowLeft') || input.isPressed('KeyA')) {
      e.pos = (e.pos - 1 + 3) % 3;
    }
    if (input.isPressed('ArrowRight') || input.isPressed('KeyD')) {
      e.pos = (e.pos + 1) % 3;
    }
    if (input.isPressed('ArrowUp') || input.isPressed('KeyW')) {
      const c = e.chars[e.pos].charCodeAt(0);
      e.chars[e.pos] = String.fromCharCode(c === 90 ? 65 : c + 1);
    }
    if (input.isPressed('ArrowDown') || input.isPressed('KeyS')) {
      const c = e.chars[e.pos].charCodeAt(0);
      e.chars[e.pos] = String.fromCharCode(c === 65 ? 90 : c - 1);
    }
    if (input.isPressed('Enter') || input.isPressed('Space')) {
      const name = e.chars.join('');
      this.add(name, e.score, e.level);
      const cb = e.callback;
      this._entry = null;
      if (cb) cb(name);
    }
  }

  update(input) {
    this._frame++;
    if (this._entry) this.handleInput(input);
  }

  renderScoreTable(ctx) {
    const cx = CANVAS_W / 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('HIGH SCORES', cx, 30);

    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#555';
    ctx.fillText('─────────────────────────────────', cx, 50);

    const scores = this._scores;
    for (let i = 0; i < Math.min(10, scores.length); i++) {
      const s = scores[i];
      const y = 70 + i * 22;
      const isTop = i === 0;
      ctx.fillStyle = isTop ? '#ffd700' : (i % 2 === 0 ? '#bfce72' : '#94e089');
      ctx.textAlign = 'left';
      ctx.fillText(`${String(i + 1).padStart(2, ' ')}.`, 60, y);
      ctx.fillText(s.name, 90, y);
      ctx.textAlign = 'right';
      ctx.fillText(String(s.score).padStart(8, '0'), CANVAS_W - 60, y);
      ctx.fillStyle = '#555';
      ctx.textAlign = 'right';
      ctx.fillText(`LVL ${s.level}`, CANVAS_W - 100, y + 11);
    }
    if (scores.length === 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#555';
      ctx.fillText('NO SCORES YET', cx, 120);
    }

    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#555';
    ctx.textAlign = 'center';
    ctx.fillText('PRESS ANY KEY TO CONTINUE', cx, CANVAS_H - 30);
    ctx.textAlign = 'left';
  }

  renderNameEntry(ctx) {
    if (!this._entry) return;
    const e = this._entry;
    const cx = CANVAS_W / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('NEW HIGH SCORE!', cx, CANVAS_H / 2 - 70);

    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(String(e.score).padStart(8, '0'), cx, CANVAS_H / 2 - 45);

    ctx.fillText('ENTER YOUR NAME:', cx, CANVAS_H / 2 - 10);

    // Character display
    const charW = 28, startX = cx - charW;
    for (let i = 0; i < 3; i++) {
      const x = startX + i * charW;
      const isActive = i === e.pos;
      if (isActive) {
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(x - 10, CANVAS_H / 2 + 10, 20, 24);
        ctx.fillStyle = '#000';
      } else {
        ctx.fillStyle = '#fff';
      }
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.fillText(e.chars[i], x, CANVAS_H / 2 + 27);
    }

    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#7869c4';
    ctx.fillText('◄► SELECT   ▲▼ CHANGE   ENTER CONFIRM', cx, CANVAS_H / 2 + 55);
    ctx.textAlign = 'left';
  }
}
