import { CANVAS_W, CANVAS_H, POWERUP } from '../constants.js';

const HUD_H = 22;
const MSG_STACK = 3; // max stacked messages

export default class HUD {
  constructor() {
    this.score        = 0;
    this.displayScore = 0;
    this.lives        = 3;
    this.maxLives     = 5;
    this.levelNum     = 1;
    this.goldTotal    = 0;
    this.goldCollected = 0;
    this.timeLeft     = 0;    // seconds remaining (0 = no timer)
    this.timeLimit    = 0;

    // Stacked floating messages [{text, timer, maxTimer, x, y, color}]
    this._messages = [];
    this._levelFlash = 0;

    // Combo display
    this.comboCount = 0;
    this._comboTimer = 0;

    // Power-up display
    this.activePower  = null;  // 'speed'|'dig'|'freeze'|null
    this.powerTimer   = 0;
    this.powerMax     = 0;

    // Level banner slide-in
    this._bannerTimer = 0;
    this._bannerText  = '';
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  showMessage(msg, frames = 120, opts = {}) {
    const { x = CANVAS_W / 2, y = CANVAS_H / 2 - 30, color = '#ffd700' } = opts;
    // Drop oldest if full
    if (this._messages.length >= MSG_STACK) this._messages.shift();
    this._messages.push({ text: msg, timer: frames, maxTimer: frames, x, y, color });
  }

  showCombo(count) {
    this.comboCount = count;
    this._comboTimer = 90;
  }

  showBanner(text) {
    this._bannerText  = text;
    this._bannerTimer = 120;
  }

  flashLevel() {
    this._levelFlash = 60;
  }

  setPower(name, frames) {
    this.activePower = name;
    this.powerTimer  = frames;
    this.powerMax    = frames;
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  update() {
    if (this.displayScore < this.score) {
      this.displayScore = Math.min(this.score, this.displayScore + 15);
    }
    for (let i = this._messages.length - 1; i >= 0; i--) {
      this._messages[i].timer--;
      if (this._messages[i].timer <= 0) this._messages.splice(i, 1);
    }
    if (this._levelFlash  > 0) this._levelFlash--;
    if (this._bannerTimer > 0) this._bannerTimer--;
    if (this._comboTimer  > 0) this._comboTimer--;
    if (this.powerTimer   > 0) this.powerTimer--;
    else this.activePower = null;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render(ctx, frameCount) {
    const w = CANVAS_W, h = CANVAS_H;

    // Bottom HUD bar
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, h - HUD_H, w, HUD_H);
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(0, h - HUD_H, w, 1);

    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textBaseline = 'middle';
    const my = h - HUD_H / 2 + 1;

    // Score
    ctx.fillStyle = '#bfce72';
    ctx.fillText('SCR', 3, my);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(this.displayScore).padStart(8, '0'), 25, my);

    // Lives (skull icons)
    const lx = 140;
    for (let i = 0; i < this.maxLives; i++) {
      const filled = i < this.lives;
      this._drawSkull(ctx, lx + i * 13, my - 4, filled);
    }

    // Gold counter
    const gx = 220;
    ctx.fillStyle = '#ffd700';
    this._drawCoin(ctx, gx, my - 4, true);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${this.goldCollected}/${this.goldTotal}`, gx + 10, my);

    // Level
    const lvlFlash = this._levelFlash > 0 && Math.floor(frameCount / 6) % 2 === 0;
    ctx.fillStyle = lvlFlash ? '#ffd700' : '#67b6bd';
    ctx.fillText(`L${String(this.levelNum).padStart(2,'0')}`, 295, my);

    // Time bar
    if (this.timeLimit > 0) {
      this._drawTimeBar(ctx, 330, my - 5, 110, 10, frameCount);
    }

    // Power-up indicator
    if (this.activePower) {
      this._drawPowerBar(ctx, 450, my - 5, 90, 10);
    }

    // Level banner slide-in
    if (this._bannerTimer > 0) {
      this._renderBanner(ctx, frameCount);
    }

    // Stacked messages
    for (const m of this._messages) {
      const alpha = Math.min(1, m.timer / 20);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = m.color;
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      const yOff = (m.maxTimer - m.timer) * 0.4;
      ctx.fillText(m.text, m.x, m.y - yOff);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;

    // Combo display
    if (this._comboTimer > 0 && this.comboCount >= 2) {
      const alpha = Math.min(1, this._comboTimer / 20);
      ctx.globalAlpha = alpha;
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff9900';
      ctx.fillText(`COMBO x${this.comboCount}!`, CANVAS_W / 2, CANVAS_H / 2 - 50);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _drawSkull(ctx, x, y, filled) {
    ctx.fillStyle = filled ? '#b86962' : '#333';
    // Dome
    ctx.fillRect(x+2, y,   5, 2);
    ctx.fillRect(x+1, y+2, 7, 4);
    ctx.fillStyle = filled ? '#000' : '#222';
    // Eye sockets
    ctx.fillRect(x+2, y+3, 2, 2);
    ctx.fillRect(x+5, y+3, 2, 2);
    // Jaw
    ctx.fillStyle = filled ? '#b86962' : '#333';
    ctx.fillRect(x+1, y+6, 7, 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(x+3, y+6, 1, 2);
    ctx.fillRect(x+5, y+6, 1, 2);
  }

  _drawCoin(ctx, x, y, filled) {
    ctx.fillStyle = filled ? '#ffd700' : '#555';
    ctx.fillRect(x+1, y,   4, 1);
    ctx.fillRect(x,   y+1, 6, 4);
    ctx.fillRect(x+1, y+5, 4, 1);
    if (filled) {
      ctx.fillStyle = '#ffee66';
      ctx.fillRect(x+1, y+1, 2, 2);
    }
  }

  _drawTimeBar(ctx, x, y, w, h, frameCount) {
    const frac = this.timeLeft / this.timeLimit;
    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, w, h);
    const color = frac > 0.5 ? '#44cc44'
                : frac > 0.25 ? '#cccc00'
                : Math.floor(frameCount / 8) % 2 ? '#ff2200' : '#cc0000';
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, Math.round((w - 2) * frac), h - 2);
    ctx.fillStyle = '#555';
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText('TIME', x + 1, y + h + 6);
  }

  _drawPowerBar(ctx, x, y, w, h) {
    const frac = this.powerTimer / this.powerMax;
    const colors = { speed: '#4488ff', dig: '#44cc44', freeze: '#ff4444' };
    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = colors[this.activePower] || '#fff';
    ctx.fillRect(x + 1, y + 1, Math.round((w - 2) * frac), h - 2);
    ctx.fillStyle = '#aaa';
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText(this.activePower?.toUpperCase() ?? '', x + 1, y + h + 6);
  }

  _renderBanner(ctx, frameCount) {
    const t = this._bannerTimer;
    const slideIn  = 120 - 90;
    const slideOut = 20;
    let xOff = 0;
    if (t > 120 - slideIn) xOff = -(CANVAS_W * (t - (120 - slideIn)) / slideIn);
    else if (t < slideOut) xOff = CANVAS_W * (1 - t / slideOut);

    ctx.save();
    ctx.translate(xOff, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, CANVAS_H / 2 - 25, CANVAS_W, 30);
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(this._bannerText, CANVAS_W / 2, CANVAS_H / 2 - 5);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}
