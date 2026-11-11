/* Concept 02 demo page: the workbench.
   One store drives the board, the phone, the wire, the lifecycle track, the record and, on small
   screens, the fixed console (built on demo.can / demo.dispatch / demo.subscribe). */
(function () {
  'use strict';
  var P = window.PayliDemo, C = window.C02, doc = document;
  function q(s, r) { return (r || doc).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  var stage = q('[data-stage]');
  if (!stage) return;
  if (!P || !P.create || !P.mountPhone || !C) {
    /* ruling D: no empty stage */
    q('[data-fail]').hidden = false;
    ['.wb-intro', '.wb-bar', '[data-stage]', '.wb-under', '[data-console]'].forEach(function (s) { var n = q(s); if (n) n.hidden = true; });
    return;
  }

  var boardEl = q('[data-board]'), phoneEl = q('[data-phone]'), frame = q('.ph', stage), anchor = q('.wb-anchor');
  var con = q('[data-console]'), sheet = q('[data-sheet]'), sheetBoard = q('[data-sheet-board]');
  var guideStaff = q('[data-guide="staff"]'), guideGuest = q('[data-guide="guest"]');
  var intro = q('[data-intro]'), tagEl = q('[data-tag]'), legalEl = q('[data-legal]');
  var trackEl = q('[data-track]'), trackTitle = q('[data-track-title]'), trackNote = q('[data-track-note]'), conTrack = q('[data-con-track]');
  var logEl = q('[data-log]'), logMore = q('[data-log-more]');
  var playBtn = q('[data-play]');
  var small = window.matchMedia('(max-width: 699px)');

  var demo = P.create({ scenario: 'pager', appearance: C.appearance });
  P.mountStaff(boardEl, demo, { variant: 'board' });
  P.mountPhone(phoneEl, demo, { frame: false });
  var sheetMount = null;
  var playing = null, trackHold = null;

  /* The acceptance path is restaurant-driven, so the counter scenario opens with the guest already
     watching: Start and Ready & ring change the phone at the first press. Play the sequence shows the
     whole run from the scan. */
  function begin(scn) {
    if (demo.getState().scenario !== scn) demo.setScenario(scn); else demo.reset();
    if (scn === 'pager') demo.seed('received');
  }

  var wire = C.Wire(q('.wire', stage), {
    from: function () { return small.matches ? frame : boardEl; },
    to: function () { return small.matches ? anchor : frame; },
    vertical: function () { return small.matches; }
  });
  window.addEventListener('scroll', wire.place, { passive: true });

  function cross(toGuest) {
    var dir = toGuest ? (small.matches ? 'back' : 'fwd') : (small.matches ? 'fwd' : 'back');
    var target = toGuest ? frame : (small.matches ? con : boardEl);
    wire.fire(dir, function () { wire.flash(target); });
  }
  var TO_GUEST = { start: 1, adjust: 1, ready: 1, ring_again: 1, complete: 1, cancel: 1, new_order: 1 };
  var TO_STAFF = { alert_received: 1, on_my_way: 1, to_pay: 1, payment: 1, rating: 1 };

  /* ---------- renderers ---------- */
  function renderGuide(st) {
    var g = st.guide, text = '', body = '';
    if (st.autoplay) { text = 'The sequence is playing.'; body = 'Press any control to take over.'; }
    else if (g) { text = g.title; body = g.body || ''; }
    var side = !st.autoplay && g && g.side === 'guest' ? 'guest' : 'staff';
    [['staff', guideStaff], ['guest', guideGuest]].forEach(function (p) {
      var node = p[1];
      var want = p[0] === side ? text + '|' + body : '';
      if (node.getAttribute('data-v') === want) return;
      node.setAttribute('data-v', want);
      node.textContent = '';
      if (p[0] === side && text) {
        var w = el('span', 'wb-guide-in');
        w.appendChild(el('b', '', text + ' '));
        if (body) w.appendChild(el('span', '', body));
        node.appendChild(w);
      }
    });
    var cn = q('[data-con-next]');
    if (cn) cn.textContent = st.autoplay ? 'The sequence is playing. Press any control to take over.' : (g ? (g.side === 'guest' ? 'On the phone: ' : '') + g.title : '');
  }

  function trackModel(st) {
    if (st.scenario === 'pager') {
      var o = st.pager.order, order = ['received', 'preparing', 'ready', 'collected'];
      var names = ['Received', 'Preparing', 'Ready', 'Collected'];
      var i = order.indexOf(o.status);
      return {
        title: 'Order ' + o.ref + ' in its lifecycle',
        note: o.status === 'cancelled' ? 'Order ' + o.ref + ' was cancelled. Staff can cancel from Received, Preparing or Ready, with a reason.' : 'Only staff move an order. Nothing advances on a timer.',
        steps: names.map(function (n, k) { return { label: n, s: i === -1 ? 'off' : k < i ? 'done' : k === i ? 'now' : 'todo' }; })
      };
    }
    var t = st.table, s = t.table12.status;
    var idx = s === 'paying' ? 2 : s === 'paid' ? (t.pos.posted ? 4 : 3) : 1;
    if (trackHold !== null) idx = trackHold;
    var labels = ['Empty', 'Bill open', 'Paying now', 'Paid', 'Sale posted to the POS'];
    return {
      title: 'Table 12 on the floor',
      note: 'Only a fully paid bill is posted to the POS. Partial payments never are.',
      steps: labels.map(function (n, k) { return { label: n, s: k < idx ? 'done' : k === idx ? 'now' : 'todo' }; })
    };
  }
  function renderTrack(st) {
    var m = trackModel(st);
    trackTitle.textContent = m.title;
    trackNote.textContent = m.note;
    [trackEl, conTrack].forEach(function (list) {
      if (!list) return;
      if (list.children.length !== m.steps.length) {
        list.textContent = '';
        m.steps.forEach(function () { list.appendChild(el('li')); });
      }
      m.steps.forEach(function (s, k) {
        var li = list.children[k];
        if (li.textContent !== s.label) li.textContent = s.label;
        li.setAttribute('data-s', s.s);
        if (s.s === 'now') li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
    });
  }

  function two(n) { return n < 10 ? '0' + n : '' + n; }
  function renderLog(st) {
    var items = st.log.filter(function (e) { return e.type !== 'autoplay_start' && e.type !== 'seed'; }).slice(-8).reverse();
    var key = items.map(function (e) { return e.id; }).join(',');
    if (logEl.getAttribute('data-k') === key) return;
    logEl.setAttribute('data-k', key);
    logEl.textContent = '';
    if (!items.length) { logEl.appendChild(el('li', 'log-empty', 'Nothing yet. Press a control on either side.')); return; }
    items.forEach(function (e) {
      var li = el('li');
      var mk = el('span', 'log-mk'); mk.setAttribute('data-side', e.side); mk.setAttribute('aria-hidden', 'true');
      var d = new Date(e.at), tm = el('time', '', two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()));
      var who = e.side === 'staff' ? 'Restaurant: ' : e.side === 'guest' ? 'Guest: ' : 'System: ';
      var tx = el('span'); tx.appendChild(el('span', 'sr', who)); tx.appendChild(doc.createTextNode(e.text));
      li.appendChild(mk); li.appendChild(tm); li.appendChild(tx);
      logEl.appendChild(li);
    });
  }

  function conButton(label, cls, onPress, opts) {
    var b = el('button', 'con-btn' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    if (opts && opts.key) b.setAttribute('data-con', opts.key);
    if (opts && opts.disabled) b.setAttribute('aria-disabled', 'true');
    b.addEventListener('click', function () { if (b.getAttribute('aria-disabled') === 'true') return; onPress(); });
    return b;
  }
  function renderConsole(st) {
    var line = q('[data-con-line]'), acts = q('[data-con-acts]');
    var focusKey = doc.activeElement && doc.activeElement.getAttribute ? doc.activeElement.getAttribute('data-con') : null;
    var parts = [], buttons = [];
    if (st.scenario === 'pager') {
      var o = st.pager.order;
      parts = [['b', o.ref], ['span', o.statusLabel], ['span', o.guestFact && o.guestFact.text ? o.guestFact.text : '', 'con-fact']];
      o.actions.forEach(function (a) {
        buttons.push(conButton(a.label, (a.kind !== 'ghost' ? 'is-main' : '') + (a.next ? ' is-next' : ''), function () { demo.dispatch(a.command); }, { key: a.command, disabled: a.disabled }));
      });
      if (!o.open && demo.can('new_order')) buttons.push(conButton('New order', 'is-main is-next', function () { demo.dispatch('new_order'); }, { key: 'new_order' }));
    } else {
      var t = st.table;
      parts = [['b', 'Table 12'], ['span', t.table12.label], ['span', t.pos.text, 'con-fact']];
      t.staffActions.forEach(function (a) {
        if (a.command === 'refund_last' && a.disabled) return;
        buttons.push(conButton(a.label, (a.command === 'rest_of_table' ? 'is-main' : '') + (a.next ? ' is-next' : ''), function () { demo.dispatch(a.command); }, { key: a.command, disabled: a.disabled }));
      });
    }
    buttons.push(conButton('Board', 'is-board', openSheet, { key: 'board' }));
    var sig = st.scenario + '|' + parts.map(function (p) { return p[1]; }).join('|') + '|' + buttons.map(function (b) { return b.textContent + b.className + b.getAttribute('aria-disabled'); }).join('|');
    if (con.getAttribute('data-k') === sig) return;
    con.setAttribute('data-k', sig);
    line.textContent = '';
    parts.forEach(function (p) { if (p[1]) line.appendChild(el(p[0], p[2] || '', p[1])); });
    acts.textContent = '';
    buttons.forEach(function (b) { acts.appendChild(b); });
    if (focusKey) {
      var again = q('[data-con="' + focusKey + '"]', acts) || q('.con-btn', acts);
      if (again) again.focus();
    }
  }

  function renderChrome(st) {
    qa('[data-scn]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-scn') === st.scenario ? 'true' : 'false'); });
    qa('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lang') === st.lang ? 'true' : 'false'); });
    tagEl.textContent = P.statusTags[st.scenario];
    legalEl.textContent = P.legal.all + ' ' + P.legal[st.scenario];
    playBtn.textContent = st.autoplay ? 'Stop' : 'Play the sequence';
    playBtn.setAttribute('aria-pressed', st.autoplay ? 'true' : 'false');
  }

  function render(st) {
    renderChrome(st); renderGuide(st); renderTrack(st); renderLog(st); renderConsole(st);
  }

  demo.subscribe(function (st, ev) {
    if (ev.type === 'pos_posted') {
      /* Paid first, then the sale runs on to the POS */
      trackHold = 3;
      setTimeout(function () { trackHold = null; renderTrack(demo.getState()); }, C.reduce() ? 0 : 520);
    }
    if (ev.type === 'reset' || ev.type === 'scenario' || ev.type === 'seed') trackHold = null;
    render(st);
    if (TO_GUEST[ev.type] && ev.side === 'staff') cross(true);
    else if (TO_STAFF[ev.type] || (ev.type === 'scan' && st.scenario === 'pager')) cross(false);
    if (ev.type === 'autoplay_stop') playing = null;
  });

  /* ---------- controls ---------- */
  function setHash(scn) {
    var h = scn === 'table' ? '#table' : '#counter';
    if (location.hash !== h && window.history && history.replaceState) { try { history.replaceState(null, '', h); } catch (e) { /* file:// in some browsers */ } }
  }
  qa('[data-scn]').forEach(function (b) {
    b.addEventListener('click', function () { var scn = b.getAttribute('data-scn'); begin(scn); setHash(scn); });
  });
  qa('[data-lang]').forEach(function (b) { b.addEventListener('click', function () { demo.setLang(b.getAttribute('data-lang')); }); });
  q('[data-reset]').addEventListener('click', function () {
    begin(demo.getState().scenario);
    intro.hidden = false;
  });
  q('[data-intro-hide]').addEventListener('click', function () { intro.hidden = true; q('[data-reset]').focus(); });
  playBtn.addEventListener('click', function () {
    if (demo.getState().autoplay && playing) { playing.stop(); if (demo.getState().scenario === 'pager' && !demo.getState().pager.guest.joined) demo.seed('received'); return; }
    playing = P.autoplay(demo, { stepMs: 1600 });
  });
  logMore.addEventListener('click', function () {
    var open = logEl.classList.toggle('is-open');
    logMore.setAttribute('aria-expanded', open ? 'true' : 'false');
    logMore.textContent = open ? 'Show only the latest event' : 'Show the last eight events';
  });

  /* ---------- the full board in a sheet (small screens) ---------- */
  function openSheet() {
    if (!sheetMount) sheetMount = P.mountStaff(sheetBoard, demo, { variant: 'board' });
    if (sheet.showModal) sheet.showModal(); else sheet.setAttribute('open', '');
  }
  function closeSheet() { if (sheet.close) sheet.close(); else sheet.removeAttribute('open'); }
  q('[data-sheet-close]').addEventListener('click', closeSheet);
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
  sheet.addEventListener('close', function () { var b = q('[data-con="board"]'); if (b && small.matches) b.focus(); });

  /* ---------- console height, deep links ---------- */
  con.hidden = false;
  function conHeight() { doc.body.style.setProperty('--con-h', (small.matches ? con.offsetHeight : 0) + 'px'); wire.place(); }
  if (window.ResizeObserver) new ResizeObserver(conHeight).observe(con);
  if (small.addEventListener) small.addEventListener('change', function () { if (!small.matches && sheet.open) closeSheet(); conHeight(); });
  window.addEventListener('resize', conHeight);

  function fromHash() {
    var h = (location.hash || '').toLowerCase();
    var scn = h === '#table' ? 'table' : h === '#counter' ? 'pager' : null;
    if (scn && (scn !== demo.getState().scenario)) begin(scn);
  }
  window.addEventListener('hashchange', fromHash);

  begin((location.hash || '').toLowerCase() === '#table' ? 'table' : 'pager');
  render(demo.getState());
  conHeight();
  window.C02.demo = demo;
})();
