/* Concept 02 shared behaviour: current page, the mobile page switcher, product snapshots,
   lane highlighting in the sequence charts, and the Signal wire used by the home plate and the demo. */
(function () {
  'use strict';
  var doc = document;
  var page = doc.body.getAttribute('data-page');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  /* current page */
  Array.prototype.forEach.call(doc.querySelectorAll('.ix-cell, .mb-row'), function (a) {
    if (a.getAttribute('data-p') === page) a.setAttribute('aria-current', 'page');
  });

  /* mobile page switcher: a disclosure anchored under the bar */
  var sw = doc.querySelector('.mb-sw');
  var panel = doc.getElementById('mb-panel');
  function setOpen(open) {
    if (!sw || !panel) return;
    sw.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
  }
  if (sw && panel) {
    sw.addEventListener('click', function () { setOpen(sw.getAttribute('aria-expanded') !== 'true'); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sw.getAttribute('aria-expanded') === 'true') { setOpen(false); sw.focus(); }
    });
    doc.addEventListener('click', function (e) {
      if (sw.getAttribute('aria-expanded') === 'true' && !e.target.closest('.ix')) setOpen(false);
    });
    window.addEventListener('resize', function () { if (window.innerWidth >= 768) setOpen(false); });
  }

  /* product snapshots: data-snap="scenario:moment:surface[:variant]" */
  var APPEARANCE = { theme: 'classic', brand: '#043C44', accent: '#19C3A6' };
  function snapshots(scope) {
    var nodes = (scope || doc).querySelectorAll('[data-snap]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute('data-snap-done')) return;
      var p = el.getAttribute('data-snap').split(':');
      var opts = { scenario: p[0], at: p[1], surface: p[2] || 'phone', frame: false, clockTime: '14:32' };
      if (p[3]) opts.variant = p[3];
      if (el.getAttribute('data-lang')) opts.lang = el.getAttribute('data-lang');
      var ap = { theme: el.getAttribute('data-theme') || APPEARANCE.theme, brand: el.getAttribute('data-brand') || APPEARANCE.brand, accent: el.getAttribute('data-accent') || APPEARANCE.accent };
      opts.appearance = ap;
      if (el.getAttribute('data-sound')) opts.sound = true;
      try {
        window.PayliDemo.snapshot(el, opts);
        el.setAttribute('data-snap-done', 'true');
      } catch (err) {
        var s = doc.createElement('span');
        s.className = 'snap-fail';
        s.textContent = 'This product screen could not be drawn in your browser.';
        el.appendChild(s);
      }
    });
  }
  if (window.PayliDemo && window.PayliDemo.snapshot) snapshots();
  else Array.prototype.forEach.call(doc.querySelectorAll('[data-snap]'), function (el) {
    var s = doc.createElement('span'); s.className = 'snap-fail'; s.textContent = 'The product screen did not load. Try the demo page, or book a walkthrough.'; el.appendChild(s);
  });

  /* sequence charts: press or hover a lane label and the other lanes step back */
  Array.prototype.forEach.call(doc.querySelectorAll('[data-seq]'), function (seq) {
    var pinned = null;
    var lanes = seq.querySelectorAll('.seq-lane');
    function show(lane) {
      Array.prototype.forEach.call(lanes, function (b) {
        b.setAttribute('data-dim', lane && b.getAttribute('data-lane') !== lane ? 'true' : 'false');
      });
      Array.prototype.forEach.call(seq.querySelectorAll('.seq-st'), function (st) {
        var has = (' ' + st.getAttribute('data-lanes') + ' ').indexOf(' ' + lane + ' ') !== -1;
        st.setAttribute('data-dim', lane && !has ? 'true' : 'false');
      });
      ['floor', 'pos', 'payli', 'guest', 'prov', 'staff'].forEach(function (k) {
        if (lane && k !== lane) seq.style.setProperty('--c-' + k, 'rgba(119,121,114,.35)');
        else seq.style.removeProperty('--c-' + k);
      });
    }
    Array.prototype.forEach.call(lanes, function (b) {
      var lane = b.getAttribute('data-lane');
      b.addEventListener('mouseenter', function () { show(lane); });
      b.addEventListener('mouseleave', function () { show(pinned); });
      b.addEventListener('focus', function () { show(lane); });
      b.addEventListener('blur', function () { show(pinned); });
      b.addEventListener('click', function () {
        pinned = pinned === lane ? null : lane;
        Array.prototype.forEach.call(lanes, function (o) { o.setAttribute('aria-pressed', o.getAttribute('data-lane') === pinned ? 'true' : 'false'); });
        show(pinned);
      });
    });
  });

  /* the Signal wire: a line between two elements; fire(dir) sends a dot along it */
  function Wire(el, opts) {
    var dot = doc.createElement('span');
    dot.className = 'wire-dot';
    el.appendChild(dot);
    var vertical = false, len = 0, anim = null, timer = null;
    function place() {
      var host = el.offsetParent || el.parentNode;
      var a = opts.from(), b = opts.to();
      if (!a || !b || !host) return;
      var h = host.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      vertical = typeof opts.vertical === 'function' ? opts.vertical() : !!opts.vertical;
      el.classList.toggle('is-v', vertical);
      if (vertical) {
        var x = (opts.x ? opts.x(ra, rb) : rb.left + rb.width / 2) - h.left;
        var top = ra.bottom - h.top, bottom = rb.top - h.top;
        if (bottom < top) { top = rb.bottom - h.top; bottom = ra.top - h.top; }
        len = Math.max(0, bottom - top);
        el.style.left = x + 'px'; el.style.top = top + 'px'; el.style.height = len + 'px'; el.style.width = '0';
      } else {
        var y = (opts.y ? opts.y(ra, rb) : rb.top + rb.height * 0.36) - h.top;
        var left = ra.right - h.left, right = rb.left - h.left;
        len = Math.max(0, right - left);
        el.style.left = left + 'px'; el.style.top = y + 'px'; el.style.width = len + 'px'; el.style.height = '0';
      }
    }
    function fire(dir, done) {
      /* dir: 'fwd' = from -> to, 'back' = to -> from */
      place();
      el.classList.add('is-hot');
      clearTimeout(timer);
      if (anim) { anim.cancel(); anim = null; }
      var still = reduce && reduce.matches;
      if (still || !dot.animate) {
        /* reduced motion: nothing travels; the wire turns Signal for 600 ms and the receiving side reacts at once */
        if (done) done();
        timer = setTimeout(function () { if (!opts.keepHot || !opts.keepHot()) el.classList.remove('is-hot'); }, 600);
        return;
      }
      var p0 = dir === 'back' ? len : 0, p1 = dir === 'back' ? 0 : len;
      var f = vertical ? function (v) { return 'translateY(' + v + 'px)'; } : function (v) { return 'translateX(' + v + 'px)'; };
      anim = dot.animate([{ transform: f(p0), opacity: 1 }, { transform: f(p1), opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)' });
      anim.onfinish = function () {
        anim = null;
        if (done) done();
        timer = setTimeout(function () { if (!opts.keepHot || !opts.keepHot()) el.classList.remove('is-hot'); }, 600);
      };
    }
    function flash(target) {
      if (!target) return;
      target.classList.add('is-rx');
      setTimeout(function () { target.classList.remove('is-rx'); }, 600);
    }
    function settle() { if (opts.keepHot) el.classList.toggle('is-hot', !!opts.keepHot()); }
    window.addEventListener('resize', place);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(place);
    window.addEventListener('load', place);
    if (window.ResizeObserver) { var ro = new ResizeObserver(place); ro.observe(opts.from()); ro.observe(opts.to()); }
    place();
    return { place: place, fire: fire, flash: flash, settle: settle };
  }

  window.C02 = { Wire: Wire, snapshots: snapshots, reduce: function () { return !!(reduce && reduce.matches); }, appearance: APPEARANCE };
})();
