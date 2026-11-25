// Ask Insights "Vision work": the three concept shots start folded into an
// overlapping fan. Clicking unfolds them into the vertical stack with their
// captions. The move is a FLIP: measure both layouts, start each tile at its
// old box via an inline transform, then let it ease to the new one.
(() => {
  const sec = document.getElementById('pc-vision');
  if (!sec) return;
  const row = sec.querySelector('.pc-vision-row');
  const btn = document.getElementById('pc-vision-toggle');
  const tiles = [...row.querySelectorAll('.pc-vision-shot')];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const DUR = 720;
  let busy = false;

  // Layout box ignoring transforms, relative to the row.
  const box = t => ({ cx: t.offsetLeft + t.offsetWidth / 2, cy: t.offsetTop + t.offsetHeight / 2, w: t.offsetWidth });
  const rot = t => getComputedStyle(t).getPropertyValue('--r').trim() || '0deg';

  function toggle() {
    if (busy) return;
    const expanding = sec.classList.contains('is-collapsed');
    if (reduce) {
      sec.classList.toggle('is-collapsed', !expanding);
      btn.setAttribute('aria-expanded', expanding);
      return;
    }
    busy = true;
    const first = tiles.map(box);
    const rotFirst = tiles.map(rot);
    const h0 = row.offsetHeight;

    sec.classList.toggle('is-collapsed', !expanding);
    sec.classList.add('is-flipping');
    btn.setAttribute('aria-expanded', expanding);

    const last = tiles.map(box);
    const rotLast = tiles.map(rot);
    const h1 = row.offsetHeight;

    // Hold the row at its old height so the page below slides, not jumps.
    row.style.transition = 'none';
    row.style.height = h0 + 'px';

    tiles.forEach((t, i) => {
      const f = first[i], l = last[i];
      t.style.transition = 'none';
      t.style.transform = `translate(${f.cx - l.cx}px, ${f.cy - l.cy}px) scale(${f.w / l.w}) rotate(${rotFirst[i]})`;
    });

    // Flush, then release everything to its new place.
    row.getBoundingClientRect();
    requestAnimationFrame(() => {
      row.style.transition = `height ${DUR}ms ${EASE}`;
      row.style.height = h1 + 'px';
      tiles.forEach((t, i) => {
        t.style.transition = `transform ${DUR}ms ${EASE}, box-shadow ${DUR}ms ease`;
        t.style.transform = `rotate(${rotLast[i]})`;
      });
    });

    setTimeout(() => {
      row.style.transition = '';
      row.style.height = '';
      tiles.forEach(t => { t.style.transition = ''; t.style.transform = ''; });
      sec.classList.remove('is-flipping');
      busy = false;
    }, DUR + 40);
  }

  btn.addEventListener('click', toggle);
  row.addEventListener('click', () => { if (sec.classList.contains('is-collapsed')) toggle(); });
})();
