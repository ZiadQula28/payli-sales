/* Payli · Theme 06 · Quiet Precision
   1. Nav hairline once the page has scrolled 8 px.
   2. Nav inverts to Night while the pay spread is under it (instant).
   3. Baseline lock: CSS places type and phones from font metrics; this measures the
      real baselines and removes any sub-pixel residue. Hero: the phone moves so the
      last dish's price sits on the sub-line's last baseline. Night: the text block
      moves so its last baseline sits on the "Total" row. Desktop composition only. */
(() => {
  const nav = document.getElementById('nav');
  const night = document.getElementById('night');
  const probe = document.querySelector('.scroll-probe');
  if (!nav) return;

  if ('IntersectionObserver' in window && probe) {
    new IntersectionObserver(([e]) => nav.classList.toggle('is-scrolled', !e.isIntersecting)).observe(probe);
  }

  let nightIO;
  const watchNight = () => {
    if (!night || !('IntersectionObserver' in window)) return;
    if (nightIO) nightIO.disconnect();
    const line = Math.round(nav.offsetHeight / 2);
    nightIO = new IntersectionObserver(([e]) => {
      const on = e.isIntersecting;
      if (on === nav.classList.contains('is-night')) return;
      nav.classList.add('snap');
      nav.classList.toggle('is-night', on);
      requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.remove('snap')));
    }, { rootMargin: `-${line}px 0px -${Math.max(0, window.innerHeight - line - 1)}px 0px` });
    nightIO.observe(night);
  };

  const wide = window.matchMedia('(min-width: 960px)');
  const marker = (k) => document.querySelector(`[data-bl="${k}"]`);
  const base = (k) => { const m = marker(k); return m ? m.getBoundingClientRect().top : null; };
  const pairs = [
    ['hero', () => base('sub-last') - base('price')],
    ['night', () => base('total') - base('night-last')],
  ];
  const align = () => {
    for (const [key, delta] of pairs) {
      const el = document.querySelector(`[data-align="${key}"]`);
      if (!el) continue;
      if (!wide.matches) { el.style.removeProperty('--nudge'); continue; }
      const d = delta();
      if (!Number.isFinite(d)) continue;
      const cur = parseFloat(el.style.getPropertyValue('--nudge')) || 0;
      const next = Math.round((cur + d) * 100) / 100;
      if (Math.abs(next) < 0.01) el.style.removeProperty('--nudge');
      else el.style.setProperty('--nudge', `${next}px`);
    }
  };

  // Measure only once fonts are in and the hero's load sequence has settled.
  const settled = () => {
    const anims = document.getAnimations ? document.getAnimations() : [];
    return Promise.all(anims.map((a) => a.finished.catch(() => {})));
  };
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  fonts.then(settled).then(() => { align(); document.documentElement.dataset.aligned = '1'; });

  let raf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { watchNight(); align(); });
  });
  watchNight();
})();
