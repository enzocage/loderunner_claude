import { TILE, TILE_SIZE, CANVAS_W, CANVAS_H, DEFAULT_SETTINGS } from '../constants.js';
import SpriteAtlas from './SpriteAtlas.js';
import WebGLPostProcess from './WebGLPostProcess.js';

export default class Renderer {
  constructor(gameCanvas, crtCanvas) {
    this.gameCanvas = gameCanvas;
    this.crtCanvas  = crtCanvas;
    this.gCtx = gameCanvas.getContext('2d', { willReadFrequently: false });
    // cCtx used as fallback when WebGL is unavailable
    this.cCtx = crtCanvas.getContext('2d');

    this.crtEnabled = true;
    this._crtPreset = DEFAULT_SETTINGS.crtPreset;
    this.shakeX = 0;
    this.shakeY = 0;
    this._shakeIntensity = 0;
    this._shakeFrames = 0;
    this._frameCount = 0;
    this._currentTheme = null;

    // Sprite atlas (built lazily on first draw or explicit build call)
    this.atlas = new SpriteAtlas();

    // WebGL post-process pipeline
    this._glPost = new WebGLPostProcess(crtCanvas, gameCanvas);
    if (this._glPost.ok) {
      this._glPost.setPreset(this._crtPreset);
      // Null out the 2D CRT context – we use WebGL instead
      this.cCtx = crtCanvas.getContext('2d'); // keep for fallback overlays
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  setCrtPreset(name) {
    this._crtPreset = name;
    if (this._glPost.ok) {
      this._glPost.setPreset(name);
    }
  }

  buildAtlas(theme) {
    this._currentTheme = theme;
    this.atlas.build(theme);
  }

  triggerShake(intensity = 4, frames = 20) {
    this._shakeIntensity = intensity;
    this._shakeFrames    = frames;
  }

  beginFrame() {
    this._updateShake();
    const ctx = this.gCtx;
    ctx.save();
    ctx.translate(Math.round(this.shakeX), Math.round(this.shakeY));
    ctx.fillStyle = '#000';
    ctx.fillRect(-4, -4, CANVAS_W + 8, CANVAS_H + 8);
  }

  endFrame() {
    this.gCtx.restore();
    this._frameCount++;
    this._pushToOutput();
  }

  /** Draw an overlay on gCtx then re-push to output (CRT/2D). No beginFrame/restore. */
  overlayAndFlush(fn) {
    fn(this.gCtx);
    this._pushToOutput();
  }

  _pushToOutput() {
    if (this.crtEnabled && this._glPost.ok) {
      this._glPost.render();
    } else if (this.crtEnabled) {
      this._applyCPUCRT();
    } else {
      this.cCtx.drawImage(this.gameCanvas, 0, 0);
    }
  }

  // ── Tile drawing ──────────────────────────────────────────────────────────

  drawTile(tile, px, py, holeAnim = 0, frame = 0) {
    if (this.atlas.ready) {
      this.atlas.blitTile(this.gCtx, tile, px, py, frame, holeAnim);
    } else {
      this._fallbackTile(tile, px, py, holeAnim);
    }
  }

  // ── Entity drawing ─────────────────────────────────────────────────────────

  drawPlayer(x, y, state, facing, animFrame, isRespawning = false) {
    if (isRespawning && Math.floor(animFrame / 4) % 2 === 0) return;
    if (this.atlas.ready) {
      this.atlas.blitPlayer(this.gCtx, state, facing, animFrame, Math.round(x), Math.round(y));
    } else {
      this._fallbackPlayer(x, y, state, facing, animFrame);
    }
  }

  drawEnemy(x, y, state, facing, animFrame, isCarrying = false, tier = 2) {
    if (this.atlas.ready) {
      this.atlas.blitEnemy(this.gCtx, state, facing, animFrame, Math.round(x), Math.round(y), isCarrying, tier);
    } else {
      this._fallbackEnemy(x, y, state, facing, animFrame, isCarrying);
    }
  }

  // ── Utility ────────────────────────────────────────────────────────────────

  static scaleToFit() {
    const sw = window.innerWidth, sh = window.innerHeight;
    const scale = Math.min(sw / CANVAS_W, sh / CANVAS_H, 3);
    const wrap = document.getElementById('screen-wrap');
    if (wrap) {
      wrap.style.transformOrigin = 'center center';
      wrap.style.transform = `scale(${scale})`;
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  _updateShake() {
    if (this._shakeFrames > 0) {
      this.shakeX = (Math.random() - 0.5) * this._shakeIntensity * 2;
      this.shakeY = (Math.random() - 0.5) * this._shakeIntensity * 2;
      this._shakeIntensity *= 0.85;
      this._shakeFrames--;
    } else {
      this.shakeX = this.shakeY = 0;
    }
  }

  _applyCPUCRT() {
    const w = CANVAS_W, h = CANVAS_H;
    const src = this.gCtx.getImageData(0, 0, w, h);
    const dst = this.cCtx.createImageData(w, h);
    const srcD = src.data, dstD = dst.data;
    const curv = 0.10;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let ux = x / w - 0.5, uy = y / h - 0.5;
        const r2 = ux * ux + uy * uy;
        ux *= (1 + curv * r2);
        uy *= (1 + curv * r2);
        const sx = Math.round((ux + 0.5) * w);
        const sy = Math.round((uy + 0.5) * h);
        const di = (y * w + x) * 4;
        if (sx < 0 || sx >= w || sy < 0 || sy >= h) {
          dstD[di] = dstD[di+1] = dstD[di+2] = 0;
          dstD[di+3] = 255;
          continue;
        }
        const si = (sy * w + sx) * 4;
        let r = srcD[si], g = srcD[si+1], b = srcD[si+2];
        if (y % 2 === 0) { r = r * 0.82 | 0; g = g * 0.82 | 0; b = b * 0.82 | 0; }
        dstD[di] = r; dstD[di+1] = g; dstD[di+2] = b; dstD[di+3] = 255;
      }
    }
    this.cCtx.putImageData(dst, 0, 0);
  }

  // ── Fallback drawing (no atlas) ────────────────────────────────────────────

  _fallbackTile(tile, px, py, holeAnim) {
    const ctx = this.gCtx;
    const s = TILE_SIZE;
    switch (tile) {
      case TILE.BRICK:    this._fbBrick(ctx, px, py, s); break;
      case TILE.CONCRETE: this._fbConcrete(ctx, px, py, s); break;
      case TILE.LADDER:   this._fbLadder(ctx, px, py, s); break;
      case TILE.ROPE:     this._fbRope(ctx, px, py, s); break;
      case TILE.GOLD:     this._fbGold(ctx, px, py, s); break;
      case TILE.HOLE:     this._fbHole(ctx, px, py, s, holeAnim); break;
    }
  }

  _fbBrick(ctx, px, py, s) {
    ctx.fillStyle = '#8b4513'; ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#c07040'; ctx.fillRect(px, py, s-1, 1); ctx.fillRect(px, py, 1, s-1);
    ctx.fillStyle = '#5a2a00'; ctx.fillRect(px+s-1, py, 1, s); ctx.fillRect(px, py+s-1, s, 1);
    ctx.fillStyle = '#6b3010';
    ctx.fillRect(px+1, py+9, s-2, 1); ctx.fillRect(px+10, py+1, 1, 8);
    ctx.fillRect(px+4,  py+10, 1, 9); ctx.fillRect(px+16, py+10, 1, 9);
  }

  _fbConcrete(ctx, px, py, s) {
    ctx.fillStyle = '#606060'; ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#404040'; ctx.fillRect(px, py, s, 1); ctx.fillRect(px, py, 1, s);
    ctx.fillStyle = '#787878'; ctx.fillRect(px+s-1, py, 1, s); ctx.fillRect(px, py+s-1, s, 1);
    ctx.fillStyle = '#505050';
    ctx.fillRect(px+5, py+5, 10, 1); ctx.fillRect(px+5, py+14, 10, 1);
    ctx.fillRect(px+5, py+5, 1, 10); ctx.fillRect(px+14, py+5, 1, 10);
  }

  _fbLadder(ctx, px, py, s) {
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(px+3, py, 3, s); ctx.fillRect(px+14, py, 3, s);
    ctx.fillStyle = '#f0c030';
    ctx.fillRect(px+3, py, 1, s); ctx.fillRect(px+14, py, 1, s);
    ctx.fillStyle = '#d4a017';
    for (let ry = 2; ry < s; ry += 5) ctx.fillRect(px+3, py+ry, 14, 2);
  }

  _fbRope(ctx, px, py, s) {
    ctx.fillStyle = '#8b7030'; ctx.fillRect(px, py+8, s, 3);
    ctx.fillStyle = '#c0a060'; ctx.fillRect(px, py+8, s, 1);
    ctx.fillStyle = '#6b5020';
    for (let rx = 2; rx < s; rx += 5) ctx.fillRect(px+rx, py+8, 2, 3);
  }

  _fbGold(ctx, px, py, s) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(px+10, py+2); ctx.lineTo(px+18, py+10);
    ctx.lineTo(px+10, py+18); ctx.lineTo(px+2, py+10);
    ctx.closePath(); ctx.fill();
  }

  _fbHole(ctx, px, py, s, anim) {
    const open = Math.min(1, anim);
    const brickH = Math.round(s * (1 - open));
    if (brickH > 0) { ctx.fillStyle = '#8b4513'; ctx.fillRect(px, py+(s-brickH), s, brickH); }
    if (s-brickH > 0) { ctx.fillStyle = '#0a0a0a'; ctx.fillRect(px, py, s, s-brickH); }
  }

  _fallbackPlayer(x, y, state, facing, animFrame) {
    const ctx = this.gCtx;
    ctx.save();
    if (facing < 0) { ctx.translate((x + TILE_SIZE/2)*2, 0); ctx.scale(-1,1); }
    const isDig   = state === 'DIG_LEFT' || state === 'DIG_RIGHT';
    const isClimb = state === 'CLIMB_UP' || state === 'CLIMB_DOWN';
    const wf = Math.floor(animFrame/4) % 4;
    const lo = [[0,0],[2,-2],[0,0],[-2,-2]];
    ctx.fillStyle = '#5555ff'; ctx.fillRect(x+5, y+7, 10, 9);
    ctx.fillStyle = '#f0c060'; ctx.fillRect(x+6, y+1, 8, 7);
    ctx.fillStyle = '#000';    ctx.fillRect(x+11, y+3, 2, 2);
    ctx.fillStyle = '#fff';    ctx.fillRect(x+11, y+3, 1, 1);
    ctx.fillStyle = '#3333bb';
    if (!isClimb && !isDig) {
      ctx.fillRect(x+5,  y+16+lo[wf][0], 4, 4);
      ctx.fillRect(x+11, y+16+lo[(wf+2)%4][0], 4, 4);
    } else {
      ctx.fillRect(x+5, y+16, 4, 4); ctx.fillRect(x+11, y+16, 4, 4);
    }
    ctx.fillStyle = '#f0c060';
    if (isDig) { ctx.fillRect(x+15, y+8, 5, 3); ctx.fillStyle='#888'; ctx.fillRect(x+18, y+7, 3, 5); }
    else { ctx.fillRect(x+2, y+8, 3, 3); ctx.fillRect(x+15, y+8, 3, 3); }
    ctx.restore();
  }

  _fallbackEnemy(x, y, state, facing, animFrame, isCarrying) {
    const ctx = this.gCtx;
    ctx.save();
    if (facing < 0) { ctx.translate((x + TILE_SIZE/2)*2, 0); ctx.scale(-1,1); }
    if (state === 'TRAPPED') {
      ctx.fillStyle = '#ff5555'; ctx.fillRect(x+4, y+10, 12, 8);
      ctx.fillStyle = '#f0c060'; ctx.fillRect(x+6, y+4, 8, 8);
      ctx.restore(); return;
    }
    if (state === 'RESPAWN' && Math.floor(animFrame/3)%2===0) { ctx.restore(); return; }
    const wf = Math.floor(animFrame/4)%4;
    const lo = [[0,0],[2,-2],[0,0],[-2,-2]];
    ctx.fillStyle = '#ff5555'; ctx.fillRect(x+5, y+7, 10, 9);
    ctx.fillStyle = '#f0c060'; ctx.fillRect(x+5, y+1, 10, 7);
    ctx.fillStyle = '#ff0000'; ctx.fillRect(x+5, y+1, 10, 2);
    ctx.fillStyle = '#000';    ctx.fillRect(x+12, y+3, 2, 2);
    if (isCarrying) { ctx.fillStyle='#ffd700'; ctx.fillRect(x+7, y-2, 6, 4); }
    ctx.fillStyle = '#cc3333';
    ctx.fillRect(x+5, y+16+lo[wf][0], 4, 4);
    ctx.fillRect(x+11, y+16+lo[(wf+2)%4][0], 4, 4);
    ctx.restore();
  }
}
