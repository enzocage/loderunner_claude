export const TILE_SIZE = 20;
export const COLS = 28;
export const ROWS = 20;
export const CANVAS_W = COLS * TILE_SIZE; // 560
export const CANVAS_H = ROWS * TILE_SIZE; // 400

export const TILE = Object.freeze({
  EMPTY:        0,
  BRICK:        1,
  CONCRETE:     2,
  LADDER:       3,
  ROPE:         5,
  TRAP_BRICK:   6,
  GOLD:         7,
  SPAWN_PLAYER: 8,
  SPAWN_ENEMY:  9,
  HOLE:         10,
  POWER_SPEED:  11,   // Blue flask — 2× speed 8 s
  POWER_DIG:    12,   // Green flask — free dig anywhere 5 s
  POWER_FREEZE: 13,   // Red flask — freeze all enemies 4 s
  CHECKPOINT:   14,   // Runtime flag marker
});

export const WALK_SPEED   = 2;
export const CLIMB_SPEED  = 2;
export const FALL_SPEED   = 4;
export const ENEMY_SPEED  = 1.5;
export const ENEMY_CHASE_SPEED = 2;

export const HOLE_OPEN_FRAMES  = 240;
export const HOLE_CLOSE_FRAMES = 24;
export const DIG_FRAMES   = 14;
export const DEAD_FRAMES  = 60;
export const RESPAWN_FLASH = 30;

export const SCORE = Object.freeze({
  GOLD:           250,
  LEVEL_COMPLETE: 1000,
  TIME_BONUS_PER_SEC: 10,
});

export const TRAP_SCORES = [75, 150, 300, 600]; // escalating per trap session

export const COMBO = Object.freeze({
  WINDOW_FRAMES: 90,                        // 1.5 s chain window
  MULTS: [1, 1, 1.5, 2, 3],               // by combo count index (capped at last)
});

export const AI_TIER = Object.freeze({
  DUMB:   1,   // patrol only, no BFS
  NORMAL: 2,   // BFS chase in range
  ELITE:  3,   // predictive 10-frame lookahead
});

export const POWERUP = Object.freeze({
  SPEED_BOOST_FRAMES: 480,
  DIG_FRENZY_FRAMES:  300,
  FREEZE_FRAMES:      240,
});

export const THEMES = Object.freeze({
  dungeon: {
    bg:'#060810', brick:'#5a3020', concrete:'#404050',
    ladder:'#c8a030', rope:'#806020', fog:'rgba(20,30,60,0.18)',
    ambientR:0, ambientG:0, ambientB:20,
  },
  sewer: {
    bg:'#06100a', brick:'#2a4a2a', concrete:'#1a3a1a',
    ladder:'#8fbc8f', rope:'#4a7040', fog:'rgba(10,40,15,0.18)',
    ambientR:0, ambientG:20, ambientB:0,
  },
  factory: {
    bg:'#100808', brick:'#6a3018', concrete:'#3a2a1a',
    ladder:'#d07030', rope:'#803820', fog:'rgba(40,15,5,0.18)',
    ambientR:20, ambientG:5, ambientB:0,
  },
  space: {
    bg:'#000010', brick:'#1a2a4a', concrete:'#0a1a2a',
    ladder:'#60a0d0', rope:'#304060', fog:'rgba(5,10,40,0.15)',
    ambientR:0, ambientG:5, ambientB:25,
  },
  temple: {
    bg:'#100c06', brick:'#7a5a28', concrete:'#5a4018',
    ladder:'#d4b050', rope:'#906030', fog:'rgba(40,30,10,0.15)',
    ambientR:20, ambientG:15, ambientB:0,
  },
});
export const DEFAULT_THEME = 'dungeon';

export const STATE = Object.freeze({
  LOADING:     'LOADING',
  MENU:        'MENU',
  PLAYING:     'PLAYING',
  PAUSED:      'PAUSED',
  LEVEL_CLEAR: 'LEVEL_CLEAR',
  GAME_OVER:   'GAME_OVER',
  EDITOR:      'EDITOR',
  HIGH_SCORES: 'HIGH_SCORES',
  NAME_ENTRY:  'NAME_ENTRY',
  SETTINGS:    'SETTINGS',
});

export const PLAYER_STATE = Object.freeze({
  IDLE:       'IDLE',
  WALK_LEFT:  'WALK_LEFT',
  WALK_RIGHT: 'WALK_RIGHT',
  CLIMB_UP:   'CLIMB_UP',
  CLIMB_DOWN: 'CLIMB_DOWN',
  FALL:       'FALL',
  DIG_LEFT:   'DIG_LEFT',
  DIG_RIGHT:  'DIG_RIGHT',
  DEAD:       'DEAD',
  WIN:        'WIN',
});

export const ENEMY_STATE = Object.freeze({
  PATROL:   'PATROL',
  CHASE:    'CHASE',
  TRAPPED:  'TRAPPED',
  RESPAWN:  'RESPAWN',
  ALERTED:  'ALERTED',
});

export const PALETTE_ITEMS = [
  { type: TILE.EMPTY,        label: 'EMPTY',        color: '#111' },
  { type: TILE.BRICK,        label: 'BRICK',        color: '#8b4513' },
  { type: TILE.CONCRETE,     label: 'CONCRETE',     color: '#606060' },
  { type: TILE.LADDER,       label: 'LADDER',       color: '#d4a017' },
  { type: TILE.ROPE,         label: 'ROPE',         color: '#8b7030' },
  { type: TILE.TRAP_BRICK,   label: 'TRAP BRICK',   color: '#4a2a0e' },
  { type: TILE.GOLD,         label: 'GOLD',         color: '#ffd700' },
  { type: TILE.POWER_SPEED,  label: 'POWER: SPEED', color: '#4488ff' },
  { type: TILE.POWER_DIG,    label: 'POWER: DIG',   color: '#44cc44' },
  { type: TILE.POWER_FREEZE, label: 'POWER: FREEZE',color: '#ff4444' },
  { type: TILE.SPAWN_PLAYER, label: 'PLAYER START', color: '#5555ff' },
  { type: TILE.SPAWN_ENEMY,  label: 'ENEMY SPAWN',  color: '#ff5555' },
];

// Default game settings (stored in localStorage)
export const DEFAULT_SETTINGS = Object.freeze({
  musicVol:  0.5,
  sfxVol:    0.7,
  crtPreset: 'amber',   // 'amber'|'green'|'cold'|'off'
  lives:     5,
});
