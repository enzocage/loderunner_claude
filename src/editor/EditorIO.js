import { TILE, COLS, ROWS } from '../constants.js';

export default class EditorIO {
  // Serialize tileMap + metadata to JSON string
  static serialize(tileMap, meta = {}) {
    const tiles = tileMap.toArray();
    // Count gold
    const gold = [];
    let pStart = null;
    const enemies = [];
    let eId = 0;

    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const t = tiles[ty][tx];
        if (t === TILE.GOLD) {
          gold.push({ x: tx, y: ty });
          tiles[ty][tx] = TILE.EMPTY;
        } else if (t === TILE.SPAWN_PLAYER) {
          pStart = { x: tx, y: ty };
          tiles[ty][tx] = TILE.EMPTY;
        } else if (t === TILE.SPAWN_ENEMY) {
          enemies.push({
            id: eId++, spawnX: tx, spawnY: ty,
            patrolLeft:  Math.max(0, tx - 6),
            patrolRight: Math.min(COLS - 1, tx + 6)
          });
          tiles[ty][tx] = TILE.EMPTY;
        }
      }
    }

    const json = {
      $schema: 'loderunner-level-v1',
      meta: {
        id: meta.id ?? 'custom',
        title: meta.title ?? 'Custom Level',
        author: meta.author ?? 'Editor',
        difficulty: meta.difficulty ?? 1,
        ...meta
      },
      dimensions: { cols: COLS, rows: ROWS },
      tiles,
      playerStart: pStart ?? { x: 1, y: 1 },
      enemies,
      gold,
      exitTile: { tx: Math.floor(COLS / 2), ty: 1 }
    };
    return JSON.stringify(json, null, 2);
  }

  // Download as file
  static download(tileMap, meta = {}) {
    const str = EditorIO.serialize(tileMap, meta);
    const blob = new Blob([str], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (meta.id ?? 'level') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Parse JSON string/object → level JSON
  static parse(input) {
    try {
      const json = typeof input === 'string' ? JSON.parse(input) : input;
      if (!json.tiles || !Array.isArray(json.tiles)) throw new Error('Missing tiles');
      if (json.tiles.length !== ROWS || json.tiles[0].length !== COLS)
        throw new Error(`Expected ${COLS}×${ROWS} tile map`);
      return json;
    } catch (e) {
      throw new Error('Invalid level JSON: ' + e.message);
    }
  }

  // Build a blank level JSON
  static blank() {
    const tiles = [];
    for (let ty = 0; ty < ROWS; ty++) {
      const row = [];
      for (let tx = 0; tx < COLS; tx++) {
        if (ty === 0 || ty === ROWS - 1 || tx === 0 || tx === COLS - 1) {
          row.push(TILE.CONCRETE);
        } else if (ty === ROWS - 2) {
          row.push(TILE.BRICK);
        } else {
          row.push(TILE.EMPTY);
        }
      }
      tiles.push(row);
    }
    // Place default player spawn
    tiles[ROWS - 3][2] = TILE.SPAWN_PLAYER;
    return {
      $schema: 'loderunner-level-v1',
      meta: { id: 'custom', title: 'Custom Level', author: 'Editor', difficulty: 1 },
      dimensions: { cols: COLS, rows: ROWS },
      tiles,
      playerStart: { x: 2, y: ROWS - 3 },
      enemies: [],
      gold: [],
      exitTile: { tx: Math.floor(COLS / 2), ty: 1 }
    };
  }
}
