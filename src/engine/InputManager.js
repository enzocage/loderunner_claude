export default class InputManager {
  constructor() {
    this._held    = new Set();
    this._pressed = new Set();
    this._released= new Set();

    this._onDown = (e) => {
      const k = e.code;
      if (!this._held.has(k)) this._pressed.add(k);
      this._held.add(k);
      // Prevent page scroll on arrow keys / space
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(k)) {
        e.preventDefault();
      }
    };
    this._onUp = (e) => {
      const k = e.code;
      this._held.delete(k);
      this._released.add(k);
    };

    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup',   this._onUp);
  }

  destroy() {
    window.removeEventListener('keydown', this._onDown);
    window.removeEventListener('keyup',   this._onUp);
  }

  // Call once per frame AFTER reading input
  flush() {
    this._pressed.clear();
    this._released.clear();
  }

  isHeld(code)     { return this._held.has(code); }
  isPressed(code)  { return this._pressed.has(code); }
  isReleased(code) { return this._released.has(code); }

  get left()     { return this.isHeld('ArrowLeft')  || this.isHeld('KeyA'); }
  get right()    { return this.isHeld('ArrowRight') || this.isHeld('KeyD'); }
  get up()       { return this.isHeld('ArrowUp')    || this.isHeld('KeyW'); }
  get down()     { return this.isHeld('ArrowDown')  || this.isHeld('KeyS'); }
  get digLeft()  { return this.isHeld('KeyZ') || this.isHeld('Comma'); }
  get digRight() { return this.isHeld('KeyX') || this.isHeld('Period'); }
  get pause()    { return this.isPressed('Escape') || this.isPressed('KeyP'); }
  get any()      { return this._held.size > 0; }

  // Mobile touch injection
  setHeld(code, state) {
    if (state) {
      if (!this._held.has(code)) this._pressed.add(code);
      this._held.add(code);
    } else {
      this._held.delete(code);
      this._released.add(code);
    }
  }
}
