/* Payli Concept 01: staging of the shared demo ("The demonstration").
   Uses the engine only through its documented API (shared/demo/README.md): two stores, one per scenario,
   so that "At the counter" can open at the moment the guest has scanned and Start is the first press. */
(function () {
  'use strict';
  var P = window.PayliDemo;
  var stage = document.getElementById('hs-stage');
  var fallback = document.getElementById('hs-demo-fallback');
  if (!P || !P.create || !stage) return;                 // the fallback message stays on the page

  function $(id) { return document.getElementById(id); }
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var narrow = window.matchMedia('(max-width: 599px)');
  var APPEARANCE = { theme: 'classic', brand: '#4A0F22', accent: '#B23A5A' };
  var HASH = { counter: 'pager', table: 'table' };
  var NAME = { pager: 'counter', table: 'table' };

  var stores, mounts = {}, variant = { pager: 'card', table: 'card' };
  try {
    stores = {
      pager: P.create({ scenario: 'pager', opening: 'received', appearance: APPEARANCE }),
      table: P.create({ scenario: 'table', opening: 'scan', appearance: APPEARANCE }),
    };
    P.mountPhone('#hs-phone-pager', stores.pager, { frame: false });
    P.mountPhone('#hs-phone-table', stores.table, { frame: false });
    mounts.pager = P.mountStaff('#hs-staff-pager', stores.pager, { variant: 'card' });
    mounts.table = P.mountStaff('#hs-staff-table', stores.table, { variant: 'card' });
  } catch (err) { return; }

  fallback.hidden = true;
  stage.hidden = false;

  var active = 'pager';
  var leafGuest = $('hs-leaf-guest'), leafHouse = $('hs-leaf-house'), live = $('hs-live');
  var intro = $('hs-intro'), introForm = $('hs-intro-form'), folder = $('hs-folder');
  var underline = $('hs-underline'), houseBody = $('hs-house-body');
  var strip = $('hs-strip'), stripToggle = $('hs-strip-toggle'), windowToggle = $('hs-window-toggle'), boardToggle = $('hs-board-toggle');
  var lastActing = null, underlineTimer = null, introReturn = null;

  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  function statusSentence(id) {
    var tag = P.statusTags[id];
    return P.productNames[id] + ', ' + (id === 'table' ? 'in ' : '') + tag.charAt(0).toLowerCase() + tag.slice(1) + '.';
  }

  /* ── what the staging says, from the store's state ── */
  function render(fromEvent) {
    var s = stores[active].getState(), g = s.guide;
    $('hs-stage-status').textContent = statusSentence(active);
    $('hs-note-title').textContent = g.title;
    $('hs-note-body').textContent = g.done ? 'Press Start again to run it once more.' : g.body;
    $('hs-note-step').textContent = g.done ? '' : 'Step ' + g.step + ' of ' + g.total + '.';
    $('hs-recent').textContent = s.log.length ? 'Most recently: ' + s.log[s.log.length - 1].text + '.' : 'Most recently: nothing yet.';
    $('hs-fine').textContent = P.legal.all + ' ' + P.legal[active];

    var acting = g.side === 'guest' ? 'guest' : 'staff';
    if (acting !== lastActing) {
      lastActing = acting;
      stage.setAttribute('data-acting', acting);
      setOpen('phone', false); setOpen('house', false);
      if (fromEvent && narrow.matches && intro.hidden) bringNextIntoView();
    }
    if (active === 'pager' && s.pager && s.pager.order) {
      if (acting === 'guest') {
        $('hs-strip-a').textContent = 'Order #' + s.pager.order.number + ': ' + s.pager.order.statusLabel;
        $('hs-strip-b').textContent = s.pager.order.guestFact ? s.pager.order.guestFact.text : '';
      } else {
        $('hs-strip-a').textContent = 'On the guest\u2019s phone';
        $('hs-strip-b').textContent = s.pager.guest && s.pager.guest.headline ? '\u201C' + s.pager.guest.headline + '\u201D' : 'Waiting for the scan';
      }
    } else if (active === 'table' && s.table) {
      $('hs-strip-a').textContent = 'Table 12: ' + s.table.table12.label;
      $('hs-strip-b').textContent = 'POS: ' + s.table.pos.text;
    }
    strip.hidden = false;
    stripToggle.hidden = acting !== 'guest';
  }
  function setOpen(which, open) {
    stage.setAttribute('data-' + which + '-open', String(open));
    if (which === 'phone') { windowToggle.setAttribute('aria-expanded', String(open)); windowToggle.textContent = open ? 'Show less of the phone' : 'Show the whole phone'; }
    else { stripToggle.setAttribute('aria-expanded', String(open)); stripToggle.textContent = open ? 'Hide the card' : 'Show the card'; }
  }
  function nextControl() {
    var all = folder.querySelectorAll('[data-pd-next="true"]');
    for (var i = 0; i < all.length; i++) if (all[i].getClientRects().length) return all[i];
    return null;
  }
  function bringNextIntoView() {
    window.requestAnimationFrame(function () {
      var next = nextControl();
      if (next && next.scrollIntoView) next.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' });
    });
  }

  /* ── sync moments: the other side answers ── */
  function answer(leaf) {
    if (reduce.matches) return;
    [leaf, strip].forEach(function (el) { el.classList.remove('is-answering'); void el.offsetWidth; el.classList.add('is-answering'); });
  }
  function ring() {
    if (reduce.matches) {
      live.classList.add('is-ringing-still');
      window.setTimeout(function () { live.classList.remove('is-ringing-still'); }, 900);
      return;
    }
    live.classList.remove('is-ringing'); void live.offsetWidth; live.classList.add('is-ringing');
  }
  function underlineHook(selector) {
    window.requestAnimationFrame(function () {
      var root = $('hs-staff-' + active), target = root && root.querySelector(selector);
      if (!target || !target.getBoundingClientRect().width) return;
      var a = target.getBoundingClientRect(), b = houseBody.getBoundingClientRect();
      underline.style.left = (a.left - b.left) + 'px';
      underline.style.top = (a.bottom - b.top + 3) + 'px';
      underline.style.width = a.width + 'px';
      underline.classList.remove('is-on'); void underline.offsetWidth; underline.classList.add('is-on');
      window.clearTimeout(underlineTimer);
      underlineTimer = window.setTimeout(clearUnderline, 2600);
    });
  }
  function clearUnderline() { window.clearTimeout(underlineTimer); underline.classList.remove('is-on'); }
  function effects(ev) {
    if (!ev) return;
    if (ev.ring) { answer(leafGuest); ring(); }
    else if (ev.side === 'staff' && /^(start|adjust|complete|cancel|new_order)$/.test(ev.type)) answer(leafGuest);
    if (ev.type === 'on_my_way') { answer(leafHouse); underlineHook('[data-pd-fact="guest"]'); }
    else if (ev.type === 'pos_posted') { answer(leafHouse); underlineHook('[data-pd-posted]'); }
    else if (ev.type === 'alert_received' || (ev.side === 'guest' && /^(scan|to_pay|payment)$/.test(ev.type))) answer(leafHouse);
    else if (ev.type === 'reset' || ev.type === 'scenario') clearUnderline();
  }
  ['pager', 'table'].forEach(function (id) {
    stores[id].subscribe(function (state, ev) {
      if (id !== active) return;
      render(!!ev && ev.type !== 'reset' && ev.type !== 'scenario' && ev.type !== 'lang');
      effects(ev);
    });
  });

  /* ── scenario, reset, language, board ── */
  function setScenario(id, opts) {
    if (!stores[id]) return;
    active = id; lastActing = null;
    stage.setAttribute('data-scenario', id);
    ['pager', 'table'].forEach(function (k) {
      $('hs-phone-' + k).hidden = k !== id;
      $('hs-staff-' + k).hidden = k !== id;
    });
    each('input[name="hs-scenario"]', function (r) { r.checked = r.value === id; });
    each('input[name="hs-intro-scenario"]', function (r) { r.checked = r.value === id; });
    syncBoard();
    clearUnderline();
    stores[id].reset();
    render();
    if (!opts || opts.hash !== false) {
      try { window.history.replaceState(null, '', '#' + NAME[id]); } catch (e) { /* file:// in some browsers */ }
    }
  }
  function syncBoard() {
    var board = variant[active] === 'board';
    stage.setAttribute('data-board', String(board));
    boardToggle.setAttribute('aria-pressed', String(board));
    boardToggle.textContent = board ? 'Show only this ' + (active === 'pager' ? 'order' : 'table') : 'Show the whole board';
  }
  boardToggle.addEventListener('click', function () {
    variant[active] = variant[active] === 'board' ? 'card' : 'board';
    if (mounts[active]) mounts[active].destroy();
    mounts[active] = P.mountStaff('#hs-staff-' + active, stores[active], { variant: variant[active] });
    clearUnderline();
    syncBoard();
  });
  each('input[name="hs-scenario"]', function (r) {
    r.addEventListener('change', function () { if (r.checked) { closeIntro(false); setScenario(r.value); } });
  });
  $('hs-reset').addEventListener('click', function () {
    closeIntro(false);
    stores[active].reset();
    lastActing = null; render();
  });
  each('[data-hs-lang]', function (b) {
    b.addEventListener('click', function () {
      var lang = b.getAttribute('data-hs-lang');
      stores.pager.setLang(lang); stores.table.setLang(lang);
      each('[data-hs-lang]', function (o) { o.setAttribute('aria-pressed', String(o === b)); });
    });
  });
  windowToggle.addEventListener('click', function () { setOpen('phone', stage.getAttribute('data-phone-open') !== 'true'); });
  stripToggle.addEventListener('click', function () { setOpen('house', stage.getAttribute('data-house-open') !== 'true'); });

  /* ── the introduction card ── */
  function seen() { try { return window.sessionStorage.getItem('hs-demo-intro') === 'seen'; } catch (e) { return false; } }
  function markSeen() { try { window.sessionStorage.setItem('hs-demo-intro', 'seen'); } catch (e) { /* private mode */ } }
  function openIntro(returnTo) {
    introReturn = returnTo || null;
    intro.hidden = false;
    stage.setAttribute('data-intro', 'true');
    leafGuest.inert = true; leafHouse.inert = true;
    if (returnTo) $('hs-intro-h').focus();
  }
  function closeIntro(moveFocus) {
    if (intro.hidden) return;
    intro.hidden = true;
    stage.removeAttribute('data-intro');
    leafGuest.inert = false; leafHouse.inert = false;
    markSeen();
    if (moveFocus === false) return;
    var target = nextControl() || introReturn || document.querySelector('input[name="hs-scenario"]:checked');
    if (target && target.focus) target.focus({ preventScroll: true });
  }
  introForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var pick = introForm.querySelector('input[name="hs-intro-scenario"]:checked');
    setScenario(pick ? pick.value : 'pager');
    closeIntro(true);
    var bar = stage.querySelector('.hs-stage-bar');
    if (bar && bar.scrollIntoView) bar.scrollIntoView({ block: 'start', behavior: reduce.matches ? 'auto' : 'smooth' });
  });
  $('hs-intro-close').addEventListener('click', function () { closeIntro(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !intro.hidden) { e.preventDefault(); closeIntro(true); } });
  $('hs-how').addEventListener('click', function () {
    openIntro($('hs-how'));
    if (folder.scrollIntoView) folder.scrollIntoView({ block: 'start', behavior: reduce.matches ? 'auto' : 'smooth' });
  });

  /* ── deep links: demo.html#counter and demo.html#table ── */
  function fromHash() { return HASH[(window.location.hash || '').replace('#', '')] || null; }
  window.addEventListener('hashchange', function () {
    var id = fromHash();
    if (id && id !== active) { closeIntro(false); setScenario(id, { hash: false }); }
  });

  var first = fromHash();
  setScenario(first || 'pager', { hash: false });
  if (!first && !seen()) openIntro(null);

  window.hsDemo = { stores: stores, setScenario: setScenario };   // for tests and the console
})();
