/* Home plate: live mounts made inert, a visitor-started sequence, and the Signal between them. */
(function () {
  'use strict';
  var P = window.PayliDemo, C = window.C02;
  var plate = document.querySelector('[data-hero]');
  if (!plate) return;
  var cardEl = plate.querySelector('[data-hero-card]');
  var phoneEl = plate.querySelector('[data-hero-phone]');
  var frame = plate.querySelector('.ph');
  var line = document.querySelector('[data-hero-event]');
  var legal = document.querySelector('[data-hero-legal]');
  var play = document.querySelector('[data-hero-play]');
  if (!P || !P.create) {
    if (line) line.textContent = 'The live plate did not load. The demo page and the walkthrough are one step away.';
    if (play) play.hidden = true;
    return;
  }
  var demo = P.create({ scenario: 'pager', appearance: C.appearance });
  demo.seed('ready');
  P.mountStaff(cardEl, demo, { variant: 'card' });
  P.mountPhone(phoneEl, demo, { frame: false, audio: false });
  cardEl.setAttribute('inert', '');
  phoneEl.setAttribute('inert', '');
  if (legal) legal.textContent = P.legal.all + ' ' + P.legal.pager;

  var narrow = window.matchMedia('(max-width: 767px)');
  var wire = C.Wire(plate.querySelector('.wire'), {
    from: function () { return cardEl; },
    to: function () { return frame; },
    vertical: function () { return narrow.matches; },
    x: function (ra, rb) { return rb.right - 44; },
    keepHot: function () { var s = demo.getState(); return s.pager && s.pager.order && s.pager.order.status === 'ready'; }
  });
  wire.settle();

  var FWD = { start: 1, adjust: 1, ready: 1, ring_again: 1, complete: 1, cancel: 1 };
  var BACK = { scan: 1, alert_received: 1, on_my_way: 1, notify_allow: 1 };
  var playing = null, restore = null;
  function setLine(text) { if (line && text) line.textContent = text; }
  function label() { if (play) play.textContent = playing ? 'Stop' : 'Watch the sequence'; }

  demo.subscribe(function (state, ev) {
    if (ev.text && ev.type !== 'autoplay_start' && ev.type !== 'autoplay_stop' && ev.type !== 'reset') setLine(ev.text.replace(/\.$/, '') + '.');
    if (FWD[ev.type]) wire.fire('fwd', function () { wire.flash(frame); });
    else if (BACK[ev.type]) wire.fire('back', function () { wire.flash(cardEl); });
    else wire.settle();
    if (ev.type === 'autoplay_stop') {
      playing = null; label();
      clearTimeout(restore);
      restore = setTimeout(function () { demo.seed('ready'); wire.settle(); setLine('Staff pressed Ready & ring. Guest’s phone received the alert.'); }, ev.reason === 'end' ? 2600 : 0);
    }
  });
  setLine('Staff pressed Ready & ring. Guest’s phone received the alert.');

  if (play) play.addEventListener('click', function () {
    clearTimeout(restore);
    if (playing) { playing.stop(); return; }
    playing = P.autoplay(demo, { stepMs: 1600 });
    label();
    setLine('The sequence starts: the guest scans the QR at the counter.');
  });
})();
