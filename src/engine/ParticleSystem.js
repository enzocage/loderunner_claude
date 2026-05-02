const POOL_SIZE = 256;

class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.life = 0; this.maxLife = 1;
    this.color = '#fff';
    this.size = 2;
    this.active = false;
  }
}

export default class ParticleSystem {
  constructor() {
    this._pool = Array.from({ length: POOL_SIZE }, () => new Particle());
  }

  _alloc() {
    return this._pool.find(p => !p.active) || null;
  }

  emit(type, x, y) {
    switch (type) {
      case 'dust':   this._emitDust(x, y);   break;
      case 'spark':  this._emitSpark(x, y);  break;
      case 'gold':   this._emitGold(x, y);   break;
      case 'death':  this._emitDeath(x, y);  break;
      case 'dig':    this._emitDig(x, y);    break;
    }
  }

  _spawn(x, y, vx, vy, life, color, size) {
    const p = this._alloc();
    if (!p) return;
    p.x = x; p.y = y;
    p.vx = vx; p.vy = vy;
    p.life = p.maxLife = life;
    p.color = color;
    p.size = size;
    p.active = true;
  }

  _emitDust(x, y) {
    for (let i = 0; i < 4; i++) {
      this._spawn(x, y,
        (Math.random() - 0.5) * 2,
        -0.5 - Math.random(),
        18, '#9f9f9f', 2);
    }
  }

  _emitSpark(x, y) {
    for (let i = 0; i < 6; i++) {
      this._spawn(x, y,
        (Math.random() - 0.5) * 3,
        -2 - Math.random() * 2,
        12, '#bfce72', 2);
    }
  }

  _emitGold(x, y) {
    for (let i = 0; i < 6; i++) {
      this._spawn(x + 10, y + 10,
        (Math.random() - 0.5) * 2,
        -1 - Math.random() * 2,
        20, '#ffd700', 2);
    }
  }

  _emitDeath(x, y) {
    for (let i = 0; i < 12; i++) {
      const ang = (Math.PI * 2 * i) / 12;
      const spd = 1.5 + Math.random() * 2;
      this._spawn(x + 10, y + 10,
        Math.cos(ang) * spd, Math.sin(ang) * spd,
        30, '#b86962', 2);
    }
  }

  _emitDig(x, y) {
    for (let i = 0; i < 5; i++) {
      this._spawn(x + 10, y + 18,
        (Math.random() - 0.5) * 3,
        -0.3 - Math.random(),
        16, '#574200', 2);
    }
  }

  update() {
    for (const p of this._pool) {
      if (!p.active) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.life--;
      if (p.life <= 0) p.active = false;
    }
  }

  render(ctx) {
    for (const p of this._pool) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
