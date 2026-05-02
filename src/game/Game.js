import { TILE_SIZE, SCORE, CANVAS_H, CANVAS_W, TILE } from '../constants.js';
import Player  from './Player.js';
import Level   from './Level.js';
import HUD     from './HUD.js';

const LEVEL_CLEAR_DELAY = 180; // 3 s

export default class Game {
  constructor(renderer, audio, particles) {
    this.renderer  = renderer;
    this.audio     = audio;
    this.particles = particles;
    this.player    = new Player();
    this.hud       = new HUD();
    this.level     = new Level();
    this.score     = 0;
    this.lives     = 3;
    this.levelNum  = 1;
    this._levels   = [];         // URLs or JSON objects
    this._frameCount = 0;
    this._state    = 'playing';  // 'playing'|'dying'|'clearing'|'gameover'
    this._clearTimer = 0;
    this._deathTimer = 0;
    this._flashAlpha = 0;
    this._testMode = false;

    // Callbacks
    this.onLevelClear = null;
    this.onGameOver   = null;

    this._bindPlayer();
  }

  _bindPlayer() {
    this.player.onDeath = () => this._handlePlayerDeath();
    this.player.onDig   = (tx, ty, px, py) => {
      this.particles.emit('dig', px, py);
      this.audio.play('dig');
      this.renderer.triggerShake(2, 8);
    };
  }

  setLevels(urls) { this._levels = urls; }

  async startLevel(num, json = null) {
    this.levelNum = num;
    this.hud.levelNum = num;
    this.hud.flashLevel();
    if (json) {
      this.level.loadFromJSON(json);
    } else {
      await this.level.loadFromURL(this._levels[num - 1]);
    }
    const ps = this.level.playerStart;
    this.player.lives = this.lives;
    this.player.setStart(ps.x, ps.y);
    // Wire enemy trap-score callbacks once
    for (const e of this.level.enemies) {
      e.onDeath = () => {
        this.score += SCORE.ENEMY_TRAP;
        this.hud.score = this.score;
        this.hud.showMessage('+' + SCORE.ENEMY_TRAP, 60);
      };
    }
    this._state = 'playing';
    this._clearTimer = 0;
    this.audio.startBGM();
  }

  startTestMode(json) {
    this._testMode = true;
    this.score = 0; this.lives = 3; this.levelNum = 1;
    this.hud.score = 0; this.hud.displayScore = 0; this.hud.lives = 3;
    this.startLevel(1, json);
  }

  update(dt, input) {
    this._frameCount++;
    this.hud.update();
    this.particles.update();

    if (this._state === 'dying') {
      this._deathTimer--;
      this._flashAlpha = Math.max(0, this._deathTimer / 30);
      if (this._deathTimer <= 0) {
        this._state = 'playing';
        const ps = this.level.playerStart;
        this.player.setStart(ps.x, ps.y);
      }
      return;
    }

    if (this._state === 'clearing') {
      this._clearTimer--;
      if (this._clearTimer <= 0) {
        if (this.onLevelClear) this.onLevelClear(this.score);
      }
      return;
    }

    if (this._state === 'gameover') return;

    // Level update
    this.level.update();

    // Player update
    this.player.update(input, this.level.tileMap);

    // Enemy updates
    for (const e of this.level.enemies) {
      e.update(this.level.tileMap, this.player.x, this.player.y, this.level.enemies);

      // Enemy picks up uncollected gold
      if (e.state !== 'TRAPPED' && e.state !== 'RESPAWN' && !e.carriedGold) {
        const gi = this.level.checkGoldPickup(e.x, e.y);
        if (gi >= 0 && !this.level.gold[gi].collected) {
          e.carriedGold = this.level.gold[gi];
          e.carriedGold.collected = true;
        }
      }
    }

    // Gold collection by player
    const gi = this.level.checkGoldPickup(this.player.x, this.player.y);
    if (gi >= 0) {
      const pts = this.level.collectGold(gi, this.audio, this.particles);
      this.score += pts;
      this.hud.score = this.score;
    }

    // Player-enemy collision
    if (this.player.isAlive) {
      for (const e of this.level.enemies) {
        if (e.overlapsPlayer(this.player.x, this.player.y)) {
          this._killPlayer();
          break;
        }
      }
    }

    // Exit check
    if (this.player.isAlive && this.level.checkExit(this.player.x, this.player.y)) {
      this.level.playerReachedExit();
      this._triggerLevelClear();
    }
  }

  _killPlayer() {
    if (!this.player.isAlive) return;
    this.lives--;
    this.hud.lives = this.lives;
    this.audio.play('death');
    this.particles.emit('death', this.player.x, this.player.y);
    this.renderer.triggerShake(4, 20);
    this.player.die();

    if (this.lives <= 0) {
      this._state = 'gameover';
      setTimeout(() => { if (this.onGameOver) this.onGameOver(this.score); }, 2000);
    } else {
      this._state = 'dying';
      this._deathTimer = 90;
      this._flashAlpha = 1;
    }
  }

  _handlePlayerDeath() {
    // Already handled in _killPlayer
  }

  _triggerLevelClear() {
    if (this._state === 'clearing') return;
    this._state = 'clearing';
    this._clearTimer = LEVEL_CLEAR_DELAY;
    this.score += SCORE.LEVEL_COMPLETE;
    this.hud.score = this.score;
    this.audio.play('complete');
    this.audio.stopBGM();
    this.hud.showMessage('LEVEL COMPLETE!', LEVEL_CLEAR_DELAY);
  }

  render(alpha) {
    const ctx = this.renderer.gCtx;

    this.renderer.beginFrame();

    // Level
    this.level.render(this.renderer, this._frameCount);

    // Gold
    // (rendered inside level.render)

    // Enemies
    for (const e of this.level.enemies) e.render(this.renderer);

    // Player
    if (this.player.state !== 'DEAD' || Math.floor(this._frameCount / 4) % 2 === 0) {
      this.player.render(this.renderer);
    }

    // Particles
    this.particles.render(ctx);

    // Death flash
    if (this._flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this._flashAlpha * 0.7})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // HUD
    this.hud.render(ctx, this._frameCount);

    this.renderer.endFrame();
  }
}
