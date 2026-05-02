import { TILE, TILE_SIZE, CANVAS_W, CANVAS_H } from '../constants.js';

export default class Renderer {
  constructor(gameCanvas, crtCanvas) {
    this.gameCanvas = gameCanvas;
    this.crtCanvas  = crtCanvas;
    this.gCtx  = gameCanvas.getContext('2d', { willReadFrequently: true });
    this.cCtx  = crtCanvas.getContext('2d');
    this.crtEnabled = true;
    this.shakeX = 0; this.shakeY = 0;
    this._shakeIntensity = 0; this._shakeFrames = 0;
    this._frameCount = 0;
    this._slowFrames = 0;
  }

  triggerShake(intensity = 4, frames = 20) {
    this._shakeIntensity = intensity;
    this._shakeFrames = frames;
  }

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

  beginFrame() {
    const ctx = this.gCtx;
    this._updateShake();
    ctx.save();
    ctx.translate(Math.round(this.shakeX), Math.round(this.shakeY));
    ctx.fillStyle = '#000';
    ctx.fillRect(-4, -4, CANVAS_W + 8, CANVAS_H + 8);
  }

  endFrame() {
    this.gCtx.restore();
    this._frameCount++;
    if (this.crtEnabled) {
      this._applyCRT();
    } else {
      this.cCtx.drawImage(this.gameCanvas, 0, 0);
    }
  }

  _applyCRT() {
    const t0 = performance.now();
    const w = CANVAS_W, h = CANVAS_H;
    const src = this.gCtx.getImageData(0, 0, w, h);
    const dst = this.cCtx.createImageData(w, h);
    const srcD = src.data, dstD = dst.data;
    const curv = 0.12;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Barrel distortion
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

        // Phosphor tint: slight green push
        g = Math.min(255, g + 8);

        // Scanline darkening on even rows
        if (y % 2 === 0) { r = r * 0.82 | 0; g = g * 0.82 | 0; b = b * 0.82 | 0; }

        dstD[di]   = r;
        dstD[di+1] = g;
        dstD[di+2] = b;
        dstD[di+3] = 255;
      }
    }
    this.cCtx.putImageData(dst, 0, 0);

    // Auto-disable if too slow
    const elapsed = performance.now() - t0;
    if (elapsed > 13) {
      this._slowFrames++;
      if (this._slowFrames >= 3) {
        this.crtEnabled = false;
        this.cCtx.drawImage(this.gameCanvas, 0, 0);
        console.warn('[Renderer] CRT disabled: too slow');
      }
    } else {
      this._slowFrames = 0;
    }
  }

  // ─── Tile drawing ──────────────────────────────────────────────────────────

  drawTile(tile, px, py, holeAnim = 0) {
    const ctx = this.gCtx;
    const s = TILE_SIZE;
    switch (tile) {
      case TILE.BRICK:
        this._drawBrick(ctx, px, py, s);
        break;
      case TILE.CONCRETE:
        this._drawConcrete(ctx, px, py, s);
        break;
      case TILE.LADDER:
        this._drawLadder(ctx, px, py, s);
        break;
      case TILE.ROPE:
        this._drawRope(ctx, px, py, s);
        break;
      case TILE.GOLD:
        this._drawGold(ctx, px, py, s, this._frameCount);
        break;
      case TILE.HOLE:
        this._drawHole(ctx, px, py, s, holeAnim);
        break;
      case TILE.TRAP_BRICK:
        // looks like empty but we draw a very faint outline in editor
        break;
    }
  }

  _drawBrick(ctx, px, py, s) {
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(px, py, s, s);
    // Highlight top-left
    ctx.fillStyle = '#c07040';
    ctx.fillRect(px, py, s - 1, 1);
    ctx.fillRect(px, py, 1, s - 1);
    // Shadow bottom-right
    ctx.fillStyle = '#5a2a00';
    ctx.fillRect(px + s - 1, py, 1, s);
    ctx.fillRect(px, py + s - 1, s, 1);
    // Mortar lines
    ctx.fillStyle = '#6b3010';
    ctx.fillRect(px + 1, py + 9, s - 2, 1);
    ctx.fillRect(px + 10, py + 1, 1, 8);
    ctx.fillRect(px + 4,  py + 10, 1, 9);
    ctx.fillRect(px + 16, py + 10, 1, 9);
  }

  _drawConcrete(ctx, px, py, s) {
    ctx.fillStyle = '#606060';
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#404040';
    ctx.fillRect(px, py, s, 1);
    ctx.fillRect(px, py, 1, s);
    ctx.fillStyle = '#787878';
    ctx.fillRect(px + s - 1, py, 1, s);
    ctx.fillRect(px, py + s - 1, s, 1);
    // Cross-hatch texture
    ctx.fillStyle = '#505050';
    ctx.fillRect(px + 5, py + 5, 10, 1);
    ctx.fillRect(px + 5, py + 14, 10, 1);
    ctx.fillRect(px + 5, py + 5, 1, 10);
    ctx.fillRect(px + 14, py + 5, 1, 10);
  }

  _drawLadder(ctx, px, py, s) {
    ctx.fillStyle = '#d4a017';
    // Rails
    ctx.fillRect(px + 3, py, 3, s);
    ctx.fillRect(px + 14, py, 3, s);
    // Highlight
    ctx.fillStyle = '#f0c030';
    ctx.fillRect(px + 3, py, 1, s);
    ctx.fillRect(px + 14, py, 1, s);
    // Rungs
    ctx.fillStyle = '#d4a017';
    for (let ry = 2; ry < s; ry += 5) {
      ctx.fillRect(px + 3, py + ry, 14, 2);
    }
  }

  _drawRope(ctx, px, py, s) {
    ctx.fillStyle = '#8b7030';
    ctx.fillRect(px, py + 8, s, 3);
    ctx.fillStyle = '#c0a060';
    ctx.fillRect(px, py + 8, s, 1);
    // Knot marks every 5px
    ctx.fillStyle = '#6b5020';
    for (let rx = 2; rx < s; rx += 5) {
      ctx.fillRect(px + rx, py + 8, 2, 3);
    }
  }

  _drawGold(ctx, px, py, s, frame) {
    // Pulsing diamond
    const pulse = Math.sin(frame * 0.1) * 0.5 + 0.5;
    const bright = `hsl(45,100%,${50 + pulse * 15}%)`;
    ctx.fillStyle = bright;
    ctx.beginPath();
    ctx.moveTo(px + 10, py + 2);
    ctx.lineTo(px + 18, py + 10);
    ctx.lineTo(px + 10, py + 18);
    ctx.lineTo(px + 2,  py + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffeea0';
    ctx.fillRect(px + 9, py + 6, 2, 2);
  }

  _drawHole(ctx, px, py, s, anim) {
    // anim 0..1: 0=full brick, 1=full open
    const open = Math.min(1, anim);
    const brickH = Math.round(s * (1 - open));
    // Show remaining brick at bottom of hole
    if (brickH > 0) {
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(px, py + (s - brickH), s, brickH);
      ctx.fillStyle = '#5a2a00';
      ctx.fillRect(px, py + (s - brickH), s, 1);
    }
    // Dark inside
    const holeH = s - brickH;
    if (holeH > 0) {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(px, py, s, holeH);
    }
  }

  // ─── Entity drawing ─────────────────────────────────────────────────────────

  drawPlayer(x, y, state, facing, animFrame, isRespawning = false) {
    const ctx = this.gCtx;
    if (isRespawning && Math.floor(animFrame / 4) % 2 === 0) return; // flash
    ctx.save();
    const cx = x + TILE_SIZE / 2;
    if (facing < 0) {
      ctx.translate(cx * 2, 0);
      ctx.scale(-1, 1);
    }

    const isDig = state === 'DIG_LEFT' || state === 'DIG_RIGHT';
    const isClimb = state === 'CLIMB_UP' || state === 'CLIMB_DOWN';
    const walkFrame = Math.floor(animFrame / 4) % 4;

    // Body
    ctx.fillStyle = '#5555ff';
    ctx.fillRect(x + 5, y + 7, 10, 9);

    // Head
    ctx.fillStyle = '#f0c060';
    ctx.fillRect(x + 6, y + 1, 8, 7);
    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 11, y + 3, 2, 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 11, y + 3, 1, 1);

    // Legs (walk animation)
    ctx.fillStyle = '#3333bb';
    if (!isClimb && !isDig) {
      const legOffsets = [[0,0],[2,-2],[0,0],[-2,-2]];
      const [lOff, rOff] = [legOffsets[walkFrame], legOffsets[(walkFrame+2)%4]];
      ctx.fillRect(x + 5,  y + 16 + lOff[0], 4, 4);
      ctx.fillRect(x + 11, y + 16 + rOff[0], 4, 4);
    } else {
      ctx.fillRect(x + 5,  y + 16, 4, 4);
      ctx.fillRect(x + 11, y + 16, 4, 4);
    }

    // Arms
    ctx.fillStyle = '#f0c060';
    if (isDig) {
      ctx.fillRect(x + 15, y + 8, 5, 3);
      ctx.fillStyle = '#888';
      ctx.fillRect(x + 18, y + 7, 3, 5);
    } else {
      ctx.fillRect(x + 2,  y + 8, 3, 3);
      ctx.fillRect(x + 15, y + 8, 3, 3);
    }

    ctx.restore();
  }

  drawEnemy(x, y, state, facing, animFrame, isCarrying = false) {
    const ctx = this.gCtx;
    ctx.save();
    const cx = x + TILE_SIZE / 2;
    if (facing < 0) {
      ctx.translate(cx * 2, 0);
      ctx.scale(-1, 1);
    }

    const isTrapped = state === 'TRAPPED';
    if (isTrapped) {
      // Draw in hole, crouched
      ctx.fillStyle = '#ff5555';
      ctx.fillRect(x + 4, y + 10, 12, 8);
      ctx.fillStyle = '#f0c060';
      ctx.fillRect(x + 6, y + 4, 8, 8);
      ctx.restore();
      return;
    }

    const walkFrame = Math.floor(animFrame / 4) % 4;
    const isRespawn = state === 'RESPAWN';
    if (isRespawn && Math.floor(animFrame / 3) % 2 === 0) { ctx.restore(); return; }

    // Body
    ctx.fillStyle = '#ff5555';
    ctx.fillRect(x + 5, y + 7, 10, 9);

    // Head with distinct shape
    ctx.fillStyle = '#f0c060';
    ctx.fillRect(x + 5, y + 1, 10, 7);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 12, y + 3, 2, 2);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(x + 5, y + 1, 10, 2); // red headband

    if (isCarrying) {
      // Gold on head
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x + 7, y - 2, 6, 4);
    }

    // Legs
    ctx.fillStyle = '#cc3333';
    const legOffs = [[0,0],[2,-2],[0,0],[-2,-2]];
    ctx.fillRect(x + 5,  y + 16 + legOffs[walkFrame][0], 4, 4);
    ctx.fillRect(x + 11, y + 16 + legOffs[(walkFrame+2)%4][0], 4, 4);

    ctx.restore();
  }

  // Utility: scale canvas to fit window
  static scaleToFit() {
    const sw = window.innerWidth, sh = window.innerHeight;
    const scale = Math.min(sw / CANVAS_W, sh / CANVAS_H, 3);
    const wrap = document.getElementById('screen-wrap');
    if (wrap) {
      wrap.style.transformOrigin = 'center center';
      wrap.style.transform = `scale(${scale})`;
    }
  }
}
