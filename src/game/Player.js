import {
  TILE, TILE_SIZE, WALK_SPEED, CLIMB_SPEED, FALL_SPEED,
  PLAYER_STATE, DIG_FRAMES, DEAD_FRAMES, RESPAWN_FLASH,
  POWERUP,
} from '../constants.js';

const S = PLAYER_STATE;

export default class Player {
  constructor() {
    this.x = 0; this.y = 0;     // pixel position (top-left)
    this.prevX = 0; this.prevY = 0; // for sub-frame interpolation
    this.state = S.IDLE;
    this.facing = 1;              // 1 = right, -1 = left
    this.animFrame = 0;
    this.digTimer  = 0;
    this.deadTimer = 0;
    this.respawnTimer = 0;
    this.lives = 3;

    // Power-up timers
    this.speedBoost  = 0;  // frames remaining
    this.digFrenzy   = 0;  // frames remaining — can dig anywhere
    this.frozen      = false; // set externally for freeze power-up display

    this.onDeath = null;          // callback
    this.onDig   = null;          // callback(tx, ty, x, y)
    this._startX = 0; this._startY = 0;
  }

  setStart(tx, ty) {
    this._startX = tx * TILE_SIZE;
    this._startY = ty * TILE_SIZE;
    this.reset();
  }

  reset() {
    this.x = this._startX;
    this.y = this._startY;
    this.prevX = this.x;
    this.prevY = this.y;
    this.state = S.IDLE;
    this.animFrame = 0;
    this.digTimer  = 0;
    this.deadTimer = 0;
    this.respawnTimer = RESPAWN_FLASH;
    this.speedBoost = 0;
    this.digFrenzy  = 0;
  }

  get tileX() { return Math.floor((this.x + TILE_SIZE / 2) / TILE_SIZE); }
  get tileY() { return Math.floor((this.y + TILE_SIZE / 2) / TILE_SIZE); }
  get isAlive() { return this.state !== S.DEAD; }

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

  _canMoveLeft(tileMap, spd = WALK_SPEED) {
    const nx = this.x - spd;
    const tx = Math.floor(nx / TILE_SIZE);
    return tileMap.isPassable(tx, this.tileY);
  }

  _canMoveRight(tileMap, spd = WALK_SPEED) {
    const nx = this.x + spd;
    const tx = Math.floor((nx + TILE_SIZE - 1) / TILE_SIZE);
    return tileMap.isPassable(tx, this.tileY);
  }

  _canMoveUp(tileMap, spd = CLIMB_SPEED) {
    const ny = this.y - spd;
    const ty = Math.floor(ny / TILE_SIZE);
    return tileMap.isPassable(this.tileX, ty);
  }

  _canMoveDown(tileMap, spd = CLIMB_SPEED) {
    const ny = this.y + spd;
    const ty = Math.floor((ny + TILE_SIZE - 1) / TILE_SIZE);
    return tileMap.isPassable(this.tileX, ty);
  }

  die() {
    if (this.state === S.DEAD) return;
    this.state = S.DEAD;
    this.deadTimer = DEAD_FRAMES;
  }

  update(input, tileMap) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.animFrame++;

    // Tick power-up timers
    if (this.speedBoost > 0) this.speedBoost--;
    if (this.digFrenzy  > 0) this.digFrenzy--;

    const speed = this.speedBoost > 0 ? 2 : 1;

    // Respawn flash
    if (this.respawnTimer > 0) this.respawnTimer--;

    if (this.state === S.DEAD) {
      this.deadTimer--;
      if (this.deadTimer <= 0 && this.onDeath) this.onDeath();
      return;
    }

    if (this.state === S.DIG_LEFT || this.state === S.DIG_RIGHT) {
      this.digTimer--;
      if (this.digTimer <= 0) this.state = S.IDLE;
      return;
    }

    const support = this._support(tileMap);

    // ── FALL ──────────────────────────────────────────────────────────────────
    if (!support) {
      this.state = S.FALL;
    }

    if (this.state === S.FALL) {
      const newY = this.y + FALL_SPEED;
      const footTY = Math.floor((newY + TILE_SIZE) / TILE_SIZE);
      const tl = Math.floor(this.x / TILE_SIZE);
      const tr = Math.floor((this.x + TILE_SIZE - 1) / TILE_SIZE);

      if (tileMap.isSolid(tl, footTY) || tileMap.isSolid(tr, footTY)) {
        this.y = (footTY - 1) * TILE_SIZE;
        this.state = S.IDLE;
      } else {
        this.y = newY;
        // Check if we entered a ladder or rope
        const newSupport = this._support(tileMap);
        if (newSupport === 'ladder' || newSupport === 'rope') {
          this.state = S.IDLE;
        }
      }
      return;
    }

    // ── DIG ───────────────────────────────────────────────────────────────────
    const canDig = support === 'floor' || this.digFrenzy > 0;
    if (input.digLeft && canDig) {
      const dTx = this.tileX - 1;
      const dTy = this.tileY + (this.digFrenzy > 0 ? 0 : 1);
      const t = tileMap.get(dTx, dTy);
      if (t === TILE.BRICK || (this.digFrenzy > 0 && t === TILE.CONCRETE)) {
        tileMap.startDig(dTx, dTy);
        this.state = S.DIG_LEFT;
        this.digTimer = DIG_FRAMES;
        this.facing = -1;
        if (this.onDig) this.onDig(dTx, dTy, dTx * TILE_SIZE, dTy * TILE_SIZE);
        return;
      }
    }
    if (input.digRight && canDig) {
      const dTx = this.tileX + 1;
      const dTy = this.tileY + (this.digFrenzy > 0 ? 0 : 1);
      const t = tileMap.get(dTx, dTy);
      if (t === TILE.BRICK || (this.digFrenzy > 0 && t === TILE.CONCRETE)) {
        tileMap.startDig(dTx, dTy);
        this.state = S.DIG_RIGHT;
        this.digTimer = DIG_FRAMES;
        this.facing = 1;
        if (this.onDig) this.onDig(dTx, dTy, dTx * TILE_SIZE, dTy * TILE_SIZE);
        return;
      }
    }

    // ── CLIMB ─────────────────────────────────────────────────────────────────
    const onLadder = support === 'ladder';
    const canEnterLadderBelow = !onLadder &&
      tileMap.get(this.tileX, this.tileY + 1) === TILE.LADDER;

    const ws = WALK_SPEED  * speed;
    const cs = CLIMB_SPEED * speed;

    if (input.up && onLadder && this._canMoveUp(tileMap, cs)) {
      this.y -= cs;
      this.x = this.tileX * TILE_SIZE; // snap to column
      this.state = S.CLIMB_UP;
      return;
    }
    if (input.down && (onLadder || canEnterLadderBelow)) {
      if (this._canMoveDown(tileMap, cs)) {
        this.y += cs;
        this.x = this.tileX * TILE_SIZE;
        this.state = S.CLIMB_DOWN;
        return;
      }
    }

    // ── WALK ──────────────────────────────────────────────────────────────────
    let moved = false;
    if (input.left && this._canMoveLeft(tileMap, ws)) {
      this.x -= ws;
      this.facing = -1;
      this.state = S.WALK_LEFT;
      moved = true;
    } else if (input.right && this._canMoveRight(tileMap, ws)) {
      this.x += ws;
      this.facing = 1;
      this.state = S.WALK_RIGHT;
      moved = true;
    }

    if (!moved) {
      if (onLadder && (this.state === S.CLIMB_UP || this.state === S.CLIMB_DOWN)) {
        this.state = S.IDLE;
      } else if (!onLadder && this.state !== S.FALL) {
        this.state = S.IDLE;
      }
    }
  }

  render(renderer) {
    renderer.drawPlayer(
      Math.round(this.x), Math.round(this.y),
      this.state, this.facing, this.animFrame,
      this.respawnTimer > 0
    );
  }
}
