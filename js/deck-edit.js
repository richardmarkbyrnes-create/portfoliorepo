/* Inline slide editor. Press E on a deck slide to edit its copy in place; the
   changes are written straight back into the deck's HTML on disk.

   Dev-only by design. The write endpoint lives in serve.py, which only ever runs
   behind `npm run dev` — the deployed deck is static files on GitHub Pages with
   nothing to POST to — so this bails out anywhere but localhost rather than
   offering an edit affordance that could never save. */
(function () {
  const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', ''];
  if (!LOCAL_HOSTS.includes(window.location.hostname)) return;

  const slides = Array.from(document.querySelectorAll('.slide'));
  if (!slides.length) return;

  // Must stay in step with EDITABLE_TAGS in serve.py: the client and the server
  // both walk this set in document order, and an index is the whole contract
  // between them.
  const EDITABLE = 'p, h1, h2, li';

  let editing = false;
  let originals = [];

  const banner = document.createElement('div');
  banner.className = 'deck-edit-banner';
  banner.setAttribute('aria-live', 'polite');
  document.body.appendChild(banner);

  let bannerTimer = null;
  function say(text, tone) {
    banner.textContent = text;
    banner.dataset.tone = tone || '';
    banner.classList.add('is-visible');
    window.clearTimeout(bannerTimer);
    if (!editing) bannerTimer = window.setTimeout(() => banner.classList.remove('is-visible'), 2600);
  }

  function currentSlide() {
    return document.querySelector('.slide.is-current') || slides[0];
  }

  function slideNumber(slide) {
    const match = /Slide (\d+)/.exec(slide.getAttribute('aria-label') || '');
    return match ? parseInt(match[1], 10) : null;
  }

  function fields(slide) {
    return Array.from(slide.querySelectorAll(EDITABLE));
  }

  function enter() {
    const slide = currentSlide();
    const els = fields(slide);
    if (!els.length) {
      say('Nothing editable on this slide');
      return;
    }

    editing = true;
    widths = {};
    sizes = {};
    originals = els.map((el) => el.innerHTML);
    els.forEach((el) => {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
    });
    document.body.classList.add('deck-is-editing');
    say('Editing slide ' + slideNumber(slide) + ' — select text to set its tone · esc to save and exit');

    const first = els[0];
    if (first) {
      first.focus();
      // Caret at the end of the first field rather than selecting it, so a
      // stray keystroke can't wipe the line.
      const range = document.createRange();
      range.selectNodeContents(first);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function teardown(slide) {
    fields(slide).forEach((el) => {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
    });
    document.body.classList.remove('deck-is-editing');
    editing = false;
    hideMenu();
    hideGrip();
  }

  function collect(slide) {
    const edits = {};
    fields(slide).forEach((el, i) => {
      tidy(el);
      // contenteditable substitutes non-breaking spaces to stop a trailing
      // space collapsing. In the file they are just a space.
      const html = el.innerHTML.replace(/\u00a0/g, ' ').replace(/&nbsp;/g, ' ').trim();
      if (originals[i] !== undefined && originals[i].trim() !== html) edits[i] = html;
    });
    return edits;
  }

  function save(exit) {
    const slide = currentSlide();
    const number = slideNumber(slide);
    const edits = collect(slide);

    if (exit) teardown(slide);

    const pendingWidths = widths;
    const pendingSizes = sizes;
    if (exit) { widths = {}; sizes = {}; }

    const count = Object.keys(edits).length
      + Object.keys(pendingWidths).length
      + Object.keys(pendingSizes).length;
    if (!count) {
      say(exit ? 'No changes' : 'Nothing to save');
      return;
    }

    say('Saving…');
    fetch('/__edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: window.location.pathname,
        slide: number,
        edits,
        widths: pendingWidths,
        sizes: pendingSizes,
      }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data.ok) throw new Error(data.error || 'server refused the write');
        // The saved markup is the sanitised copy, so re-baseline against what is
        // now on disk — otherwise the next save would resend unchanged fields.
        originals = fields(slide).map((el) => el.innerHTML);
        if (!exit) { widths = {}; sizes = {}; }
        say('Saved ' + data.written + ' edit' + (data.written === 1 ? '' : 's') + ' → ' + data.file);
      })
      .catch((err) => say('Save failed: ' + err.message, 'error'));
  }

  function discard() {
    const slide = currentSlide();
    fields(slide).forEach((el, i) => {
      if (originals[i] !== undefined) el.innerHTML = originals[i];
    });
    teardown(slide);
    say('Discarded');
  }

  /* ── Run-style menu ──────────────────────────────────────────────────────
     Slide copy is written in two tones: full strength, and a grey `.muted` run
     for the trailing half of a sentence. Selecting text while editing offers
     both.

     Applying is a wrap rather than an unwrap, in either direction: `.solid`
     exists precisely to pull a word back to full strength inside a muted run,
     so "plain" doesn't have to split an enclosing span — it just nests, and the
     inner rule wins. Any opposite-tone spans fully inside the selection are
     unwrapped on the way so the markup doesn't accumulate layers. */
  const menu = document.createElement('div');
  menu.className = 'deck-edit-menu';
  menu.innerHTML =
    '<button type="button" data-run="solid">Plain</button>' +
    '<button type="button" data-run="muted">Grey</button>' +
    '<span class="deck-edit-menu-rule" aria-hidden="true"></span>' +
    '<button type="button" data-size="-1" title="Smaller">A&minus;</button>' +
    '<button type="button" data-size="1" title="Larger">A+</button>';
  document.body.appendChild(menu);

  function hideMenu() {
    menu.classList.remove('is-visible');
  }

  function liveRange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const host = range.commonAncestorContainer;
    const el = host.nodeType === 1 ? host : host.parentElement;
    if (!el || !el.closest('[contenteditable="true"]')) return null;
    return range;
  }

  function positionMenu(range) {
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return hideMenu();
    menu.classList.add('is-visible');
    const box = menu.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - box.width / 2),
      window.innerWidth - box.width - 8
    );
    // Above the selection, unless it is close enough to the top that the menu
    // would sit off-screen.
    const above = rect.top - box.height - 8;
    menu.style.left = left + 'px';
    menu.style.top = (above < 8 ? rect.bottom + 8 : above) + 'px';
  }

  /* extractContents plus insertNode is a blunt way to restyle a range, and it
     leaves debris: empty spans where a selection clipped one, bare <span>s the
     browser adds of its own accord, runs of the same tone sitting adjacent
     instead of merged, and non-breaking spaces standing in for ordinary ones.
     Left alone that debris compounds every time a run is re-toned, and adjacent
     same-tone spans with no whitespace between them visibly jam two words
     together. Everything gets swept after each change. */
  function tidy(host) {
    if (!host) return;

    // Bare spans are the browser's leavings, with one exception: inside a list
    // item `.slide-list li span` carries the grey trailing half, so those are
    // structural and stay. Anywhere else — a lede, a title — they do nothing but
    // fragment the markup a little more with every edit.
    host.querySelectorAll('span:not([class])').forEach((el) => {
      const structural = el.closest('li') && !el.closest('span.muted, span.solid');
      if (!structural || !el.textContent.trim()) el.replaceWith(...el.childNodes);
    });

    // A run nested directly inside the same tone is redundant.
    host.querySelectorAll('span.muted span.muted, span.solid span.solid').forEach((el) => {
      el.replaceWith(...el.childNodes);
    });

    host.querySelectorAll('span.muted, span.solid').forEach((el) => {
      if (!el.textContent.trim() && !el.querySelector('img, br')) el.remove();
    });

    // Merge neighbours of the same tone so the markup stops growing.
    host.querySelectorAll('span.muted, span.solid').forEach((el) => {
      let next = el.nextSibling;
      while (next && next.nodeType === 1 && next.tagName === 'SPAN'
             && next.className === el.className) {
        const dead = next;
        next = next.nextSibling;
        while (dead.firstChild) el.appendChild(dead.firstChild);
        dead.remove();
      }
    });

    // A paste can still bring blocks with it. Flatten them to line breaks rather
    // than letting the save unwrap them and run the lines together.
    host.querySelectorAll('div, p, h1, h2, h3, li').forEach((el) => {
      const bits = Array.from(el.childNodes);
      if (el.previousSibling) el.before(document.createElement('br'));
      el.replaceWith(...bits);
    });

    host.normalize();
  }

  function applyRun(run) {
    const range = liveRange();
    if (!range) return;

    const span = document.createElement('span');
    span.className = run;
    span.appendChild(range.extractContents());

    // Drop any spans of the other tone that came along inside the selection.
    const opposite = run === 'muted' ? 'solid' : 'muted';
    span.querySelectorAll('span.' + opposite + ', span.' + run).forEach((inner) => {
      inner.replaceWith(...inner.childNodes);
    });

    range.insertNode(span);

    // Selecting the whole of a run and giving it the other tone leaves the old
    // wrapper around it doing nothing. Unwrap rather than nest.
    const parent = span.parentElement;
    if (parent && parent.tagName === 'SPAN'
        && parent.classList.contains(opposite)
        && parent.childNodes.length === 1) {
      parent.replaceWith(span);
    }

    tidy(span.closest('[contenteditable="true"]'));

    // Keep the run selected so the two buttons can be toggled between.
    const sel = window.getSelection();
    const after = document.createRange();
    after.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(after);
    positionMenu(after);
  }

  /* Size acts on the whole field, not the selection. Sizing a fragment of a
     headline means inline spans carrying their own px values, which fight the
     deck's type scale the moment anything reflows — and it is almost never what
     you want on a slide. Steps are proportional so a 44px headline and a 16px
     lede move by a sensible amount each. */
  const SIZE_STEP = 1.08;
  const SIZE_MIN = 10;
  const SIZE_MAX = 96;
  let sizes = {};

  function fieldFor(node) {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return el ? el.closest('[contenteditable="true"]') : null;
  }

  function stepSize(direction) {
    const sel = window.getSelection();
    const field = fieldFor(sel && sel.anchorNode) || document.activeElement;
    if (!field || !field.isContentEditable) return;

    const current = parseFloat(window.getComputedStyle(field).fontSize);
    const next = Math.round(
      Math.min(SIZE_MAX, Math.max(SIZE_MIN, direction > 0 ? current * SIZE_STEP : current / SIZE_STEP))
    );
    field.style.fontSize = next + 'px';
    sizes[fields(currentSlide()).indexOf(field)] = next + 'px';
    say('Size ' + next + 'px — esc to save and exit');
    if (gripTarget === field) placeGrip(field);
  }

  // mousedown, not click: the default would blur the editable and collapse the
  // selection before the handler ever ran.
  menu.addEventListener('mousedown', (event) => {
    const button = event.target.closest('button[data-run], button[data-size]');
    if (!button) return;
    event.preventDefault();
    if (button.dataset.size) stepSize(Number(button.dataset.size));
    else applyRun(button.dataset.run);
  });

  document.addEventListener('selectionchange', () => {
    if (!editing) return hideMenu();
    const range = liveRange();
    if (!range) return hideMenu();
    positionMenu(range);
  });

  /* ── Width handle ────────────────────────────────────────────────────────
     Drag the right edge of the focused field to set how wide its text runs.
     Stored as a percentage rather than pixels so the measure holds when the
     deck is presented at a different size — every slide is a percentage of the
     same 940px column. */
  const MIN_WIDTH = 20;
  const grip = document.createElement('div');
  grip.className = 'deck-edit-grip';
  grip.title = 'Drag to set the text width · double-click to reset';
  document.body.appendChild(grip);

  let gripTarget = null;
  let widths = {};

  function hideGrip() {
    grip.classList.remove('is-visible');
    gripTarget = null;
  }

  function placeGrip(el) {
    if (!el) return hideGrip();
    gripTarget = el;
    const rect = el.getBoundingClientRect();
    grip.style.left = rect.right + 'px';
    grip.style.top = (rect.top + rect.height / 2) + 'px';
    grip.classList.add('is-visible');
  }

  function columnWidth(el) {
    // The slide's content box is what a percentage resolves against.
    const slide = el.closest('.slide');
    const styles = window.getComputedStyle(slide);
    return slide.clientWidth
      - parseFloat(styles.paddingLeft)
      - parseFloat(styles.paddingRight);
  }

  grip.addEventListener('mousedown', (event) => {
    if (!gripTarget) return;
    event.preventDefault();
    const el = gripTarget;
    const column = columnWidth(el);
    const startX = event.clientX;
    const startWidth = el.getBoundingClientRect().width;
    // Centred slides grow from both edges at once, so a drag moves the edge at
    // half the rate unless the width is doubled.
    const centred = window.getComputedStyle(el).textAlign === 'center'
      || !!el.closest('.slide--title');
    document.body.classList.add('deck-is-resizing');

    function onMove(move) {
      const delta = (move.clientX - startX) * (centred ? 2 : 1);
      const pct = Math.min(100, Math.max(MIN_WIDTH, ((startWidth + delta) / column) * 100));
      const rounded = Math.round(pct * 10) / 10;
      el.style.maxWidth = rounded + '%';
      widths[fields(currentSlide()).indexOf(el)] = rounded + '%';
      placeGrip(el);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('deck-is-resizing');
      say('Width ' + el.style.maxWidth + ' — esc to save and exit');
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  grip.addEventListener('dblclick', (event) => {
    if (!gripTarget) return;
    event.preventDefault();
    gripTarget.style.removeProperty('max-width');
    widths[fields(currentSlide()).indexOf(gripTarget)] = null;
    placeGrip(gripTarget);
    say('Width reset — esc to save and exit');
  });

  document.addEventListener('focusin', (event) => {
    if (!editing) return;
    const el = event.target.closest('[contenteditable="true"]');
    if (el) placeGrip(el);
  });

  window.addEventListener('resize', () => {
    if (editing && gripTarget) placeGrip(gripTarget);
  });

  // Capture phase, so this settles what a keypress means before deck.js sees it
  // and tries to page the deck with it.
  document.addEventListener('keydown', (event) => {
    // Size without reaching for the menu. Checked before the modifier bail-out
    // below, which exists to let browser shortcuts through.
    if ((event.metaKey || event.ctrlKey) && editing
        && (event.key === '=' || event.key === '+' || event.key === '-' || event.key === '_')) {
      event.preventDefault();
      stepSize(event.key === '-' || event.key === '_' ? -1 : 1);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && (event.key === 's' || event.key === 'S')) {
      if (!editing) return;
      event.preventDefault();
      save(false);
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (editing) {
      // Enter in a contenteditable splits the field into <div> blocks, which the
      // save path unwraps — the text survives but the break doesn't, and the two
      // lines end up run together. Every editable here is a single block, so a
      // line break is what Enter should have meant anyway.
      if (event.key === 'Enter' && !event.shiftKey
          && document.activeElement && document.activeElement.isContentEditable) {
        event.preventDefault();
        document.execCommand('insertLineBreak');
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (event.shiftKey) discard();
        else save(true);
      }
      return; // every other key is just typing
    }

    if ((event.key === 'e' || event.key === 'E') && !event.target.isContentEditable) {
      event.preventDefault();
      enter();
    }
  }, true);

  // Leaving mid-edit would silently drop the changes.
  window.addEventListener('beforeunload', (event) => {
    if (!editing || !Object.keys(collect(currentSlide())).length) return;
    event.preventDefault();
    event.returnValue = '';
  });
})();
