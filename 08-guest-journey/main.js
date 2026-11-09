/* Payli, theme 08: The Guest Journey.
   Progressive enhancement only. Without this file, or with reduced motion, the journey is five static panels.
   Native scrolling throughout: no wheel listeners, nothing scrubbed. */
(() => {
  const root = document.documentElement;
  const stage = document.querySelector('.stage');
  if (!stage || !('IntersectionObserver' in window)) return;

  const journey = stage.parentElement;
  const bar = document.querySelector('.bar');
  const steps = [...stage.querySelectorAll('.step')];
  const firstPhone = steps[0].querySelector('.phone');
  const nav = document.querySelector('.bar-nav');
  const sentinels = [...document.querySelectorAll('.sentinel')];
  const links = [...document.querySelectorAll('.bar-nav a')];
  const stageTable = stage.querySelector('.table--stage');
  const states = steps.map((s) => s.querySelector('.table--step').dataset.state);

  // The pinned stage needs motion allowed and enough height to hold the phone.
  const mqStage = matchMedia('(prefers-reduced-motion: no-preference) and (min-height: 540px)');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');

  let staged = false;
  let current = 0;   // step shown on the stage (1..5)
  let lock = 0;      // step requested from the bar while a jump is scrolling
  let io = null;
  const hits = new Set();

  const targets = () => (staged ? sentinels : steps);

  /* ---- stage state ---- */
  // n = 0 empties the stage (used while it slides in under the hero, before it pins).
  function show(n) {
    if (!staged || n === current) return;
    const prev = current;
    stage.style.setProperty('--dir', prev && n < prev ? -1 : 1);
    void stage.offsetWidth; // resting screens take the new direction before they animate in
    steps.forEach((el, i) => {
      const k = i + 1;
      clearTimeout(el._leave);
      if (k === n) {
        el.classList.remove('is-leaving');
        el.classList.add('is-active');
      } else if (k === prev) {
        el.classList.remove('is-active');
        el.classList.add('is-leaving');
        el._leave = setTimeout(() => el.classList.remove('is-leaving'), 260);
      } else {
        el.classList.remove('is-active', 'is-leaving');
      }
    });
    if (n) {
      stage.dataset.step = String(n);
      stage.dataset.active = '';
      stageTable.dataset.state = states[n - 1];
    } else {
      delete stage.dataset.active;
    }
    current = n;
  }


  let marked = -1;
  function markLink(n) {
    if (n === marked) return;
    marked = n;
    links.forEach((a, i) => {
      if (i + 1 === n) a.setAttribute('aria-current', 'step');
      else a.removeAttribute('aria-current');
    });
  }

  /* ---- which step covers the middle of the viewport ----
     A 100vh sentinel is at least half visible exactly when it covers the viewport's centre line,
     so a zero-height root at 50% is the threshold-0.5 rule without the double-hit at boundaries. */
  function sync() {
    if (lock) return;
    const n = hits.size ? Math.max(...hits) + 1 : 0;
    markLink(n);
    if (n) show(n);
  }

  function observe() {
    if (io) io.disconnect();
    hits.clear();
    io = new IntersectionObserver((entries) => {
      const list = targets();
      entries.forEach((e) => {
        const i = list.indexOf(e.target);
        if (e.isIntersecting) hits.add(i); else hits.delete(i);
      });
      sync();
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    targets().forEach((t) => io.observe(t));
  }

  /* ---- progress lines in the bar ---- */
  let queued = false;
  function progress() {
    queued = false;
    const mid = innerHeight / 2;
    // Step tabs appear once the phone is on screen and leave when the journey has passed mid-screen.
    const j = journey.getBoundingClientRect();
    // The step word waits until the stage has pinned; the phone and tile scroll in with it.
    stage.toggleAttribute('data-pinned', staged && j.top <= 0.5);
    updateTabs(nav.contains(document.activeElement));
    sync();
    targets().forEach((t, i) => {
      const r = t.getBoundingClientRect();
      const p = r.height ? Math.min(1, Math.max(0, (mid - r.top) / r.height)) : 0;
      links[i].style.setProperty('--p', p.toFixed(3));
    });
  }
  // Step tabs show once the phone is on screen and until the journey has passed mid-screen,
  // and never hide while one of them holds keyboard focus.
  function updateTabs(tabFocused) {
    const j = journey.getBoundingClientRect();
    const phoneTop = firstPhone.getBoundingClientRect().top;
    const inView = phoneTop < innerHeight - bar.offsetHeight - 24 && j.bottom > innerHeight / 2;
    bar.classList.toggle('is-journey', tabFocused || inView);
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(progress); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  // When focus leaves the tab group, re-check at once so the next Tab skips hidden tabs.
  nav.addEventListener('focusout', (e) => { if (!nav.contains(e.relatedTarget)) updateTabs(false); });

  /* ---- jumps from the bar ---- */
  let settleTimer = 0;
  let onSettleScroll = null;
  function settle() {
    if (onSettleScroll) removeEventListener('scroll', onSettleScroll);
    const done = () => {
      removeEventListener('scroll', onSettleScroll);
      onSettleScroll = null;
      lock = 0;
      sync();
    };
    onSettleScroll = () => { clearTimeout(settleTimer); settleTimer = setTimeout(done, 160); };
    addEventListener('scroll', onSettleScroll, { passive: true });
    clearTimeout(settleTimer);
    settleTimer = setTimeout(done, 400);
  }

  links.forEach((a, i) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = targets()[i];
      if (staged) {
        // Show the requested step at once; skip the steps the scroll passes on the way.
        lock = i + 1;
        markLink(i + 1);
        show(i + 1);
      }
      target.scrollIntoView({ behavior: mqReduce.matches ? 'auto' : 'smooth', block: 'start' });
      settle();
    });
  });

  /* ---- mode ---- */
  // Step 1 is already on the stage while it scrolls up under the hero, so it arrives full, then pins.
  function initialStep() {
    const mid = innerHeight / 2;
    let n = 1;
    sentinels.forEach((s, i) => { if (s.getBoundingClientRect().top <= mid) n = i + 1; });
    return n;
  }

  function setMode() {
    staged = mqStage.matches;
    root.classList.toggle('is-staged', staged);
    steps.forEach((el) => el.classList.remove('is-active', 'is-leaving'));
    current = 0;
    delete stage.dataset.active;
    if (staged) show(initialStep());
    else stage.dataset.step = '1';
    observe();
    progress();
  }

  if (mqStage.addEventListener) mqStage.addEventListener('change', setMode);
  setMode();

  // A link such as #pay should land on its step, not on the top of the pinned stage.
  function followHash() {
    const i = steps.findIndex((s) => '#' + s.id === location.hash);
    if (i < 0 || !staged) return;
    lock = i + 1;
    markLink(i + 1);
    show(i + 1);
    requestAnimationFrame(() => { sentinels[i].scrollIntoView({ block: 'start' }); settle(); });
  }
  addEventListener('load', followHash);
  addEventListener('hashchange', followHash);
})();
