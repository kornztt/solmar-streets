// Keyboard + mouse input, stored on the shared state.
export function bindInput(G, canvas) {
  const down = (e) => {
    G.keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (window.__solmarKey) window.__solmarKey(e.code, true);
  };
  const up = (e) => {
    G.keys[e.code] = false;
    if (window.__solmarKey) window.__solmarKey(e.code, false);
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    G.mouse.x = e.clientX - r.left;
    G.mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      G.mouse.down = true;
      if (window.__solmarClick) window.__solmarClick(G.mouse.x, G.mouse.y);
    }
  });
  window.addEventListener('mouseup', () => {
    G.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
