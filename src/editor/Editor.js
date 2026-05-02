import { TILE, TILE_SIZE, COLS, ROWS } from '../constants.js';
import TileMap        from '../game/TileMap.js';
import EditorRenderer from './EditorRenderer.js';
import Palette        from './Palette.js';
import EditorIO       from './EditorIO.js';

export default class Editor {
  constructor(renderer, domRefs) {
    this._renderer = renderer;
    this._eRenderer = new EditorRenderer(renderer);
    this._tileMap  = new TileMap(EditorIO.blank().tiles);
    this._palette  = new Palette(domRefs.paletteContainer);
    this._mouseDown = false;
    this._frameCount = 0;
    this._meta = {};

    this.onPlayTest = null; // callback(jsonObj)
    this.onBack     = null;

    this._setupDOM(domRefs);
    this._setupCanvas(renderer.gameCanvas);
  }

  _setupDOM(refs) {
    refs.btnSave.addEventListener('click', () => {
      EditorIO.download(this._tileMap, this._meta);
    });

    refs.fileInput.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const json = EditorIO.parse(ev.target.result);
          // Merge gold/enemies/spawns back into tile array
          const tiles = json.tiles.map(r => [...r]);
          if (json.playerStart) {
            tiles[json.playerStart.y][json.playerStart.x] = TILE.SPAWN_PLAYER;
          }
          for (const e of json.enemies ?? []) {
            tiles[e.spawnY][e.spawnX] = TILE.SPAWN_ENEMY;
          }
          for (const g of json.gold ?? []) {
            tiles[g.y][g.x] = TILE.GOLD;
          }
          this._tileMap = new TileMap(tiles);
          this._meta = json.meta ?? {};
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
        const json = JSON.parse(EditorIO.serialize(this._tileMap, this._meta));
        if (this.onPlayTest) this.onPlayTest(json);
      } catch (err) {
        alert(err.message);
      }
    });

    refs.btnClear.addEventListener('click', () => {
      if (confirm('Clear all tiles?')) {
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
      this._place(tx, ty, e.button);
    });

    window.addEventListener('mouseup', () => { this._mouseDown = false; });

    // Touch
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const { tx, ty } = toTile(t);
      this._place(tx, ty, 0);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const { tx, ty } = toTile(t);
      this._place(tx, ty, 0);
    }, { passive: false });
  }

  _place(tx, ty, btn) {
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;
    if (btn === 2) {
      this._tileMap.set(tx, ty, TILE.EMPTY);
      return;
    }
    const type = this._palette.selected;
    // Enforce single player spawn
    if (type === TILE.SPAWN_PLAYER) {
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (this._tileMap.get(c, r) === TILE.SPAWN_PLAYER)
            this._tileMap.set(c, r, TILE.EMPTY);
    }
    this._tileMap.set(tx, ty, type);
  }

  update() {
    this._frameCount++;
  }

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
