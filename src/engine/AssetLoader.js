export default class AssetLoader {
  constructor() {
    this.progress = 0;
    this.total = 0;
    this.loaded = 0;
  }

  // Since we use no external image/sound files,
  // this just resolves a font load promise.
  async loadAll() {
    try {
      await document.fonts.ready;
    } catch (e) {
      // Fonts optional – continue anyway
    }
    return true;
  }
}
