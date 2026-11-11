/* Concept 02 inner pages: leader lines for the exploded views, keyboard access for the
   sideways screen rows on small screens, and the enquiry form (it composes an email; it sends nothing). */
(function () {
  'use strict';
  var doc = document;
  var SVG = 'http://www.w3.org/2000/svg';
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  /* ---------- exploded views ---------- */
  function findText(root, q) {
    var best = null, len = Infinity;
    each(root.querySelectorAll('*'), function (el) {
      var t = norm(el.textContent);
      if (t.indexOf(q) !== -1 && t.length < len && el.getClientRects().length) { best = el; len = t.length; }
    });
    return best;
  }
  function draw(xv) {
    var svg = xv.querySelector('.xv-lines');
    var fig = xv.querySelector('[data-xv-fig]');
    if (!svg || !fig) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (window.getComputedStyle(svg).display === 'none') return;
    var host = xv.getBoundingClientRect();
    var f = fig.getBoundingClientRect();
    if (!host.width || !f.width) return;
    svg.setAttribute('viewBox', '0 0 ' + host.width + ' ' + host.height);
    each(xv.querySelectorAll('.xv-note'), function (note) {
      var r = note.getBoundingClientRect();
      var onLeft = r.left < f.left;
      var tx, ty;
      var find = note.getAttribute('data-find');
      if (find) {
        var el = findText(fig, find);
        if (!el) return;
        var e = el.getBoundingClientRect();
        ty = e.top + e.height / 2;
        tx = onLeft ? Math.max(e.left - 7, f.left + 4) : Math.min(e.right + 7, f.right - 4);
      } else {
        var p = (note.getAttribute('data-to') || '50,50').split(',');
        tx = f.left + f.width * parseFloat(p[0]) / 100;
        ty = f.top + f.height * parseFloat(p[1]) / 100;
      }
      var line = doc.createElementNS(SVG, 'line');
      line.setAttribute('x1', (onLeft ? r.right : r.left) - host.left);
      line.setAttribute('y1', r.top + 0.5 - host.top);
      line.setAttribute('x2', tx - host.left);
      line.setAttribute('y2', ty - host.top);
      svg.appendChild(line);
      var dot = doc.createElementNS(SVG, 'circle');
      dot.setAttribute('cx', tx - host.left);
      dot.setAttribute('cy', ty - host.top);
      dot.setAttribute('r', 4);
      svg.appendChild(dot);
    });
  }
  var views = doc.querySelectorAll('[data-xv]');
  function drawAll() { each(views, draw); }
  if (views.length) {
    drawAll();
    window.addEventListener('resize', drawAll);
    window.addEventListener('load', drawAll);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(drawAll);
    if (window.PayliDemo && window.PayliDemo.whenReady) window.PayliDemo.whenReady().then(drawAll, function () {});
    if (window.ResizeObserver) { var ro = new ResizeObserver(drawAll); each(views, function (v) { ro.observe(v); }); }
  }

  /* ---------- sideways rows: focusable only while they scroll ---------- */
  var rows = doc.querySelectorAll('[data-scroll-row]');
  function rowFocus() {
    each(rows, function (row) {
      if (row.scrollWidth > row.clientWidth + 2) row.setAttribute('tabindex', '0');
      else row.removeAttribute('tabindex');
    });
  }
  if (rows.length) { rowFocus(); window.addEventListener('resize', rowFocus); window.addEventListener('load', rowFocus); }

  /* ---------- enquiry form ---------- */
  var form = doc.querySelector('[data-enquiry]');
  if (!form) return;
  var TO = 'info@payli.io';
  var pvSubject = doc.querySelector('[data-pv-subject]');
  var pvBody = doc.querySelector('[data-pv-body]');
  var fall = doc.querySelector('[data-fallback]');
  var copyBtn = doc.querySelector('[data-copy]');
  var copyOk = doc.querySelector('[data-copy-ok]');
  form.setAttribute('novalidate', '');

  function val(name) { var el = form.elements[name]; return el ? norm(el.value) : ''; }
  function radio(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function compose(forPreview) {
    var interest = radio('interest') || 'Something else';
    var venue = val('restaurant');
    var subject = 'Payli enquiry: ' + interest + ' — ' + (venue || (forPreview ? 'your restaurant or company' : ''));
    var lines = [];
    function add(label, value, hint) {
      if (value) lines.push(label + ': ' + value);
      else if (forPreview && hint) lines.push(label + ': ' + hint);
    }
    add('Name', val('name'), '(your name)');
    add('Restaurant or company', venue, '(your restaurant or company)');
    add('Role', val('role'));
    add('Email', val('email'), '(your email)');
    add('Phone', val('phone'));
    add('Interested in', interest);
    add('Number of venues', radio('venues'));
    var msg = form.elements.message ? form.elements.message.value.replace(/\s+$/, '') : '';
    if (msg) lines.push('', 'Message:', msg);
    return { subject: subject, body: lines.join('\n') };
  }
  function preview() {
    var m = compose(true);
    if (pvSubject) pvSubject.textContent = m.subject;
    if (pvBody) pvBody.textContent = m.body;
  }
  form.addEventListener('input', preview);
  form.addEventListener('change', preview);
  preview();

  var RULES = [
    { name: 'name', test: function (v) { return v.length > 0; }, msg: 'Enter your name.' },
    { name: 'restaurant', test: function (v) { return v.length > 0; }, msg: 'Enter your restaurant or company.' },
    { name: 'email', test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }, msg: 'Enter an email address we can reply to.' }
  ];
  function check(rule) {
    var el = form.elements[rule.name];
    var err = doc.getElementById('err-' + rule.name);
    var ok = rule.test(norm(el.value));
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (err) { err.textContent = ok ? '' : rule.msg; err.hidden = ok; }
    return ok;
  }
  RULES.forEach(function (rule) {
    var el = form.elements[rule.name];
    el.addEventListener('blur', function () { if (el.getAttribute('aria-invalid') === 'true' || norm(el.value)) check(rule); });
    el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') check(rule); });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var first = null;
    RULES.forEach(function (rule) { if (!check(rule) && !first) first = form.elements[rule.name]; });
    if (first) { first.focus(); return; }
    var m = compose(false);
    if (fall) fall.hidden = false;
    window.location.href = 'mailto:' + TO + '?subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.body);
  });
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var m = compose(false);
    var text = 'To: ' + TO + '\nSubject: ' + m.subject + '\n\n' + m.body;
    function done(ok) { if (copyOk) copyOk.textContent = ok ? 'Copied. Paste it into an email to ' + TO + '.' : 'Copying is blocked in this browser. Select the preview and copy it by hand.'; }
    function legacy() {
      var ta = doc.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-200px';
      doc.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (err) { ok = false; }
      doc.body.removeChild(ta); done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, legacy);
    else legacy();
  });
})();
