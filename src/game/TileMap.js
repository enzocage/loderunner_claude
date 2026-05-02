import { TILE, COLS, ROWS, TILE_SIZE, HOLE_OPEN_FRAMES, HOLE_CLOSE_FRAMES } from '../constants.js';

export default class TileMap {
  constructor(data) {
    // data: 2-D array [row][col], or flat copy
    this._tiles    = data.map(row => [...row]);
    this._original = data.map(row => [...row]);
    // hole state: { tx, ty, origTile, timer, state:'opening'|'open'|'closing' }
    this._holes = new Map(); // key = `${tx},${ty}`
  }

  get(tx, ty) {
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return TILE.CONCRETE;
    const t = this._tiles[ty][tx];
    return t ?? TILE.EMPTY;
  }

  set(tx, ty, type) {
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;
    this._tiles[ty][tx] = type;
  }

  isSolid(tx, ty) {
    const t = this.get(tx, ty);
    return t === TILE.BRICK || t === TILE.CONCRETE;
  }

  isLadder(tx, ty)    { return this.get(tx, ty) === TILE.LADDER; }
  isRope(tx, ty)      { return this.get(tx, ty) === TILE.ROPE; }
  isHole(tx, ty)      { return this.get(tx, ty) === TILE.HOLE; }
  isPassable(tx, ty) {
    const t = this.get(tx, ty);
    return t !== TILE.BRICK && t !== TILE.CONCRETE && t !== TILE.TRAP_BRICK;
  }

  // Returns support type for an entity centered at (ex, ey)
  // ex, ey: pixel positions
  getSupportType(ex, ey) {
    const tx = Math.floor((ex + TILE_SIZE / 2) / TILE_SIZE);
    const ty = Math.floor((ey + TILE_SIZE / 2) / TILE_SIZE);
    const tile = this.get(tx, ty);
    if (tile === TILE.LADDER) return 'ladder';
    if (tile === TILE.ROPE)   return 'rope';
    // Floor check: tile directly below entity's feet
    const footTY = Math.floor((ey + TILE_SIZE - 1) / TILE_SIZE) + 1;
    const tl = Math.floor(ex / TILE_SIZE);
    const tr = Math.floor((ex + TILE_SIZE - 1) / TILE_SIZE);
    if (this.isSolid(tl, footTY) || this.isSolid(tr, footTY)) return 'floor';
    return null;
  }

  // Dig a BRICK tile, starting the hole timer
  startDig(tx, ty) {
    if (this.get(tx, ty) !== TILE.BRICK) return false;
    const key = `${tx},${ty}`;
    if (this._holes.has(key)) return false;
    this._holes.set(key, { tx, ty, timer: 0, state: 'opening', anim: 0 });
    this.set(tx, ty, TILE.HOLE);
    return true;
  }

  // Returns 0..1 anim value for hole at (tx, ty)
  getHoleAnim(tx, ty) {
    const key = `${tx},${ty}`;
    const h = this._holes.get(key);
    if (!h) return 0;
    return h.anim;
  }

  getHoles() { return this._holes; }

  update() {
    for (const [key, h] of this._holes) {
      h.timer++;
      switch (h.state) {
        case 'opening':
          h.anim = Math.min(1, h.timer / 8);
          if (h.timer >= 8) { h.state = 'open'; h.timer = 0; h.anim = 1; }
          break;
        case 'open':
          if (h.timer >= HOLE_OPEN_FRAMES) { h.state = 'closing'; h.timer = 0; }
          break;
        case 'closing':
          h.anim = 1 - h.timer / HOLE_CLOSE_FRAMES;
          if (h.timer >= HOLE_CLOSE_FRAMES) {
            // Restore brick
            this.set(h.tx, h.ty, TILE.BRICK);
            this._holes.delete(key);
          }
          break;
      }
    }
  }

  // Is hole fully open at this tile?
  isHoleOpen(tx, ty) {
    const key = `${tx},${ty}`;
    const h = this._holes.get(key);
    return h && h.state === 'open';
  }

  // Is hole closing at this tile?
  isHoleClosing(tx, ty) {
    const key = `${tx},${ty}`;
    const h = this._holes.get(key);
    return h && h.state === 'closing';
  }

  // Clone for editor use
  clone() {
    return new TileMap(this._tiles);
  }

  toArray() {
    return this._tiles.map(row => [...row]);
  }

  reset() {
    this._tiles = this._original.map(row => [...row]);
    this._holes.clear();
  }
}
