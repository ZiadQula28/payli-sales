/* Payli Round 3, Concept 03. Chrome, product snapshots, filmstrip, enquiry form. Classic script, no dependencies. */
(function () {
  'use strict';
  var doc = document;
  var APPEARANCE = { theme: 'bold', brand: '#1D35C9', accent: '#FFD966' };
  window.PayliSite = { appearance: APPEARANCE };

  function all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  /* ----- Header: transparent while a scene is under it, White over reading rooms ----- */
  var hd = doc.querySelector('.hd');
  var clear = all('[data-hd="clear"]');
  if (hd && clear.length) {
    var queued = false;
    var checkHeader = function () {
      queued = false;
      var line = hd.offsetHeight;
      /* Clear only while a scene begins at the top edge; once it is scrolled into, the bar turns White so nothing reads through it. */
      var over = clear.some(function (el) { var r = el.getBoundingClientRect(); return r.top <= line && r.top > -32 && r.bottom > line; });
      hd.classList.toggle('hd--clear', over);
    };
    var ask = function () { if (!queued) { queued = true; window.requestAnimationFrame(checkHeader); } };
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    checkHeader();
  }

  /* ----- The title panel ----- */
  var menu = doc.querySelector('.turner-menu');
  if (menu) {
    var summary = menu.querySelector('summary');
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) { menu.open = false; summary.focus(); }
    });
    doc.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
    menu.addEventListener('focusout', function (e) {
      if (menu.open && e.relatedTarget && !menu.contains(e.relatedTarget)) menu.open = false;
    });
  }

  /* ----- Product snapshots: data-snap="scenario:at:surface" ----- */
  function snapshots() {
    var PD = window.PayliDemo;
    var holders = all('[data-snap]');
    if (!holders.length) return;
    if (!PD || !PD.snapshot) { doc.documentElement.classList.add('no-engine'); return; }
    holders.forEach(function (el) {
      var p = el.getAttribute('data-snap').split(':');
      var opts = {
        scenario: p[0], at: p[1], surface: p[2] || 'phone',
        lang: el.getAttribute('data-lang') || 'en',
        appearance: APPEARANCE, frame: false, statusBar: true, caption: false, clockTime: '14:32'
      };
      if (el.hasAttribute('data-variant')) opts.variant = el.getAttribute('data-variant');
      if (el.hasAttribute('data-sound')) opts.sound = true;
      if (el.hasAttribute('data-details')) opts.detailsOpen = true;
      try { PD.snapshot(el, opts); } catch (err) { el.setAttribute('data-snap-failed', ''); }
    });
  }
  snapshots();

  /* ----- Filmstrip: native scrolling; the two buttons only call scrollBy ----- */
  all('[data-strip]').forEach(function (wrap) {
    var track = wrap.querySelector('[data-strip-track]');
    var prev = wrap.querySelector('[data-strip-prev]');
    var next = wrap.querySelector('[data-strip-next]');
    if (!track) return;
    function step() { var f = track.querySelector('li'); return f ? f.getBoundingClientRect().width + 24 : 320; }
    function move(dir) {
      var smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
      track.scrollBy({ left: dir * step(), behavior: smooth ? 'smooth' : 'auto' });
    }
    function sync() {
      if (!prev || !next) return;
      prev.disabled = track.scrollLeft < 8;
      next.disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 8;
    }
    if (prev) prev.addEventListener('click', function () { move(-1); });
    if (next) next.addEventListener('click', function () { move(1); });
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  });

  /* ----- Enquiry form: composes an email in the visitor's own mail app ----- */
  var form = doc.querySelector('[data-enquiry]');
  if (form) {
    var TO = 'info' + '@' + 'payli.io';
    var after = doc.querySelector('[data-enquiry-after]');
    var details = doc.querySelector('[data-enquiry-details]');
    var copyBtn = doc.querySelector('[data-enquiry-copy]');
    var copyNote = doc.querySelector('[data-enquiry-copied]');
    var summaryBox = doc.querySelector('[data-enquiry-errors]');
    var MESSAGES = {
      name: 'Add your name, so we know who to reply to.',
      company: 'Add your restaurant or company.',
      email: 'Add an email address we can reply to, like name@restaurant.com.'
    };
    function field(name) { return form.elements[name]; }
    function value(name) { var f = field(name); return f && f.value ? String(f.value).trim() : ''; }
    function setError(name, msg) {
      var f = field(name);
      var note = doc.getElementById('err-' + name);
      if (!f || !note) return;
      if (msg) { f.setAttribute('aria-invalid', 'true'); note.textContent = msg; note.hidden = false; }
      else { f.removeAttribute('aria-invalid'); note.textContent = ''; note.hidden = true; }
    }
    function check(name) {
      var v = value(name);
      var bad = !v || (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v));
      setError(name, bad ? MESSAGES[name] : '');
      return !bad;
    }
    ['name', 'company', 'email'].forEach(function (n) {
      var f = field(n);
      if (f) f.addEventListener('blur', function () { if (f.getAttribute('aria-invalid')) check(n); });
      if (f) f.addEventListener('input', function () { if (f.getAttribute('aria-invalid')) check(n); });
    });
    function compose() {
      var interest = value('interest') || 'Something else';
      var lines = [
        'Name: ' + value('name'),
        'Restaurant or company: ' + value('company')
      ];
      if (value('role')) lines.push('Role: ' + value('role'));
      lines.push('Email: ' + value('email'));
      if (value('phone')) lines.push('Phone: ' + value('phone'));
      lines.push('Interested in: ' + interest);
      if (value('venues')) lines.push('Number of venues: ' + value('venues'));
      if (value('message')) { lines.push(''); lines.push(value('message')); }
      return { subject: 'Payli enquiry: ' + interest + ' — ' + value('company'), body: lines.join('\n') };
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = ['name', 'company', 'email'].filter(function (n) { return !check(n); });
      if (summaryBox) {
        summaryBox.hidden = !bad.length;
        summaryBox.textContent = bad.length ? (bad.length === 1 ? 'One field needs a look before the email can be written.' : bad.length + ' fields need a look before the email can be written.') : '';
      }
      if (bad.length) { field(bad[0]).focus(); return; }
      var mail = compose();
      if (details) details.value = 'To: ' + TO + '\nSubject: ' + mail.subject + '\n\n' + mail.body;
      if (after) { after.hidden = false; }
      window.location.href = 'mailto:' + TO + '?subject=' + encodeURIComponent(mail.subject) + '&body=' + encodeURIComponent(mail.body);
      if (after && after.focus) { try { after.focus({ preventScroll: true }); } catch (err) { after.focus(); } }
    });
    if (copyBtn && details) {
      copyBtn.addEventListener('click', function () {
        function done(ok) { if (copyNote) { copyNote.hidden = false; copyNote.textContent = ok ? 'Copied. Paste it into an email to ' + TO + '.' : 'Copying is blocked here. Select the text above and copy it.'; } }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(details.value).then(function () { done(true); }, function () { legacy(); });
        } else { legacy(); }
        function legacy() {
          details.focus(); details.select();
          var ok = false;
          try { ok = doc.execCommand('copy'); } catch (err) { ok = false; }
          done(ok);
        }
      });
    }
  }
})();
