/* Brendon Lock — Portfolio
   Scroll effects: reveal-on-scroll, line-split headlines, parallax media,
   scroll progress bar, header state, menu overlay, carousel arrows.
   No dependencies. Respects prefers-reduced-motion. */

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------------------------------------------------------------
     1. Split headlines into lines so each line can rise into view.
        Works on natural line wraps by measuring word offsets.
     --------------------------------------------------------------- */
  function splitLines(el) {
    // Hero title is pre-split into .line spans in the markup.
    if (el.querySelector('.line')) {
      $$('.line', el).forEach((line, i) => {
        if (line.querySelector('.line__inner')) return;
        const inner = document.createElement('span');
        inner.className = 'line__inner';
        inner.style.setProperty('--i', i);
        inner.append(...line.childNodes);
        line.append(inner);
      });
      return;
    }

    const original = el.textContent;
    const words = original.trim().split(/\s+/);
    el.textContent = '';
    const spans = words.map((w, i) => {
      const s = document.createElement('span');
      s.textContent = w;
      el.append(s);
      if (i < words.length - 1) el.append(document.createTextNode(' '));
      return s;
    });

    // Group words by their rendered top offset (inline spans keep real spacing).
    const lines = [];
    let currentTop = null;
    spans.forEach(s => {
      const top = Math.round(s.getBoundingClientRect().top);
      if (currentTop === null || Math.abs(top - currentTop) > 2) { lines.push([]); currentTop = top; }
      lines[lines.length - 1].push(s.textContent);
    });

    el.textContent = '';
    lines.forEach((wordsInLine, i) => {
      const line = document.createElement('span');
      line.className = 'line';
      const inner = document.createElement('span');
      inner.className = 'line__inner';
      inner.style.setProperty('--i', i);
      inner.textContent = wordsInLine.join(' ');
      line.append(inner);
      el.append(line);
    });
    el.dataset.splitText = original;
  }

  function initSplits() {
    $$('[data-split]').forEach(splitLines);
  }

  // Re-split on resize (debounced) so line breaks stay accurate.
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      $$('[data-split]').forEach(el => {
        if (el.querySelector('.line') && !el.dataset.splitText) return; // hero, static
        if (!el.dataset.splitText) return;
        el.textContent = el.dataset.splitText;
        splitLines(el);
        el.classList.add('is-visible');
      });
    }, 200);
  });

  /* ---------------------------------------------------------------
     2. Reveal on scroll (IntersectionObserver).
        Sibling [data-reveal] items inside the same parent get a
        small stagger via --delay.
     --------------------------------------------------------------- */
  function initReveal() {
    const targets = $$('[data-reveal], [data-split]');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach(t => t.classList.add('is-visible'));
      return;
    }

    // Stagger siblings
    const groups = new Map();
    $$('[data-reveal]').forEach(el => {
      const parent = el.parentElement;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(el);
    });
    groups.forEach(list => {
      if (list.length < 2) return;
      list.forEach((el, i) => el.style.setProperty('--delay', `${Math.min(i, 6) * 80}ms`));
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

    targets.forEach(t => io.observe(t));
  }

  /* ---------------------------------------------------------------
     3. Parallax on full-bleed media. Moves the inner image a fraction
        of the element's distance from viewport center. rAF-throttled.
     --------------------------------------------------------------- */
  function initParallax() {
    if (reduceMotion) return;
    const items = $$('[data-parallax]').map(wrap => ({
      wrap,
      img: wrap.querySelector('img, .band__img, .ph'),
      strength: parseFloat(wrap.dataset.parallaxStrength || '0.25'),
    })).filter(i => i.img);
    if (!items.length) return;

    let ticking = false;
    const update = () => {
      const vh = window.innerHeight;
      items.forEach(({ wrap, img, strength }) => {
        const r = wrap.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const center = r.top + r.height / 2 - vh / 2;   // px from viewport center
        const shift = -center * strength * 0.25;         // subtle
        img.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
      });
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------------------------------------------------------------
     4. Scroll progress hairline + header scrolled state.
     --------------------------------------------------------------- */
  function initProgress() {
    const bar = $('.progress');
    const header = $('.header');
    const cue = $('.scroll-cue');
    let ticking = false;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      bar.style.setProperty('--progress', p.toFixed(4));
      header.classList.toggle('is-scrolled', window.scrollY > 24);
      if (cue) cue.classList.toggle('is-hidden', window.scrollY > 80);
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ---------------------------------------------------------------
     5. Menu overlay.
     --------------------------------------------------------------- */
  function initMenu() {
    const btn = $('.menu-btn');
    const menu = $('#menu');
    if (!btn || !menu) return;

    const setOpen = (open) => {
      btn.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
    };
    btn.addEventListener('click', () => setOpen(btn.getAttribute('aria-expanded') !== 'true'));
    $$('a', menu).forEach(a => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); btn.focus(); }
    });
  }

  /* ---------------------------------------------------------------
     6. Theme toggle. Initial theme is set inline in <head> to avoid a
        flash; this just flips and persists it.
     --------------------------------------------------------------- */
  function initTheme() {
    const btn = $('[data-theme-toggle]');
    if (!btn) return;
    const root = document.documentElement;
    const label = () => btn.setAttribute('aria-label',
      root.getAttribute('data-theme') === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      label();
    });
    label();
  }

  /* ---------------------------------------------------------------
     7. Carousel arrows for horizontally-scrolling card rows.
     --------------------------------------------------------------- */
  function initCarousels() {
    $$('[data-carousel]').forEach(track => {
      const id = track.dataset.carousel;
      const prev = $(`[data-carousel-prev="${id}"]`);
      const next = $(`[data-carousel-next="${id}"]`);
      if (!prev || !next) return;

      const step = () => {
        const card = track.querySelector('.card');
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        return card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
      };
      const updateState = () => {
        const maxScroll = track.scrollWidth - track.clientWidth - 1;
        prev.disabled = track.scrollLeft <= 0;
        next.disabled = track.scrollLeft >= maxScroll;
      };
      prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }));
      next.addEventListener('click', () => track.scrollBy({ left:  step(), behavior: reduceMotion ? 'auto' : 'smooth' }));
      track.addEventListener('scroll', updateState, { passive: true });
      window.addEventListener('resize', updateState);
      updateState();
    });
  }

  /* ---------------------------------------------------------------
     Boot. Wait for fonts so line-splitting measures the real font.
     --------------------------------------------------------------- */
  const boot = () => {
    initSplits();
    initReveal();
    initParallax();
    initProgress();
    initMenu();
    initTheme();
    initCarousels();
    document.documentElement.classList.add('is-ready');
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(boot);
  } else {
    window.addEventListener('load', boot);
  }
})();
