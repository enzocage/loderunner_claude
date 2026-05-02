import { TILE, TILE_SIZE, COLS, ROWS, CANVAS_W, CANVAS_H } from '../constants.js';

const MINIMAP_W = 112;
const MINIMAP_H = 80;

export default class EditorRenderer {
  constructor(renderer) {
    this._renderer = renderer;
    this._hover = null;
    this.hoverTx = null;
    this.hoverTy = null;
  }

  setHover(tx, ty) {
    this._hover = (tx !== null) ? { tx, ty } : null;
    this.hoverTx = tx !== null ? tx : null;
    this.hoverTy = ty !== null ? ty : null;
  }

  render(tileMap, selectedType, frameCount) {
    const r = this._renderer;
    const ctx = r.gCtx;
    r.beginFrame();

    // Background checkerboard
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if ((tx + ty) % 2 === 0) {
          ctx.fillStyle = '#0e0e0e';
          ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Draw all tiles
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const tile = tileMap.get(tx, ty);
        const px = tx * TILE_SIZE, py = ty * TILE_SIZE;

        if (tile === TILE.EMPTY) continue;

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
        if (tile === TILE.POWER_SPEED) {
          ctx.fillStyle = '#001a44';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#4488ff';
          ctx.font = '6px monospace';
          ctx.fillText('SPD', px + 2, py + 12);
          continue;
        }
        if (tile === TILE.POWER_DIG) {
          ctx.fillStyle = '#001a00';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#44cc44';
          ctx.font = '6px monospace';
          ctx.fillText('DIG', px + 2, py + 12);
          continue;
        }
        if (tile === TILE.POWER_FREEZE) {
          ctx.fillStyle = '#1a0000';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#ff4444';
          ctx.font = '6px monospace';
          ctx.fillText('FRZ', px + 2, py + 12);
          continue;
        }
        r.drawTile(tile, px, py);
      }
    }

    // Grid overlay
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
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
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx * TILE_SIZE + 0.5, ty * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    }

    // Minimap panel (top-right corner)
    this._renderMinimap(ctx, tileMap);

    // Toolbar hint
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, CANVAS_W, 14);
    ctx.fillStyle = '#bfce72';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillText(
      'EDITOR  [L:place] [R:erase] [F:fill] [R:rect] [Ctrl+Z:undo] [Ctrl+Y:redo] [Ctrl+C/V:copy/paste]',
      4, 9
    );

    r.endFrame();
  }

  _renderMinimap(ctx, tileMap) {
    const mx = CANVAS_W - MINIMAP_W - 4;
    const my = 18;
    const scaleX = MINIMAP_W / COLS;
    const scaleY = MINIMAP_H / ROWS;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(mx - 2, my - 2, MINIMAP_W + 4, MINIMAP_H + 4);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 2, my - 2, MINIMAP_W + 4, MINIMAP_H + 4);

    // Draw each tile as a coloured dot
    const COLORS = {
      [TILE.BRICK]:        '#8b4513',
      [TILE.CONCRETE]:     '#606060',
      [TILE.LADDER]:       '#d4a017',
      [TILE.ROPE]:         '#8b7030',
      [TILE.GOLD]:         '#ffd700',
      [TILE.TRAP_BRICK]:   '#4a2a0e',
      [TILE.SPAWN_PLAYER]: '#5555ff',
      [TILE.SPAWN_ENEMY]:  '#ff5555',
      [TILE.POWER_SPEED]:  '#4488ff',
      [TILE.POWER_DIG]:    '#44cc44',
      [TILE.POWER_FREEZE]: '#ff4444',
    };

    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const t = tileMap.get(tx, ty);
        if (t === TILE.EMPTY) continue;
        ctx.fillStyle = COLORS[t] || '#666';
        ctx.fillRect(
          mx + Math.floor(tx * scaleX),
          my + Math.floor(ty * scaleY),
          Math.max(1, Math.ceil(scaleX)),
          Math.max(1, Math.ceil(scaleY))
        );
      }
    }

    // Hover position indicator
    if (this._hover) {
      const { tx, ty } = this._hover;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        mx + Math.floor(tx * scaleX) - 1,
        my + Math.floor(ty * scaleY) - 1,
        Math.ceil(scaleX) + 2,
        Math.ceil(scaleY) + 2
      );
    }

    // Label
    ctx.fillStyle = '#555';
    ctx.font = '5px monospace';
    ctx.fillText('MINIMAP', mx, my + MINIMAP_H + 8);
  }
}
