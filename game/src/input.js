// Keyboard and mouse state: held keys, edge-triggered presses, and the
// mouse position in screen pixels plus its world position once aimed.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouse.down = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
    this.canvas = null;
  }

  attach(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  // True while the key is held.
  down(code) {
    return this.keys.has(code);
  }

  // True only on the frame the key went down; consumed by endFrame().
  pressed(code) {
    return this.pressedKeys.has(code);
  }

  // Movement axis from WASD / arrows: {x: -1..1, y: -1..1}.
  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    return { x, y };
  }

  // Driving axis: throttle -1..1 and steer -1..1.
  driveAxis() {
    let throttle = 0;
    let steer = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) throttle += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) throttle -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) steer -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) steer += 1;
    return { throttle, steer };
  }

  // Call once per frame, after the world has read the edge state.
  endFrame() {
    this.pressedKeys.clear();
    this.mouse.clicked = false;
  }
}
