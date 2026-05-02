# Lode Runner Clone — Complete 10-Step Implementation Plan

---

## Step 1: Project Architecture and File Structure

### Directory Layout

```
loderunner/
├── index.html
├── style.css
├── assets/
│   ├── fonts/
│   │   └── press-start-2p.woff2
│   └── sounds/
│       ├── dig.wav
│       ├── fall.wav
│       ├── collect.wav
│       ├── death.wav
│       ├── levelcomplete.wav
│       └── bgm.wav
├── src/
│   ├── main.js                  # Entry point, bootstraps App
│   ├── app.js                   # Top-level state machine (MENU, PLAYING, EDITOR, GAMEOVER)
│   ├── constants.js             # All magic numbers, enums, tile types
│   ├── engine/
│   │   ├── GameLoop.js          # requestAnimationFrame loop, fixed timestep
│   │   ├── Renderer.js          # Canvas pipeline, CRT shader, post-process
│   │   ├── InputManager.js      # Keyboard + gamepad polling
│   │   ├── AudioManager.js      # Web Audio API wrapper
│   │   ├── AssetLoader.js       # Font/sound preloading promises
│   │   └── ParticleSystem.js    # Pooled particles, emitters
│   ├── game/
│   │   ├── Game.js              # Orchestrates level, player, enemies, HUD
│   │   ├── Level.js             # Tile map, collision queries, hole timers
│   │   ├── TileMap.js           # 2D array operations, neighbor queries
│   │   ├── Player.js            # State machine, movement, dig actions
│   │   ├── Enemy.js             # AI state machine, pathfinding
│   │   ├── Pathfinder.js        # BFS graph on tile map
│   │   ├── GoldPiece.js         # Collectible entity
│   │   └── HUD.js               # Score, lives, level display
│   ├── editor/
│   │   ├── Editor.js            # Main editor controller
│   │   ├── EditorRenderer.js    # Grid overlay, hover highlights
│   │   ├── Palette.js           # Tile selector sidebar
│   │   └── EditorIO.js          # JSON serialize/deserialize, download/upload
│   ├── ui/
│   │   ├── Menu.js              # Main menu with animated tiles
│   │   ├── HighScores.js        # LocalStorage read/write, sorted display
│   │   ├── Transitions.js       # Wipe, flash, dissolve effects
│   │   └── Screen.js            # Generic screen base class
│   └── levels/
│       ├── level1.json
│       ├── level2.json
│       └── level3.json
```

### Module Dependency Graph (top-down)

```
main.js
  └─ app.js
       ├─ engine/* (shared singletons)
       ├─ ui/* (screens)
       ├─ game/Game.js
       │    ├─ Level.js → TileMap.js
       │    ├─ Player.js → constants.js
       │    ├─ Enemy.js → Pathfinder.js → TileMap.js
       │    ├─ HUD.js
       │    └─ GoldPiece.js
       └─ editor/Editor.js
            ├─ EditorRenderer.js
            ├─ Palette.js
            └─ EditorIO.js
```

No build tool required. All modules use native ES Modules (`type="module"`). A single `<script type="module" src="src/main.js">` in `index.html` suffices.

---

## Step 2: Retro Pixel-Art Graphics System

### CSS Design Tokens (`style.css`)

```css
:root {
  /* Color palette — Commodore 64 inspired */
  --c64-black:       #000000;
  --c64-white:       #ffffff;
  --c64-red:         #883932;
  --c64-cyan:        #67b6bd;
  --c64-purple:      #8b3f96;
  --c64-green:       #55a049;
  --c64-blue:        #40318d;
  --c64-yellow:      #bfce72;
  --c64-orange:      #8b5429;
  --c64-brown:       #574200;
  --c64-lightred:    #b86962;
  --c64-darkgrey:    #505050;
  --c64-midgrey:     #787878;
  --c64-lightgreen:  #94e089;
  --c64-lightblue:   #7869c4;
  --c64-lightgrey:   #9f9f9f;

  /* Layout */
  --canvas-width:    560px;   /* 28 tiles × 20px */
  --canvas-height:   400px;   /* 20 tiles × 20px */
  --tile-size:       20px;
  --ui-font:         'Press Start 2P', monospace;

  /* CRT aesthetic */
  --crt-curvature:   0.15;
  --crt-scanline-opacity: 0.18;
  --crt-vignette-size: 60%;
  --crt-glow-color:  rgba(0, 255, 80, 0.12);
  --scanline-height: 2px;

  /* Timing */
  --transition-flash: 80ms;
  --transition-wipe:  400ms;
}
```

### Canvas Rendering Pipeline (`Renderer.js`)

The renderer maintains two `<canvas>` elements:

1. **gameCanvas** (560×400) — game scene drawn each frame
2. **crtCanvas** (560×400) — post-processed output displayed to user

Each frame proceeds in the following order:

```
[1]  Clear gameCanvas (fillRect black)
[2]  Draw tile layer         → TileMap.render(ctx)
[3]  Draw gold pieces        → GoldPiece.render(ctx)
[4]  Draw player             → Player.render(ctx)
[5]  Draw enemies            → Enemy[].render(ctx)
[6]  Draw particles          → ParticleSystem.render(ctx)
[7]  Draw hole regeneration overlay (semi-transparent brick fill)
[8]  Copy gameCanvas → crtCanvas via drawImage
[9]  Apply CRT post-process shader (fragment operations via ImageData)
[10] Draw scanlines overlay (CSS ::after pseudo-element, not canvas)
[11] Draw vignette (radial gradient composited on crtCanvas)
```

### CRT Shader (pure JS, `Renderer.js`)

Applied every frame via `getImageData` / `putImageData` on the crtCanvas:

```
For each pixel (x, y):
  1. Compute barrel distortion UV:
       uv = (x/W - 0.5, y/H - 0.5)
       r2 = dot(uv, uv)
       uv_dist = uv * (1 + curvature * r2)
       sx = (uv_dist.x + 0.5) * W
       sy = (uv_dist.y + 0.5) * H
  2. If sx/sy out of bounds → write black pixel
  3. Sample nearest-neighbor from gameCanvas pixel at (floor(sx), floor(sy))
  4. Apply phosphor bloom: R channel += 8, G channel += 16 (green CRT tint)
  5. Apply scanline darkening: if (y % 2 == 0) multiply RGB by 0.82
  6. Clamp all channels to [0, 255]
```

The CRT pass is toggled by a `crtEnabled` flag (default true, toggle with F2).

### Sprite Sheet Approach

A single `sprites.png` (160×40) contains 8 tile sprites at 20×20px each in a horizontal strip. Tile indices map to `sx = tileId * 20`. All sprites are hand-designed using a 20×20 pixel grid with the C64 palette. Sprites are drawn with `ctx.imageSmoothingEnabled = false` to preserve pixel crispness.

---

## Step 3: Core Game Engine

### Fixed-Timestep Game Loop (`GameLoop.js`)

```
FIXED_DT = 1/60 seconds (16.667 ms)
MAX_FRAME_SKIP = 5

loop(timestamp):
  elapsed = timestamp - lastTimestamp
  lastTimestamp = timestamp
  accumulator += elapsed

  steps = 0
  while accumulator >= FIXED_DT and steps < MAX_FRAME_SKIP:
    game.update(FIXED_DT)
    accumulator -= FIXED_DT
    steps++

  alpha = accumulator / FIXED_DT   (for interpolation)
  renderer.render(alpha)
  requestAnimationFrame(loop)
```

This decouples simulation from rendering, ensuring physics runs at exactly 60 Hz regardless of display refresh rate.

### Physics Model

Physics operates in **tile-space** with sub-tile pixel offsets:

- Each entity has `{tileX, tileY, pixelOffsetX, pixelOffsetY}`.
- Movement is quantized: per update tick, entities move at most 1 tile (20px).
- Gravity applies only when the tile directly below is empty (no floor, no ladder).
- Fall speed = 1 tile per 2 frames (10px/frame). This produces smooth visible descent.
- Horizontal speed = 1 tile per 3 frames.
- Climb speed (ladder) = 1 tile per 4 frames.

### Collision Detection (`TileMap.js`)

All collision is tile-based (AABB against tile grid, no continuous sweep):

```
function isSolid(tileX, tileY):
  tile = getTile(tileX, tileY)
  return tile in [BRICK, CONCRETE, LADDER_TOP]

function hasFloor(entity):
  foot_tileY = floor((entity.pixelY + 20) / TILE_SIZE)
  return isSolid(entity.tileX, foot_tileY)

function canMoveLeft(entity):
  return not isSolid(entity.tileX - 1, entity.tileY)

function canMoveRight(entity):
  return not isSolid(entity.tileX + 1, entity.tileY)

function isOnLadder(entity):
  return getTile(entity.tileX, entity.tileY) in [LADDER, LADDER_TOP]
```

Entities are blocked from entering solid tiles. No subpixel overlap is allowed — if a move would cross a solid tile boundary the entity is snapped to the tile edge.

---

## Step 4: Player Mechanics

### Keyboard Controls (`InputManager.js`)

| Action         | Primary Key  | Alternate Key  |
|----------------|-------------|----------------|
| Move Left      | Arrow Left   | A              |
| Move Right     | Arrow Right  | D              |
| Climb Up       | Arrow Up     | W              |
| Climb Down     | Arrow Down   | S              |
| Dig Left       | Z            | ,              |
| Dig Right      | X            | .              |
| Pause          | Escape       | P              |
| Toggle CRT     | F2           | —              |

`InputManager` polls `keydown`/`keyup` events into a `Set<string>`. Each frame, `isHeld(key)` and `isPressed(key)` (rising edge) are available.

### Player State Machine (`Player.js`)

States:

```
IDLE → WALK_LEFT | WALK_RIGHT | CLIMB_UP | CLIMB_DOWN | FALL | DIG_LEFT | DIG_RIGHT | DEAD
WALK_* → IDLE | FALL | CLIMB_*
CLIMB_* → IDLE | FALL
FALL → IDLE (on landing) | DEAD (if fell into enemy)
DIG_* → IDLE (after dig animation completes, ~12 frames)
DEAD → (triggers Game.onPlayerDeath after 60-frame death animation)
```

### Digging Logic

1. Player presses Dig Left: checks tile at `(tileX - 1, tileY + 1)` — must be `BRICK`.
2. If valid: sets tile to `HOLE`, starts `holeTimer[tileX-1][tileY+1] = 240` frames (4 seconds).
3. Hole visually animates in 3 stages (frames 0–4: partial, 5–8: open, 9+: full open).
4. After timer expires: hole re-closes in reverse 3-stage animation (24 frames).
5. Any entity inside a closing hole is instantly killed (player = death, enemy = trapped then killed).

### Falling Through Holes

- When player stands on a `HOLE` tile, gravity acts immediately.
- During fall, horizontal input is ignored (authentic to original).
- Landing on a solid tile or ladder stops fall, plays land sound, emits 3 dust particles.

---

## Step 5: Enemy AI

### Enemy State Machine (`Enemy.js`)

States:

```
PATROL → CHASE (player enters 12-tile Manhattan range)
CHASE → PATROL (player exits 20-tile range or enemy loses path)
CHASE → TRAPPED (enemy falls into hole)
TRAPPED → RESPAWN (after 180 frames in hole)
RESPAWN → PATROL (teleport to spawn point)
```

### Pathfinding Algorithm (`Pathfinder.js`)

BFS on the tile graph, recomputed every 30 frames per enemy (not every frame):

```
buildGraph(tileMap):
  nodes = all non-solid tiles
  edges:
    - horizontal: left/right neighbors if both tiles are walkable
    - ladder up/down: if current tile is LADDER, connect to tile above/below
    - fall: if no floor below, connect downward up to MAX_FALL_HEIGHT=6 tiles
    - NOTE: enemies cannot dig, so BRICK is never traversable

findPath(start, goal):
  frontier = Queue([start])
  cameFrom = {start: null}
  while frontier not empty:
    current = frontier.dequeue()
    if current == goal: break
    for neighbor in graph.neighbors(current):
      if neighbor not in cameFrom:
        cameFrom[neighbor] = current
        frontier.enqueue(neighbor)
  return reconstruct_path(cameFrom, goal)  // returns list of tile coords
```

The enemy follows the first step in the returned path each movement cycle. If `findPath` returns null (player unreachable), enemy enters `PATROL` mode and walks left/right, reversing on walls.

### Gold Carrying

When an enemy walks over a gold piece:
- Gold is removed from the map; enemy enters `CARRYING` substate.
- While carrying, enemy moves toward its patrol waypoint, not the player.
- On `RESPAWN`, the gold is dropped at a random walkable tile.
- This is the authentic Lode Runner mechanic that forces varied strategies.

### Respawn

On respawn, enemy's pixel position is set to its designated spawn tile (stored in level JSON as `spawnX, spawnY`). A 30-frame "materialize" animation plays (flashing sprite before becoming solid/harmful).

---

## Step 6: Level System

### Tile Type Enumeration (`constants.js`)

```javascript
export const TILE = {
  EMPTY:        0,   // Air — no collision, transparent
  BRICK:        1,   // Diggable — solid, can be tunneled by player
  CONCRETE:     2,   // Indestructible — solid, cannot be dug
  LADDER:       3,   // Climbable — passable horizontally, climb vertically
  LADDER_TOP:   4,   // Top rung — stands on top, can climb down onto it
  ROPE:         5,   // Horizontal bar — hang and traverse left/right
  TRAP_BRICK:   6,   // Looks like EMPTY, acts like BRICK on first contact
  GOLD:         7,   // Collectable — placed in map, converted to GoldPiece entity
  SPAWN_PLAYER: 8,   // Editor-only marker — converted to player start at load
  SPAWN_ENEMY:  9,   // Editor-only marker — converted to enemy spawn at load
  HOLE:         10,  // Runtime-only — created by digging, not stored in JSON
};
```

### JSON Level Format

```json
{
  "$schema": "loderunner-level-v1",
  "meta": {
    "id": "level1",
    "title": "The Vault",
    "author": "Dev",
    "difficulty": 1,
    "timeLimit": null,
    "bgColor": "#000000",
    "brickColor": "#883932",
    "ladderColor": "#bfce72"
  },
  "dimensions": {
    "cols": 28,
    "rows": 20
  },
  "tiles": [
    [2,2,2,2,2,...],   // row 0 (top), 28 values
    [2,0,0,0,0,...],   // row 1
    ...                // 20 rows total
  ],
  "playerStart": { "x": 5, "y": 15 },
  "enemies": [
    { "id": 0, "spawnX": 22, "spawnY": 3, "patrolLeft": 18, "patrolRight": 26 },
    { "id": 1, "spawnX": 10, "spawnY": 8, "patrolLeft": 6,  "patrolRight": 14 }
  ],
  "gold": [
    { "x": 3, "y": 10 },
    { "x": 7, "y": 10 }
  ],
  "totalGold": 12
}
```

### Level Loading (`Level.js`)

1. `fetch('levels/level1.json')` → parse JSON.
2. Validate schema version and dimensions.
3. Build `TileMap` from `tiles` array.
4. Iterate tiles looking for `GOLD` (type 7): create `GoldPiece` entity, replace tile with `EMPTY`.
5. `playerStart` → sets `Player.tileX/Y`.
6. `enemies` array → instantiate `Enemy` objects with patrol bounds.
7. Subscribe hole timers to `Level.update()`.

---

## Step 7: Level Editor

### Editor Layout

The editor shares the same canvas as the game, rendered by `EditorRenderer.js`. The HTML DOM sidebar (`.editor-sidebar`) is shown/hidden via CSS class toggle.

```
┌─────────────────────────────────────┐
│  [canvas 560×400]   │ [sidebar 180px]│
│                     │  Tile Palette  │
│  Grid overlay       │  ──────────    │
│  Hover highlight    │  [EMPTY]       │
│  Click to place     │  [BRICK]       │
│                     │  [CONCRETE]    │
│                     │  [LADDER]      │
│                     │  [ROPE]        │
│                     │  [GOLD]        │
│                     │  [SPAWN_PLAYER]│
│                     │  [SPAWN_ENEMY] │
│                     │  ──────────    │
│                     │  [Save JSON]   │
│                     │  [Load JSON]   │
│                     │  [Play Test]   │
│                     │  [Clear All]   │
└─────────────────────────────────────┘
```

### Tile Placement (`Editor.js`)

```
onMouseMove(e):
  {tileX, tileY} = screenToTile(e.offsetX, e.offsetY)
  hoverTile = {tileX, tileY}

onMouseDown(e):
  if e.button == 0: placeTile(hoverTile, selectedTileType)
  if e.button == 2: placeTile(hoverTile, TILE.EMPTY)   // right-click erases

onMouseMove with button held (drag):
  placeTile(hoverTile, selectedTileType)  // paint mode

placeTile(pos, type):
  validate: only one SPAWN_PLAYER allowed
  tileMap.set(pos.tileX, pos.tileY, type)
  editorRenderer.markDirty()
```

### JSON Save/Load (`EditorIO.js`)

**Save:** Serialize current `TileMap` to JSON string matching the level schema. Use `URL.createObjectURL(new Blob([json], {type:'application/json'}))` and programmatically click a hidden `<a download>` element.

**Load:** Hidden `<input type="file" accept=".json">` element. On change, `FileReader.readAsText()` → parse → validate schema → hydrate editor's `TileMap`.

**Play Test:** Serializes current map, passes the JSON object directly to `Game.loadLevel()` without writing to disk, then switches `App` state to `PLAYING`.

---

## Step 8: UI/UX Design

### Screen Architecture (`app.js`)

App manages a stack of screens:

```
AppState:
  LOADING    → AssetLoader promise → MENU
  MENU       → user starts game → PLAYING
  PLAYING    → level complete → LEVEL_CLEAR → next level or MENU
  PLAYING    → player dies → GAME_OVER → MENU
  PLAYING    → pause → PAUSED → PLAYING
  MENU       → editor → EDITOR
  EDITOR     → play test → PLAYING (test mode)
```

### Main Menu (`Menu.js`)

- Animated background: tiles randomly fall from top of canvas, matching the game's tile-fall physics.
- Title "LODE RUNNER" drawn in 8×8 pixel font with a 2px yellow drop shadow.
- Menu items blink at 500ms interval using a CSS animation (`@keyframes blink`).
- A horizontally-scrolling demo-play scene runs behind the menu (ghost player patrolling).

### HUD (`HUD.js`)

Rendered on-canvas (not DOM) at `y = canvas.height - 20px`:

```
┌────────────────────────────────────────┐
│ SCORE: 0001240   LIVES: ♥♥♥   LVL: 03 │
└────────────────────────────────────────┘
```

Score increments with a "tick-up" animation (adds 10 per frame until target reached). Lives are drawn as small player-head sprites. Level flashes for 60 frames on entry.

### Transitions (`Transitions.js`)

Three effects available:

1. **Flash Wipe** (death): white flash fills screen over 8 frames, then fades out as respawn begins.
2. **Dissolve** (level complete): random tiles are replaced by `#000` pixels frame-by-frame at 200 tiles/frame.
3. **Scan Wipe** (menu to game): a horizontal black bar sweeps top-to-bottom over 400ms.

### High Scores (`HighScores.js`)

Stored in `localStorage` under key `loderunner_scores`. Format:

```json
[
  {"name": "AAA", "score": 45200, "level": 7, "date": "2026-05-01"}
]
```

Maximum 10 entries, sorted descending by score. Entry is added on GAME_OVER if it qualifies. 3-character name entry uses Left/Right to select character, Up/Down to change letter (classic arcade style).

---

## Step 9: Three Challenging Levels

### Level 1 — "The Vault" (Difficulty: Introductory)

**Layout Description (28 cols × 20 rows):**

- Row 0: solid concrete border (full row).
- Rows 1–3: open air platforms. Two floating brick shelves at cols 4–9 and 18–23 at row 4.
- Rows 5–10: central open cavern. A ladder runs from row 5 down to row 14 at col 14.
- Rows 11–13: three-level staircase of bricks (cols 2–6, 8–12, 14–18), each 1 tile high with gaps between.
- Row 14: floor of bricks with 4 gaps. Rope at row 8 spanning cols 3–25.
- Rows 15–18: lower tunnels. Two vertical ladder shafts at cols 6 and 21. Gold pieces buried in brick alcoves.
- Row 19: concrete floor (full row).
- 2 enemies: patrol the staircase (cols 2–18) and the lower tunnel (cols 5–22).
- 12 gold pieces total. Most accessible by digging horizontally.

**Difficulty Mechanics:** Teaches digging (all gold requires at least 1 dig), ladder navigation, and rope traversal. Enemies have slow patrol speeds. No TRAP_BRICK tiles.

---

### Level 2 — "The Labyrinth" (Difficulty: Intermediate)

**Layout Description:**

- Dense brick maze. Outer concrete border plus interior concrete pillars at every 4th column.
- Multiple dead-end corridors that require digging to escape.
- Central room (cols 10–18, rows 7–13): open chamber accessible only via ladder shafts hidden behind TRAP_BRICK walls at cols 9 and 19.
- TRAP_BRICK tiles (type 6) placed at 8 locations — they look like empty air but are solid until stepped on, causing surprise falls into lower corridors.
- Rope network at rows 3, 9, 16 spanning full width.
- 4 enemies: two in upper maze, two in lower tunnels, all with faster patrol speeds than Level 1. BFS recompute every 20 frames (instead of 30).
- 18 gold pieces — several require chaining multiple digs in sequence. Two are behind concrete that can only be reached via a specific fall trajectory.
- Gold piece at row 18, col 14 is only reachable by riding a falling enemy (standing on top of enemy in a shaft).

**Difficulty Mechanics:** TRAP_BRICKs punish exploration. Gold collection order matters. Enemy density creates timing puzzles.

---

### Level 3 — "The Descent" (Difficulty: Expert)

**Layout Description:**

- Vertical emphasis: the level is organized as a shaft descent from row 1 to row 18.
- Left half (cols 0–13): complex lattice of bricks with narrow platforms (1-tile wide).
- Right half (cols 14–27): open vertical shafts with ropes and ladders.
- 6 enemies: all in CHASE mode from start (no patrol range limit), BFS every 15 frames.
- Three "gauntlet corridors" (rows 5, 10, 15): full-width brick rows with only two alternating gaps. Enemies guard these choke points.
- TRAP_BRICK used extensively (14 tiles) — entire bridge at row 7 is TRAP_BRICK; player must figure out safe path.
- 24 gold pieces: 6 embedded in the gauntlet corridors (must dig under active enemies), 8 in the right-side shafts (require precise rope traversal), 10 in the lower labyrinth.
- The final gold piece (row 18, col 27) is surrounded by concrete on three sides; the only approach is a carefully timed diagonal fall while an enemy is trapped in a hole.
- A single ladder at col 27 is the only exit to the "top ladder" (all-gold collection triggers the EXIT_LADDER to appear at top center).

**Difficulty Mechanics:** Enemy density, TRAP_BRICK field, mandatory enemy-trap synergy for final gold, no safe "reset" positions.

---

## Step 10: Polish

### Web Audio API Sound System (`AudioManager.js`)

```javascript
AudioManager:
  ctx = new AudioContext()
  buffers = Map<string, AudioBuffer>

  async load(name, url):
    response = await fetch(url)
    arrayBuffer = await response.arrayBuffer()
    buffers.set(name, await ctx.decodeAudioData(arrayBuffer))

  play(name, options = {volume:1, pitch:1}):
    source = ctx.createBufferSource()
    source.buffer = buffers.get(name)
    source.playbackRate.value = options.pitch
    gainNode = ctx.createGain()
    gainNode.gain.value = options.volume
    source.connect(gainNode)
    gainNode.connect(ctx.destination)
    source.start(0)

  playBGM(name):
    // looping background music with low-pass filter for "muffled" effect
    source.loop = true
    filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 3200  // retro muffled quality
    source → filter → masterGain → ctx.destination
```

Sound events and parameters:

| Event            | Sound File        | Pitch Variation     |
|------------------|-------------------|---------------------|
| Dig              | dig.wav           | random 0.9–1.1      |
| Collect gold     | collect.wav       | +0.1 per chain      |
| Player fall land | fall.wav          | 1.0                 |
| Player death     | death.wav         | 1.0                 |
| Level complete   | levelcomplete.wav | 1.0                 |
| Enemy trapped    | dig.wav           | 0.5 (low thud)      |

### Particle System (`ParticleSystem.js`)

Object pool of 256 `Particle` instances (never allocated after init):

```
Particle properties: x, y, vx, vy, life, maxLife, color, size, active

Emitter types:
  DUST:    4 particles, vy: -0.5 to -1.5, vx: ±1.0, color: var(--c64-lightgrey), life: 18 frames
  SPARK:   8 particles, vy: -2 to -4, vx: ±2, color: var(--c64-yellow), life: 12 frames
  GOLD:    6 particles, vy: -1 to -3, vx: ±1.5, color: var(--c64-yellow), life: 20 frames
  DEATH:   12 particles, radial burst, color: var(--c64-red), life: 30 frames

Render: ctx.fillRect(p.x, p.y, p.size, p.size)
        alpha = p.life / p.maxLife  (fade out)
```

### Screen Shake

`Renderer.js` maintains `shakeX, shakeY` offset applied to the canvas transform:

```
triggerShake(intensity, duration):
  shakeIntensity = intensity   // e.g. 4px for death, 2px for dig
  shakeFrames = duration       // e.g. 20 frames

per-frame:
  if shakeFrames > 0:
    shakeX = (Math.random() - 0.5) * shakeIntensity * 2
    shakeY = (Math.random() - 0.5) * shakeIntensity * 2
    shakeIntensity *= 0.85   // exponential decay
    shakeFrames--
  else:
    shakeX = shakeY = 0

ctx.save()
ctx.translate(shakeX, shakeY)
// ... draw frame ...
ctx.restore()
```

### Responsive Design

The game canvas is scaled to fit the viewport using CSS `transform: scale()`. The scaling factor is computed in JS on `resize` events:

```javascript
const scaleX = window.innerWidth / CANVAS_WIDTH;
const scaleY = window.innerHeight / CANVAS_HEIGHT;
const scale = Math.min(scaleX, scaleY, 3.0);  // max 3× to avoid blur
canvas.style.transform = `scale(${scale})`;
canvas.style.imageRendering = 'pixelated';
```

The outer container uses `display: flex; align-items: center; justify-content: center; background: #000` to letterbox on all screen sizes. On mobile, touch zones (left/right/up/down/dig-left/dig-right) are rendered as semi-transparent button overlays below the canvas.

### Performance Budget

| System           | Target Budget        |
|------------------|----------------------|
| TileMap render   | < 0.5 ms/frame       |
| Enemy BFS (all)  | < 1.0 ms/frame       |
| CRT shader pass  | < 2.0 ms/frame       |
| Particles        | < 0.3 ms/frame       |
| Total frame      | < 10 ms (60fps budget: 16.67 ms) |

The CRT shader is the most expensive pass. If `performance.now()` delta exceeds 13ms for 3 consecutive frames, `crtEnabled` is auto-disabled and a console warning is logged.

---

## Implementation Sequence (Recommended Order)

```
Phase 1 (Foundation):     constants.js → GameLoop.js → InputManager.js → TileMap.js
Phase 2 (Rendering):      Renderer.js (no CRT yet) → basic tile draw → sprites
Phase 3 (Core Entities):  Player.js (full state machine) → Level.js → Game.js
Phase 4 (Enemies):        Enemy.js (basic patrol) → Pathfinder.js → BFS chase
Phase 5 (Levels):         level1.json → level2.json → level3.json → Level loading
Phase 6 (UI):             HUD.js → Menu.js → HighScores.js → Transitions.js
Phase 7 (Editor):         EditorRenderer.js → Palette.js → EditorIO.js → Editor.js
Phase 8 (Audio):          AudioManager.js → wire all sound events
Phase 9 (Polish):         ParticleSystem.js → screen shake → CRT shader → mobile touch
Phase 10 (Integration):   app.js state machine wiring → AssetLoader → index.html final
```

---

### Critical Files for Implementation

- `src/engine/GameLoop.js`
- `src/game/Game.js`
- `src/game/Level.js`
- `src/engine/Renderer.js`
- `src/game/Pathfinder.js`
