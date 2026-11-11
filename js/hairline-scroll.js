// Drives a hairline figure from scroll rather than letting it play on its
// own: as the figure rises through the window, a virtual pointer travels
// `path` (points in the figure's 400 x 320 drawing space, from outside it in
// to where the effect is strongest), so the figure answers in step with the
// scroll. Scroll faster and it moves faster; scroll back and it eases back.
// A real pointer over the figure takes over while it's there. The figure
// reads pointer positions from page events, so the virtual one is sent the
// same way.
export function scrollDrive(el, path) {
  const along = (t) => {
    const seg = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
    const k = t * (path.length - 1) - seg;
    const [a, b] = [path[seg], path[seg + 1]];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };

  let hovering = false;
  let last = -1;

  function update() {
    if (hovering) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // 0 as the figure's top enters the bottom of the window, 1 by the time
    // its middle reaches 45% of the way down.
    const start = vh;
    const end = vh * 0.45 - r.height / 2;
    const t = Math.min(1, Math.max(0, (start - r.top) / (start - end)));
    if (Math.abs(t - last) < 0.002) return;
    last = t;
    const [x, y] = along(t);
    el.dispatchEvent(new PointerEvent('pointermove', {
      clientX: r.left + (x / 400) * r.width,
      clientY: r.top + (y / 320) * r.height,
      pointerType: 'mouse',
      bubbles: true,
    }));
  }

  el.addEventListener('pointerenter', (e) => { if (e.isTrusted) hovering = true; });
  el.addEventListener('pointerleave', (e) => {
    if (!e.isTrusted) return;
    hovering = false;
    last = -1;
    update();
  });

  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}
