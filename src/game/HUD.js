import { CANVAS_W, CANVAS_H, TILE_SIZE } from '../constants.js';

const HUD_H = 20;

export default class HUD {
  constructor() {
    this.score      = 0;
    this.displayScore = 0;
    this.lives      = 3;
    this.levelNum   = 1;
    this.message    = '';
    this.messageTimer = 0;
    this._levelFlash = 0;
  }

  addScore(n) {
    this.score += n;
  }

  showMessage(msg, frames = 120) {
    this.message = msg;
    this.messageTimer = frames;
  }

  flashLevel() {
    this._levelFlash = 60;
  }

  update() {
    // Tick up display score
    if (this.displayScore < this.score) {
      this.displayScore = Math.min(this.score, this.displayScore + 10);
    }
    if (this.messageTimer > 0) this.messageTimer--;
    if (this._levelFlash > 0)  this._levelFlash--;
  }

  render(ctx, frameCount) {
    const w = CANVAS_W, h = CANVAS_H;

    // Background bar
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, h - HUD_H, w, HUD_H);
    ctx.fillStyle = '#333';
    ctx.fillRect(0, h - HUD_H, w, 1);

    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textBaseline = 'middle';
    const my = h - HUD_H / 2;

    // Score
    ctx.fillStyle = '#bfce72';
    ctx.fillText('SCORE', 4, my);
    ctx.fillStyle = '#fff';
    const scoreStr = String(this.displayScore).padStart(7, '0');
    ctx.fillText(scoreStr, 50, my);

    // Lives (heart icons)
    ctx.fillStyle = '#b86962';
    ctx.fillText('LIVES', 165, my);
    for (let i = 0; i < this.lives; i++) {
      this._drawHeart(ctx, 215 + i * 14, my - 4);
    }

    // Level
    const lvlFlashing = this._levelFlash > 0 && Math.floor(frameCount / 6) % 2 === 0;
    ctx.fillStyle = lvlFlashing ? '#ffd700' : '#67b6bd';
    ctx.fillText(`LVL  ${String(this.levelNum).padStart(2, '0')}`, 290, my);

    // Gold remaining
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`GOLD`, 400, my);
    ctx.fillStyle = '#fff';

    // Message overlay
    if (this.messageTimer > 0) {
      const alpha = Math.min(1, this.messageTimer / 20);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffd700';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.message, CANVAS_W / 2, CANVAS_H / 2 - 20);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  _drawHeart(ctx, x, y) {
    ctx.fillStyle = '#b86962';
    ctx.fillRect(x+1, y,   3, 2);
    ctx.fillRect(x+5, y,   3, 2);
    ctx.fillRect(x,   y+2, 9, 3);
    ctx.fillRect(x+1, y+5, 7, 2);
    ctx.fillRect(x+2, y+7, 5, 1);
    ctx.fillRect(x+3, y+8, 3, 1);
    ctx.fillRect(x+4, y+9, 1, 1);
  }
}
