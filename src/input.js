// Keyboard, mouse, and gamepad input, normalized into per-frame snapshots.
export default class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.prevKeys = new Set();
    // Raw viewport-relative mouse position; converted to a -1..1 stick by
    // the caller using the canvas's current bounding rect.
    this.mouse = { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 };

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftRight'].includes(e.code)
      ) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('mousemove', (e) => {
      this.mouse.clientX = e.clientX;
      this.mouse.clientY = e.clientY;
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  // Normalized aim stick in [-1, 1] on each axis, relative to canvas center.
  getMouseStick() {
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = (this.mouse.clientX - cx) / (rect.width / 2);
    const y = (this.mouse.clientY - cy) / (rect.height / 2);
    const mag = Math.hypot(x, y);
    if (mag < 0.06) return { x: 0, y: 0 };
    const clampedMag = Math.min(mag, 1.6);
    return { x: (x / mag) * clampedMag, y: (y / mag) * clampedMag };
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
