// Keyboard + mouse input with edge detection for pressed keys.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.pressedKeys = {};
    this.mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, clicked: false };
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.pressedKeys[e.code] = true;
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return !!this.keys[code]; }
  pressed(code) { return !!this.pressedKeys[code]; }
  endFrame() { this.pressedKeys = {}; this.mouse.clicked = false; }

  // WASD or arrows as -1..1 axes.
  axes() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    return { x, y };
  }
}
