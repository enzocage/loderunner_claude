import {
  TILE_SIZE, SCORE, CANVAS_H, CANVAS_W, TILE,
  COMBO, TRAP_SCORES, POWERUP, ENEMY_STATE,
} from '../constants.js';
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
    this.lives     = 5;
    this.levelNum  = 1;
    this._levels   = [];
    this._frameCount = 0;
    this._state    = 'playing';
    this._clearTimer = 0;
    this._deathTimer = 0;
    this._flashAlpha = 0;
    this._testMode = false;

    // Combo system
    this._comboCount   = 0;
    this._comboWindow  = 0;   // frames until combo resets

    // Trap score escalation per session
    this._trapSession  = 0;

    // Power-up active state
    this._freezeTimer  = 0;

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
    this.hud.showBanner(`LEVEL  ${String(num).padStart(2,'0')}`);

    if (json) {
      this.level.loadFromJSON(json);
    } else {
      await this.level.loadFromURL(this._levels[num - 1]);
    }

    // Build atlas with level theme
    this.renderer.buildAtlas(this.level.theme);

    const ps = this.level.playerStart;
    this.player.lives = this.lives;
    this.player.setStart(ps.x, ps.y);

    // HUD gold counts
    this.hud.goldTotal     = this.level.totalGold;
    this.hud.goldCollected = 0;
    this.hud.lives         = this.lives;
    this.hud.maxLives      = this.lives;
    this.hud.timeLimit     = this.level.timeLimit;
    this.hud.timeLeft      = this.level.timeLeft;

    // Wire enemy trap-score callbacks
    for (const e of this.level.enemies) {
      e.onDeath = (enemy) => {
        const mult = COMBO.MULTS[Math.min(this._comboCount, COMBO.MULTS.length - 1)];
        const base = TRAP_SCORES[Math.min(this._trapSession, TRAP_SCORES.length - 1)];
        const pts  = Math.round(base * mult);
        this._trapSession = Math.min(this._trapSession + 1, TRAP_SCORES.length - 1);
        this._comboCount++;
        this._comboWindow = COMBO.WINDOW_FRAMES;
        this.score += pts;
        this.hud.score = this.score;
        this.hud.showMessage(`+${pts}`, 60, {
          x: Math.round(enemy.x) + TILE_SIZE / 2,
          y: Math.round(enemy.y) - 8,
          color: '#ff9900',
        });
        if (this._comboCount >= 2) {
          this.hud.showCombo(this._comboCount);
        }
      };
    }

    this._state = 'playing';
    this._clearTimer = 0;
    this._comboCount  = 0;
    this._comboWindow = 0;
    this._trapSession = 0;
    this._freezeTimer = 0;
    this.audio.startBGM();
  }

  startTestMode(json) {
    this._testMode = true;
    this.score = 0; this.lives = 5; this.levelNum = 1;
    this.hud.score = 0; this.hud.displayScore = 0; this.hud.lives = 5;
    return this.startLevel(1, json);
  }

  update(dt, input) {
    this._frameCount++;
    this.hud.update();
    this.particles.update();

    // Combo window countdown
    if (this._comboWindow > 0) {
      this._comboWindow--;
      if (this._comboWindow === 0) {
        this._comboCount  = 0;
        this._trapSession = 0;
      }
    }

    // Freeze timer
    if (this._freezeTimer > 0) {
      this._freezeTimer--;
      for (const e of this.level.enemies) e.frozen = this._freezeTimer > 0;
    }

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

    // Time limit check
    if (this.level.timeLimit > 0 && this.level.timeLeft <= 0) {
      this._killPlayer();
      return;
    }

    // Level update
    this.level.update();

    // Sync HUD time
    this.hud.timeLeft  = this.level.timeLeft;
    this.hud.timeLimit = this.level.timeLimit;

    // Player update
    this.player.update(input, this.level.tileMap);

    // Power-up pickup
    if (this.player.isAlive) {
      const puType = this.level.checkPowerUpPickup(this.player.x, this.player.y);
      if (puType >= 0) this._applyPowerUp(puType);
    }

    // Enemy updates
    for (const e of this.level.enemies) {
      e.update(this.level.tileMap, this.player.x, this.player.y, this.level.enemies);

      // Enemy picks up uncollected gold
      if (e.state !== ENEMY_STATE.TRAPPED && e.state !== ENEMY_STATE.RESPAWN && !e.carriedGold) {
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
      this.hud.goldCollected = this.level.goldCollected;
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

  _applyPowerUp(type) {
    this.audio.play('powerup');
    this.particles.emit('gold', this.player.x, this.player.y);
    if (type === TILE.POWER_SPEED) {
      this.player.speedBoost = POWERUP.SPEED_BOOST_FRAMES;
      this.hud.setPower('speed', POWERUP.SPEED_BOOST_FRAMES);
      this.hud.showMessage('SPEED BOOST!', 90);
    } else if (type === TILE.POWER_DIG) {
      this.player.digFrenzy = POWERUP.DIG_FRENZY_FRAMES;
      this.hud.setPower('dig', POWERUP.DIG_FRENZY_FRAMES);
      this.hud.showMessage('DIG FRENZY!', 90);
    } else if (type === TILE.POWER_FREEZE) {
      this._freezeTimer = POWERUP.FREEZE_FRAMES;
      for (const e of this.level.enemies) e.frozen = true;
      this.hud.setPower('freeze', POWERUP.FREEZE_FRAMES);
      this.hud.showMessage('ENEMIES FROZEN!', 90);
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
    // Handled in _killPlayer
  }

  _triggerLevelClear() {
    if (this._state === 'clearing') return;
    this._state = 'clearing';
    this._clearTimer = LEVEL_CLEAR_DELAY;

    // Time bonus
    const timeBonus = this.level.timeLimit > 0
      ? Math.floor(this.level.timeLeft / 60) * SCORE.TIME_BONUS_PER_SEC
      : 0;

    this.score += SCORE.LEVEL_COMPLETE + timeBonus;
    this.hud.score = this.score;
    this.audio.play('complete');
    this.audio.stopBGM();

    const msg = timeBonus > 0
      ? `LEVEL COMPLETE! +${timeBonus} TIME BONUS`
      : 'LEVEL COMPLETE!';
    this.hud.showMessage(msg, LEVEL_CLEAR_DELAY);
    this.hud.showBanner('STAGE CLEAR');
  }

  /**
   * Render the game frame.
   * @param {number} alpha - interpolation factor (unused currently)
   * @param {Function|null} overlayFn - optional fn(ctx) called on gCtx before endFrame,
   *   used for pause overlay and transition overlays so WebGL picks them up.
   */
  render(alpha, overlayFn = null) {
    const ctx = this.renderer.gCtx;

    this.renderer.beginFrame();

    // Level
    this.level.render(this.renderer, this._frameCount);

    // Enemies
    for (const e of this.level.enemies) e.render(this.renderer);

    // Player (flicker on respawn handled inside drawPlayer)
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

    // Pre-endFrame overlay (pause screen, transitions)
    if (overlayFn) overlayFn(ctx);

    this.renderer.endFrame();
  }
}
