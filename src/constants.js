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
});

export const WALK_SPEED   = 2;   // px per frame at 60fps
export const CLIMB_SPEED  = 2;
export const FALL_SPEED   = 4;
export const ENEMY_SPEED  = 1.5;
export const ENEMY_CHASE_SPEED = 2;

export const HOLE_OPEN_FRAMES  = 240; // 4 s
export const HOLE_CLOSE_FRAMES = 24;  // 0.4 s

export const DIG_FRAMES   = 14;
export const DEAD_FRAMES  = 60;
export const RESPAWN_FLASH = 30;

export const SCORE = Object.freeze({
  GOLD:           250,
  ENEMY_TRAP:     75,
  LEVEL_COMPLETE: 1000,
});

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
});

export const PALETTE_ITEMS = [
  { type: TILE.EMPTY,        label: 'EMPTY',        color: '#111' },
  { type: TILE.BRICK,        label: 'BRICK',        color: '#8b4513' },
  { type: TILE.CONCRETE,     label: 'CONCRETE',     color: '#606060' },
  { type: TILE.LADDER,       label: 'LADDER',       color: '#d4a017' },
  { type: TILE.ROPE,         label: 'ROPE',         color: '#8b7030' },
  { type: TILE.TRAP_BRICK,   label: 'TRAP BRICK',   color: '#4a2a0e' },
  { type: TILE.GOLD,         label: 'GOLD',         color: '#ffd700' },
  { type: TILE.SPAWN_PLAYER, label: 'PLAYER START', color: '#5555ff' },
  { type: TILE.SPAWN_ENEMY,  label: 'ENEMY SPAWN',  color: '#ff5555' },
];
