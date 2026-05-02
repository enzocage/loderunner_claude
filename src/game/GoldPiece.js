import { TILE_SIZE } from '../constants.js';

export default class GoldPiece {
  constructor(tx, ty) {
    this.tx = tx;
    this.ty = ty;
    this.x  = tx * TILE_SIZE;
    this.y  = ty * TILE_SIZE;
    this.collected = false;
    this._bobFrame = Math.random() * Math.PI * 2; // phase offset
  }

  update() {
    if (!this.collected) this._bobFrame += 0.08;
  }

  // Check if entity at pixel (ex, ey) overlaps this gold
  overlaps(ex, ey) {
    return (
      ex < this.x + TILE_SIZE - 2 && ex + TILE_SIZE - 2 > this.x &&
      ey < this.y + TILE_SIZE - 2 && ey + TILE_SIZE - 2 > this.y
    );
  }

  renderInWorld(renderer, frame) {
    if (this.collected) return;
    renderer.drawTile(7 /* TILE.GOLD */, this.x, this.y, 0);
  }
}
