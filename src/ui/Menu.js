import { CANVAS_W, CANVAS_H, TILE, TILE_SIZE } from '../constants.js';

const ITEMS = ['START GAME', 'LEVEL EDITOR', 'HIGH SCORES', 'CONTROLS'];

export default class Menu {
  constructor(renderer) {
    this._renderer = renderer;
    this._selected = 0;
    this._frame    = 0;
    this._tiles    = this._buildBgTiles();
    this.onSelect  = null; // callback(index)
  }

  _buildBgTiles() {
    // Random falling bricks for background decoration
    const tiles = [];
    for (let i = 0; i < 20; i++) {
      tiles.push({
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H,
        type: [TILE.BRICK, TILE.CONCRETE, TILE.LADDER, TILE.ROPE][Math.floor(Math.random() * 4)],
        speed: 0.4 + Math.random() * 0.6,
        alpha: 0.05 + Math.random() * 0.12,
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
    // Number shortcuts
    for (let i = 1; i <= ITEMS.length; i++) {
      if (input.isPressed('Digit' + i)) {
        if (this.onSelect) this.onSelect(i - 1);
      }
    }
  }

  update(input) {
    this._frame++;
    this.handleInput(input);
    // Animate background tiles
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

    // Title scanline background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Title
    const titleY = 80;
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = 'center';

    // Drop shadow
    ctx.fillStyle = '#574200';
    ctx.fillText('LODE RUNNER', CANVAS_W / 2 + 2, titleY + 2);
    // Main title
    ctx.fillStyle = '#ffd700';
    ctx.fillText('LODE RUNNER', CANVAS_W / 2, titleY);

    // Subtitle
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#67b6bd';
    ctx.fillText('THE CLASSIC REBORN', CANVAS_W / 2, titleY + 22);

    // Menu items
    const menuStartY = 165;
    const itemH = 28;
    for (let i = 0; i < ITEMS.length; i++) {
      const y = menuStartY + i * itemH;
      const isSelected = i === this._selected;
      const blink = Math.floor(this._frame / 15) % 2 === 0;

      if (isSelected) {
        // Selection highlight
        ctx.fillStyle = 'rgba(255,215,0,0.12)';
        ctx.fillRect(CANVAS_W / 2 - 100, y - 10, 200, 18);
        ctx.fillStyle = blink ? '#ffd700' : '#c8a000';
        // Arrow
        ctx.fillText('►', CANVAS_W / 2 - 90, y);
      } else {
        ctx.fillStyle = '#9f9f9f';
      }
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(ITEMS[i], CANVAS_W / 2, y);
    }

    // Footer
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#505050';
    ctx.fillText('↑↓ NAVIGATE   ENTER SELECT   F2 TOGGLE CRT   M MUTE', CANVAS_W / 2, CANVAS_H - 28);
    ctx.fillStyle = '#333';
    ctx.fillText('Z=DIG-LEFT  X=DIG-RIGHT  ARROWS=MOVE  ESC=PAUSE', CANVAS_W / 2, CANVAS_H - 16);

    ctx.textAlign = 'left';
    this._renderer.endFrame();
  }
}
