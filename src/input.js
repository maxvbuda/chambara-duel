// Keyboard, mouse, and gamepad input, normalized into per-frame snapshots.
export default class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.prevKeys = new Set();
    this.mouse = { x: 640, y: 360, down: false };

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    canvas.addEventListener('mousemove', (e) => this._updateMouse(e));
    canvas.addEventListener('mousedown', (e) => {
      this.mouse.down = true;
      e.preventDefault();
    });
    window.addEventListener('mouseup', () => (this.mouse.down = false));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
  }

  _updateMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.mouse.x = (e.clientX - rect.left) * scaleX;
    this.mouse.y = (e.clientY - rect.top) * scaleY;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  justPressed(code) {
    return this.keys.has(code) && !this.prevKeys.has(code);
  }

  // Call once at the end of every game frame.
  endFrame() {
    this.prevKeys = new Set(this.keys);
  }

  getGamepad(index) {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    return pads && pads[index] ? pads[index] : null;
  }
}
