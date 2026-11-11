/* Payli Concept 01: site chrome. Classic script, no dependencies.
   1. The condensed bar returns on scroll up.
   2. The Carte sheet (mobile contents) opens as a <dialog>.
   3. Static product pictures are drawn by the shared demo engine (PayliDemo.snapshot).
   4. <details> open and close with a short height animation. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. header return */
  var lastY = window.pageYOffset, ticking = false;
  function onScroll() {
    var y = window.pageYOffset;
    if (y < 8) { root.classList.remove('hs-pinned', 'hs-shown'); }
    else if (y > 220) {
      if (!root.classList.contains('hs-pinned')) { root.classList.add('hs-pinned'); void root.offsetWidth; }
      if (y < lastY - 4) root.classList.add('hs-shown');
      else if (y > lastY + 4) root.classList.remove('hs-shown');
    } else if (!root.classList.contains('hs-shown')) { root.classList.remove('hs-pinned'); }
    lastY = y; ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });

  /* 2. the Carte sheet */
  var sheet = document.getElementById('hs-carte');
  var opener = document.querySelector('[data-hs-contents]');
  if (sheet && opener && typeof sheet.showModal === 'function') {
    opener.addEventListener('click', function () { sheet.showModal(); opener.setAttribute('aria-expanded', 'true'); });
    sheet.addEventListener('close', function () { opener.setAttribute('aria-expanded', 'false'); opener.focus(); });
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet) { sheet.close(); return; }             // a tap on the backdrop
      if (e.target.closest('[data-hs-close]')) sheet.close();
    });
    window.addEventListener('resize', function () { if (sheet.open && window.innerWidth > 900) sheet.close(); });
  } else if (opener) {
    opener.addEventListener('click', function () { var f = document.getElementById('hs-foot'); if (f) f.scrollIntoView(); });
  }

  /* 3. product pictures */
  var APPEARANCE = { theme: 'classic', brand: '#4A0F22', accent: '#B23A5A' };
  function drawSnapshots() {
    if (!window.PayliDemo || !window.PayliDemo.snapshot) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-snap]'), function (el) {
      var p = el.getAttribute('data-snap').split(':');
      var opts = {
        scenario: p[0], at: p[1], surface: p[2] || 'phone', appearance: APPEARANCE,
        clockTime: p[0] === 'table' ? '21:40' : '10:12',
      };
      if (el.hasAttribute('data-variant')) opts.variant = el.getAttribute('data-variant');
      if (el.hasAttribute('data-lang')) opts.lang = el.getAttribute('data-lang');
      try { window.PayliDemo.snapshot(el, opts); el.setAttribute('data-snap-done', ''); }
      catch (err) { el.textContent = ''; }
    });
  }
  drawSnapshots();

  /* 4. <details> height */
  Array.prototype.forEach.call(document.querySelectorAll('details[data-hs-fold]'), function (d) {
    var summary = d.querySelector('summary');
    var body = d.querySelector('[data-hs-fold-body]');
    if (!summary || !body || reduce || !body.animate) return;
    var anim = null;
    summary.addEventListener('click', function (e) {
      e.preventDefault();
      if (anim) anim.cancel();
      if (d.open) {
        anim = body.animate({ height: [body.offsetHeight + 'px', '0px'], opacity: [1, 0] }, { duration: 220, easing: 'ease' });
        anim.onfinish = function () { d.open = false; anim = null; };
      } else {
        d.open = true;
        anim = body.animate({ height: ['0px', body.offsetHeight + 'px'], opacity: [0, 1] }, { duration: 220, easing: 'ease' });
        anim.onfinish = function () { anim = null; };
      }
    });
  });
})();
