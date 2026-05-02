import { STATE, CANVAS_W, CANVAS_H } from './constants.js';
import GameLoop      from './engine/GameLoop.js';
import Renderer      from './engine/Renderer.js';
import InputManager  from './engine/InputManager.js';
import AudioManager  from './engine/AudioManager.js';
import AssetLoader   from './engine/AssetLoader.js';
import ParticleSystem from './engine/ParticleSystem.js';
import Game          from './game/Game.js';
import Editor        from './editor/Editor.js';
import Menu          from './ui/Menu.js';
import HighScores    from './ui/HighScores.js';
import Transitions   from './ui/Transitions.js';

const LEVEL_URLS = [
  'src/levels/level1.json',
  'src/levels/level2.json',
  'src/levels/level3.json',
];

export default class App {
  constructor() {
    this._state = STATE.LOADING;
    this._prevState = null;
    this._frameCount = 0;

    // Canvas
    this._gameCanvas = document.getElementById('game-canvas');
    this._crtCanvas  = document.getElementById('crt-canvas');

    // Engine
    this._renderer  = new Renderer(this._gameCanvas, this._crtCanvas);
    this._input     = new InputManager();
    this._audio     = new AudioManager();
    this._assets    = new AssetLoader();
    this._particles = new ParticleSystem();
    this._trans     = new Transitions();

    // Subsystems
    this._game   = new Game(this._renderer, this._audio, this._particles);
    this._menu   = new Menu(this._renderer);
    this._scores = new HighScores();
    this._editor = null; // lazy init

    this._pendingScore = 0;
    this._pendingLevel = 1;
    this._currentLevel = 1;
    this._totalLevels  = LEVEL_URLS.length;

    // Controls screen flag
    this._showControls = false;

    this._loop = new GameLoop(
      (dt) => this._update(dt),
      (alpha) => this._render(alpha)
    );

    this._setupGame();
    this._setupMobileControls();
    this._setupWindowEvents();
  }

  _setupGame() {
    this._game.setLevels(LEVEL_URLS);

    this._game.onLevelClear = (score) => {
      this._pendingScore = score;
      this._currentLevel++;
      if (this._currentLevel > this._totalLevels) {
        // All levels done – game complete
        this._setState(STATE.GAME_OVER);
      } else {
        this._trans.dissolve(40, () => {
          this._game.startLevel(this._currentLevel).catch(console.error);
        });
      }
    };

    this._game.onGameOver = (score) => {
      this._pendingScore = score;
      this._pendingLevel = this._currentLevel;
      this._trans.wipe(30, () => this._setState(STATE.GAME_OVER));
    };

    this._menu.onSelect = (idx) => {
      switch (idx) {
        case 0: // Start game
          this._audio.init();
          this._currentLevel = 1;
          this._trans.wipe(25, async () => {
            await this._game.startLevel(1);
            this._setState(STATE.PLAYING);
          });
          break;
        case 1: // Editor
          this._audio.init();
          this._initEditor();
          this._setState(STATE.EDITOR);
          break;
        case 2: // High scores
          this._setState(STATE.HIGH_SCORES);
          break;
        case 3: // Controls
          this._showControls = true;
          this._setState(STATE.HIGH_SCORES); // reuse screen slot
          break;
      }
    };
  }

  _initEditor() {
    if (this._editor) return;
    const domRefs = {
      paletteContainer: document.getElementById('palette-tiles'),
      btnSave:   document.getElementById('btn-save'),
      btnLoad:   document.getElementById('btn-load'),
      fileInput: document.getElementById('file-input'),
      btnTest:   document.getElementById('btn-test'),
      btnClear:  document.getElementById('btn-clear'),
      btnBack:   document.getElementById('btn-back'),
    };
    this._editor = new Editor(this._renderer, domRefs);
    this._editor.onPlayTest = (json) => {
      this._audio.init();
      this._trans.wipe(20, async () => {
        await this._game.startTestMode(json);
        this._setState(STATE.PLAYING);
        document.getElementById('editor-sidebar').classList.add('hidden');
      });
    };
    this._editor.onBack = () => {
      document.getElementById('editor-sidebar').classList.add('hidden');
      this._setState(STATE.MENU);
    };
  }

  _setState(s) {
    this._prevState = this._state;
    this._state = s;

    // Show/hide editor sidebar
    const sidebar = document.getElementById('editor-sidebar');
    if (s === STATE.EDITOR) {
      sidebar.classList.remove('hidden');
      // Make canvas narrower for editor
      this._gameCanvas.style.cursor = 'crosshair';
    } else {
      sidebar.classList.add('hidden');
      this._gameCanvas.style.cursor = 'default';
    }
  }

  _setupMobileControls() {
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (!isTouchDevice) return;
    document.getElementById('mobile-controls')?.classList.remove('hidden');

    const map = {
      'btn-up':    'ArrowUp',
      'btn-down':  'ArrowDown',
      'btn-left':  'ArrowLeft',
      'btn-right': 'ArrowRight',
      'btn-digl':  'KeyZ',
      'btn-digr':  'KeyX',
    };
    for (const [id, code] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); this._input.setHeld(code, true); },  { passive: false });
      el.addEventListener('touchend',   (e) => { e.preventDefault(); this._input.setHeld(code, false); }, { passive: false });
    }
  }

  _setupWindowEvents() {
    window.addEventListener('resize', () => Renderer.scaleToFit());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF2') {
        this._renderer.crtEnabled = !this._renderer.crtEnabled;
      }
      if (e.code === 'KeyM') {
        const m = this._audio.toggleMute();
        if (!m) this._audio.init();
      }
    });
    Renderer.scaleToFit();
  }

  async init() {
    await this._assets.loadAll();
    this._setState(STATE.MENU);
    this._loop.start();
  }

  _update(dt) {
    this._frameCount++;
    this._trans.update();

    switch (this._state) {
      case STATE.LOADING:
        break;

      case STATE.MENU:
        if (!this._showControls) {
          this._menu.update(this._input);
        } else {
          if (this._input.isPressed('Escape') || this._input.isPressed('Space') || this._input.any) {
            this._showControls = false;
          }
        }
        break;

      case STATE.PLAYING:
        if (this._input.pause) {
          this._setState(STATE.PAUSED);
          break;
        }
        this._game.update(dt, this._input);
        break;

      case STATE.PAUSED:
        if (this._input.pause || this._input.isPressed('Space')) {
          this._setState(STATE.PLAYING);
        }
        break;

      case STATE.LEVEL_CLEAR:
        // Handled via callback
        break;

      case STATE.GAME_OVER:
        if (this._scores.isEnteringName) {
          this._scores.update(this._input);
        } else if (this._input.isPressed('Enter') || this._input.isPressed('Space') ||
                   this._input.isPressed('KeyZ') || this._input.isPressed('Escape')) {
          if (this._scores.qualifies(this._pendingScore)) {
            this._scores.startEntry(this._pendingScore, this._pendingLevel, () => {
              this._setState(STATE.HIGH_SCORES);
            });
          } else {
            this._setState(STATE.MENU);
          }
        }
        break;

      case STATE.HIGH_SCORES:
        this._scores.update(this._input);
        if (!this._scores.isEnteringName) {
          if (this._input.isPressed('Enter') || this._input.isPressed('Space') ||
              this._input.isPressed('Escape') || this._input.isPressed('KeyZ')) {
            this._showControls = false;
            this._setState(STATE.MENU);
          }
        }
        break;

      case STATE.EDITOR:
        if (this._editor) this._editor.update();
        break;
    }

    this._input.flush();
  }

  _render(alpha) {
    const ctx = this._renderer.gCtx;

    switch (this._state) {
      case STATE.LOADING: {
        this._renderer.beginFrame();
        ctx.fillStyle = '#ffd700';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('LOADING…', CANVAS_W / 2, CANVAS_H / 2);
        ctx.textAlign = 'left';
        this._renderer.endFrame();
        break;
      }

      case STATE.MENU:
        if (this._showControls) {
          this._renderControls();
        } else {
          this._menu.render();
        }
        break;

      case STATE.PLAYING:
      case STATE.LEVEL_CLEAR:
        this._game.render(alpha);
        // Draw transition overlay directly on the CRT output (after game.render endFrame)
        if (this._trans.isActive) {
          this._trans.render(this._renderer.cCtx);
        }
        break;

      case STATE.PAUSED:
        this._game.render(alpha);
        this._renderPauseOverlay();   // draws directly on cCtx after game.render
        break;

      case STATE.GAME_OVER:
        this._renderGameOver();
        break;

      case STATE.HIGH_SCORES:
        this._renderer.beginFrame();
        this._scores.renderScoreTable(ctx);
        this._renderer.endFrame();
        break;

      case STATE.EDITOR:
        if (this._editor) this._editor.render();
        break;
    }

    // Global transition overlay for non-playing states (wipe/dissolve between screens)
    if (this._trans.isActive && this._state !== STATE.PLAYING && this._state !== STATE.LEVEL_CLEAR) {
      this._trans.render(this._renderer.cCtx);
    }
  }

  _renderPauseOverlay() {
    // Draw directly on the CRT output canvas (game.render already ran endFrame)
    const ctx = this._renderer.cCtx;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#9f9f9f';
    ctx.fillText('PRESS P OR ESC TO RESUME', CANVAS_W / 2, CANVAS_H / 2 + 20);
    ctx.textAlign = 'left';
  }

  _renderGameOver() {
    this._renderer.beginFrame();
    const ctx = this._renderer.gCtx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#883932';
    ctx.fillText('GAME OVER', CANVAS_W / 2 + 2, CANVAS_H / 2 - 28);
    ctx.fillStyle = '#b86962';
    ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 30);

    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#bfce72';
    ctx.fillText(`SCORE: ${String(this._pendingScore).padStart(8,'0')}`, CANVAS_W / 2, CANVAS_H / 2 + 10);

    if (this._scores.isEnteringName) {
      // Render name entry on gCtx BEFORE endFrame so it goes through CRT
      this._scores.renderNameEntry(ctx);
    } else {
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = Math.floor(this._frameCount / 20) % 2 ? '#ffd700' : '#c8a000';
      ctx.fillText('PRESS ANY KEY', CANVAS_W / 2, CANVAS_H / 2 + 40);
    }
    ctx.textAlign = 'left';
    this._renderer.endFrame();
  }

  _renderControls() {
    this._renderer.beginFrame();
    const ctx = this._renderer.gCtx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('CONTROLS', CANVAS_W / 2, 30);

    const lines = [
      ['MOVE',       '← → ↑ ↓  /  W A S D'],
      ['DIG LEFT',   'Z  or  ,'],
      ['DIG RIGHT',  'X  or  .'],
      ['PAUSE',      'P  or  ESC'],
      ['TOGGLE CRT', 'F2'],
      ['MUTE',       'M'],
      ['',''],
      ['GOAL','COLLECT ALL GOLD THEN'],
      ['',    'REACH THE EXIT LADDER'],
      ['',''],
      ['ENEMIES','TRAP THEM IN HOLES'],
      ['',       'TO EARN BONUS POINTS'],
    ];

    ctx.font = '6px "Press Start 2P", monospace';
    let y = 60;
    for (const [lbl, val] of lines) {
      if (!lbl && !val) { y += 8; continue; }
      ctx.fillStyle = '#67b6bd';
      ctx.textAlign = 'right';
      ctx.fillText(lbl, CANVAS_W / 2 - 10, y);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(val, CANVAS_W / 2 + 10, y);
      y += 16;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#555';
    ctx.fillText('PRESS ANY KEY TO GO BACK', CANVAS_W / 2, CANVAS_H - 20);
    ctx.textAlign = 'left';
    this._renderer.endFrame();
  }
}
