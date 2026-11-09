/* Theme 07: the one load moment. The opening photograph is drawn open from a
   12%-wide slit at its centre once it has loaded. With reduced motion (or if
   the image fails) it simply appears. Nothing else on the page moves by itself. */
(function () {
  var fig = document.querySelector('.opening__photo');
  if (!fig) return;
  var img = fig.querySelector('img');
  var done = false;

  function open() {
    if (done) return;
    done = true;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { fig.classList.add('is-open'); });
    });
  }

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    fig.classList.add('is-open');
    return;
  }
  if (!img || (img.complete && img.naturalWidth)) { open(); return; }
  img.addEventListener('load', open, { once: true });
  img.addEventListener('error', open, { once: true });
  setTimeout(open, 2500);
})();
