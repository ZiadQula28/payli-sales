// Payli, theme 10: After Hours. Three small behaviours, nothing else.
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* 1. The wake: the phone's screen comes on once, when 55% of its section is in view. */
  var wake = document.getElementById('wake');
  if (wake) {
    var finish = function () {
      wake.classList.add('is-awake');
      window.setTimeout(function () { wake.classList.add('is-done'); }, 1200);
    };
    if (reduce.matches || !('IntersectionObserver' in window)) {
      wake.classList.add('is-awake', 'is-done');
    } else {
      // A tall section can never be 55% visible on a short screen; cap the threshold so it still fires.
      var ratio = Math.min(0.55, (window.innerHeight / wake.offsetHeight) * 0.8);
      if (wake.getBoundingClientRect().bottom < 0) {
        // Page restored below the section: show it lit, without replaying the moment.
        wake.classList.add('is-awake', 'is-done');
      } else {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            var past = e.isIntersecting && e.boundingClientRect.top < 0;
            if ((e.isIntersecting && e.intersectionRatio >= ratio - 0.001) || past) { finish(); io.disconnect(); }
          });
        }, { threshold: [0, ratio] });
        io.observe(wake);
      }
    }
  }

  /* 2. After the top bar has scrolled away, "Menu" stays fixed on a small Room chip. */
  var bar = document.querySelector('.top');
  var menuBtn = document.getElementById('menu-btn');
  if (bar && menuBtn && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      menuBtn.classList.toggle('is-pinned', !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe(bar);
  }

  /* 3. The overlay menu: a real modal <dialog>. Native invoker commands open and close it where
     supported; otherwise these handlers do. Tab is kept inside, Escape closes, focus returns to Menu. */
  var dialog = document.getElementById('menu');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  var native = 'command' in HTMLButtonElement.prototype;
  var closeBtn = dialog.querySelector('.menu__close');

  if (!native) {
    menuBtn.addEventListener('click', function () { if (!dialog.open) dialog.showModal(); });
    closeBtn.addEventListener('click', function () { dialog.close(); });
  }

  dialog.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Tab') return;
    var items = Array.prototype.filter.call(
      dialog.querySelectorAll('a[href], button:not([disabled])'),
      function (el) { return el.offsetParent !== null || el === document.activeElement; }
    );
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (ev.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      ev.preventDefault(); last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault(); first.focus();
    }
  });

  dialog.addEventListener('close', function () {
    menuBtn.focus({ preventScroll: true });
  });
})();
