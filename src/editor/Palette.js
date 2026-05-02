import { PALETTE_ITEMS, TILE } from '../constants.js';

export default class Palette {
  constructor(containerEl) {
    this._container = containerEl;
    this.selected = TILE.BRICK;
    this._items = [];
    this._build();
  }

  _build() {
    this._container.innerHTML = '';
    for (const item of PALETTE_ITEMS) {
      const el = document.createElement('div');
      el.className = 'palette-item' + (item.type === this.selected ? ' selected' : '');
      el.title = item.label;

      // Colour swatch
      const sw = document.createElement('canvas');
      sw.className = 'palette-swatch';
      sw.width = 16; sw.height = 16;
      const ctx = sw.getContext('2d');
      ctx.fillStyle = item.color;
      ctx.fillRect(0, 0, 16, 16);

      const lbl = document.createElement('span');
      lbl.textContent = item.label;

      el.appendChild(sw);
      el.appendChild(lbl);
      el.addEventListener('click', () => this._select(item.type));
      this._container.appendChild(el);
      this._items.push({ type: item.type, el });
    }
  }

  _select(type) {
    this.selected = type;
    for (const i of this._items) {
      i.el.classList.toggle('selected', i.type === type);
    }
  }

  setSelected(type) { this._select(type); }
}
