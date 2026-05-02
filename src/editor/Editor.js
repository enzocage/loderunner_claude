import { TILE, TILE_SIZE, COLS, ROWS } from '../constants.js';
import TileMap        from '../game/TileMap.js';
import EditorRenderer from './EditorRenderer.js';
import Palette        from './Palette.js';
import EditorIO       from './EditorIO.js';

const UNDO_LIMIT = 50;

export default class Editor {
  constructor(renderer, domRefs) {
    this._renderer  = renderer;
    this._eRenderer = new EditorRenderer(renderer);
    this._tileMap   = new TileMap(EditorIO.blank().tiles);
    this._palette   = new Palette(domRefs.paletteContainer);
    this._mouseDown = false;
    this._frameCount = 0;
    this._meta = {};

    // Undo/redo: array of {tx,ty,prev,next}
    this._undoStack = [];
    this._redoStack = [];

    // Copy/paste buffer: {tiles[][], offX, offY}
    this._clipboard = null;
    this._selecting = false;
    this._selStart  = null;
    this._selEnd    = null;

    this.onPlayTest = null;
    this.onBack     = null;

    this._setupDOM(domRefs);
    this._setupCanvas(renderer.gameCanvas);
    this._setupKeys();
  }

  // ── DOM events ─────────────────────────────────────────────────────────────

  _setupDOM(refs) {
    refs.btnSave.addEventListener('click', () => {
      try {
        EditorIO.download(this._tileMap, this._meta);
      } catch (err) {
        alert(err.message);
      }
    });

    refs.fileInput.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const json = EditorIO.parse(ev.target.result);
          this.loadJSON(json);
        } catch (err) {
          alert(err.message);
        }
      };
      reader.readAsText(f);
      refs.fileInput.value = '';
    });

    refs.btnLoad.addEventListener('click', () => refs.fileInput.click());

    refs.btnTest.addEventListener('click', () => {
      try {
        const jsonStr = EditorIO.serialize(this._tileMap, this._meta);
        const result  = EditorIO.validate(JSON.parse(jsonStr));
        if (result.errors.length > 0) {
          alert('Level validation errors:\n' + result.errors.join('\n'));
          return;
        }
        if (this.onPlayTest) this.onPlayTest(JSON.parse(jsonStr));
      } catch (err) {
        alert(err.message);
      }
    });

    refs.btnClear.addEventListener('click', () => {
      if (confirm('Clear all tiles?')) {
        this._pushUndo(this._tileMap.toArray());
        this._tileMap = new TileMap(EditorIO.blank().tiles);
      }
    });

    refs.btnBack.addEventListener('click', () => {
      if (this.onBack) this.onBack();
    });
  }

  _setupCanvas(canvas) {
    const toTile = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        tx: Math.floor(((e.clientX - rect.left) * scaleX) / TILE_SIZE),
        ty: Math.floor(((e.clientY - rect.top)  * scaleY) / TILE_SIZE),
      };
    };

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    canvas.addEventListener('mousemove', (e) => {
      const { tx, ty } = toTile(e);
      this._eRenderer.setHover(tx, ty);
      if (this._mouseDown && this._mouseBtn !== undefined) {
        this._place(tx, ty, this._mouseBtn);
      }
    });

    canvas.addEventListener('mouseleave', () => this._eRenderer.setHover(null, null));

    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this._mouseDown = true;
      this._mouseBtn  = e.button;
      const { tx, ty } = toTile(e);
      // Save snapshot before paint stroke
      if (e.button !== 2) this._preStrokeSnap = this._tileMap.toArray();
      this._place(tx, ty, e.button);
    });

    window.addEventListener('mouseup', () => {
      if (this._mouseDown && this._preStrokeSnap) {
        this._pushUndo(this._preStrokeSnap);
        this._preStrokeSnap = null;
      }
      this._mouseDown = false;
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const { tx, ty } = toTile(e.touches[0]);
      this._preStrokeSnap = this._tileMap.toArray();
      this._place(tx, ty, 0);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const { tx, ty } = toTile(e.touches[0]);
      this._place(tx, ty, 0);
    }, { passive: false });
    canvas.addEventListener('touchend', () => {
      if (this._preStrokeSnap) {
        this._pushUndo(this._preStrokeSnap);
        this._preStrokeSnap = null;
      }
    });
  }

  _setupKeys() {
    window.addEventListener('keydown', (e) => {
      if (document.getElementById('editor-sidebar')?.classList.contains('hidden')) return;

      // Undo / Redo
      if (e.ctrlKey && e.code === 'KeyZ') { e.preventDefault(); this._undo(); return; }
      if (e.ctrlKey && e.code === 'KeyY') { e.preventDefault(); this._redo(); return; }

      // Copy / Paste
      if (e.ctrlKey && e.code === 'KeyC') { e.preventDefault(); this._copySelection(); return; }
      if (e.ctrlKey && e.code === 'KeyV') { e.preventDefault(); this._pasteSelection(); return; }

      // Flood fill (F) on hovered tile
      if (e.code === 'KeyF') { this._floodFill(); return; }

      // Rect fill (R) on selection
      if (e.code === 'KeyR') { this._rectFill(); return; }
    });
  }

  // ── Undo / Redo ─────────────────────────────────────────────────────────────

  _pushUndo(prevArray) {
    this._undoStack.push(prevArray);
    if (this._undoStack.length > UNDO_LIMIT) this._undoStack.shift();
    this._redoStack = [];
  }

  _undo() {
    if (this._undoStack.length === 0) return;
    const prev = this._undoStack.pop();
    this._redoStack.push(this._tileMap.toArray());
    this._tileMap = new TileMap(prev);
  }

  _redo() {
    if (this._redoStack.length === 0) return;
    const next = this._redoStack.pop();
    this._undoStack.push(this._tileMap.toArray());
    this._tileMap = new TileMap(next);
  }

  // ── Flood fill ───────────────────────────────────────────────────────────────

  _floodFill() {
    const h = this._eRenderer.hoverTx;
    const vy = this._eRenderer.hoverTy;
    if (h == null || vy == null) return;
    const tx = h, ty = vy;
    const target  = this._tileMap.get(tx, ty);
    const replace = this._palette.selected;
    if (target === replace) return;
    const before = this._tileMap.toArray();

    // BFS flood fill
    const queue = [[tx, ty]];
    const visited = new Set();
    const key = (x, y) => `${x},${y}`;
    visited.add(key(tx, ty));
    while (queue.length) {
      const [cx, cy] = queue.shift();
      if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) continue;
      if (this._tileMap.get(cx, cy) !== target) continue;
      this._tileMap.set(cx, cy, replace);
      for (const [nx, ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]]) {
        const k = key(nx, ny);
        if (!visited.has(k)) { visited.add(k); queue.push([nx, ny]); }
      }
    }
    this._pushUndo(before);
  }

  // ── Rect fill ────────────────────────────────────────────────────────────────

  _rectFill() {
    // Fills from hover position inward (1-tile border of selected type, or solid fill)
    const h = this._eRenderer.hoverTx;
    const vy = this._eRenderer.hoverTy;
    if (h == null || vy == null) return;
    const before = this._tileMap.toArray();
    const type = this._palette.selected;
    // Fill 5×5 block centred on hover
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = h + dx, ny = vy + dy;
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
          this._tileMap.set(nx, ny, type);
        }
      }
    }
    this._pushUndo(before);
  }

  // ── Copy / Paste ─────────────────────────────────────────────────────────────

  _copySelection() {
    // Copy a 5×5 region centred on hover
    const h = this._eRenderer.hoverTx;
    const vy = this._eRenderer.hoverTy;
    if (h == null || vy == null) return;
    const rad = 2;
    const tiles = [];
    for (let dy = -rad; dy <= rad; dy++) {
      const row = [];
      for (let dx = -rad; dx <= rad; dx++) {
        row.push(this._tileMap.get(h + dx, vy + dy));
      }
      tiles.push(row);
    }
    this._clipboard = { tiles, offX: -rad, offY: -rad };
  }

  _pasteSelection() {
    const h = this._eRenderer.hoverTx;
    const vy = this._eRenderer.hoverTy;
    if (!this._clipboard || h == null || vy == null) return;
    const before = this._tileMap.toArray();
    const { tiles, offX, offY } = this._clipboard;
    for (let dy = 0; dy < tiles.length; dy++) {
      for (let dx = 0; dx < tiles[dy].length; dx++) {
        const nx = h + offX + dx, ny = vy + offY + dy;
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
          this._tileMap.set(nx, ny, tiles[dy][dx]);
        }
      }
    }
    this._pushUndo(before);
  }

  // ── Place tile ───────────────────────────────────────────────────────────────

  _place(tx, ty, btn) {
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;
    if (btn === 2) {
      this._tileMap.set(tx, ty, TILE.EMPTY);
      return;
    }
    const type = this._palette.selected;
    if (type === TILE.SPAWN_PLAYER) {
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (this._tileMap.get(c, r) === TILE.SPAWN_PLAYER)
            this._tileMap.set(c, r, TILE.EMPTY);
    }
    this._tileMap.set(tx, ty, type);
  }

  // ── Public ────────────────────────────────────────────────────────────────────

  update() { this._frameCount++; }

  render() {
    this._eRenderer.render(this._tileMap, this._palette.selected, this._frameCount);
  }

  loadJSON(json) {
    const tiles = json.tiles.map(r => [...r]);
    if (json.playerStart) tiles[json.playerStart.y][json.playerStart.x] = TILE.SPAWN_PLAYER;
    for (const e of json.enemies ?? []) tiles[e.spawnY][e.spawnX] = TILE.SPAWN_ENEMY;
    for (const g of json.gold ?? []) tiles[g.y][g.x] = TILE.GOLD;
    this._tileMap = new TileMap(tiles);
    this._meta = json.meta ?? {};
  }
}
