import { TILE, COLS, ROWS } from '../constants.js';

function key(tx, ty) { return ty * COLS + tx; }

function isSupported(tx, ty, tileMap) {
  const t = tileMap.get(tx, ty);
  if (t === TILE.LADDER || t === TILE.ROPE) return true;
  return tileMap.isSolid(tx, ty + 1);
}

function canOccupy(tx, ty, tileMap) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return false;
  const t = tileMap.get(tx, ty);
  if (t === TILE.BRICK || t === TILE.CONCRETE || t === TILE.TRAP_BRICK) return false;
  return true;
}

export default class Pathfinder {
  constructor() {
    this._cache = new Map();
    this._dirty = true;
  }

  markDirty() { this._dirty = true; }

  // Returns array of {tx,ty} from start to goal (exclusive of start), or null
  findPath(startTx, startTy, goalTx, goalTy, tileMap) {
    if (startTx === goalTx && startTy === goalTy) return [];

    const startKey = key(startTx, startTy);
    const goalKey  = key(goalTx,  goalTy);

    const frontier = [startKey];
    const cameFrom = new Map([[startKey, -1]]);

    while (frontier.length > 0) {
      const cur = frontier.shift();
      if (cur === goalKey) break;

      const cx = cur % COLS;
      const cy = (cur / COLS) | 0;

      for (const [nx, ny] of this._neighbors(cx, cy, tileMap)) {
        const nk = key(nx, ny);
        if (!cameFrom.has(nk)) {
          cameFrom.set(nk, cur);
          frontier.push(nk);
        }
      }
    }

    if (!cameFrom.has(goalKey)) return null;

    // Reconstruct
    const path = [];
    let cur = goalKey;
    while (cur !== startKey) {
      path.push({ tx: cur % COLS, ty: (cur / COLS) | 0 });
      cur = cameFrom.get(cur);
    }
    path.reverse();
    return path;
  }

  _neighbors(tx, ty, tileMap) {
    const result = [];
    const tile = tileMap.get(tx, ty);

    // Horizontal
    for (const dx of [-1, 1]) {
      const nx = tx + dx;
      if (canOccupy(nx, ty, tileMap) && isSupported(nx, ty, tileMap)) {
        result.push([nx, ty]);
      }
    }

    // Climb up (only from ladder tile)
    if (tile === TILE.LADDER) {
      const ny = ty - 1;
      if (canOccupy(tx, ny, tileMap)) result.push([tx, ny]);
    }

    // Climb down (from ladder or onto ladder below)
    if (tile === TILE.LADDER || tileMap.get(tx, ty + 1) === TILE.LADDER) {
      const ny = ty + 1;
      if (canOccupy(tx, ny, tileMap)) result.push([tx, ny]);
    }

    // Fall: if no direct floor, find first supported tile below
    const isCurSupported = isSupported(tx, ty, tileMap);
    if (isCurSupported && tile !== TILE.LADDER && tile !== TILE.ROPE) {
      const belowTile = tileMap.get(tx, ty + 1);
      if (!tileMap.isSolid(tx, ty + 1) && belowTile !== TILE.LADDER) {
        for (let fy = ty + 1; fy < ROWS; fy++) {
          if (!canOccupy(tx, fy, tileMap)) break;
          if (isSupported(tx, fy, tileMap)) {
            result.push([tx, fy]);
            break;
          }
        }
      }
    }

    return result;
  }
}
