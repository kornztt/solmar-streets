// Keyboard and mouse input, plus the screen-space to world-space aim.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.pressed = {}; // edge-triggered keys, consumed once per frame
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys[e.key.toLowerCase()]) this.pressed[e.key.toLowerCase()] = true;
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouse.down = true; this.mouse.clicked = true;
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
  }
  down(k) { return !!this.keys[k]; }
  wasPressed(k) { return !!this.pressed[k]; }
  endFrame() { this.pressed = {}; this.mouse.clicked = false; }
  // movement vector from WASD/arrows, normalised
  moveVector() {
    let x = 0, y = 0;
    if (this.down('w') || this.down('arrowup')) y -= 1;
    if (this.down('s') || this.down('arrowdown')) y += 1;
    if (this.down('a') || this.down('arrowleft')) x -= 1;
    if (this.down('d') || this.down('arrowright')) x += 1;
    const len = Math.hypot(x, y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }
}
