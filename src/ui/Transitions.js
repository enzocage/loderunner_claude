import { CANVAS_W, CANVAS_H } from '../constants.js';

export default class Transitions {
  constructor() {
    this._type   = null;
    this._frame  = 0;
    this._frames = 0;
    this._cb     = null;
    this._active = false;
    this._midFired = false;
  }

  get isActive() { return this._active; }

  flash(frames = 16, onMid = null) {
    this._type = 'flash'; this._frames = frames;
    this._frame = 0; this._cb = onMid; this._active = true; this._midFired = false;
  }

  dissolve(frames = 40, onDone = null) {
    this._type = 'dissolve'; this._frames = frames;
    this._frame = 0; this._cb = onDone; this._active = true; this._midFired = false;
    this._pixels = null;
  }

  wipe(frames = 30, onDone = null) {
    this._type = 'wipe'; this._frames = frames;
    this._frame = 0; this._cb = onDone; this._active = true; this._midFired = false;
  }

  update() {
    if (!this._active) return;
    this._frame++;
    if (this._frame >= this._frames) {
      this._active = false;
      if (!this._midFired && this._cb) { this._midFired = true; this._cb(); }
    }
    const mid = Math.floor(this._frames / 2);
    if (!this._midFired && this._frame >= mid && this._type === 'flash' && this._cb) {
      this._midFired = true;
      this._cb();
    }
  }

  // Alias for drawing onto a plain 2D ctx (game canvas or legacy crt canvas)
  renderOnCtx(ctx, w = CANVAS_W, h = CANVAS_H) {
    this._renderImpl(ctx, w, h);
  }

  render(ctx) {
    if (!this._active) return;
    this._renderImpl(ctx, CANVAS_W, CANVAS_H);
  }

  _renderImpl(ctx, w, h) {
    if (!this._active) return;
    const t = this._frame / this._frames;

    switch (this._type) {
      case 'flash': {
        const alpha = t < 0.5 ? t * 2 : (1 - t) * 2;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case 'dissolve': {
        const pct = Math.min(1, t * 2);
        ctx.fillStyle = '#000';
        const count = (w * h * pct / 16) | 0;
        for (let i = 0; i < count; i++) {
          const px = (Math.random() * w | 0) & ~1;
          const py = (Math.random() * h | 0) & ~1;
          ctx.fillRect(px, py, 4, 4);
        }
        if (t > 0.9) {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, w, h);
        }
        break;
      }
      case 'wipe': {
        const wh = h * t;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, wh);
        break;
      }
    }
  }
}
