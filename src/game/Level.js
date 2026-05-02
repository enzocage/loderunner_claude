import { TILE, TILE_SIZE, COLS, ROWS, SCORE, THEMES, DEFAULT_THEME, AI_TIER } from '../constants.js';
import TileMap   from './TileMap.js';
import GoldPiece from './GoldPiece.js';
import Enemy     from './Enemy.js';

export default class Level {
  constructor() {
    this.tileMap      = null;
    this.gold         = [];
    this.enemies      = [];
    this.playerStart  = { x: 1, y: 1 };
    this.totalGold    = 0;
    this.goldCollected = 0;
    this.exitRevealed = false;
    this.exitTile     = { tx: Math.floor(COLS / 2), ty: 0 };
    this.theme        = DEFAULT_THEME;
    this.timeLimit    = 0;       // 0 = no limit
    this.timeLeft     = 0;
    this.meta         = {};
    this._levelNum    = 1;
    this._exitReached = false;
  }

  get goldRemaining() { return this.totalGold - this.goldCollected; }
  get isComplete()    { return this.exitRevealed && this._exitReached; }
  get themeData()     { return THEMES[this.theme] || THEMES[DEFAULT_THEME]; }

  async loadFromURL(url) {
    const res  = await fetch(url);
    const json = await res.json();
    this.loadFromJSON(json);
  }

  loadFromJSON(json) {
    this.meta  = json.meta ?? {};
    this.theme = json.theme ?? DEFAULT_THEME;
    this.timeLimit = json.timeLimit ?? 0;
    this.timeLeft  = this.timeLimit;

    // Build tile map (strip editor markers; power-ups stay in tiles)
    const rawTiles = json.tiles.map(row =>
      row.map(t => {
        if (t === TILE.SPAWN_PLAYER || t === TILE.SPAWN_ENEMY) return TILE.EMPTY;
        return t;
      })
    );
    this.tileMap = new TileMap(rawTiles);

    // Gold
    this.gold = (json.gold ?? []).map(g => new GoldPiece(g.x, g.y));
    this.totalGold    = this.gold.length;
    this.goldCollected = 0;
    this.exitRevealed  = this.totalGold === 0;
    this._exitReached  = false;

    // Player start
    this.playerStart = json.playerStart ?? { x: 1, y: 1 };

    // Enemies — read tier from JSON, default to NORMAL
    this.enemies = (json.enemies ?? []).map(e =>
      new Enemy(e.id, e.spawnX, e.spawnY, e.patrolLeft, e.patrolRight,
        e.tier ?? AI_TIER.NORMAL)
    );

    // Exit tile
    this.exitTile = json.exitTile ?? { tx: Math.floor(COLS / 2), ty: 1 };
  }

  // Returns power-up type collected at player position, or -1
  checkPowerUpPickup(playerX, playerY) {
    const tx = Math.floor((playerX + TILE_SIZE / 2) / TILE_SIZE);
    const ty = Math.floor((playerY + TILE_SIZE / 2) / TILE_SIZE);
    return this.tileMap.collectPowerUp(tx, ty);
  }

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
    if (this.timeLimit > 0 && this.timeLeft > 0) this.timeLeft--;
  }

  render(renderer, frameCount) {
    const tm  = this.tileMap;
    const td  = this.themeData;

    // Background
    renderer.gCtx.fillStyle = td.bg;
    renderer.gCtx.fillRect(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);

    // Draw tiles
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const tile = tm.get(tx, ty);
        if (tile === TILE.EMPTY) continue;
        if (tile === TILE.HOLE) {
          renderer.drawTile(tile, tx * TILE_SIZE, ty * TILE_SIZE, tm.getHoleAnim(tx, ty));
        } else {
          renderer.drawTile(tile, tx * TILE_SIZE, ty * TILE_SIZE, 0, frameCount);
        }
      }
    }

    // Draw exit ladder when revealed
    if (this.exitRevealed) {
      const ex = this.exitTile.tx * TILE_SIZE;
      const ey = this.exitTile.ty * TILE_SIZE;
      if (Math.floor(frameCount / 8) % 2 === 0) {
        renderer.gCtx.fillStyle = '#00ff88';
        renderer.gCtx.fillRect(ex, ey, TILE_SIZE, TILE_SIZE);
      }
      renderer.drawTile(TILE.LADDER, ex, ey);
    }

    // Draw gold
    for (const g of this.gold) {
      if (!g.collected) renderer.drawTile(TILE.GOLD, g.x, g.y, 0, frameCount);
    }
  }

  checkExit(playerX, playerY) {
    if (!this.exitRevealed) return false;
    const ex = this.exitTile.tx * TILE_SIZE;
    const ey = this.exitTile.ty * TILE_SIZE;
    return Math.abs(playerX - ex) < TILE_SIZE && Math.abs(playerY - ey) < TILE_SIZE;
  }

  checkGoldPickup(playerX, playerY) {
    for (let i = 0; i < this.gold.length; i++) {
      if (!this.gold[i].collected && this.gold[i].overlaps(playerX, playerY)) return i;
    }
    return -1;
  }
}
