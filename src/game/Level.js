import { TILE, TILE_SIZE, COLS, ROWS, SCORE } from '../constants.js';
import TileMap  from './TileMap.js';
import GoldPiece from './GoldPiece.js';
import Enemy    from './Enemy.js';

export default class Level {
  constructor() {
    this.tileMap    = null;
    this.gold       = [];
    this.enemies    = [];
    this.playerStart = { x: 1, y: 1 };
    this.totalGold  = 0;
    this.goldCollected = 0;
    this.exitRevealed = false;
    this.exitTile   = { tx: Math.floor(COLS / 2), ty: 0 };
    this.meta       = {};
    this._levelNum  = 1;
  }

  get goldRemaining() { return this.totalGold - this.goldCollected; }
  get isComplete()    { return this.exitRevealed && this._exitReached; }

  async loadFromURL(url) {
    const res  = await fetch(url);
    const json = await res.json();
    this.loadFromJSON(json);
  }

  loadFromJSON(json) {
    this.meta = json.meta ?? {};
    // Build tile map (strip editor markers)
    const rawTiles = json.tiles.map(row =>
      row.map(t => {
        if (t === TILE.SPAWN_PLAYER || t === TILE.SPAWN_ENEMY) return TILE.EMPTY;
        return t;
      })
    );
    this.tileMap = new TileMap(rawTiles);

    // Gold
    this.gold = (json.gold ?? []).map(g => new GoldPiece(g.x, g.y));
    this.totalGold  = this.gold.length;
    this.goldCollected = 0;
    this.exitRevealed = this.totalGold === 0;
    this._exitReached = false;

    // Player start
    const ps = json.playerStart ?? { x: 1, y: 1 };
    this.playerStart = ps;

    // Enemies
    this.enemies = (json.enemies ?? []).map(e =>
      new Enemy(e.id, e.spawnX, e.spawnY, e.patrolLeft, e.patrolRight)
    );

    // Exit tile (centre top of playfield)
    this.exitTile = json.exitTile ?? { tx: Math.floor(COLS / 2), ty: 1 };
  }

  // Call when player collects gold at index idx
  collectGold(idx, audio, particles) {
    const g = this.gold[idx];
    if (!g || g.collected) return 0;
    g.collected = true;
    this.goldCollected++;
    if (particles) particles.emit('gold', g.x, g.y);
    if (audio)     audio.play('collect', { pitch: 0.9 + this.goldCollected * 0.02 });
    if (this.goldRemaining === 0) {
      this.exitRevealed = true;
    }
    return SCORE.GOLD;
  }

  playerReachedExit() {
    this._exitReached = true;
  }

  update() {
    this.tileMap.update();
    for (const g of this.gold) g.update();
  }

  render(renderer, frameCount) {
    const tm = this.tileMap;
    // Draw tiles
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const tile = tm.get(tx, ty);
        if (tile === TILE.EMPTY) continue;
        if (tile === TILE.HOLE) {
          renderer.drawTile(tile, tx * TILE_SIZE, ty * TILE_SIZE, tm.getHoleAnim(tx, ty));
        } else {
          renderer.drawTile(tile, tx * TILE_SIZE, ty * TILE_SIZE);
        }
      }
    }
    // Draw exit ladder when revealed
    if (this.exitRevealed) {
      const ex = this.exitTile.tx * TILE_SIZE;
      const ey = this.exitTile.ty * TILE_SIZE;
      // Flashing indicator
      if (Math.floor(frameCount / 8) % 2 === 0) {
        renderer.gCtx.fillStyle = '#00ff88';
        renderer.gCtx.fillRect(ex, ey, TILE_SIZE, TILE_SIZE);
      }
      renderer.drawTile(TILE.LADDER, ex, ey);
    }
    // Draw gold
    for (const g of this.gold) {
      if (!g.collected) renderer.drawTile(TILE.GOLD, g.x, g.y);
    }
  }

  // Check player overlaps exit
  checkExit(playerX, playerY) {
    if (!this.exitRevealed) return false;
    const ex = this.exitTile.tx * TILE_SIZE;
    const ey = this.exitTile.ty * TILE_SIZE;
    return Math.abs(playerX - ex) < TILE_SIZE && Math.abs(playerY - ey) < TILE_SIZE;
  }

  // Check player overlaps any uncollected gold; returns index or -1
  checkGoldPickup(playerX, playerY) {
    for (let i = 0; i < this.gold.length; i++) {
      if (!this.gold[i].collected && this.gold[i].overlaps(playerX, playerY)) return i;
    }
    return -1;
  }
}
