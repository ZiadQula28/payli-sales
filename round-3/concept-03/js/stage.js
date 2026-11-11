/* Payli Round 3, Concept 03. The stage: staging for the shared demo engine (home hero and demo page).
   Uses only the documented PayliDemo API: create, mountPhone, mountStaff, autoplay, the store and its guide. */
(function () {
  'use strict';
  var doc = document;
  var APPEARANCE = { theme: 'bold', brand: '#1D35C9', accent: '#FFD966' };
  var NARROW = window.matchMedia ? window.matchMedia('(max-width: 700px)') : { matches: false };
  var REDUCED = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function q(root, sel) { return root.querySelector(sel); }
  function text(el, value) { if (el && el.textContent !== value) el.textContent = value; }

  /* The words beside the phone. Product strings are quoted exactly; everything else comes from the engine's guide. */
  function words(state, mode) {
    var g = state.guide;
    var out = { title: g.title, body: g.body, line: g.title, intro: false };
    if (state.scenario === 'pager') {
      var o = state.pager.order;
      var joined = state.pager.guest.joined;
      if (!joined && o.status === 'received' && o.number === 24 && mode === 'full') {
        out.title = 'You hold both sides.';
        out.body = '';
        out.intro = true;
        out.line = 'Scan the QR to sit down.';
      } else if (o.status === 'received' && joined) {
        out.line = mode === 'hero' ? 'You’re also behind the counter. Press Start.' : g.title;
      } else if (o.status === 'preparing') {
        out.line = mode === 'hero' ? 'The phone says so already. Now press Ready & ring.' : g.title;
      } else if (o.status === 'ready' && !o.onTheWay) {
        out.title = 'Your order is ready.';
        out.body = g.title + '. ' + g.body;
        out.line = 'Your order is ready. On the phone, tap I’m on my way.';
      } else if (o.status === 'ready') {
        out.title = 'The counter knows you’re coming.';
        out.body = g.title + '. ' + g.body;
        out.line = 'The counter knows you’re coming. Press Collected.';
      } else if (o.status === 'collected') {
        out.title = 'Enjoy your order.';
        out.body = 'Order #' + o.number + ' is collected and the colour stays. Start over to play it again, or take the next order.';
        out.line = 'Enjoy your order. Start over to play it again.';
      }
    } else if (state.table.bill.settled) {
      out.title = 'Table 12 is paid. The sale is in the POS.';
      out.body = 'Every share is in, to the fils. Only a fully paid bill reaches the POS. Start over to split it another way.';
      out.line = 'Table 12 is paid. The sale is in the POS.';
    }
    return out;
  }

  function served(state) {
    if (state.scenario === 'pager') {
      var s = state.pager.order.status;
      return s === 'ready' || s === 'collected';
    }
    return !!state.table.bill.settled;
  }

  function staffLine(state) {
    if (state.scenario === 'pager') {
      var o = state.pager.order;
      return { strong: '#' + o.number, rest: o.statusLabel + (o.onTheWay ? ', on the way' : '') };
    }
    var t = state.table.table12 || {};
    return { strong: 'Table 12', rest: t.label || '' };
  }

  function nextLabel(state) {
    var g = state.guide;
    var list = state.scenario === 'pager' ? (state.pager.order.actions || []) : (state.table.staffActions || []);
    for (var i = 0; i < list.length; i++) if (list[i].command === g.command) return list[i].label;
    if (g.command === 'new_order') return 'New order';
    return null;
  }

  function init(root) {
    var PD = window.PayliDemo;
    if (!PD || !PD.create || !PD.mountPhone) { root.classList.add('is-broken'); return null; }

    var scenario = root.getAttribute('data-stage');
    var mode = root.getAttribute('data-mode') || 'full';
    var demo, phoneMount, staffMount;
    try {
      demo = PD.create({ scenario: scenario, lang: 'en', appearance: APPEARANCE, sound: false, opening: root.getAttribute('data-opening') || 'scan' });
      phoneMount = PD.mountPhone(q(root, '[data-stage-phone]'), demo, { frame: false, statusBar: true });
      staffMount = PD.mountStaff(q(root, '[data-stage-staff]'), demo, { variant: 'card' });
    } catch (err) {
      root.classList.add('is-broken');
      return null;
    }

    var el = {
      phone: q(root, '.phone'), panel: q(root, '.stage-panel'), staff: q(root, '[data-stage-staff]'),
      title: q(root, '[data-stage-title]'), body: q(root, '[data-stage-body]'), line: q(root, '[data-stage-line]'),
      intro: q(root, '[data-stage-intro]'), scan: q(root, '[data-stage-scan]'),
      play: q(root, '[data-stage-play]'), reset: q(root, '[data-stage-reset]'), board: q(root, '[data-stage-board]'),
      langs: Array.prototype.slice.call(root.querySelectorAll('[data-stage-lang]')),
      handle: q(root, '.sheet-handle'), sheetWords: q(root, '.sheet-words'), sheetState: q(root, '.sheet-state'), sheetLine: q(root, '.sheet-line'), sheetNext: q(root, '.sheet-next'),
      legal: q(root, '[data-stage-legal]'), status: q(root, '[data-stage-status]')
    };
    var auto = null;
    var sheetOpen = false;
    var ringTimer = null, toldTimer = null;

    /* Status tag and small print come from the engine, set in the site's own type. */
    if (el.legal) text(el.legal, PD.legal.all + ' ' + PD.legal[scenario]);
    if (el.status) {
      var tag = String(PD.statusTags[scenario] || '').toLowerCase();
      text(el.status, PD.productNames[scenario] + ', ' + (tag.indexOf('in ') === 0 ? tag : 'in ' + tag) + '.');
    }

    function ring() {
      if (!el.phone) return;
      el.phone.classList.remove('is-ringing');
      void el.phone.offsetWidth;
      el.phone.classList.add('is-ringing');
      clearTimeout(ringTimer);
      ringTimer = setTimeout(function () { el.phone.classList.remove('is-ringing'); }, REDUCED.matches ? 800 : 1100);
    }
    function told() {
      if (!el.panel) return;
      el.panel.classList.add('is-told');
      clearTimeout(toldTimer);
      toldTimer = setTimeout(function () { el.panel.classList.remove('is-told'); }, 600);
    }

    function render(state, event) {
      var w = words(state, mode);
      text(el.title, w.title);
      text(el.body, w.body);
      text(el.line, w.line);
      text(el.sheetWords, mode === 'hero' ? w.line : (w.intro ? w.line : w.title));
      if (el.intro) el.intro.hidden = !w.intro;
      if (el.body) el.body.hidden = w.intro || !w.body;
      root.setAttribute('data-served', served(state) ? 'true' : 'false');
      root.setAttribute('data-intro', w.intro ? 'true' : 'false');
      root.setAttribute('data-moment', state.scenario === 'pager' ? state.pager.order.status : state.table.screen);

      if (el.play) { text(el.play, state.autoplay ? 'Stop' : 'Play it for me'); el.play.setAttribute('aria-pressed', state.autoplay ? 'true' : 'false'); }
      el.langs.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-stage-lang') === state.lang ? 'true' : 'false'); });

      /* The counter sheet (phone widths): peek when the next move is the staff's, a tab when it is the guest's. */
      var staffTurn = state.guide.side === 'staff' && state.guide.command && demo.can(state.guide.command, state.guide.payload || undefined);
      var label = staffTurn ? nextLabel(state) : null;
      var sheet = sheetOpen ? 'open' : (label ? 'peek' : 'tab');
      if (el.panel) el.panel.setAttribute('data-sheet', sheet);
      if (el.handle) el.handle.setAttribute('aria-expanded', sheetOpen ? 'true' : 'false');
      /* The sheet's two summaries are written only where they are on show, so no hidden copy of the counter's words sits in the page. */
      var line = staffLine(state);
      var narrow = NARROW.matches;
      if (el.sheetLine) {
        var b = el.sheetLine.querySelector('b'), s = el.sheetLine.querySelector('span');
        text(b, narrow && sheet === 'peek' ? line.strong : ''); text(s, narrow && sheet === 'peek' ? line.rest : '');
      }
      if (el.sheetNext) { text(el.sheetNext, label || ''); el.sheetNext.hidden = !label; }
      if (el.sheetState) text(el.sheetState, narrow && sheet !== 'peek' ? (state.scenario === 'pager' ? 'Order ' : '') + line.strong + (line.rest ? ': ' + line.rest : '') : '');

      if (event) {
        if (event.ring) ring();
        if (event.type === 'on_my_way') told();
      }
    }

    demo.subscribe(render);
    render(demo.getState(), null);

    function reset() { if (auto) { auto.stop(); auto = null; } demo.reset(); }
    /* On the demo page "Start over" starts the whole visit over: both parts return to their opening screen. */
    if (el.reset) el.reset.addEventListener('click', function () {
      reset();
      if (mode === 'full') (window.PayliStages || []).forEach(function (other) { if (other.root !== root && other.mode === 'full') other.reset(); });
    });
    if (NARROW.addEventListener) NARROW.addEventListener('change', function () { render(demo.getState(), null); });
    if (el.scan) el.scan.addEventListener('click', function () { demo.dispatch('scan'); });
    if (el.play) el.play.addEventListener('click', function () {
      if (demo.getState().autoplay) { if (auto) auto.stop(); auto = null; return; }
      auto = PD.autoplay(demo, { stepMs: 1800 });
    });
    el.langs.forEach(function (b) { b.addEventListener('click', function () { demo.setLang(b.getAttribute('data-stage-lang')); }); });
    if (el.board) el.board.addEventListener('click', function () {
      var open = root.getAttribute('data-board') === 'true';
      staffMount.destroy();
      staffMount = PD.mountStaff(el.staff, demo, { variant: open ? 'card' : 'board' });
      root.setAttribute('data-board', open ? 'false' : 'true');
      el.board.setAttribute('aria-pressed', open ? 'false' : 'true');
      text(el.board, open ? 'Open the whole board' : 'Back to one order');
    });
    if (el.sheetNext) el.sheetNext.addEventListener('click', function () {
      var g = demo.getState().guide;
      if (g.side === 'staff' && g.command) demo.dispatch(g.command, g.payload || undefined);
    });
    if (el.handle) {
      var toggle = function (to) {
        sheetOpen = typeof to === 'boolean' ? to : !sheetOpen;
        render(demo.getState(), null);
      };
      var startY = null, dragged = false;
      el.handle.addEventListener('click', function () { if (dragged) { dragged = false; return; } toggle(); });
      el.handle.addEventListener('pointerdown', function (e) { startY = e.clientY; dragged = false; });
      el.handle.addEventListener('pointerup', function (e) {
        if (startY === null) return;
        var dy = e.clientY - startY; startY = null;
        if (Math.abs(dy) > 24) { dragged = true; toggle(dy < 0); }
      });
      el.handle.addEventListener('pointercancel', function () { startY = null; });
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetOpen && NARROW.matches) { toggle(false); el.handle.focus(); } });
    }

    return { demo: demo, root: root, mode: mode, reset: reset };
  }

  var stages = Array.prototype.slice.call(doc.querySelectorAll('[data-stage]')).map(init).filter(Boolean);
  window.PayliStages = stages;

  /* The part switch marks where you are; it scrolls (native anchors), it does not replace anything. */
  var parts = Array.prototype.slice.call(doc.querySelectorAll('[data-part]'));
  if (parts.length > 1) {
    var mark = function () {
      var mid = window.innerHeight * 0.4, current = parts[0].id;
      parts.forEach(function (p) { if (p.getBoundingClientRect().top <= mid) current = p.id; });
      Array.prototype.forEach.call(doc.querySelectorAll('[data-part-link]'), function (a) {
        if (a.getAttribute('data-part-link') === current) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    };
    var waiting = false;
    window.addEventListener('scroll', function () { if (!waiting) { waiting = true; requestAnimationFrame(function () { waiting = false; mark(); }); } }, { passive: true });
    window.addEventListener('hashchange', mark);
    mark();
  }
})();
