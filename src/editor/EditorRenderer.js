import { TILE, TILE_SIZE, COLS, ROWS, CANVAS_W, CANVAS_H } from '../constants.js';

export default class EditorRenderer {
  constructor(renderer) {
    this._renderer = renderer;
    this._hover = null;    // {tx, ty}
    this._dirty = true;
  }

  setHover(tx, ty) {
    this._hover = (tx !== null) ? { tx, ty } : null;
    this._dirty = true;
  }

  markDirty() { this._dirty = true; }

  render(tileMap, selectedType, frameCount) {
    const r = this._renderer;
    const ctx = r.gCtx;
    r.beginFrame();

    // Draw all tiles
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const tile = tileMap.get(tx, ty);
        const px = tx * TILE_SIZE, py = ty * TILE_SIZE;

        if (tile === TILE.EMPTY) {
          // Subtle checkerboard for empty tiles
          if ((tx + ty) % 2 === 0) {
            ctx.fillStyle = '#111';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          }
          continue;
        }
        if (tile === TILE.SPAWN_PLAYER) {
          ctx.fillStyle = '#001a66';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#5555ff';
          ctx.font = '8px monospace';
          ctx.fillText('P', px + 6, py + 13);
          continue;
        }
        if (tile === TILE.SPAWN_ENEMY) {
          ctx.fillStyle = '#4d0000';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#ff5555';
          ctx.font = '8px monospace';
          ctx.fillText('E', px + 6, py + 13);
          continue;
        }
        if (tile === TILE.TRAP_BRICK) {
          // Draw as dark brick to distinguish in editor
          ctx.fillStyle = '#3a1a06';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#5a2a10';
          ctx.fillRect(px, py, TILE_SIZE, 1);
          ctx.fillRect(px, py, 1, TILE_SIZE);
          ctx.fillStyle = '#ff6600';
          ctx.globalAlpha = 0.3;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.globalAlpha = 1;
          continue;
        }
        r.drawTile(tile, px, py);
      }
    }

    // Grid overlay
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    for (let tx = 0; tx <= COLS; tx++) {
      ctx.beginPath();
      ctx.moveTo(tx * TILE_SIZE, 0);
      ctx.lineTo(tx * TILE_SIZE, CANVAS_H);
      ctx.stroke();
    }
    for (let ty = 0; ty <= ROWS; ty++) {
      ctx.beginPath();
      ctx.moveTo(0, ty * TILE_SIZE);
      ctx.lineTo(CANVAS_W, ty * TILE_SIZE);
      ctx.stroke();
    }

    // Hover highlight
    if (this._hover) {
      const { tx, ty } = this._hover;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx * TILE_SIZE + 0.5, ty * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    }

    // Toolbar hint
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, 14);
    ctx.fillStyle = '#bfce72';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillText('LODE RUNNER — LEVEL EDITOR   [L-CLICK: place]  [R-CLICK: erase]  [DRAG: paint]  [F2: toggle CRT]', 4, 9);

    r.endFrame();
  }
}
