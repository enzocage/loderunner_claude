import { CANVAS_W, CANVAS_H, TILE, TILE_SIZE, DEFAULT_SETTINGS } from '../constants.js';

const ITEMS = ['START GAME', 'LEVEL EDITOR', 'HIGH SCORES', 'CONTROLS', 'SETTINGS'];

export default class Menu {
  constructor(renderer) {
    this._renderer = renderer;
    this._selected = 0;
    this._frame    = 0;
    this._tiles    = this._buildBgTiles();
    this.onSelect  = null; // callback(index)
  }

  _buildBgTiles() {
    const tiles = [];
    for (let i = 0; i < 22; i++) {
      tiles.push({
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H,
        type: [TILE.BRICK, TILE.CONCRETE, TILE.LADDER, TILE.ROPE][Math.floor(Math.random() * 4)],
        speed: 0.3 + Math.random() * 0.5,
        alpha: 0.04 + Math.random() * 0.10,
      });
    }
    return tiles;
  }

  handleInput(input) {
    if (input.isPressed('ArrowUp') || input.isPressed('KeyW')) {
      this._selected = (this._selected - 1 + ITEMS.length) % ITEMS.length;
    }
    if (input.isPressed('ArrowDown') || input.isPressed('KeyS')) {
      this._selected = (this._selected + 1) % ITEMS.length;
    }
    if (input.isPressed('Enter') || input.isPressed('Space') || input.isPressed('KeyZ')) {
      if (this.onSelect) this.onSelect(this._selected);
    }
    for (let i = 1; i <= ITEMS.length; i++) {
      if (input.isPressed('Digit' + i)) {
        if (this.onSelect) this.onSelect(i - 1);
      }
    }
  }

  update(input) {
    this._frame++;
    this.handleInput(input);
    for (const t of this._tiles) {
      t.y += t.speed;
      if (t.y > CANVAS_H + TILE_SIZE) {
        t.y = -TILE_SIZE;
        t.x = Math.random() * CANVAS_W;
      }
    }
  }

  render() {
    const ctx = this._renderer.gCtx;
    this._renderer.beginFrame();

    // Background tile rain
    ctx.save();
    for (const t of this._tiles) {
      ctx.globalAlpha = t.alpha;
      this._renderer.drawTile(t.type, Math.round(t.x), Math.round(t.y));
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Title
    const titleY = 72;
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3a2a00';
    ctx.fillText('LODE RUNNER', CANVAS_W / 2 + 3, titleY + 3);
    ctx.fillStyle = '#574200';
    ctx.fillText('LODE RUNNER', CANVAS_W / 2 + 1, titleY + 1);
    ctx.fillStyle = '#ffd700';
    ctx.fillText('LODE RUNNER', CANVAS_W / 2, titleY);

    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#67b6bd';
    ctx.fillText('THE CLASSIC REBORN', CANVAS_W / 2, titleY + 22);

    // Decorative rule
    ctx.fillStyle = '#333';
    ctx.fillRect(CANVAS_W / 2 - 110, titleY + 32, 220, 1);

    // Menu items
    const menuStartY = 155;
    const itemH = 26;
    for (let i = 0; i < ITEMS.length; i++) {
      const y = menuStartY + i * itemH;
      const isSelected = i === this._selected;
      const blink = Math.floor(this._frame / 15) % 2 === 0;

      if (isSelected) {
        ctx.fillStyle = 'rgba(255,215,0,0.10)';
        ctx.fillRect(CANVAS_W / 2 - 110, y - 11, 220, 18);
        ctx.fillStyle = blink ? '#ffd700' : '#c8a000';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillText('►', CANVAS_W / 2 - 96, y);
      } else {
        ctx.fillStyle = '#8a8a8a';
      }
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(ITEMS[i], CANVAS_W / 2, y);
    }

    // Footer
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = '#484848';
    ctx.fillText('↑↓  NAVIGATE     ENTER  SELECT     F2  CRT     M  MUTE', CANVAS_W / 2, CANVAS_H - 24);
    ctx.fillStyle = '#303030';
    ctx.fillText('Z/,  DIG-LEFT     X/.  DIG-RIGHT     ARROWS / WASD  MOVE', CANVAS_W / 2, CANVAS_H - 12);

    ctx.textAlign = 'left';
    this._renderer.endFrame();
  }
}
