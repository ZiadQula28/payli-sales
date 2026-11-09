/* Payli, theme 09: The Service Blueprint (revision 1). Small, dependency-free behaviour. */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- 1. Keep drawing type and hatching at a fixed on-screen size ----------
     Each SVG scales with its column. --k (screen px per drawing unit) keeps room labels
     at 13 px and the hatch at 1 px lines on its pitch (6 px in the plans, 12 px on the
     large table). Table numerals never fall below 16 drawing units. */
  const small = () => window.innerWidth < 720;
  function numeralUnits(svg, k) {
    const kind = svg.dataset.num;
    if (kind === 't4') return 14 / k;                          // 14 px on the large table
    // On phones the plans drop their chairs and enlarge the tops, so numerals can reach 11.5 px.
    const target = small() ? 11.5 : (kind === 'plan-reset' ? 9 : 0);
    return Math.min(34, Math.max(16, target / k));
  }
  function scaleSvg(svg) {
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const w = svg.getBoundingClientRect().width;
    if (!vb || !vb.width || !w) return;
    const k = w / vb.width;
    svg.style.setProperty('--k', k.toFixed(4));
    svg.querySelectorAll('pattern[data-hatch]').forEach((p) => {
      p.setAttribute('patternTransform', `rotate(45) scale(${(1 / k).toFixed(4)})`);
    });
    const fs = numeralUnits(svg, k);
    svg.querySelectorAll('.num').forEach((t) => t.setAttribute('font-size', fs.toFixed(2)));
    const ratio = small() && svg.dataset.num !== 't4' ? 0.7 : 0.85;
    svg.querySelectorAll('.disc').forEach((d) => d.setAttribute('r', (fs * ratio).toFixed(2)));
  }
  const svgs = document.querySelectorAll('svg.plan, svg.t4');
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver((entries) => entries.forEach((e) => scaleSvg(e.target)));
    svgs.forEach((s) => ro.observe(s));
  } else {
    const all = () => svgs.forEach(scaleSvg);
    all();
    window.addEventListener('resize', all);
  }

  /* ---------- 2. The room moves once ----------
     When the plan first comes into view, three tables change state over about four
     seconds, then the room rests. Under five seconds of motion, so no control is needed;
     with reduced motion the room simply shows its starting states. */
  const plan = document.getElementById('plan');
  if (plan && !reduce.matches) {
    const SEQ = [[600, 4, 'paying'], [2000, 10, 'paid'], [3400, 3, 'open']];
    let started = false;
    const set = (n, state) => {
      const g = plan.querySelector(`.t[data-n="${n}"]`);
      if (!g || reduce.matches) return;
      g.dataset.state = state;
      if (state === 'paying') {
        g.classList.add('pulse');
        const ring = g.querySelector('.ring');
        const done = () => g.classList.remove('pulse');
        if (ring) ring.addEventListener('animationend', done, { once: true });
        window.setTimeout(done, 3000);
      }
    };
    const start = () => {
      if (started) return;
      started = true;
      SEQ.forEach(([t, n, s]) => window.setTimeout(() => set(n, s), t));
    };
    let inView = false;
    const tryStart = () => { if (inView && !document.hidden) start(); };
    document.addEventListener('visibilitychange', tryStart);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        tryStart();
        if (started) io.disconnect();
      }, { threshold: 0.35 });
      io.observe(plan);
    } else {
      inView = true;
      tryStart();
    }
  }

  /* ---------- 3. One table, four states (radiogroup) ---------- */
  const group = document.querySelector('.states');
  const stage = document.querySelector('.stage');
  if (group && stage) {
    const radios = Array.from(group.querySelectorAll('[role="radio"]'));
    const texts = Array.from(document.querySelectorAll('.state-text [data-state]'));
    const table = stage.querySelector('.t4 .t');
    const phone = stage.querySelector('.phone');
    const PHONE = {
      open: "Guest's phone showing the bill for table 12 at Cedar & Sage",
      paying: "Guest's phone showing the payment screen: paying JOD 22.649 by card",
    };

    const select = (r, focus) => {
      const s = r.dataset.state;
      radios.forEach((x) => {
        const on = x === r;
        x.setAttribute('aria-checked', String(on));
        x.tabIndex = on ? 0 : -1;
      });
      if (focus) r.focus();
      if (stage.dataset.state === s) return;
      stage.dataset.state = s;
      stage.classList.remove('is-drawing');
      void stage.offsetWidth;                 // restart the leader's draw for this change only
      stage.classList.add('is-drawing');
      if (table) {
        table.dataset.state = s;
      }
      texts.forEach((p) => { p.hidden = p.dataset.state !== s; });
      if (phone && PHONE[s]) phone.setAttribute('aria-label', PHONE[s]);
    };

    radios.forEach((r) => r.addEventListener('click', () => select(r, false)));
    group.addEventListener('keydown', (e) => {
      const n = radios.length;
      const at = radios.indexOf(document.activeElement);
      if (at < 0) return;
      let to;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': to = (at + 1) % n; break;
        case 'ArrowLeft': case 'ArrowUp': to = (at - 1 + n) % n; break;
        case 'Home': to = 0; break;
        case 'End': to = n - 1; break;
        case ' ': case 'Enter': to = at; break;
        default: return;
      }
      e.preventDefault();
      select(radios[to], true);
    });
  }
})();
