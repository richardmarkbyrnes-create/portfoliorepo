(function () {
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function padSlideNumber(value, total) {
    const digits = String(total).length;
    return String(value).padStart(Math.max(2, digits), '0');
  }

  function initWorkOverlay() {
    if (document.body.dataset.page !== 'home') return;

    const overlay = document.getElementById('work-overlay');
    const track = document.getElementById('work-slideshow-track');
    const thumbs = document.getElementById('work-slideshow-thumbs');
    const counter = document.getElementById('work-overlay-counter');
    const closeBtn = document.getElementById('work-overlay-close');
    const prevBtns = [
      document.getElementById('work-overlay-prev'),
      document.getElementById('work-overlay-nav-prev'),
    ];
    const nextBtns = [
      document.getElementById('work-overlay-next'),
      document.getElementById('work-overlay-nav-next'),
    ];
    const rows = document.querySelectorAll('.work-column--experience .work-row-main[data-project]');

    const order = window.PROJECT_ORDER || [];
    const projects = window.PROJECTS || {};

    if (!overlay || !track || !thumbs || !order.length || !rows.length) return;

    let currentIndex = 0;
    let isOpen = false;
    let lastFocused = null;

    function formatMeta(project) {
      return `${project.company} — ${project.title} — ${project.year}`;
    }

    function renderSlides() {
      track.innerHTML = order
        .map((slug) => {
          const project = projects[slug];
          if (!project) return '';

          return `
            <article class="work-slide" data-project="${slug}" aria-label="${formatMeta(project)}">
              <div class="work-slide-media" aria-hidden="true"></div>
            </article>
          `;
        })
        .join('');
    }

    function renderThumbs() {
      thumbs.innerHTML = order
        .map((slug, index) => {
          const project = projects[slug];
          if (!project) return '';

          const label = formatMeta(project);
          const number = padSlideNumber(index + 1, order.length);

          return `
            <button
              type="button"
              class="work-slideshow-thumb"
              data-index="${index}"
              role="tab"
              aria-label="${label}"
              aria-selected="false"
            >
              <span class="work-slideshow-thumb-media" aria-hidden="true"></span>
              <span class="work-slideshow-thumb-badge">${number}</span>
            </button>
          `;
        })
        .join('');

      thumbs.querySelectorAll('.work-slideshow-thumb').forEach((thumb) => {
        thumb.addEventListener('click', () => {
          goToSlide(Number(thumb.dataset.index));
        });
      });
    }

    function updateControls() {
      const current = padSlideNumber(currentIndex + 1, order.length);
      const total = padSlideNumber(order.length, order.length);

      if (counter) counter.textContent = `${current} / ${total}`;

      prevBtns.forEach((btn) => {
        if (btn) btn.disabled = currentIndex === 0;
      });

      nextBtns.forEach((btn) => {
        if (btn) btn.disabled = currentIndex === order.length - 1;
      });

      thumbs.querySelectorAll('.work-slideshow-thumb').forEach((thumb, index) => {
        const isActive = index === currentIndex;
        thumb.classList.toggle('is-active', isActive);
        thumb.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      overlay.setAttribute('data-current-project', order[currentIndex]);
    }

    function updateSlidePosition(animate = true) {
      if (!animate || prefersReducedMotion()) {
        track.style.transition = 'none';
      } else {
        track.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
      }

      track.style.transform = `translateX(-${currentIndex * 100}%)`;

      if (!animate || prefersReducedMotion()) {
        track.offsetHeight;
        track.style.transition = '';
      }

      updateControls();
    }

    function openOverlay(index) {
      lastFocused = document.activeElement;
      currentIndex = Math.max(0, Math.min(index, order.length - 1));
      isOpen = true;

      document.body.classList.add('work-overlay-open');
      overlay.classList.add('is-visible');
      overlay.setAttribute('aria-hidden', 'false');

      updateSlidePosition(false);
      closeBtn?.focus();
    }

    function closeOverlay() {
      if (!isOpen) return;

      isOpen = false;
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('work-overlay-open');

      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    }

    function goToSlide(index) {
      const nextIndex = Math.max(0, Math.min(index, order.length - 1));
      if (nextIndex === currentIndex) return;
      currentIndex = nextIndex;
      updateSlidePosition(true);
    }

    function goPrev() {
      goToSlide(currentIndex - 1);
    }

    function goNext() {
      goToSlide(currentIndex + 1);
    }

    renderSlides();
    renderThumbs();

    rows.forEach((row) => {
      function openFromRow() {
        const slug = row.dataset.project;
        const index = order.indexOf(slug);
        if (index === -1) return;
        openOverlay(index);
      }

      row.addEventListener('click', openFromRow);
      row.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openFromRow();
      });
    });

    closeBtn?.addEventListener('click', closeOverlay);
    prevBtns.forEach((btn) => btn?.addEventListener('click', goPrev));
    nextBtns.forEach((btn) => btn?.addEventListener('click', goNext));

    overlay.querySelector('.work-overlay-backdrop')?.addEventListener('click', closeOverlay);

    document.addEventListener('keydown', (event) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        closeOverlay();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    });
  }

  initWorkOverlay();
})();
