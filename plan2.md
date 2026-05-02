# Lode Runner — Massive Enhancement Plan (plan2.md)

---

## 1. Sprite & Tile Overhaul — Hand-Crafted Pixel Art Atlas

**Current state:** Tiles drawn with `fillRect` primitives. No animation frames. Characters are coloured boxes with minimal detail.

**Enhancement:**

Replace all canvas-primitive drawing with a fully pre-rendered 256-colour sprite atlas (`sprites.png`, 256×256 px). Every tile and character has multiple animation frames baked in.

### Tile sprite sheet layout (each cell 20×20 px)

| Row | Contents |
|-----|----------|
| 0 | BRICK — 4 variants (weathered, cracked, moss-stained, normal) |
| 1 | BRICK dig — 6 animation frames (crack → crumble → hole open) |
| 2 | CONCRETE — 2 variants + 1 damage-flash frame |
| 3 | LADDER — 3 shading variants (top-lit, mid, shadow) |
| 4 | ROPE — 4 sway animation frames |
| 5 | GOLD — 8 spin/sparkle frames (full rotation) |
| 6 | TRAP_BRICK — normal + 1 "shimmer tell" frame |
| 7 | HOLE — 6 close animation frames |
| 8 | EXIT LADDER — 8 glow-pulse frames |
| 9–12 | PLAYER — 16 frames: walk×4, climb×4, dig-L×2, dig-R×2, fall×2, dead×2 |
| 13–16 | ENEMY — 16 frames: walk×4, climb×4, trapped×2, carrying×2, respawn×4 |
| 17 | BG decoration — pipes, rivets, wall cracks, moss |
| 18 | PARTICLE sprites — spark, dust mote, coin glint, blood splat 4×4 px |
| 19 | UI icons — heart, coin, skull, star, key |

**Atlas generation:** A companion script `tools/gen_atlas.js` (runs with Node.js / Deno, no browser needed) draws all sprites programmatically to a Canvas and exports `sprites.png` via `canvas` npm package. Each tile function is a pure function `drawXxx(ctx, x, y, variant, frame)` so sprites are pixel-perfect and reproducible.

**Renderer change:** `drawTile(tile, px, py, frame)` becomes a single `ctx.drawImage(atlas, srcX, srcY, 20, 20, px, py, 20, 20)` call — much faster than multiple `fillRect` calls, removes all the primitive-drawing switch blocks.

---

## 2. Background & Level Theming System

**Current state:** Flat black background, no environment feel.

**Enhancement:**

### Per-level background layers (parallax)

Each level JSON gains a `theme` key:

```json
"theme": {
  "id": "sewer",
  "bgColor":    "#060a0f",
  "brickColor": "#2a4a2a",
  "concreteColor": "#1a3a1a",
  "ladderColor": "#8fbc8f",
  "fogColor":   "#0a150a",
  "parallaxBg": "sewer_bg",
  "ambientLight": "#002200"
}
```

Available themes: **Dungeon** (stone grey), **Sewer** (mossy green), **Factory** (rust orange), **Space Station** (blue-white), **Ancient Temple** (sandstone gold).

### Background rendering layers (drawn before tiles)

1. **Far BG** (scrolls at 0.1× tile speed): tiled repeating texture — stone wall, pipework, stars.
2. **Mid BG** (0.4×): distant arches, vaulted ceilings, stalactites.
3. **Near BG** (0.8×): foreground rubble, hanging vines, steam vents.

These are CSS `background-image` layers on a `<div>` behind both canvases, positioned with `background-position` updated via JS each frame — zero canvas cost.

### Atmospheric effects (canvas overlay, drawn last)

- **Fog ribbons:** 3–5 semi-transparent white rectangles at varying heights, slowly drifting left/right.
- **Torch flicker:** At concrete-wall tiles adjacent to empty space, a small orange glow (radial gradient, 30 px radius, alpha 0.08–0.15) flickers at 3–5 Hz.
- **Drip particles:** Random downward-moving single-pixel water drops from ceiling tiles.
- **Dust motes:** 20 tiny 1×1 px particles floating in Brownian motion.

All atmospheric passes are framerate-capped at 30 fps (drawn every 2 game frames) to keep the budget under 1 ms.

---

## 3. Full CRT / Retro Post-Processing Pipeline

**Current state:** Simple barrel distortion + scanline darkening. Single pass, slow pixel loop.

**Enhancement — WebGL post-process chain:**

Replace the CPU `getImageData` CRT pass with a **WebGL 2 shader pipeline**. The game canvas is used as a texture, and a fullscreen quad renders the post-process chain in < 0.5 ms on any GPU.

### Shader effects (applied in order)

1. **Barrel distortion** — same algorithm but GPU-accelerated, handles sub-pixel sampling.
2. **RGB chromatic aberration** — R/G/B channels sampled at slightly different UV offsets (`±0.001` horizontal), giving a vintage CRT colour bleed on bright edges.
3. **Phosphor bloom** — bright pixels (luminance > 0.6) bleed horizontally by 3 px. Implemented as a 1-D Gaussian blur pass on luminance.
4. **Scanlines** — dynamic: line spacing tied to display scale factor, intensity 0.15–0.25 configurable via settings.
5. **Vignette** — radial gradient darkening at corners, radius and intensity configurable.
6. **Colour grade** — per-channel `gain/lift/gamma` for warm (amber), cold (blue-white), and green (classic phosphor) presets. User-selectable via F3.
7. **Noise grain** — per-frame random noise texture (generated once, scrolled), intensity 0.03.
8. **Phosphor persistence** — previous frame blended at 8% opacity for genuine CRT "ghost" afterglow.

### Settings panel (F3 opens in-game overlay)

```
[CRT ON/OFF]   [PRESET: AMBER / GREEN / COLD / OFF]
BARREL   ████░░  0.12
BLOOM    ███░░░  0.08
SCANLINE ███░░░  0.18
VIGNETTE ████░░  0.40
GRAIN    ██░░░░  0.03
PERSIST  ██░░░░  0.08
```

If WebGL 2 is unavailable, falls back to the current CPU pass.

---

## 4. Character Animation Overhaul

**Current state:** 4-frame walk cycle, 1-frame dig, no death animation, no idle animation.

**Enhancement:**

### Player animation state machine — full 16-frame set

| State | Frames | Duration | Notes |
|-------|--------|----------|-------|
| IDLE | 2 | 1 s breathing | subtle up/down, blink |
| WALK | 6 | 10-frame loop | arm swing, leg pump |
| CLIMB | 8 | 12-frame loop | hand-over-hand |
| FALL | 3 | hold last frame | arms flail |
| DIG_LEFT | 5 | 14 frames total | wind-up → strike → recoil |
| DIG_RIGHT | 5 | 14 frames total | mirror of above |
| DEAD | 8 | 60 frames | crumple → dissolve → stars |
| WIN | 6 | loop | fist-pump celebration |

### Enemy animation state machine

| State | Frames | Notes |
|-------|--------|-------|
| WALK | 6 | slightly twitchy, menacing |
| CLIMB | 6 | |
| TRAPPED | 4 | struggling, arms flailing |
| CARRYING | 6 | walk with gold bag on head |
| RESPAWN | 8 | materialise from static |
| ALERTED | 3 | "!" pop when first seeing player |

### Smooth sub-tile interpolation

Entities render at **interpolated pixel positions** using the game loop's `alpha` value: `renderX = prevX + (x - prevX) * alpha`. Eliminates all visible jitter at 60 fps.

### Character shadow

A 10×4 px elliptical semi-transparent dark oval (alpha 0.35) renders 2 px below each entity. Scale to 1.0 when on ground, 0.6 when 1 tile above floor, fades out at distance > 3 tiles.

---

## 5. Gold & Collectibles Visual System

**Current state:** Static spinning diamond drawn with `beginPath` every frame.

**Enhancement:**

### Gold piece rendering

- 8-frame spin animation from atlas row 5.
- On collection: burst into 8 individual `GoldParticle` objects flying outward in a star pattern, each rotating and fading over 25 frames.
- **Score popup:** `+250` floats upward from collection point, yellow text with black outline, fades over 40 frames.
- **Combo multiplier:** Collecting gold within 2 seconds of the previous one shows `×2`, `×3`, etc. in increasing font size.
- **Last gold sparkle:** When one gold piece remains, it pulses with a white halo every 30 frames.

### Gold counter HUD element

A row of small gold-coin icons fills as gold is collected. Each coin `pops` (scale 1.5 → 1.0 over 8 frames) when collected.

---

## 6. Digging & Hole System Visual Upgrade

**Current state:** Hole opens in 3 linear stages. No dirt particles.

**Enhancement:**

### Dig animation — 6-stage brick crumble

- Frame 0: Brick intact.
- Frame 1: Crack appears diagonally across brick face.
- Frame 2: Crack widens, dust particles (4) emitted.
- Frame 3: Upper half crumbles, 6 small brick-fragment particles fly left.
- Frame 4: Lower half falls, dark void visible.
- Frame 5: Fully open hole — smooth dark interior with subtle depth shading.

Total dig animation: 14 frames (same as current `DIG_FRAMES`).

### Hole closing animation — 6-stage brick regeneration

- Reverse of crumble: bricks appear to "grow back" from the sides.
- If an enemy is in the hole when closing begins: enemy flashes red, gets trapped regardless of position.
- Closing bricks emit a short rumble screen-shake (intensity 1, 4 frames).

### Hole interior depth effect

Inside an open hole, 3 scanlines of progressively darker colour give an illusion of depth. Enemies at the bottom of a hole are rendered in shadow (global alpha 0.7).

---

## 7. HUD — Complete Redesign

**Current state:** Single bottom bar with text labels. No visual hierarchy.

**Enhancement:**

### Layout (28-px tall HUD bar at bottom)

```
┌──────────────────────────────────────────────────────────────────┐
│ [skull×3] LIVES  │  ●●●●●●●●●●●●  GOLD 12/12  │  SCORE 0012400 │
│  [heart icons]   │  [coin icons fill L→R]       │  [tick-up anim]│
└──────────────────────────────────────────────────────────────────┘
```

- **Lives:** Skull icons (not text). Lose a life → skull shatters into 4 fragments (particle burst), remaining skulls slide left.
- **Gold tracker:** Row of tiny coin silhouettes. Each collected coin icon fills gold (colour change + pop animation). Shows `12/12` numeric alongside.
- **Score:** Right-aligned, always 7 digits padded. Ticks upward at 15 pts/frame. New high-score indicator (`★ HI`) replaces static text when beaten.
- **Level name:** Faint watermark text centred in gameplay area on level entry, fades out after 90 frames.

### Level transition banner

Full-width animated banner slides in from left over 20 frames on level start:

```
┌──────────────────────────────────┐
│  LEVEL 02 — THE LABYRINTH        │
│  ★★☆  INTERMEDIATE               │
└──────────────────────────────────┘
```

Slides out after 60 frames. Uses CSS animation (`transform: translateX`) so it costs zero canvas draw time.

### Combo/message system overhaul

- Messages pop at the position of the triggering event (not centre-screen).
- Stack multiple messages: each new one pushes the previous one up.
- Font size scales with importance: `+250` small, `COMBO ×4!` large, `LEVEL COMPLETE!` huge.

---

## 8. Main Menu — Cinematic Redesign

**Current state:** Falling-tile rain behind text. No animation depth.

**Enhancement:**

### Full animated demo scene

A pre-scripted replay of a level runs behind the menu (ghost rendering — player and enemies at 50% alpha). The replay loops every 30 seconds. This shows real gameplay and is far more attractive than the tile rain.

### Title treatment

- "LODE RUNNER" rendered in 24 px Press Start 2P with a 4-px thick pixel-border (drawn in 8 directions with dark colour first, then bright on top).
- Title has a **scanline animation:** a bright horizontal band sweeps top-to-bottom every 2 seconds (CSS `@keyframes`, zero JS cost).
- Subtitle "THE CLASSIC REBORN" in 7 px with a left-to-right reveal wipe using `clip-path` on load.

### Menu item interaction

- Selected item: yellow with `►` arrow + glow (`text-shadow: 0 0 8px #ffd700`).
- Hovering animates the arrow with a 3-frame bounce.
- Item selection plays a satisfying tick sound (`_playTick`).
- Selecting START GAME plays a rising arpeggio over the wipe transition.

### Settings submenu

New fourth menu item "SETTINGS" opens a submenu:

```
  MUSIC     [████████░░]  80%
  SFX       [██████░░░░]  60%
  CRT       [AMBER ▾]
  CONTROLS  [KEYBOARD ▾]   (future: gamepad)
  BACK
```

Settings persist to `localStorage`.

---

## 9. Gameplay Enhancements

### 9a. Gold multiplier chain

Collecting gold pieces within a 90-frame (1.5 s) window chains a multiplier: 1×, 1.5×, 2×, 3×. The chain resets on any non-collection frame. Multiplier shown as a floating badge that pulses and fades.

### 9b. Enemy intelligence tiers

Each level assigns enemy AI tiers via the JSON:

```json
"enemies": [
  { "id": 0, "tier": 1, ... },   // Dumb: patrol only, no BFS
  { "id": 1, "tier": 2, ... },   // Normal: BFS chase in range
  { "id": 2, "tier": 3, ... }    // Elite: anticipates player movement (1-step lookahead)
]
```

**Tier 3 (Elite):** Instead of chasing the player's current tile, BFS targets where the player will be in 10 frames based on current velocity. Wears a visual indicator (red headband → gold headband for elite).

### 9c. Trap scoring escalation

Trapping enemies in the same session earns escalating bonus:
- 1st trap: 75 pts
- 2nd: 150 pts
- 3rd: 300 pts
- 4th+: 600 pts (max)

A "TRAP MASTER!" message plays for 4+ consecutive traps.

### 9d. Time bonus

Each level has an optional `timeLimit` (seconds). Timer counts down in the HUD. Beat the level before it expires: `+timeRemaining × 10` pts. Timer bar replaces the gold tracker when active — dramatic red flashing below 20 s.

### 9e. Power-ups (rare floor tiles)

Three new tile types (types 11–13), placed sparingly in hard levels:

| Type | Appearance | Effect |
|------|-----------|--------|
| 11 | Blue flask | **SPEED BOOST** — 2× walk/climb speed for 8 seconds |
| 12 | Green flask | **DIG FRENZY** — unlimited dig without floor restriction for 5 s |
| 13 | Red flask | **FREEZE** — all enemies freeze for 4 seconds |

Power-up tiles glow with a colour-matched halo and pulse at 2 Hz.

### 9f. Secret rooms

One per level (optional): a `secretRoom` JSON key defines a hidden area behind a TRAP_BRICK wall. Entering it reveals `SECRET ROOM!` message and awards `+1000` pts. Walls flash briefly to hint at the room's existence when the player is within 3 tiles.

### 9g. Lives and checkpoint system

- Player starts with 5 lives (up from 3).
- After dying on a level 3+ times, a **CHECKPOINT** appears: a golden flag at the last safe ground position. On next death, player respawns at checkpoint instead of level start.
- Checkpoints are visual landmarks drawn in the tile layer (flag sprite from atlas).

### 9h. Enemy reaction to digging

When a player digs within 3 tiles of an enemy, that enemy enters an **ALERTED** state for 2 seconds: moves 30% faster and prioritises the player's position over patrol waypoints. Shows a `!` pop above their head.

---

## 10. Level Editor — Major UX Upgrade

### 10a. Multi-select and fill

- **Drag-select box:** hold `Shift` and drag to select a rectangular region. Selected tiles shown with dashed yellow border.
- **Flood fill:** press `F` to flood-fill the selected type from the cursor position.
- **Rectangle fill:** press `R` to fill the selected rectangle with the current tile.
- **Copy/paste:** `Ctrl+C` copies selection, `Ctrl+V` pastes at cursor position.

### 10b. Undo / Redo stack

- 50-deep undo stack. Every `placeTile` call pushes a delta `{ tx, ty, prev, next }`.
- `Ctrl+Z` / `Ctrl+Y` undo/redo.
- Stack depth shown as `↩ 12` in the toolbar.

### 10c. Level metadata panel

Sidebar section below the palette:

```
TITLE:   [______________]
THEME:   [DUNGEON ▾]
TIME:    [∞ / 60 / 90 / 120]
DIFFICULTY: [★★★]
ENEMIES: FAST [■■■□□]
```

All fields live-update the JSON. Theme changes immediately recolours the editor preview.

### 10d. Playability validator

Before saving or play-testing, the editor runs a validation pass:

- **Player spawn check:** exactly one `SPAWN_PLAYER` tile exists.
- **Gold reachability:** BFS from player spawn — can all gold pieces be reached?
- **Enemy spawn check:** no enemy spawns inside solid tiles.
- **Exit reachability:** is the exit tile reachable after all gold collected?

Validation result shown as a coloured status bar:

```
✓ VALID — 12 gold reachable, exit reachable, 2 enemies placed
⚠ WARNING — enemy #1 spawn unreachable from floor
✗ ERROR — no player spawn placed
```

### 10e. Minimap

A 56×40 px thumbnail in the sidebar (2× scaled-down, 1 px per 2 tiles) shows the full level at a glance. Current cursor position shown as a white dot.

### 10f. Level pack manager

New screen (accessible from menu): shows a list of saved levels in `localStorage` (key `loderunner_packs`). Drag-to-reorder, play any level directly, export all as a `.json` bundle.

---

## Implementation Priority Order

```
Phase 1 — Quick wins (visual impact, low effort)
  ├─ Gold spin atlas + collection burst particles       (1 day)
  ├─ HUD redesign: coin icons, skull lives, level banner (1 day)
  ├─ Menu cinematic demo scene + title glow             (1 day)
  └─ Combo multiplier chain                            (0.5 day)

Phase 2 — Core graphics upgrade
  ├─ tools/gen_atlas.js sprite sheet generator          (2 days)
  ├─ Renderer: switch to atlas drawImage pipeline       (1 day)
  ├─ Character smooth interpolation + shadow           (1 day)
  └─ 6-stage dig crumble + hole depth effect           (1 day)

Phase 3 — CRT / post-process
  ├─ WebGL 2 post-process chain (bloom, aberration,    (3 days)
  │   persistence, colour grade)
  └─ F3 settings overlay                               (0.5 day)

Phase 4 — Gameplay depth
  ├─ Enemy AI tiers (tier 1/2/3 + visual indicators)   (1 day)
  ├─ Time bonus system                                 (0.5 day)
  ├─ Power-ups (3 types)                               (1.5 day)
  ├─ Checkpoint system                                 (1 day)
  └─ Trap scoring escalation                           (0.5 day)

Phase 5 — Level editor upgrade
  ├─ Undo/redo stack                                   (1 day)
  ├─ Multi-select + fill tools                         (1.5 day)
  ├─ Playability validator                             (1 day)
  └─ Minimap + level pack manager                      (1.5 day)

Phase 6 — Background & atmosphere
  ├─ Theme system + per-theme palettes                 (1 day)
  ├─ CSS parallax background layers                    (1 day)
  └─ Atmospheric particles (fog, drip, motes, torches) (1.5 day)
```

**Total estimated effort:** ~28 developer-days for full implementation.
All changes are backwards-compatible with existing level JSON format — only additive new fields required.
