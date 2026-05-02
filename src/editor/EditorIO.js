import { TILE, COLS, ROWS } from '../constants.js';

export default class EditorIO {
  // Serialize tileMap + metadata to JSON string
  static serialize(tileMap, meta = {}) {
    const tiles = tileMap.toArray();
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
            patrolRight: Math.min(COLS - 1, tx + 6),
            tier: 2,
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
      theme: meta.theme ?? 'dungeon',
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
    // Run validation before saving
    const result = EditorIO.validate(JSON.parse(str));
    if (result.warnings.length > 0) {
      const proceed = confirm('Validation warnings:\n' + result.warnings.join('\n') + '\n\nSave anyway?');
      if (!proceed) return;
    }
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

  /**
   * BFS reachability validator.
   * Checks:
   * 1. Player spawn exists
   * 2. Exit tile exists
   * 3. All gold reachable from player spawn
   * 4. Exit reachable after collecting all gold
   * Returns { errors: string[], warnings: string[] }
   */
  static validate(json) {
    const errors = [];
    const warnings = [];

    if (!json.playerStart) {
      errors.push('No player spawn placed.');
    }
    if (!json.exitTile) {
      warnings.push('No exit tile defined.');
    }
    if (!json.gold || json.gold.length === 0) {
      warnings.push('No gold pieces placed.');
    }

    if (!json.playerStart) return { errors, warnings };

    const tiles = json.tiles;
    const isPassable = (tx, ty) => {
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return false;
      const t = tiles[ty][tx];
      return t !== TILE.BRICK && t !== TILE.CONCRETE && t !== TILE.TRAP_BRICK;
    };
    const isSolid = (tx, ty) => {
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return true;
      const t = tiles[ty][tx];
      return t === TILE.BRICK || t === TILE.CONCRETE;
    };
    const isLadder = (tx, ty) => {
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return false;
      return tiles[ty][tx] === TILE.LADDER;
    };
    const isRope = (tx, ty) => {
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return false;
      return tiles[ty][tx] === TILE.ROPE;
    };

    // BFS that respects movement rules
    const reach = (startX, startY) => {
      const visited = new Set();
      const queue = [[startX, startY]];
      const key = (x, y) => x * 100 + y;
      visited.add(key(startX, startY));

      while (queue.length) {
        const [cx, cy] = queue.shift();
        const neighbors = [];

        // Walk left/right on floor/rope
        const onRope = isRope(cx, cy);
        const onLadder = isLadder(cx, cy);
        const hasFloor = isSolid(cx, cy + 1);
        const supported = onRope || onLadder || hasFloor;

        if (supported || onRope) {
          if (isPassable(cx - 1, cy)) neighbors.push([cx - 1, cy]);
          if (isPassable(cx + 1, cy)) neighbors.push([cx + 1, cy]);
        }
        // Climb ladder
        if (onLadder) {
          if (isPassable(cx, cy - 1)) neighbors.push([cx, cy - 1]);
          if (isPassable(cx, cy + 1)) neighbors.push([cx, cy + 1]);
        }
        // Enter ladder below
        if (isLadder(cx, cy + 1)) {
          neighbors.push([cx, cy + 1]);
        }
        // Fall
        if (!hasFloor && !onLadder && !onRope && isPassable(cx, cy + 1)) {
          neighbors.push([cx, cy + 1]);
        }

        for (const [nx, ny] of neighbors) {
          const k = key(nx, ny);
          if (!visited.has(k)) {
            visited.add(k);
            queue.push([nx, ny]);
          }
        }
      }
      return visited;
    };

    const ps = json.playerStart;
    const reachable = reach(ps.x, ps.y);
    const key = (x, y) => x * 100 + y;

    // Check gold reachability
    let unreachableGold = 0;
    for (const g of json.gold ?? []) {
      if (!reachable.has(key(g.x, g.y))) unreachableGold++;
    }
    if (unreachableGold > 0) {
      warnings.push(`${unreachableGold} gold piece(s) may be unreachable.`);
    }

    // Check exit reachability
    if (json.exitTile) {
      const { tx, ty } = json.exitTile;
      if (!reachable.has(key(tx, ty))) {
        errors.push('Exit tile is not reachable from player spawn.');
      }
    }

    return { errors, warnings };
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
    tiles[ROWS - 3][2] = TILE.SPAWN_PLAYER;
    return {
      $schema: 'loderunner-level-v1',
      meta: { id: 'custom', title: 'Custom Level', author: 'Editor', difficulty: 1 },
      dimensions: { cols: COLS, rows: ROWS },
      theme: 'dungeon',
      tiles,
      playerStart: { x: 2, y: ROWS - 3 },
      enemies: [],
      gold: [],
      exitTile: { tx: Math.floor(COLS / 2), ty: 1 }
    };
  }
}
