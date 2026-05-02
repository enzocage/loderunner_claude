import { TILE, TILE_SIZE } from '../constants.js';

// Atlas layout: 256×256, each sprite 20×20
// Row 0 (y=0):   brick variants x4 + hole frames x4
// Row 1 (y=20):  concrete x2 + ladder x1 + rope x1 + empty x4
// Row 2 (y=40):  gold spin x8
// Row 3 (y=60):  power-ups (speed x2, dig x2, freeze x2) + exit x2
// Row 4 (y=80):  player idle x2, walk x4, fall x2
// Row 5 (y=100): player climb x4, dig-L x2, dig-R x2
// Row 6 (y=120): player dead x4, win x4
// Row 7 (y=140): enemy walk x4, trapped x2, carry x2
// Row 8 (y=160): enemy climb x4, alerted x2, respawn x2
// Row 9 (y=180): UI: skull x3, heart x1, coin x1, star x2, checkpoint x1

export default class SpriteAtlas {
  constructor() {
    this.canvas = null;
    this.ctx    = null;
    this.ready  = false;
    this.theme  = null;
  }

  build(theme) {
    this.theme  = theme;
    this.canvas = new OffscreenCanvas(256, 256);
    this.ctx    = this.canvas.getContext('2d');
    const ctx   = this.ctx;
    ctx.clearRect(0, 0, 256, 256);

    // Row 0 – brick + hole
    this._brick(ctx, 0,   0, 0);   // normal
    this._brick(ctx, 20,  0, 1);   // crack 1
    this._brick(ctx, 40,  0, 2);   // crack 2
    this._brick(ctx, 60,  0, 3);   // crumble
    this._hole(ctx,  80,  0, 0);   // hole 25%
    this._hole(ctx,  100, 0, 0.5); // hole 50%
    this._hole(ctx,  120, 0, 0.8); // hole 80%
    this._hole(ctx,  140, 0, 1);   // hole full

    // Row 1 – concrete, ladder, rope
    this._concrete(ctx, 0,  20, 0);
    this._concrete(ctx, 20, 20, 1);
    this._ladder(ctx,   40, 20);
    this._rope(ctx,     60, 20);

    // Row 2 – gold spin (8 frames)
    for (let f = 0; f < 8; f++) this._gold(ctx, f * 20, 40, f);

    // Row 3 – power-ups + exit
    this._powerup(ctx, 0,  60, 'speed', 0);
    this._powerup(ctx, 20, 60, 'speed', 1);
    this._powerup(ctx, 40, 60, 'dig',   0);
    this._powerup(ctx, 60, 60, 'dig',   1);
    this._powerup(ctx, 80, 60, 'freeze',0);
    this._powerup(ctx, 100,60, 'freeze',1);
    this._exitLadder(ctx, 120, 60, 0);
    this._exitLadder(ctx, 140, 60, 1);

    // Row 4 – player idle + walk + fall
    this._player(ctx, 0,   80, 'idle',       1, 0);
    this._player(ctx, 20,  80, 'idle',       1, 1);
    this._player(ctx, 40,  80, 'walk',       1, 0);
    this._player(ctx, 60,  80, 'walk',       1, 1);
    this._player(ctx, 80,  80, 'walk',       1, 2);
    this._player(ctx, 100, 80, 'walk',       1, 3);
    this._player(ctx, 120, 80, 'fall',       1, 0);
    this._player(ctx, 140, 80, 'fall',       1, 1);

    // Row 5 – player climb + dig
    this._player(ctx, 0,   100, 'climb', 1, 0);
    this._player(ctx, 20,  100, 'climb', 1, 1);
    this._player(ctx, 40,  100, 'climb', 1, 2);
    this._player(ctx, 60,  100, 'climb', 1, 3);
    this._player(ctx, 80,  100, 'dig',   1, 0);
    this._player(ctx, 100, 100, 'dig',   1, 1);
    this._player(ctx, 120, 100, 'dig',  -1, 0);
    this._player(ctx, 140, 100, 'dig',  -1, 1);

    // Row 6 – player dead + win
    this._player(ctx, 0,   120, 'dead', 1, 0);
    this._player(ctx, 20,  120, 'dead', 1, 1);
    this._player(ctx, 40,  120, 'dead', 1, 2);
    this._player(ctx, 60,  120, 'dead', 1, 3);
    this._player(ctx, 80,  120, 'win',  1, 0);
    this._player(ctx, 100, 120, 'win',  1, 1);

    // Row 7 – enemy walk + trapped + carry
    this._enemy(ctx, 0,   140, 'walk',    1, 0);
    this._enemy(ctx, 20,  140, 'walk',    1, 1);
    this._enemy(ctx, 40,  140, 'walk',    1, 2);
    this._enemy(ctx, 60,  140, 'walk',    1, 3);
    this._enemy(ctx, 80,  140, 'trapped', 1, 0);
    this._enemy(ctx, 100, 140, 'trapped', 1, 1);
    this._enemy(ctx, 120, 140, 'carry',   1, 0);
    this._enemy(ctx, 140, 140, 'carry',   1, 1);

    // Row 8 – enemy climb + alerted + respawn
    this._enemy(ctx, 0,   160, 'climb',   1, 0);
    this._enemy(ctx, 20,  160, 'climb',   1, 1);
    this._enemy(ctx, 40,  160, 'climb',   1, 2);
    this._enemy(ctx, 60,  160, 'climb',   1, 3);
    this._enemy(ctx, 80,  160, 'alerted', 1, 0);
    this._enemy(ctx, 100, 160, 'alerted', 1, 1);
    this._enemy(ctx, 120, 160, 'respawn', 1, 0);
    this._enemy(ctx, 140, 160, 'respawn', 1, 1);

    // Row 9 – UI icons
    this._skull(ctx, 0,  180, false);
    this._skull(ctx, 20, 180, true);   // empty skull
    this._heart(ctx, 40, 180);
    this._coin(ctx,  60, 180, false);
    this._coin(ctx,  80, 180, true);   // collected coin
    this._checkpoint(ctx, 100, 180);
    this._alertBubble(ctx, 120, 180);

    this.ready = true;
  }

  // ─── Sprite lookup helpers ─────────────────────────────────────────────────

  blit(dstCtx, col, row, dx, dy, flipX = false) {
    const sx = col * TILE_SIZE, sy = row * TILE_SIZE;
    if (flipX) {
      dstCtx.save();
      dstCtx.scale(-1, 1);
      dstCtx.drawImage(this.canvas, sx, sy, TILE_SIZE, TILE_SIZE,
        -(dx + TILE_SIZE), dy, TILE_SIZE, TILE_SIZE);
      dstCtx.restore();
    } else {
      dstCtx.drawImage(this.canvas, sx, sy, TILE_SIZE, TILE_SIZE,
        dx, dy, TILE_SIZE, TILE_SIZE);
    }
  }

  blitTile(dstCtx, tileType, dx, dy, frame = 0, holeAnim = 0) {
    switch (tileType) {
      case TILE.BRICK:     this.blit(dstCtx, 0, 0, dx, dy); break;
      case TILE.CONCRETE:  this.blit(dstCtx, 0, 1, dx, dy); break;
      case TILE.LADDER:    this.blit(dstCtx, 2, 1, dx, dy); break;
      case TILE.ROPE:      this.blit(dstCtx, 3, 1, dx, dy); break;
      case TILE.GOLD:      this.blit(dstCtx, frame % 8, 2, dx, dy); break;
      case TILE.HOLE: {
        const f = Math.min(3, Math.floor(holeAnim * 4));
        this.blit(dstCtx, 4 + f, 0, dx, dy);
        break;
      }
      case TILE.POWER_SPEED:  this.blit(dstCtx, 0, 3, dx, dy); break;
      case TILE.POWER_DIG:    this.blit(dstCtx, 2, 3, dx, dy); break;
      case TILE.POWER_FREEZE: this.blit(dstCtx, 4, 3, dx, dy); break;
    }
  }

  blitExitLadder(dstCtx, dx, dy, frame = 0) {
    this.blit(dstCtx, 6 + (frame % 2), 3, dx, dy);
  }

  blitPlayer(dstCtx, state, facing, animFrame, dx, dy) {
    const f4 = animFrame % 4;
    const f2 = animFrame % 2;
    const flip = facing < 0;
    switch (state) {
      case 'IDLE':       this.blit(dstCtx, f2,     4, dx, dy, flip); break;
      case 'WALK_LEFT':
      case 'WALK_RIGHT': this.blit(dstCtx, 2 + f4, 4, dx, dy, flip); break;
      case 'FALL':       this.blit(dstCtx, 6 + f2, 4, dx, dy, flip); break;
      case 'CLIMB_UP':
      case 'CLIMB_DOWN': this.blit(dstCtx, f4,     5, dx, dy, false); break;
      case 'DIG_RIGHT':  this.blit(dstCtx, 4 + f2, 5, dx, dy, false); break;
      case 'DIG_LEFT':   this.blit(dstCtx, 6 + f2, 5, dx, dy, false); break;
      case 'DEAD':       this.blit(dstCtx, f4,     6, dx, dy, flip); break;
      case 'WIN':        this.blit(dstCtx, 4 + f2, 6, dx, dy, flip); break;
      default:           this.blit(dstCtx, 0,      4, dx, dy, flip); break;
    }
  }

  blitEnemy(dstCtx, state, facing, animFrame, dx, dy) {
    const f4 = animFrame % 4;
    const f2 = animFrame % 2;
    const flip = facing < 0;
    switch (state) {
      case 'PATROL':
      case 'CHASE':      this.blit(dstCtx, f4,     7, dx, dy, flip); break;
      case 'TRAPPED':    this.blit(dstCtx, 4 + f2, 7, dx, dy, flip); break;
      case 'CLIMB_UP':
      case 'CLIMB_DOWN': this.blit(dstCtx, f4,     8, dx, dy, false); break;
      case 'ALERTED':    this.blit(dstCtx, 4 + f2, 8, dx, dy, flip); break;
      case 'RESPAWN':    this.blit(dstCtx, 6 + f2, 8, dx, dy, flip); break;
      default:           this.blit(dstCtx, 0,      7, dx, dy, flip); break;
    }
    // Carry state: enemy walk + coin on head
    if (state === 'CARRY' || state.includes?.('carry')) {
      this.blit(dstCtx, 6 + f2, 7, dx, dy, flip);
    }
  }

  blitSkull(dstCtx, dx, dy, empty = false) {
    this.blit(dstCtx, empty ? 1 : 0, 9, dx, dy);
  }

  blitCoin(dstCtx, dx, dy, collected = false) {
    this.blit(dstCtx, collected ? 4 : 3, 9, dx, dy);
  }

  blitCheckpoint(dstCtx, dx, dy) {
    this.blit(dstCtx, 5, 9, dx, dy);
  }

  blitAlertBubble(dstCtx, dx, dy) {
    this.blit(dstCtx, 6, 9, dx, dy);
  }

  // ─── Sprite drawing functions ──────────────────────────────────────────────

  _brick(ctx, x, y, variant) {
    const t = this.theme;
    // Base
    ctx.fillStyle = t ? t.brick : '#8b4513';
    ctx.fillRect(x, y, 20, 20);
    // Highlight top-left edge
    ctx.fillStyle = this._lighten(t ? t.brick : '#8b4513', 40);
    ctx.fillRect(x, y, 20, 1);
    ctx.fillRect(x, y, 1, 20);
    // Shadow bottom-right
    ctx.fillStyle = this._darken(t ? t.brick : '#8b4513', 40);
    ctx.fillRect(x+19, y, 1, 20);
    ctx.fillRect(x, y+19, 20, 1);
    // Mortar lines
    ctx.fillStyle = this._darken(t ? t.brick : '#8b4513', 25);
    ctx.fillRect(x+1, y+9, 18, 1);
    ctx.fillRect(x+10, y+1, 1, 8);
    ctx.fillRect(x+4, y+10, 1, 9);
    ctx.fillRect(x+16, y+10, 1, 9);
    // Variant cracks
    if (variant >= 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x+2, y+3, 1, 5);
      ctx.fillRect(x+3, y+4, 1, 1);
    }
    if (variant >= 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x+5, y+11, 7, 1);
      ctx.fillRect(x+6, y+12, 1, 4);
      ctx.fillRect(x+11, y+3, 1, 1);
      ctx.fillRect(x+12, y+4, 2, 1);
    }
    if (variant >= 3) {
      // Crumble – darker, uneven edges
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x, y, 3, 3);
      ctx.fillRect(x+17, y, 3, 3);
      ctx.fillRect(x, y+17, 3, 3);
    }
  }

  _concrete(ctx, x, y, variant) {
    const base = this.theme ? this.theme.concrete : '#606060';
    ctx.fillStyle = base;
    ctx.fillRect(x, y, 20, 20);
    ctx.fillStyle = this._lighten(base, 20);
    ctx.fillRect(x, y, 20, 1);
    ctx.fillRect(x, y, 1, 20);
    ctx.fillStyle = this._darken(base, 20);
    ctx.fillRect(x+19, y, 1, 20);
    ctx.fillRect(x, y+19, 20, 1);
    // Grid rivets
    ctx.fillStyle = this._darken(base, 30);
    if (variant === 0) {
      ctx.fillRect(x+4, y+4, 4, 4);
      ctx.fillRect(x+12, y+4, 4, 4);
      ctx.fillRect(x+4, y+12, 4, 4);
      ctx.fillRect(x+12, y+12, 4, 4);
    } else {
      // damaged variant
      ctx.fillRect(x+3, y+3, 14, 1);
      ctx.fillRect(x+3, y+3, 1, 14);
      ctx.fillRect(x+16, y+3, 1, 14);
      ctx.fillRect(x+3, y+16, 14, 1);
    }
  }

  _ladder(ctx, x, y) {
    const col = this.theme ? this.theme.ladder : '#d4a017';
    ctx.fillStyle = col;
    ctx.fillRect(x+3, y, 3, 20);
    ctx.fillRect(x+14, y, 3, 20);
    ctx.fillStyle = this._lighten(col, 30);
    ctx.fillRect(x+3, y, 1, 20);
    ctx.fillRect(x+14, y, 1, 20);
    ctx.fillStyle = col;
    for (let ry = 1; ry < 20; ry += 5) {
      ctx.fillRect(x+3, y+ry, 14, 2);
      ctx.fillStyle = this._lighten(col, 15);
      ctx.fillRect(x+3, y+ry, 14, 1);
      ctx.fillStyle = col;
    }
  }

  _rope(ctx, x, y) {
    const col = this.theme ? this.theme.rope : '#8b7030';
    ctx.fillStyle = col;
    ctx.fillRect(x, y+8, 20, 4);
    ctx.fillStyle = this._lighten(col, 25);
    ctx.fillRect(x, y+8, 20, 1);
    ctx.fillStyle = this._darken(col, 20);
    for (let rx = 0; rx < 20; rx += 5) {
      ctx.fillRect(x+rx, y+9, 2, 2);
    }
  }

  _gold(ctx, x, y, frame) {
    const angle = (frame / 8) * Math.PI * 2;
    const cx = x + 10, cy = y + 10;
    // Animated squeeze (simulates 3D spin)
    const scaleX = Math.abs(Math.cos(angle));
    const r = 7;
    const w = Math.max(2, r * scaleX);
    // Base glow
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 2);
    grd.addColorStop(0, '#fff8a0');
    grd.addColorStop(0.4, '#ffd700');
    grd.addColorStop(1, 'rgba(200,150,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w + 2, r + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Main shape
    const shine = Math.cos(angle) > 0 ? '#ffe86a' : '#c8a000';
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + w, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - w, cy);
    ctx.closePath();
    ctx.fill();
    // Specular
    if (w > 2) {
      ctx.fillStyle = 'rgba(255,255,200,0.8)';
      ctx.fillRect(cx - Math.floor(w * 0.3), cy - 3, Math.max(1, Math.floor(w * 0.3)), 2);
    }
  }

  _hole(ctx, x, y, openFrac) {
    const brickCol = this.theme ? this.theme.brick : '#8b4513';
    const brickH = Math.round(20 * (1 - openFrac));
    // Dark interior
    const holeH = 20 - brickH;
    if (holeH > 0) {
      ctx.fillStyle = '#050505';
      ctx.fillRect(x, y, 20, holeH);
      // depth gradient
      const grd = ctx.createLinearGradient(x, y, x, y + holeH);
      grd.addColorStop(0, 'rgba(0,0,0,0.8)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(x, y, 20, holeH);
      // Side depth shading
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y, 2, holeH);
      ctx.fillRect(x+18, y, 2, holeH);
    }
    // Remaining brick at bottom
    if (brickH > 0) {
      ctx.fillStyle = brickCol;
      ctx.fillRect(x, y + holeH, 20, brickH);
      ctx.fillStyle = this._darken(brickCol, 20);
      ctx.fillRect(x, y + holeH, 20, 1);
    }
  }

  _powerup(ctx, x, y, type, frame) {
    const colors = { speed: '#3388ff', dig: '#33cc44', freeze: '#ff3333' };
    const glowColors = { speed: '#aaddff', dig: '#aaffaa', freeze: '#ffaaaa' };
    const col = colors[type], glow = glowColors[type];
    const pulse = frame === 1 ? 0.2 : 0;

    // Background circle glow
    const grd = ctx.createRadialGradient(x+10, y+10, 0, x+10, y+10, 9);
    grd.addColorStop(0, glow);
    grd.addColorStop(0.5 + pulse, col);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x+10, y+10, 8 + pulse * 2, 0, Math.PI * 2);
    ctx.fill();

    // Flask body
    ctx.fillStyle = col;
    ctx.fillRect(x+7, y+4, 6, 12);
    ctx.fillRect(x+5, y+8, 10, 8);
    // Neck
    ctx.fillStyle = this._lighten(col, 30);
    ctx.fillRect(x+8, y+2, 4, 4);
    // Stopper
    ctx.fillStyle = '#888';
    ctx.fillRect(x+7, y+1, 6, 2);
    // Icon inside
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    if (type === 'speed')  { ctx.fillRect(x+8, y+9, 2, 5); ctx.fillRect(x+10, y+7, 2, 7); }
    if (type === 'dig')    { ctx.fillRect(x+7, y+9, 6, 2); ctx.fillRect(x+9, y+7, 2, 6); }
    if (type === 'freeze') { for (let i=0;i<4;i++) ctx.fillRect(x+7+i*2, y+8+i%2*2, 1, 3); }
  }

  _exitLadder(ctx, x, y, frame) {
    // Glowing green ladder for exit
    const glow = frame === 0 ? 0.9 : 1.0;
    const grd = ctx.createRadialGradient(x+10, y+10, 0, x+10, y+10, 12);
    grd.addColorStop(0, `rgba(0,255,136,${glow})`);
    grd.addColorStop(0.6, `rgba(0,200,80,${glow * 0.4})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(x, y, 20, 20);
    // Ladder structure
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(x+3, y, 3, 20);
    ctx.fillRect(x+14, y, 3, 20);
    ctx.fillStyle = '#afffcc';
    for (let ry = 1; ry < 20; ry += 5) ctx.fillRect(x+3, y+ry, 14, 2);
  }

  _player(ctx, x, y, anim, facing, frame) {
    // Clear cell
    ctx.clearRect(x, y, 20, 20);

    // We always draw facing RIGHT; flipX is handled in blit()
    const f = facing > 0 ? 1 : -1;

    // Walk cycle offsets
    const legL = [0,2,0,-2][frame % 4] || 0;
    const legR = [0,-2,0,2][frame % 4] || 0;
    const armY = [0,1,0,-1][frame % 4] || 0;

    // ── Body ──────────────────────────────────────────────────────────────────
    ctx.fillStyle = '#4455ee';
    ctx.fillRect(x+5, y+7, 10, 9);

    // ── Head ──────────────────────────────────────────────────────────────────
    const headBob = (anim === 'idle' && frame % 2 === 0) ? 1 : 0;
    ctx.fillStyle = '#f0c060';
    ctx.fillRect(x+5, y+1+headBob, 10, 7);
    // Helmet stripe
    ctx.fillStyle = '#3344cc';
    ctx.fillRect(x+5, y+1+headBob, 10, 2);
    // Eyes
    ctx.fillStyle = '#111';
    ctx.fillRect(x+11, y+4+headBob, 2, 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x+11, y+4+headBob, 1, 1);

    // ── Legs ──────────────────────────────────────────────────────────────────
    ctx.fillStyle = '#2233aa';
    if (anim === 'walk' || anim === 'idle') {
      ctx.fillRect(x+5,  y+16+legL, 4, 4);
      ctx.fillRect(x+11, y+16+legR, 4, 4);
    } else if (anim === 'climb') {
      ctx.fillRect(x+5,  y+16 + (frame<2?-2:2), 4, 4);
      ctx.fillRect(x+11, y+16 + (frame<2?2:-2), 4, 4);
    } else if (anim === 'dead') {
      ctx.fillRect(x+2, y+14 + frame, 7, 4);
      ctx.fillRect(x+11, y+12 + frame, 7, 4);
    } else {
      ctx.fillRect(x+5, y+16, 4, 4);
      ctx.fillRect(x+11, y+16, 4, 4);
    }

    // ── Arms ──────────────────────────────────────────────────────────────────
    ctx.fillStyle = '#f0c060';
    if (anim === 'dig') {
      // Right arm extended for dig
      ctx.fillStyle = '#f0c060';
      ctx.fillRect(x+15, y+8, 5, 3);
      ctx.fillStyle = '#888888';
      ctx.fillRect(x+18, y+7, 3, 5);
    } else if (anim === 'climb') {
      ctx.fillRect(x+(frame<2?1:16), y+7, 3, 3);
      ctx.fillRect(x+(frame<2?16:1), y+10, 3, 3);
    } else if (anim === 'win') {
      ctx.fillRect(x+1, y+4+frame%2, 4, 3);
      ctx.fillRect(x+15, y+4-(frame%2), 4, 3);
    } else {
      ctx.fillRect(x+1,  y+8+armY, 4, 3);
      ctx.fillRect(x+15, y+8-armY, 4, 3);
    }

    // ── Fall ──────────────────────────────────────────────────────────────────
    if (anim === 'fall') {
      ctx.fillStyle = '#f0c060';
      ctx.fillRect(x+0,  y+7, 4, 3);
      ctx.fillRect(x+16, y+7, 4, 3);
    }

    // ── Dead animation ────────────────────────────────────────────────────────
    if (anim === 'dead') {
      ctx.globalAlpha = 1 - frame * 0.15;
      // Stars around head
      ctx.fillStyle = '#ffd700';
      const ang = frame * 0.8;
      for (let i = 0; i < 3; i++) {
        const a = ang + (i / 3) * Math.PI * 2;
        ctx.fillRect(x + 10 + Math.cos(a) * 7, y + 5 + Math.sin(a) * 5, 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    // Power-up speed lines (applied in game render, not atlas)
  }

  _enemy(ctx, x, y, anim, facing, frame) {
    ctx.clearRect(x, y, 20, 20);
    const f4 = frame % 4;
    const legL = [0,2,0,-2][f4] || 0;
    const legR = [0,-2,0,2][f4] || 0;

    if (anim === 'trapped') {
      // Crouched in hole
      ctx.fillStyle = '#cc3333';
      ctx.fillRect(x+4, y+10, 12, 8);
      ctx.fillStyle = '#f0c060';
      ctx.fillRect(x+5, y+4, 10, 7);
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(x+5, y+4, 10, 2);
      ctx.fillStyle = '#111';
      ctx.fillRect(x+8, y+7, 2, 2);
      ctx.fillRect(x+12, y+7, 2, 2);
      // Struggling arms
      ctx.fillStyle = '#f0c060';
      ctx.fillRect(x+1,  y+10+frame, 3, 3);
      ctx.fillRect(x+16, y+10-frame, 3, 3);
      return;
    }

    if (anim === 'respawn') {
      // Static / materialise
      ctx.globalAlpha = 0.4 + frame * 0.3;
      ctx.fillStyle = '#ff5555';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(x + Math.floor(Math.random()*20), y + Math.floor(Math.random()*20), 2, 2);
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (anim === 'alerted') {
      // Draw "!" bubble above
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(x+8, y, 4, 8);
      ctx.fillRect(x+8, y-1, 4, 1);
      ctx.fillRect(x+8, y+9, 4, 3);
    }

    // Body
    ctx.fillStyle = '#cc3333';
    ctx.fillRect(x+5, y+7, 10, 9);
    // Head
    ctx.fillStyle = '#f0c060';
    ctx.fillRect(x+5, y+1, 10, 7);
    // Red headband (normal) or gold (elite – drawn externally)
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(x+5, y+1, 10, 2);
    // Eyes – menacing X shape
    ctx.fillStyle = '#111';
    ctx.fillRect(x+7, y+4, 2, 2);
    ctx.fillRect(x+11, y+4, 2, 2);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(x+8, y+5, 1, 1);
    ctx.fillRect(x+12, y+5, 1, 1);
    // Legs
    ctx.fillStyle = '#993333';
    if (anim === 'climb') {
      ctx.fillRect(x+5,  y+16 + (frame<2?-2:2), 4, 4);
      ctx.fillRect(x+11, y+16 + (frame<2?2:-2), 4, 4);
    } else {
      ctx.fillRect(x+5,  y+16+legL, 4, 4);
      ctx.fillRect(x+11, y+16+legR, 4, 4);
    }
    // Arms
    ctx.fillStyle = '#f0c060';
    ctx.fillRect(x+1,  y+9, 4, 3);
    ctx.fillRect(x+15, y+9, 4, 3);
    // Carry: gold bag on head
    if (anim === 'carry') {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x+6, y-3, 8, 5);
      ctx.fillStyle = '#c8a000';
      ctx.fillRect(x+6, y-3, 8, 1);
    }
  }

  _skull(ctx, x, y, empty) {
    ctx.fillStyle = empty ? '#333' : '#ddd';
    // Cranium
    ctx.fillRect(x+3, y+1, 14, 10);
    ctx.fillRect(x+1, y+3, 18, 8);
    // Jaw
    ctx.fillStyle = empty ? '#222' : '#bbb';
    ctx.fillRect(x+3, y+11, 14, 6);
    // Teeth
    ctx.fillStyle = '#eee';
    if (!empty) {
      for (let i = 0; i < 3; i++) ctx.fillRect(x+4+i*4, y+14, 3, 3);
    }
    // Eyes
    ctx.fillStyle = empty ? '#111' : '#000';
    ctx.fillRect(x+4, y+4, 4, 4);
    ctx.fillRect(x+12, y+4, 4, 4);
    if (!empty) {
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(x+5, y+5, 2, 2);
      ctx.fillRect(x+13, y+5, 2, 2);
    }
  }

  _heart(ctx, x, y) {
    ctx.fillStyle = '#cc2244';
    ctx.fillRect(x+2, y+1, 5, 4);
    ctx.fillRect(x+9, y+1, 5, 4);
    ctx.fillRect(x+1, y+3, 14, 5);
    ctx.fillRect(x+2, y+7, 12, 4);
    ctx.fillRect(x+3, y+10, 10, 3);
    ctx.fillRect(x+5, y+12, 6, 2);
    ctx.fillRect(x+7, y+14, 2, 2);
    ctx.fillStyle = '#ff6688';
    ctx.fillRect(x+3, y+2, 3, 2);
  }

  _coin(ctx, x, y, collected) {
    ctx.fillStyle = collected ? '#666' : '#ffd700';
    ctx.beginPath();
    ctx.arc(x+10, y+10, 7, 0, Math.PI * 2);
    ctx.fill();
    if (!collected) {
      ctx.fillStyle = '#c8a000';
      ctx.fillRect(x+7, y+8, 2, 4);
      ctx.fillStyle = '#ffe070';
      ctx.fillRect(x+9, y+6, 4, 8);
      ctx.fillRect(x+7, y+8, 6, 4);
    }
  }

  _checkpoint(ctx, x, y) {
    // Flag on pole
    ctx.fillStyle = '#888';
    ctx.fillRect(x+9, y+2, 2, 16);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(x+11, y+2, 7, 6);
    ctx.fillStyle = '#cc8800';
    ctx.fillRect(x+11, y+2, 7, 1);
    ctx.fillRect(x+11, y+7, 7, 1);
    // Base
    ctx.fillStyle = '#555';
    ctx.fillRect(x+5, y+18, 10, 2);
  }

  _alertBubble(ctx, x, y) {
    ctx.fillStyle = '#ffff00';
    ctx.strokeStyle = '#cc8800';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x+10, y+8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // "!"
    ctx.fillStyle = '#cc4400';
    ctx.fillRect(x+9, y+3, 2, 6);
    ctx.fillRect(x+9, y+10, 2, 2);
  }

  // ─── Colour helpers ────────────────────────────────────────────────────────

  _lighten(hex, amt) {
    const r = Math.min(255, parseInt(hex.slice(1,3),16) + amt);
    const g = Math.min(255, parseInt(hex.slice(3,5),16) + amt);
    const b = Math.min(255, parseInt(hex.slice(5,7),16) + amt);
    return `rgb(${r},${g},${b})`;
  }

  _darken(hex, amt) {
    const r = Math.max(0, parseInt(hex.slice(1,3),16) - amt);
    const g = Math.max(0, parseInt(hex.slice(3,5),16) - amt);
    const b = Math.max(0, parseInt(hex.slice(5,7),16) - amt);
    return `rgb(${r},${g},${b})`;
  }
}
