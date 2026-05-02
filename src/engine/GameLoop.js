const FIXED_DT = 1 / 60;
const MAX_SKIP  = 5;

export default class GameLoop {
  constructor(updateFn, renderFn) {
    this._update = updateFn;
    this._render = renderFn;
    this._running = false;
    this._accum = 0;
    this._last = 0;
    this._rafId = null;
  }

  start() {
    this._running = true;
    this._last = performance.now();
    this._rafId = requestAnimationFrame(this._loop.bind(this));
  }

  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  _loop(now) {
    if (!this._running) return;
    const elapsed = Math.min((now - this._last) / 1000, 0.1);
    this._last = now;
    this._accum += elapsed;

    let steps = 0;
    while (this._accum >= FIXED_DT && steps < MAX_SKIP) {
      this._update(FIXED_DT);
      this._accum -= FIXED_DT;
      steps++;
    }
    this._render(this._accum / FIXED_DT);
    this._rafId = requestAnimationFrame(this._loop.bind(this));
  }
}
