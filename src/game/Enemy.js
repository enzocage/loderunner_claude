import {
  TILE, TILE_SIZE, ENEMY_SPEED, ENEMY_CHASE_SPEED,
  ENEMY_STATE, COLS, ROWS, AI_TIER,
} from '../constants.js';
import Pathfinder from './Pathfinder.js';

const S = ENEMY_STATE;
const CHASE_RANGE  = 14;
const PATROL_LEASH = 22;
const TRAPPED_TIME = 180;
const BFS_INTERVAL = 30;
const ALERT_FRAMES = 40;  // show "!" bubble duration

export default class Enemy {
  constructor(id, spawnTx, spawnTy, patrolLeft, patrolRight, tier = AI_TIER.NORMAL) {
    this.id = id;
    this.tier = tier;
    this.spawnTx = spawnTx;
    this.spawnTy = spawnTy;
    this.patrolLeft  = patrolLeft  ?? Math.max(0, spawnTx - 6);
    this.patrolRight = patrolRight ?? Math.min(COLS - 1, spawnTx + 6);
    this.x = spawnTx * TILE_SIZE;
    this.y = spawnTy * TILE_SIZE;
    this.prevX = this.x;
    this.prevY = this.y;
    this.state = S.PATROL;
    this.facing = 1;
    this.animFrame = 0;
    this.trappedTimer = 0;
    this.carriedGold = null;  // GoldPiece | null
    this.frozen = false;       // set externally by freeze power-up
    this.alertTimer = 0;       // frames to show alert bubble
    this.onDeath = null;
    this._path = null;
    this._pathStep = 0;
    this._bfsTimer = 0;
    this._patrolDir = 1;
    this._pathfinder = new Pathfinder();
    this._speed = ENEMY_SPEED;
    this._respawnFlash = 0;
    this._isFalling = false;

    // Elite: predicted player position
    this._predictTx = -1;
    this._predictTy = -1;
  }

  get tileX() { return Math.floor((this.x + TILE_SIZE / 2) / TILE_SIZE); }
  get tileY() { return Math.floor((this.y + TILE_SIZE / 2) / TILE_SIZE); }

  reset() {
    this.x = this.spawnTx * TILE_SIZE;
    this.y = this.spawnTy * TILE_SIZE;
    this.prevX = this.x;
    this.prevY = this.y;
    this.state = S.PATROL;
    this._path = null; this._pathStep = 0; this._bfsTimer = 0;
    this._isFalling = false;
    this.carriedGold = null;
    this.frozen = false;
    this.alertTimer = 0;
  }

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
    this.prevX = this.x;
    this.prevY = this.y;
    this.animFrame++;

    // Alert bubble tick-down
    if (this.alertTimer > 0) this.alertTimer--;

    // Frozen (freeze power-up) — can't move
    if (this.frozen) return;

    if (this.state === S.RESPAWN) {
      this._respawnFlash--;
      if (this._respawnFlash <= 0) {
        this.state = S.PATROL;
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
        this.x = this.spawnTx * TILE_SIZE;
        this.y = this.spawnTy * TILE_SIZE;
        this.state = S.RESPAWN;
        this._respawnFlash = 40;
        if (this.onDeath) this.onDeath(this);
      }
      return;
    }

    // Gravity
    if (!this._support(tileMap)) this._isFalling = true;

    if (this._isFalling) {
      const newY = this.y + 4;
      const footTY = Math.floor((newY + TILE_SIZE) / TILE_SIZE);
      const tl = Math.floor(this.x / TILE_SIZE);
      const tr = Math.floor((this.x + TILE_SIZE - 1) / TILE_SIZE);

      if (tileMap.isSolid(tl, footTY) || tileMap.isSolid(tr, footTY)) {
        this.y = (footTY - 1) * TILE_SIZE;
        this._isFalling = false;
      } else {
        this.y = newY;
        const ns = this._support(tileMap);
        if (ns === 'ladder' || ns === 'rope') this._isFalling = false;
        if (tileMap.isHole(this.tileX, this.tileY)) {
          this.state = S.TRAPPED;
          this.trappedTimer = TRAPPED_TIME;
          this._isFalling = false;
          return;
        }
      }
      if (this._isFalling) return;
    }

    if (tileMap.isHoleClosing(this.tileX, this.tileY + 1)) {
      this.state = S.TRAPPED;
      this.trappedTimer = TRAPPED_TIME;
      return;
    }

    // State transitions
    const dist = this._dist(playerX, playerY);
    const wasPatrol = this.state === S.PATROL;
    if (this.state === S.PATROL && dist <= CHASE_RANGE) {
      this.state = S.CHASE;
      // Alert on tier NORMAL+ when first entering chase
      if (this.tier >= AI_TIER.NORMAL && wasPatrol) {
        this.alertTimer = ALERT_FRAMES;
        this.state = S.ALERTED;
      }
    } else if (this.state === S.ALERTED) {
      if (this.alertTimer <= 0) this.state = S.CHASE;
    } else if (this.state === S.CHASE && dist > PATROL_LEASH) {
      this.state = S.PATROL;
      this._path = null;
    }

    // Dumb tier: never chases
    if (this.tier === AI_TIER.DUMB && this.state === S.CHASE) {
      this.state = S.PATROL;
      this._path = null;
    }

    if (this.state === S.ALERTED) return;

    this._speed = this.state === S.CHASE
      ? ENEMY_CHASE_SPEED * (this.tier === AI_TIER.ELITE ? 1.2 : 1.0)
      : ENEMY_SPEED;

    // BFS update
    this._bfsTimer++;
    const bfsFreq = this.state === S.CHASE ? 20 : BFS_INTERVAL;
    if (this._bfsTimer >= bfsFreq) {
      this._bfsTimer = 0;
      if (this.state === S.CHASE && this.tier >= AI_TIER.NORMAL) {
        let goalTx, goalTy;
        if (this.tier === AI_TIER.ELITE) {
          // Predict player position 10 frames ahead
          goalTx = Math.floor((playerX + TILE_SIZE / 2) / TILE_SIZE);
          goalTy = Math.floor((playerY + TILE_SIZE / 2) / TILE_SIZE);
          // Crude prediction: offset by facing direction 3 tiles
          const pFacing = (playerX > this.x) ? 1 : -1;
          goalTx = Math.max(0, Math.min(COLS - 1, goalTx + pFacing * 3));
        } else {
          goalTx = Math.floor((playerX + TILE_SIZE / 2) / TILE_SIZE);
          goalTy = Math.floor((playerY + TILE_SIZE / 2) / TILE_SIZE);
        }
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
      this.carriedGold !== null,
      this.tier
    );

    // Alert bubble rendered by renderer via SpriteAtlas
    if (this.alertTimer > 0 && renderer.atlas && renderer.atlas.ready) {
      renderer.atlas.blitAlertBubble(
        renderer.gCtx,
        Math.round(this.x),
        Math.round(this.y) - 14
      );
    }
  }
}
