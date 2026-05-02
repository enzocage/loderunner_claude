import {
  TILE, TILE_SIZE, ENEMY_SPEED, ENEMY_CHASE_SPEED,
  ENEMY_STATE, COLS, ROWS
} from '../constants.js';
import Pathfinder from './Pathfinder.js';

const S = ENEMY_STATE;
const CHASE_RANGE  = 14;
const PATROL_LEASH = 20;
const TRAPPED_TIME = 180;
const BFS_INTERVAL = 30;

export default class Enemy {
  constructor(id, spawnTx, spawnTy, patrolLeft, patrolRight) {
    this.id = id;
    this.spawnTx = spawnTx;
    this.spawnTy = spawnTy;
    this.patrolLeft  = patrolLeft  ?? Math.max(0, spawnTx - 6);
    this.patrolRight = patrolRight ?? Math.min(COLS - 1, spawnTx + 6);
    this.x = spawnTx * TILE_SIZE;
    this.y = spawnTy * TILE_SIZE;
    this.state = S.PATROL;
    this.facing = 1;
    this.animFrame = 0;
    this.trappedTimer = 0;
    this.carriedGold = null;  // GoldPiece | null
    this.onDeath = null;
    this._path = null;
    this._pathStep = 0;
    this._bfsTimer = 0;
    this._patrolDir = 1;
    this._pathfinder = new Pathfinder();
    this._speed = ENEMY_SPEED;
    this._respawnFlash = 0;
    this._fallSpeed = 0;
    this._isFalling = false;
  }

  get tileX() { return Math.floor((this.x + TILE_SIZE / 2) / TILE_SIZE); }
  get tileY() { return Math.floor((this.y + TILE_SIZE / 2) / TILE_SIZE); }

  reset() {
    this.x = this.spawnTx * TILE_SIZE;
    this.y = this.spawnTy * TILE_SIZE;
    this.state = S.PATROL;
    this._path = null; this._pathStep = 0; this._bfsTimer = 0;
    this._isFalling = false; this._fallSpeed = 0;
    this.carriedGold = null;
  }

  // Returns pixel distance to player
  _dist(px, py) {
    return Math.abs(this.tileX - Math.floor(px / TILE_SIZE)) +
           Math.abs(this.tileY - Math.floor(py / TILE_SIZE));
  }

  _support(tileMap) {
    const tx = this.tileX, ty = this.tileY;
    const tile = tileMap.get(tx, ty);
    if (tile === TILE.LADDER) return 'ladder';
    if (tile === TILE.ROPE)   return 'rope';
    const tl = Math.floor(this.x / TILE_SIZE);
    const tr = Math.floor((this.x + TILE_SIZE - 1) / TILE_SIZE);
    const footTY = Math.floor((this.y + TILE_SIZE) / TILE_SIZE);
    if (tileMap.isSolid(tl, footTY) || tileMap.isSolid(tr, footTY)) return 'floor';
    return null;
  }

  update(tileMap, playerX, playerY, allEnemies) {
    this.animFrame++;

    if (this.state === S.RESPAWN) {
      this._respawnFlash--;
      if (this._respawnFlash <= 0) {
        this.state = S.PATROL;
        // Drop carried gold at random walkable spot
        if (this.carriedGold) {
          this.carriedGold.tx = this.spawnTx;
          this.carriedGold.ty = this.spawnTy;
          this.carriedGold.x  = this.spawnTx * TILE_SIZE;
          this.carriedGold.y  = this.spawnTy * TILE_SIZE;
          this.carriedGold.collected = false;
          this.carriedGold = null;
        }
      }
      return;
    }

    if (this.state === S.TRAPPED) {
      this.trappedTimer--;
      if (this.trappedTimer <= 0) {
        // Respawn
        this.x = this.spawnTx * TILE_SIZE;
        this.y = this.spawnTy * TILE_SIZE;
        this.state = S.RESPAWN;
        this._respawnFlash = 40;
        if (this.onDeath) this.onDeath(this);
      }
      return;
    }

    // Gravity
    const support = this._support(tileMap);
    if (!support) {
      this._isFalling = true;
    }

    if (this._isFalling) {
      const newY = this.y + 4;
      const footTY = Math.floor((newY + TILE_SIZE) / TILE_SIZE);
      const tl = Math.floor(this.x / TILE_SIZE);
      const tr = Math.floor((this.x + TILE_SIZE - 1) / TILE_SIZE);

      if (tileMap.isSolid(tl, footTY) || tileMap.isSolid(tr, footTY)) {
        this.y = (footTY - 1) * TILE_SIZE;
        this._isFalling = false;
        // Check if fell into an open hole → trapped
        if (tileMap.isHole(this.tileX, this.tileY + 1) ||
            tileMap.isHoleOpen(this.tileX, this.tileY)) {
          // Stay falling, next tick will catch
        }
      } else {
        this.y = newY;
        const ns = this._support(tileMap);
        if (ns === 'ladder' || ns === 'rope') this._isFalling = false;
        // Fell into hole?
        if (tileMap.isHole(this.tileX, this.tileY)) {
          this.state = S.TRAPPED;
          this.trappedTimer = TRAPPED_TIME;
          this._isFalling = false;
          return;
        }
      }
      if (this._isFalling) return;
    }

    // Check if standing in a closing hole → trapped
    if (tileMap.isHoleClosing(this.tileX, this.tileY + 1)) {
      this.state = S.TRAPPED;
      this.trappedTimer = TRAPPED_TIME;
      return;
    }

    // State transitions
    const dist = this._dist(playerX, playerY);
    if (this.state === S.PATROL && dist <= CHASE_RANGE) {
      this.state = S.CHASE;
    } else if (this.state === S.CHASE && dist > PATROL_LEASH) {
      this.state = S.PATROL;
      this._path = null;
    }

    this._speed = this.state === S.CHASE ? ENEMY_CHASE_SPEED : ENEMY_SPEED;

    // BFS update
    this._bfsTimer++;
    const bfsFreq = this.state === S.CHASE ? 20 : BFS_INTERVAL;
    if (this._bfsTimer >= bfsFreq) {
      this._bfsTimer = 0;
      if (this.state === S.CHASE) {
        const goalTx = Math.floor((playerX + TILE_SIZE / 2) / TILE_SIZE);
        const goalTy = Math.floor((playerY + TILE_SIZE / 2) / TILE_SIZE);
        this._path = this._pathfinder.findPath(this.tileX, this.tileY, goalTx, goalTy, tileMap);
        this._pathStep = 0;
      }
    }

    if (this.state === S.CHASE && this._path && this._pathStep < this._path.length) {
      this._followPath(tileMap);
    } else {
      this._patrol(tileMap);
    }
  }

  _followPath(tileMap) {
    if (!this._path || this._pathStep >= this._path.length) return;
    const next = this._path[this._pathStep];
    const targetX = next.tx * TILE_SIZE;
    const targetY = next.ty * TILE_SIZE;
    const dx = targetX - this.x;
    const dy = targetY - this.y;

    const moved = this._moveToward(dx, dy, tileMap);
    if (!moved || (Math.abs(dx) < 2 && Math.abs(dy) < 2)) {
      this.x = targetX; this.y = targetY;
      this._pathStep++;
    }
  }

  _moveToward(dx, dy, tileMap) {
    const spd = this._speed;
    if (Math.abs(dy) > 2) {
      // Vertical movement (climbing)
      const newY = this.y + Math.sign(dy) * spd;
      const ty = Math.floor((newY + (dy > 0 ? TILE_SIZE - 1 : 0)) / TILE_SIZE);
      if (tileMap.isPassable(this.tileX, ty)) {
        this.y = newY;
        return true;
      }
    }
    if (Math.abs(dx) > 2) {
      const newX = this.x + Math.sign(dx) * spd;
      const tx = Math.floor((newX + (dx > 0 ? TILE_SIZE - 1 : 0)) / TILE_SIZE);
      if (tileMap.isPassable(tx, this.tileY)) {
        this.x = newX;
        this.facing = dx > 0 ? 1 : -1;
        return true;
      }
    }
    return false;
  }

  _patrol(tileMap) {
    const spd = this._speed;
    const newX = this.x + this._patrolDir * spd;
    const tx = Math.floor((newX + (this._patrolDir > 0 ? TILE_SIZE - 1 : 0)) / TILE_SIZE);
    const onLadder = tileMap.get(this.tileX, this.tileY) === TILE.LADDER;

    if (!onLadder && (!tileMap.isPassable(tx, this.tileY) ||
        this.tileX <= this.patrolLeft || this.tileX >= this.patrolRight)) {
      this._patrolDir *= -1;
    } else {
      this.x = newX;
      this.facing = this._patrolDir;
    }
  }

  overlapsPlayer(px, py) {
    if (this.state === S.TRAPPED || this.state === S.RESPAWN) return false;
    const margin = 6;
    return (
      this.x + margin < px + TILE_SIZE - margin &&
      this.x + TILE_SIZE - margin > px + margin &&
      this.y + margin < py + TILE_SIZE - margin &&
      this.y + TILE_SIZE - margin > py + margin
    );
  }

  render(renderer) {
    renderer.drawEnemy(
      Math.round(this.x), Math.round(this.y),
      this.state, this.facing, this.animFrame,
      this.carriedGold !== null
    );
  }
}
