/*!
 * Payli demo engine: product-UI renderers.
 *
 * Draws the guest's phone screen and the staff surfaces from store state and sends commands back.
 * Nothing else: staging, device frames (beyond the optional neutral one), narration and page copy
 * belong to each website. Load after payli-demo-core.js. Classic script; works from file://.
 *
 * The DOM is patched in place (a small keyed differ below), never replaced wholesale, so keyboard
 * focus, text carets and scroll positions survive every state change.
 */
(function (root) {
  'use strict';

  var api = root.PayliDemo;
  if (!api || typeof api.create !== 'function') throw new Error('PayliDemo: load payli-demo-core.js before payli-demo-ui.js');
  var doc = root.document;
  if (!doc) return;

  var fmt = api.money.format;
  var STAFF = api.strings.staff;

  /* ───────────────────────── assets ───────────────────────── */

  var scriptSrc = doc.currentScript && doc.currentScript.src ? doc.currentScript.src : '';
  function rel(path) {
    try {
      return new URL(path, scriptSrc || doc.baseURI).href;
    } catch (e) {
      return path;
    }
  }
  /* Sites that move the files can point these elsewhere before mounting. */
  api.assets = {
    product: rel('../../../shared/product/'), // avocado.webp, cookies.webp, eggs-greens.webp, latte.webp
    logo: rel('../../../shared/img/logo.svg'),
  };

  /* ───────────────────────── a small keyed DOM differ ───────────────────────── */

  var NO_PROPS = {};
  var BARE = { class: 'pd-x' };
  /* Every element gets a pd- class (pd-x when it needs no styling of its own), so the stylesheet's
     normalising rule shields all of them from the host page's element selectors. */
  function h(tag, props, kids) {
    var out = [];
    flatten(kids, out);
    var p = props || (tag === 'option' ? NO_PROPS : BARE);
    if (p !== BARE && p !== NO_PROPS && !p.class && tag !== 'option') p.class = 'pd-x';
    return { t: tag, p: p, c: out, k: p.key != null ? String(p.key) : null, el: null };
  }
  function flatten(kids, out) {
    if (kids == null || kids === false || kids === true) return;
    if (Array.isArray(kids)) {
      for (var i = 0; i < kids.length; i++) flatten(kids[i], out);
    } else if (typeof kids === 'object') {
      out.push(kids);
    } else {
      out.push({ t: '#', v: String(kids), p: NO_PROPS, c: [], k: null, el: null });
    }
  }
  var BOOL = { disabled: 1, checked: 1, hidden: 1, inert: 1, selected: 1 };
  /* True while a live mount is being patched after its first paint: nodes created then, and marked
     `enter`, get the class pd-enter, which is what entrance animations hang on. Nodes present at
     the first paint, and everything in a snapshot, never animate in. */
  var ENTERING = false;
  function setProp(el, name, value, old) {
    if (name === 'key' || name === 'enter') return;
    if (name.charCodeAt(0) === 111 && name.charCodeAt(1) === 110) {
      el[name] = value || null; // on*
      return;
    }
    if (value === old) return;
    if (name === 'html') {
      el.innerHTML = value == null ? '' : value;
    } else if (name === 'class') {
      var entering = el.classList.contains('pd-enter');
      el.className = value || '';
      if (entering) el.classList.add('pd-enter');
    } else if (name === 'style') {
      el.style.cssText = value || '';
    } else if (name === 'value') {
      if (el.value !== value) el.value = value == null ? '' : value;
    } else if (BOOL[name]) {
      if (value) el.setAttribute(name, '');
      else el.removeAttribute(name);
      if (name in el) el[name] = !!value;
    } else if (value == null || value === false) {
      el.removeAttribute(name);
    } else {
      el.setAttribute(name, value === true ? '' : String(value));
    }
  }
  function setProps(el, oldP, newP) {
    var k;
    for (k in oldP) if (!(k in newP)) setProp(el, k, null, oldP[k]);
    for (k in newP) setProp(el, k, newP[k], oldP[k]);
  }
  function createNode(v) {
    if (v.t === '#') {
      v.el = doc.createTextNode(v.v);
      return v.el;
    }
    var el = doc.createElement(v.t);
    v.el = el;
    setProps(el, NO_PROPS, v.p);
    if (ENTERING && v.p.enter) el.classList.add('pd-enter');
    if (!('html' in v.p)) for (var i = 0; i < v.c.length; i++) el.appendChild(createNode(v.c[i]));
    return el;
  }
  function updateNode(o, n) {
    n.el = o.el;
    if (n.t === '#') {
      if (o.v !== n.v) n.el.nodeValue = n.v;
      return;
    }
    setProps(n.el, o.p, n.p);
    if (!('html' in n.p)) reconcile(n.el, 'html' in o.p ? [] : o.c, n.c);
  }
  function reconcile(parent, olds, news) {
    var keyed = {};
    var pool = [];
    var i, j, o, n;
    for (i = 0; i < olds.length; i++) {
      o = olds[i];
      if (o.k !== null) keyed[o.k] = o;
      else pool.push(o);
    }
    for (i = 0; i < news.length; i++) {
      n = news[i];
      o = null;
      if (n.k !== null) {
        o = keyed[n.k];
        if (o && o.t === n.t) keyed[n.k] = null;
        else o = null;
      } else {
        for (j = 0; j < pool.length; j++) {
          if (pool[j] && pool[j].t === n.t) {
            o = pool[j];
            pool[j] = null;
            break;
          }
        }
      }
      if (o) updateNode(o, n);
      else createNode(n);
    }
    for (var k in keyed) if (keyed[k] && keyed[k].el.parentNode === parent) parent.removeChild(keyed[k].el);
    for (j = 0; j < pool.length; j++) if (pool[j] && pool[j].el.parentNode === parent) parent.removeChild(pool[j].el);
    var ref = parent.firstChild;
    for (i = 0; i < news.length; i++) {
      if (news[i].el === ref) ref = ref.nextSibling;
      else parent.insertBefore(news[i].el, ref);
    }
  }

  /* Focus that survives a re-render: same control if it still exists, else the next sensible one. */
  function keepFocus(rootEl, work) {
    var active = doc.activeElement;
    var inside = !!active && active !== rootEl && rootEl.contains(active);
    var key = inside ? active.getAttribute('data-pd-key') : null;
    var groupEl = inside && active.closest ? active.closest('[data-pd-group]') : null;
    var group = groupEl ? groupEl.getAttribute('data-pd-group') : null;
    work();
    if (!inside) return;
    var now = doc.activeElement;
    if (now && now !== doc.body && rootEl.contains(now)) return;
    var target = null;
    if (key) target = rootEl.querySelector('[data-pd-key="' + key + '"]');
    if (!target && group) {
      var g = rootEl.querySelector('[data-pd-group="' + group + '"]');
      if (g) target = g.querySelector('[data-pd-next="true"]') || g.querySelector('button');
    }
    if (!target) target = rootEl.querySelector('[data-pd-next="true"]') || rootEl.querySelector('[data-pd-key="cta"]') || rootEl;
    if (target && target.focus) target.focus({ preventScroll: true });
  }

  /* ───────────────────────── icons (inline SVG, decorative) ───────────────────────── */

  function svg(body, vb, extra) {
    return '<svg class="pd-svg" viewBox="' + (vb || '0 0 24 24') + '" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ' + (extra || 'stroke-width="2"') + '>' + body + '</svg>';
  }
  var ICON = {
    back: svg('<path d="M8.5 1.5 1.5 9l7 7.5"/>', '0 0 10 18'),
    check: svg('<path d="m5 12 5 5 9-10"/>', null, 'stroke-width="3"'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    bell: svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
    pencil: svg('<path d="M10.6 2.4l3 3L5.2 13.8 1.9 14.1l.3-3.3z"/>', '0 0 16 16', 'stroke-width="1.6"'),
    chev: svg('<path d="m6 9 6 6 6-6"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    star: '<svg class="pd-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>',
    signal: '<svg class="pd-svg" viewBox="0 0 18 12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M0 8h3v4H0zm5-3h3v7H5zm5-3h3v10h-3zm5-2h3v12h-3z"/></svg>',
    /* The Apple mark of the Apple Pay button (3.1.0): the one third-party mark in the engine, used only
       on that button, in Apple's standard form (mark, then "Pay"). */
    apple: '<svg class="pd-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>',
    battery: '<svg class="pd-svg" viewBox="0 0 27 12" aria-hidden="true" focusable="false"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".5"/><rect x="2" y="2" width="19" height="8" rx="1.6" fill="currentColor"/><path fill="currentColor" opacity=".5" d="M24 4h1.4c.6 0 1.1.5 1.1 1.1v1.8c0 .6-.5 1.1-1.1 1.1H24z"/></svg>',
  };
  function icon(name, cls) {
    return h('span', { class: 'pd-ic' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true', html: ICON[name] });
  }

  /* A QR-looking pattern. Deliberately not a real code: it encodes nothing and cannot be scanned. */
  var qrCache = {};
  function qrSvg(seed) {
    if (qrCache[seed]) return qrCache[seed];
    var n = 25;
    var s = seed * 7919 + 17;
    var cells = '';
    function rnd() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    }
    function finder(x, y) {
      return (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
    }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (!finder(x, y) && rnd() > 0.52) cells += 'M' + x + ' ' + y + 'h1v1h-1z';
    function fp(x, y) {
      return '<path fill="currentColor" fill-rule="evenodd" d="M' + x + ' ' + y + 'h7v7h-7zm1 1v5h5v-5zm1 1h3v3h-3z"/>';
    }
    qrCache[seed] = '<svg class="pd-svg" viewBox="-1 -1 27 27" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path fill="currentColor" d="' + cells + '"/>' + fp(0, 0) + fp(n - 7, 0) + fp(0, n - 7) + '</svg>';
    return qrCache[seed];
  }

  /* ───────────────────────── shared building blocks ───────────────────────── */

  function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (m, k) {
      return vars && vars[k] !== undefined ? String(vars[k]) : m;
    });
  }
  /** "Ready in about {range} min" with the figure isolated left-to-right for Arabic. */
  function withNumber(template, name, value) {
    var parts = String(template).split('{' + name + '}');
    if (parts.length < 2) return [template];
    return [parts[0], h('span', { class: 'pd-num', dir: 'ltr' }, value), parts.slice(1).join('')];
  }
  function money(fils, cls, bare) {
    return h('span', { class: 'pd-money' + (cls ? ' ' + cls : ''), dir: 'ltr' }, [bare ? null : h('span', { class: 'pd-cur' }, 'JOD'), h('span', { class: 'pd-amt' }, fmt(fils))]);
  }
  function jodText(fils) {
    return 'JOD ' + fmt(fils);
  }

  /**
   * A control. Interactive mounts get a real <button>; snapshots get an inert <span> with the same
   * classes. "Unavailable" is aria-disabled (not the disabled attribute) so focus never falls off
   * a button that greys out under the visitor's finger, e.g. Ring again during its cooldown.
   */
  function btn(ctx, p, kids) {
    var guide = ctx.state.guide;
    var next = p.next !== undefined ? p.next : !!p.cmd && guide.command === p.cmd && guide.side === ctx.side;
    var attrs = {
      key: p.key,
      class: p.class,
      'data-pd-key': p.key,
      'data-pd-cmd': p.cmd || null,
      'data-pd-next': next && !p.disabled && !ctx.isStatic ? 'true' : null,
      'data-pd-off': p.disabled ? '' : null,
      'data-pd-on': p.pressed || p.checked ? '' : null,
    };
    if (p.order) attrs['data-pd-order'] = p.order;
    if (ctx.isStatic) return h('span', attrs, kids);
    attrs.type = 'button';
    if (p.label) attrs['aria-label'] = p.label;
    if (p.disabled) attrs['aria-disabled'] = 'true';
    if (p.pressed !== undefined) attrs['aria-pressed'] = p.pressed ? 'true' : 'false';
    if (p.role) attrs.role = p.role;
    if (p.checked !== undefined) attrs['aria-checked'] = p.checked ? 'true' : 'false';
    if (p.expanded !== undefined) attrs['aria-expanded'] = p.expanded ? 'true' : 'false';
    if (p.lang) attrs.lang = p.lang;
    attrs.onclick = function (e) {
      if (p.disabled) return;
      if (p.onclick) p.onclick(e);
      else if (p.cmd) ctx.send(p.cmd, p.payload);
    };
    return h('button', attrs, kids);
  }

  /* ═════════════════════════ the guest's phone ═════════════════════════ */

  function phoneTree(ctx) {
    var s = ctx.state;
    var pager = s.scenario === 'pager';
    var g = pager ? s.pager.guest : null;
    var screen = pager ? g.screen : s.table.screen;
    var darkScreen = screen === 'scan' || screen === 'pay';
    var theme = pager && screen === 'order' ? s.appearance.theme : 'classic';
    var lightBar = darkScreen || (pager && screen === 'order' && theme !== 'classic');
    var o = ctx.opts;

    var style = '';
    if (pager && (s.appearance.brandSet || s.appearance.accentSet)) {
      var c = api.theme.colours(theme, s.appearance.brand, s.appearance.accent);
      if (s.appearance.brandSet) style += '--pd-brand:' + c.brand + ';--pd-brand-ink:' + c.brandInk + ';--pd-brand-strong:' + c.brandStrong + ';--pd-brand-tint:' + c.brandTint + ';';
      if (s.appearance.accentSet) style += '--pd-accent:' + c.accent + ';--pd-accent-ink:' + c.accentInk + ';--pd-accent-tint:' + c.accentTint + ';';
    }

    var view;
    if (screen === 'scan') view = scanView(ctx);
    else if (pager) view = pagerView(ctx);
    else view = tableView(ctx);

    var screenKids = [
      o.statusBar ? h('div', { class: 'pd-statusbar' + (lightBar ? ' pd-statusbar--light' : ''), 'aria-hidden': 'true', dir: 'ltr' }, [h('span', { class: 'pd-sb-time' }, s.clock), h('span', { class: 'pd-sb-icons' }, [icon('signal', 'pd-sb-signal'), icon('battery', 'pd-sb-battery')])]) : null,
      h('div', { key: 'view-' + s.scenario + '-' + screen, enter: true, class: 'pd-view pd-view--' + screen + (o.statusBar ? ' pd-view--bar' : '') }, view),
      pager && g.banner
        ? h('div', { key: 'banner-' + g.ringCount, class: 'pd-banner', role: ctx.isStatic ? null : 'presentation' }, [
            h('span', { class: 'pd-banner-ic', 'aria-hidden': 'true' }, g.monogram),
            h('span', { class: 'pd-banner-body' }, [h('span', { class: 'pd-banner-title' }, g.banner.title), h('span', { class: 'pd-banner-text' }, g.banner.body)]),
            h('span', { class: 'pd-banner-when' }, g.banner.when),
          ])
        : null,
      pager && g.ringing && !ctx.isStatic ? h('div', { key: 'ring-' + g.ringCount, class: 'pd-ringfx', 'aria-hidden': 'true' }, [h('span', { class: 'pd-ringfx-a' }), h('span', { class: 'pd-ringfx-b' })]) : null,
    ];
    var screenEl = h(
      'div',
      {
        key: 'screen',
        class: 'pd-screen' + (darkScreen ? ' pd-screen--dark' : '') + (o.fill ? ' pd-screen--fill' : ''),
        dir: s.dir,
        lang: s.lang,
      },
      screenKids
    );

    var statusText = 'Illustrative demo · ' + s.statusTag;
    return h(
      'div',
      {
        class: 'pd-phone pd-theme-' + theme + (o.frame ? ' pd-phone--framed' : '') + (ctx.isStatic ? ' pd-static' : '') + (s.lang === 'ar' ? ' pd-ar' : ''),
        'data-pd-surface': 'phone',
        'data-pd-scenario': s.scenario,
        'data-pd-screen': screen,
        'data-pd-state': pager ? g.status : s.table.screen,
        'data-pd-joined': pager ? String(g.joined) : null,
        'data-pd-ringing': pager && g.ringing ? 'true' : 'false',
        'data-pd-rings': pager ? String(g.ringCount) : null,
        'data-pd-theme': theme,
        'data-pd-lang': s.lang,
        role: ctx.isStatic ? 'img' : 'group',
        'aria-label': ctx.isStatic ? phoneAlt(s) : 'Guest phone, ' + s.product + ' (' + statusText + ')',
        tabindex: ctx.isStatic ? null : '-1',
        style: style,
      },
      [
        o.frame ? h('div', { key: 'device', class: 'pd-device' }, [screenEl, h('span', { class: 'pd-island', 'aria-hidden': 'true' })]) : screenEl,
        o.frame && o.caption !== false ? h('div', { key: 'caption', class: 'pd-caption' }, statusText) : null,
        ctx.isStatic ? null : h('div', { key: 'sr', class: 'pd-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, ctx.say || ''),
      ]
    );
  }

  function phoneAlt(s) {
    if (s.scenario === 'pager') {
      var g = s.pager.guest;
      if (g.screen === 'scan') return 'Guest phone about to scan the QR for order ' + g.ref + ' (illustration)';
      return 'Guest phone, order ' + g.ref + ': ' + g.headline + ' ' + g.message + ' (illustration)';
    }
    var t = s.table;
    var names = {
      scan: 'about to scan the QR on Table ' + t.tableNumber,
      bill: 'showing the itemised bill, total ' + jodText(t.bill.total),
      split: 'splitting the bill, share ' + jodText(t.split.share),
      tip: 'choosing a tip, paying ' + jodText(t.pay.total),
      pay: 'about to pay ' + jodText(t.pay.total) + ' with Apple Pay or by card',
      provider: 'at the simulated payment step',
      paid: 'showing the payment confirmation',
      closed: 'showing the thank-you and rating',
    };
    return 'Guest phone ' + names[t.screen] + ' (illustration)';
  }

  /* ── the camera prompt before the page is open (the simulation's own screen, not the product) ── */
  function scanView(ctx) {
    var s = ctx.state;
    var pager = s.scenario === 'pager';
    var card;
    if (pager) {
      var tk = s.pager.guest.ticket;
      card = h('div', { class: 'pd-scan-card pd-scan-ticket', dir: 'ltr', lang: 'en' }, [
        h('span', { class: 'pd-scan-venue' }, tk.venue),
        h('span', { class: 'pd-scan-ref' }, tk.ref),
        h('span', { class: 'pd-scan-qr', html: qrSvg(s.pager.order.number) }),
        h('span', { class: 'pd-scan-line' }, tk.line),
      ]);
    } else {
      card = h('div', { class: 'pd-scan-card pd-scan-tent', dir: 'ltr', lang: 'en' }, [
        h('span', { class: 'pd-scan-qr', html: qrSvg(12) }),
        h('span', { class: 'pd-scan-table' }, 'Table ' + s.table.tableNumber),
        h('img', { class: 'pd-scan-logo', src: api.assets.logo, alt: 'Payli', decoding: 'sync' }),
      ]);
    }
    return h('div', { class: 'pd-scan' }, [
      h('div', { class: 'pd-scan-cam', 'aria-hidden': 'true' }, [card, h('span', { class: 'pd-scan-c pd-scan-c1' }), h('span', { class: 'pd-scan-c pd-scan-c2' }), h('span', { class: 'pd-scan-c pd-scan-c3' }), h('span', { class: 'pd-scan-c pd-scan-c4' })]),
      h('div', { class: 'pd-scan-foot' }, [
        pager ? null : h('div', { class: 'pd-scan-hint' }, ctx.t('sim.scanTable')),
        btn(ctx, { key: 'cta', class: 'pd-btn pd-btn--scan', cmd: 'scan' }, ctx.t('sim.scan')),
      ]),
    ]);
  }

  /* ── Order Pager: the guest's order page (PagerView.tsx) ── */
  function pagerView(ctx) {
    var s = ctx.state;
    var g = s.pager.guest;
    var ready = g.status === 'ready';
    var hero = [
      ready ? h('div', { key: 'mark', enter: true, class: 'pd-pg-mark', 'aria-hidden': 'true' }, icon('check')) : null,
      h('div', { key: 'eyebrow', class: 'pd-pg-eyebrow' }, g.eyebrow),
      h('div', { key: 'ref', class: 'pd-pg-ref', dir: 'ltr' }, g.ref),
      h('div', { key: 'headline', class: 'pd-pg-headline', role: 'heading', 'aria-level': '2' }, g.headline),
      h('div', { key: 'msg', class: 'pd-pg-msg' }, g.message),
      g.eta
        ? h('div', { key: 'eta', class: 'pd-pg-eta' }, [
            icon('clock', 'pd-pg-eta-ic'),
            h('span', { class: 'pd-pg-eta-t' }, withNumber(g.eta.template, 'range', g.eta.range)),
            g.eta.updated ? h('span', { key: 'upd-' + g.eta.range, enter: true, class: 'pd-pg-updated' }, g.eta.updatedLabel) : null,
          ])
        : null,
      ready
        ? h('div', { key: 'collect', class: 'pd-pg-collect' }, [h('div', { class: 'pd-pg-collect-place' }, g.collect.place), h('div', { class: 'pd-pg-collect-note' }, g.collect.note)])
        : null,
      ready && g.acked ? h('div', { key: 'acked', enter: true, class: 'pd-pg-acked' }, [icon('check'), h('span', null, ctx.t('pager.ready.acknowledged'))]) : null,
      ready && !g.acked ? btn(ctx, { key: 'cta', class: 'pd-btn pd-pg-primary', cmd: 'on_my_way' }, ctx.t('pager.ready.onMyWay')) : null,
      ready ? h('div', { key: 'since', class: 'pd-pg-since' }, withNumber(g.readySince.template, 'time', g.readySince.time)) : null,
    ];

    var timeline = g.showTimeline
      ? h(
          'div',
          { key: 'timeline', class: 'pd-pg-card pd-pg-timeline', role: 'list', 'aria-label': ctx.t('pager.timeline.label') },
          g.steps.map(function (st) {
            return h('div', { key: st.id, class: 'pd-pg-step' + (st.done ? ' pd-pg-step--done' : '') + (st.now ? ' pd-pg-step--now' : ''), role: 'listitem', 'aria-current': st.now ? 'step' : null }, [
              h('span', { class: 'pd-pg-dot' + (st.now && st.id === 'ready' ? ' pd-pg-dot--pulse' : ''), 'aria-hidden': 'true' }, st.done ? icon('check') : null),
              h('span', { class: 'pd-pg-step-label' }, [st.label, h('span', { class: 'pd-sr' }, st.done ? ' (' + ctx.t('pager.step.done') + ')' : st.now ? ' (' + ctx.t('pager.step.current') + ')' : '')]),
            ]);
          })
        )
      : null;

    var a = g.alerts;
    var alerts = a.visible
      ? h('div', { key: 'alerts', class: 'pd-pg-card pd-pg-alerts', role: 'group', 'aria-label': ctx.t('pager.alerts.title') }, [
          h('div', { class: 'pd-pg-card-title', role: 'heading', 'aria-level': '3' }, ctx.t('pager.alerts.title')),
          h('div', { class: 'pd-pg-rows' }, [
            h('div', { key: 'sound', class: 'pd-pg-row' }, [
              h('div', { class: 'pd-pg-row-label' }, ctx.t('pager.alerts.sound')),
              a.sound
                ? h('span', { key: 'on', class: 'pd-pg-row-end' }, [
                    btn(ctx, { key: 'sound', class: 'pd-pg-btn', cmd: 'sound_test' }, ctx.t('pager.alerts.test')),
                    h('span', { class: 'pd-pg-state' }, [h('span', { class: 'pd-pg-state-dot', 'aria-hidden': 'true' }), ctx.t('pager.alerts.on')]),
                  ])
                : h('span', { key: 'off', class: 'pd-pg-row-end' }, btn(ctx, { key: 'sound', class: 'pd-pg-btn pd-pg-btn--solid', cmd: 'sound_on', label: ctx.t('pager.alerts.sound') + ': ' + ctx.t('pager.alerts.turnOn') }, ctx.t('pager.alerts.turnOn'))),
            ]),
            h('div', { key: 'notif', class: 'pd-pg-row' }, [
              h('div', null, [h('div', { class: 'pd-pg-row-label' }, ctx.t('pager.alerts.notifications')), a.notifications ? h('div', { class: 'pd-pg-row-sub' }, ctx.t('pager.alerts.foreground')) : null]),
              a.notifications
                ? h('span', { key: 'on', class: 'pd-pg-row-end' }, h('span', { class: 'pd-pg-state' }, [h('span', { class: 'pd-pg-state-dot', 'aria-hidden': 'true' }), ctx.t('pager.alerts.on')]))
                : h('span', { key: 'off', class: 'pd-pg-row-end' }, btn(ctx, { key: 'notif', class: 'pd-pg-btn', cmd: 'notify_allow', label: ctx.t('pager.alerts.notifications') + ': ' + ctx.t('pager.alerts.allow') }, ctx.t('pager.alerts.allow'))),
            ]),
          ]),
          h('div', { class: 'pd-pg-hint' }, ctx.t('pager.alerts.keepOpen')),
        ])
      : null;

    var open = ctx.isStatic ? !!ctx.opts.detailsOpen : !!ctx.local.details;
    var details = h('div', { key: 'details', class: 'pd-pg-card pd-pg-details' }, [
      btn(
        ctx,
        {
          key: 'details',
          class: 'pd-pg-summary',
          expanded: open,
          onclick: function () {
            ctx.local.details = !ctx.local.details;
            ctx.rerender();
          },
        },
        [h('span', null, ctx.t('pager.items.title')), h('span', { class: 'pd-pg-summary-end' }, [h('span', null, withNumber(ctx.raw('pager.items.count'), 'n', String(g.itemCount))), icon('chev', 'pd-pg-chev' + (open ? ' pd-pg-chev--open' : ''))])]
      ),
      open
        ? h(
            'div',
            { class: 'pd-pg-items', role: 'list' },
            g.items.map(function (it, i) {
              return h('div', { key: 'i' + i, class: 'pd-pg-item', role: 'listitem' }, [
                h('span', { class: 'pd-pg-qty', dir: 'ltr' }, it.qty + '×'),
                h('span', null, [it.name, it.mods.length ? h('div', { class: 'pd-pg-mods' }, it.mods.join(' · ')) : null]),
              ]);
            })
          )
        : null,
    ]);

    return h('div', { class: 'pd-pg pd-scroll' }, [
      h('div', { class: 'pd-pg-head' }, [
        h('span', { class: 'pd-pg-monogram', 'aria-hidden': 'true' }, g.monogram),
        h('div', { class: 'pd-pg-venue' }, [h('div', { class: 'pd-pg-venue-name' }, g.venue), h('div', { class: 'pd-pg-welcome' }, g.welcome)]),
        langButton(ctx, 'pd-pg-lang'),
      ]),
      h('div', { class: 'pd-pg-col' }, [
        h('div', { key: 'hero', class: 'pd-pg-card pd-pg-hero' + (ready ? ' pd-pg-hero--ready' : '') + (g.status === 'cancelled' ? ' pd-pg-hero--cancelled' : '') }, hero),
        timeline,
        alerts,
        details,
        h('div', { key: 'foot', class: 'pd-pg-foot' }, [
          g.live ? h('span', { class: 'pd-pg-conn' }, [h('span', { class: 'pd-pg-conn-dot', 'aria-hidden': 'true' }), ctx.t('pager.conn.live')]) : h('span'),
          h('span', { class: 'pd-pg-powered' }, ctx.t('pager.poweredBy')),
        ]),
      ]),
    ]);
  }

  function langButton(ctx, cls) {
    var other = ctx.state.lang === 'ar' ? 'en' : 'ar';
    return btn(
      ctx,
      {
        key: 'lang',
        class: 'pd-lang ' + cls,
        lang: other,
        onclick: function () {
          ctx.demo.setLang(other);
        },
      },
      ctx.t('nav.switch')
    );
  }

  /* ── Pay at Table: bill → split → tip → pay → (simulated provider) → paid → rating ── */
  function topBar(ctx, back, dark) {
    return h('div', { class: 'pd-tb-top' + (dark ? ' pd-tb-top--dark' : '') }, [
      back ? btn(ctx, { key: 'back', class: 'pd-tb-back', cmd: 'back', next: false }, [icon('back', 'pd-tb-back-ic'), h('span', null, ctx.t('nav.back'))]) : h('span'),
      dark ? null : langButton(ctx, 'pd-tb-lang'),
    ]);
  }
  function cta(ctx, p, label, amount) {
    return btn(ctx, { key: p.key || 'cta', class: 'pd-btn pd-cta ' + p.class, cmd: p.cmd, payload: p.payload, disabled: p.disabled, next: p.next }, [
      h('span', { class: 'pd-cta-label' }, label),
      amount != null ? h('span', { class: 'pd-cta-sep', 'aria-hidden': 'true' }, '·') : null,
      amount != null ? money(amount, 'pd-cta-money') : null,
    ]);
  }
  function sumRow(label, value, cls) {
    return h('div', { class: 'pd-row' + (cls ? ' ' + cls : '') }, [h('span', { class: 'pd-row-l' }, label), value]);
  }

  function tableView(ctx) {
    var t = ctx.state.table;
    switch (t.screen) {
      case 'bill':
        return billView(ctx, t);
      case 'split':
        return splitView(ctx, t);
      case 'tip':
        return tipView(ctx, t);
      case 'pay':
        return payView(ctx, t);
      case 'provider':
        return providerView(ctx, t);
      case 'paid':
        return paidView(ctx, t);
      default:
        return closedView(ctx, t);
    }
  }

  function billView(ctx, t) {
    var b = t.bill;
    var ip = t.inProgress;
    var foot;
    if (ip) {
      foot = [
        h('div', { class: 'pd-tb-splitcap' }, [ctx.t('bill.splitOn') + ' · ', h('span', { class: 'pd-num', dir: 'ltr' }, String(ip.sharesTaken)), ' ' + ctx.t('common.of') + ' ', h('span', { class: 'pd-num', dir: 'ltr' }, String(ip.headcount))]),
        cta(ctx, { class: 'pd-cta--teal', cmd: 'pay_share', payload: { shares: 1 } }, ctx.t('bill.payShare'), ip.perShare),
        ip.sharesRemaining > 1 ? cta(ctx, { key: 'ghost', class: 'pd-cta--ghost', cmd: 'pay_share', payload: { shares: ip.sharesRemaining }, next: false }, fill(ctx.raw('bill.payRest'), { n: ip.sharesRemaining }), b.remaining) : null,
      ];
    } else {
      foot = [
        cta(ctx, { class: 'pd-cta--teal', cmd: 'pay_full', disabled: !ctx.demo.can('pay_full') }, b.paid ? ctx.t('bill.payRemaining') : ctx.t('bill.payFull'), b.remaining),
        btn(ctx, { key: 'ghost', class: 'pd-btn pd-cta pd-cta--ghost', cmd: 'open_split', disabled: !ctx.demo.can('open_split') }, h('span', { class: 'pd-cta-label' }, ctx.t('bill.split'))),
      ];
    }
    return h('div', { class: 'pd-tb pd-tb-bill' }, [
      topBar(ctx, false),
      h('div', { class: 'pd-scroll pd-tb-body' }, [
        h('div', { class: 'pd-tb-venue' }, [
          h('span', { class: 'pd-tb-avatar', 'aria-hidden': 'true' }, t.monogram),
          h('div', { class: 'pd-tb-venue-t' }, [h('div', { class: 'pd-tb-venue-name', role: 'heading', 'aria-level': '2' }, t.venue), h('div', { class: 'pd-tb-venue-table' }, t.tableLabel)]),
        ]),
        h('div', { class: 'pd-tb-lead' }, ctx.t('bill.lead')),
        h(
          'div',
          { class: 'pd-tb-items', role: 'list' },
          b.lines.map(function (l) {
            return h('div', { key: l.id, class: 'pd-tb-item' + (l.paid ? ' pd-tb-item--paid' : ''), role: 'listitem' }, [
              h('img', { class: 'pd-tb-thumb', src: api.assets.product + l.image + '.webp', alt: '', width: '116', height: '116', decoding: 'sync' }),
              h('div', { class: 'pd-tb-item-t' }, [
                h('div', { class: 'pd-tb-item-name' }, l.name),
                l.paid ? h('div', { class: 'pd-tb-item-paid' }, ctx.t('item.alreadyPaid')) : h('div', { class: 'pd-tb-item-qty', dir: 'ltr' }, [h('span', { class: 'pd-tb-item-x' }, l.qty + '×'), ' ' + fmt(l.unit)]),
              ]),
              money(l.amount, 'pd-tb-item-amt', true),
            ]);
          })
        ),
        h('div', { class: 'pd-tb-rule', 'aria-hidden': 'true' }),
        h('div', { class: 'pd-tb-sum' }, [
          sumRow(ctx.t('bill.subtotal'), money(b.subtotal, null, true)),
          sumRow([ctx.t('bill.service') + ' ', h('span', { class: 'pd-num', dir: 'ltr' }, '(' + b.servicePct + '%)')], money(b.service, null, true)),
          sumRow(ctx.t('bill.tax'), money(b.tax, null, true)),
        ]),
        h('div', { class: 'pd-tb-thin', 'aria-hidden': 'true' }),
        b.paid
          ? h('div', { key: 'partial', class: 'pd-tb-sum' }, [
              sumRow(ctx.t('bill.billTotal'), money(b.total, null, true)),
              sumRow(ctx.t('bill.alreadyPaid'), h('span', { class: 'pd-money', dir: 'ltr' }, '−' + fmt(b.paid))),
              sumRow(ctx.t('bill.remaining'), money(b.remaining), 'pd-row--big'),
            ])
          : h('div', { key: 'full', class: 'pd-tb-sum' }, sumRow(ctx.t('bill.total'), money(b.total), 'pd-row--big')),
      ]),
      h('div', { class: 'pd-tb-foot pd-tb-foot--fade' }, foot),
    ]);
  }

  function stepper(ctx, key, label, sub, value, less, more, cmd, field) {
    function payload(v) {
      var p = {};
      p[field] = v;
      return p;
    }
    return h('div', { key: key, class: 'pd-stepper' }, [
      h('div', { class: 'pd-stepper-t' }, [h('div', { class: 'pd-stepper-l' }, label), h('div', { class: 'pd-stepper-s' }, sub)]),
      h('div', { class: 'pd-stepper-c', dir: 'ltr' }, [
        btn(ctx, { key: key + '-less', class: 'pd-step pd-step--less', cmd: cmd, payload: payload(value - 1), disabled: !less, label: label + ' −', next: false }, '−'),
        h('span', { class: 'pd-stepper-v', 'aria-live': ctx.isStatic ? null : 'off' }, String(value)),
        btn(ctx, { key: key + '-more', class: 'pd-step pd-step--more', cmd: cmd, payload: payload(value + 1), disabled: !more, label: label + ' +', next: false }, '+'),
      ]),
    ]);
  }

  function splitView(ctx, t) {
    var sp = t.split;
    var modes = [
      ['equal', 'split.equal', 'split.equalSub'],
      ['item', 'split.item', 'split.itemSub'],
      ['custom', 'split.custom', 'split.customSub'],
    ];
    var body;
    if (sp.mode === 'equal') {
      body = h('div', { key: 'equal', class: 'pd-steppers' }, [
        stepper(ctx, 'people', ctx.t('split.people'), ctx.t('split.peopleSub'), sp.people, sp.canPeopleLess, sp.canPeopleMore, 'set_people', 'people'),
        stepper(ctx, 'covers', ctx.t('split.youPayFor'), ctx.t('split.youPayForSub'), sp.covers, sp.canCoversLess, sp.canCoversMore, 'set_covers', 'covers'),
      ]);
    } else if (sp.mode === 'item') {
      body = h('div', { key: 'item', class: 'pd-picks', role: 'group', 'aria-label': ctx.t('split.chooseItems') }, [
        h('div', { class: 'pd-picks-title' }, ctx.t('split.chooseItems')),
        t.bill.units.map(function (u) {
          return btn(ctx, { key: 'unit-' + u.id, class: 'pd-pick' + (u.paid ? ' pd-pick--paid' : ''), cmd: 'toggle_item', payload: { unit: u.id }, role: 'checkbox', checked: u.selected, disabled: u.paid, next: false }, [
            h('span', { class: 'pd-pick-box', 'aria-hidden': 'true' }, u.selected ? icon('check') : null),
            h('span', { class: 'pd-pick-name' }, [u.name, u.paid ? h('span', { class: 'pd-pick-paid' }, ' · ' + ctx.t('item.alreadyPaid')) : null]),
            money(u.amount, 'pd-pick-amt', true),
          ]);
        }),
      ]);
    } else {
      body = h('div', { key: 'custom', class: 'pd-custom' }, [
        h('div', { class: 'pd-custom-l', id: ctx.id + '-custom-l' }, ctx.t('split.enterAmount')),
        amountInput(ctx, 'custom', sp.customText, sp.customInvalid, ctx.id + '-custom-l', function (v) {
          ctx.send('set_custom', { amount: v });
        }),
        h('div', { class: 'pd-custom-h' + (sp.customInvalid ? ' pd-custom-h--warn' : '') }, withNumber(ctx.raw('split.upTo'), 'amount', jodText(t.bill.remaining))),
      ]);
    }
    return h('div', { class: 'pd-tb pd-tb-split' }, [
      topBar(ctx, true),
      h('div', { class: 'pd-scroll pd-tb-body' }, [
        h('div', { class: 'pd-tb-crumb' }, [t.venue, h('span', { class: 'pd-sep', 'aria-hidden': 'true' }, ' · '), t.tableLabel]),
        h('div', { class: 'pd-tb-title', role: 'heading', 'aria-level': '2' }, ctx.t('split.title')),
        h('div', { class: 'pd-tb-sub' }, ctx.t('split.sub')),
        h('div', { class: 'pd-share' }, [h('div', { class: 'pd-share-l' }, ctx.t('split.shareLabel')), money(sp.share, 'pd-share-big'), h('div', { class: 'pd-share-n' }, ctx.t('split.shareNote'))]),
        h(
          'div',
          { class: 'pd-opts', role: 'group', 'aria-label': ctx.t('split.title') },
          modes.map(function (m) {
            return btn(ctx, { key: 'mode-' + m[0], class: 'pd-opt', cmd: 'set_split_mode', payload: { mode: m[0] }, pressed: sp.mode === m[0], next: false }, [h('span', { class: 'pd-opt-l' }, ctx.t(m[1])), h('span', { class: 'pd-opt-s' }, ctx.t(m[2]))]);
          })
        ),
        body,
        h('div', { class: 'pd-pill' }, ctx.t('split.propNote')),
      ]),
      h('div', { class: 'pd-tb-foot' }, cta(ctx, { class: 'pd-cta--dark', cmd: 'to_tip', disabled: sp.share <= 0 }, ctx.t('split.continue'), sp.share)),
    ]);
  }

  function amountInput(ctx, key, text, invalid, labelledBy, onInput) {
    if (ctx.isStatic) {
      return h('div', { class: 'pd-amount' }, [h('span', { class: 'pd-amount-cur' }, 'JOD'), h('span', { class: 'pd-amount-in' }, text || '0.000')]);
    }
    return h('div', { class: 'pd-amount' + (invalid ? ' pd-amount--warn' : ''), dir: 'ltr' }, [
      h('span', { class: 'pd-amount-cur', 'aria-hidden': 'true' }, 'JOD'),
      h('input', {
        key: key + '-input',
        class: 'pd-amount-in',
        'data-pd-key': key + '-input',
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        placeholder: '0.000',
        maxlength: '10',
        'aria-labelledby': labelledBy,
        'aria-invalid': invalid ? 'true' : null,
        value: text,
        oninput: function (e) {
          onInput(e.target.value);
        },
      }),
    ]);
  }

  function tipView(ctx, t) {
    var tp = t.tip;
    function opt(id, big, small) {
      return btn(ctx, { key: 'tip-' + id, class: 'pd-tipopt', cmd: 'set_tip', payload: { tip: id }, pressed: tp.choice === id, next: false }, [h('span', { class: 'pd-tipopt-l', dir: id === 'none' ? null : 'ltr' }, big), small ? h('span', { class: 'pd-tipopt-s' }, small) : null]);
    }
    return h('div', { class: 'pd-tb pd-tb-tip' }, [
      topBar(ctx, true),
      h('div', { class: 'pd-scroll pd-tb-body' }, [
        h('div', { class: 'pd-tb-title pd-tb-title--tip', role: 'heading', 'aria-level': '2' }, ctx.t('tip.title')),
        h('div', { class: 'pd-band' }, withNumber(ctx.raw('tip.service'), 'pct', String(t.bill.servicePct))),
        h('div', { class: 'pd-tips', role: 'group', 'aria-label': ctx.t('tip.title') }, [opt('none', ctx.t('tip.noTip')), opt('5', '5%', ctx.t('tip.kind')), opt('10', '10%', ctx.t('tip.generous'))]),
        tp.choice === 'custom'
          ? h('div', { key: 'tipcustom', class: 'pd-custom pd-custom--tip' }, [
              h('div', { class: 'pd-custom-l', id: ctx.id + '-tip-l' }, ctx.t('tip.custom')),
              amountInput(ctx, 'tip', tp.customText, false, ctx.id + '-tip-l', function (v) {
                ctx.send('set_tip', { tip: 'custom', amount: v });
              }),
            ])
          : btn(
              ctx,
              {
                key: 'tip-custom',
                class: 'pd-tiplink',
                next: false,
                onclick: function () {
                  ctx.focusAfter = 'tip-input';
                  ctx.send('set_tip', { tip: 'custom' });
                },
              },
              [icon('pencil', 'pd-tiplink-ic'), h('span', null, ctx.t('tip.custom'))]
            ),
        h('div', { class: 'pd-card' }, [
          sumRow(ctx.t('summary.share'), money(t.pay.share, 'pd-card-money')),
          sumRow(ctx.t('summary.tip'), money(t.pay.tip, 'pd-card-money')),
          sumRow(ctx.t('summary.youPay'), money(t.pay.total, 'pd-card-money'), 'pd-row--total'),
        ]),
      ]),
      h('div', { class: 'pd-tb-foot' }, cta(ctx, { class: 'pd-cta--dark', cmd: 'to_pay', disabled: !ctx.demo.can('to_pay') }, ctx.t('tip.continue'), t.pay.total)),
    ]);
  }

  function payView(ctx, t) {
    return h('div', { class: 'pd-tb pd-tb-pay' }, [
      topBar(ctx, true, true),
      h('div', { class: 'pd-scroll pd-tb-body pd-tb-body--pay' }, [
        h('div', { class: 'pd-pay-l' }, ctx.t('pay.paying')),
        h('div', { class: 'pd-pay-amt', role: 'heading', 'aria-level': '2' }, money(t.pay.total, 'pd-pay-money')),
        h('div', { class: 'pd-pay-where' }, [t.venue, h('span', { class: 'pd-sep', 'aria-hidden': 'true' }, ' · '), t.tableLabel]),
        h('div', { class: 'pd-card pd-card--dark' }, [
          sumRow(ctx.t('pay.yourShare'), money(t.pay.share, null, true)),
          sumRow(ctx.t('pay.tip'), money(t.pay.tip, null, true)),
          sumRow(ctx.t('pay.total'), money(t.pay.total, 'pd-card-money'), 'pd-row--total'),
        ]),
      ]),
      h('div', { class: 'pd-tb-foot pd-tb-foot--pay' }, [
        h('div', { class: 'pd-pay-methods' }, [
          /* Apple's standard button for a dark background: white, the mark, then "Pay". The lockup
             is always left-to-right; the accessible name is in the guest's language. */
          btn(ctx, { key: 'apple-pay', class: 'pd-btn pd-cta pd-applepay', cmd: 'pay_apple', label: ctx.t('pay.apple') }, h('span', { class: 'pd-applepay-in', dir: 'ltr', lang: 'en' }, [icon('apple', 'pd-applepay-mark'), h('span', { class: 'pd-applepay-word' }, 'Pay')])),
          btn(ctx, { key: 'cta', class: 'pd-btn pd-cta pd-cta--outline', cmd: 'pay_card' }, h('span', { class: 'pd-cta-label' }, ctx.t('pay.card'))),
        ]),
        h('div', { class: 'pd-pay-secure' }, [h('span', { class: 'pd-dot', 'aria-hidden': 'true' }), h('span', null, ctx.t('pay.secure'))]),
      ]),
    ]);
  }

  function providerView(ctx, t) {
    var wallet = t.payMethod === 'apple';
    return h('div', { class: 'pd-tb pd-tb-prov', 'data-pd-method': wallet ? 'apple' : 'card' }, [
      h('div', { class: 'pd-tb-top' }, [
        btn(ctx, { key: 'back', class: 'pd-tb-back', cmd: 'back', disabled: t.processing, next: false }, [icon('back', 'pd-tb-back-ic'), h('span', null, ctx.t('nav.back'))]),
        h('span', { class: 'pd-prov-tag' }, [icon('lock', 'pd-prov-tag-ic'), h('span', null, ctx.t('sim.provider.tag'))]),
      ]),
      h('div', { class: 'pd-scroll pd-tb-body' }, [
        wallet ? h('div', { key: 'wallet-title', class: 'pd-prov-title', role: 'heading', 'aria-level': '2' }, h('span', { class: 'pd-prov-title-in', dir: 'ltr', lang: 'en' }, ctx.t('sim.wallet.title'))) : null,
        h('div', { class: 'pd-prov-note' }, ctx.t(wallet ? 'sim.wallet.note' : 'sim.provider.note')),
        h('div', { class: 'pd-prov-sum' }, [h('div', { class: 'pd-prov-to' }, [t.venue, h('span', { class: 'pd-sep', 'aria-hidden': 'true' }, ' · '), t.tableLabel]), money(t.pay.total, 'pd-prov-money')]),
        /* card fields belong to the card page only; Apple's sheet has none to show */
        wallet ? null : h('div', { key: 'fields', class: 'pd-prov-fields', 'aria-hidden': 'true' }, [h('span', { class: 'pd-prov-f' }), h('span', { class: 'pd-prov-f2' }, [h('span', { class: 'pd-prov-f' }), h('span', { class: 'pd-prov-f' })])]),
        wallet ? null : h('div', { key: 'fields-cap', class: 'pd-prov-cap' }, ctx.t('sim.provider.fields')),
      ]),
      h('div', { class: 'pd-tb-foot' }, [
        btn(ctx, { key: 'cta', class: 'pd-btn pd-cta pd-cta--prov' + (t.processing ? ' pd-cta--busy' : ''), cmd: 'confirm_payment', disabled: t.processing }, [
          t.processing ? h('span', { key: 'spin', class: 'pd-spin', 'aria-hidden': 'true' }) : null,
          h('span', { class: 'pd-cta-label' }, t.processing ? ctx.t('sim.provider.waiting') : ctx.t('sim.provider.confirm')),
        ]),
        h('div', { class: 'pd-prov-none' }, ctx.t('sim.provider.none')),
      ]),
    ]);
  }

  function paidView(ctx, t) {
    var last = t.last || { total: 0 };
    var settled = t.bill.settled;
    return h('div', { class: 'pd-tb pd-tb-done' }, [
      h('div', { class: 'pd-scroll pd-done-body' }, [
        h('div', { class: 'pd-done-check', 'aria-hidden': 'true' }, icon('check')),
        h('div', { class: 'pd-done-title', role: 'heading', 'aria-level': '2' }, ctx.t('done.title')),
        h('div', { class: 'pd-done-sub' }, [ctx.t('done.paid') + ' ', money(last.total, 'pd-done-money'), ' ' + fill(ctx.raw('done.paidTo'), { restaurant: t.venue })]),
        settled
          ? h('div', { key: 'settled', class: 'pd-done-status' }, h('span', { class: 'pd-done-pill' }, [icon('check', 'pd-done-pill-ic'), h('span', null, ctx.t('done.settled'))]))
          : h('div', { key: 'left', class: 'pd-done-status' }, [
              h('div', { class: 'pd-done-left' }, withNumber(ctx.raw('done.tableLeft'), 'amount', jodText(t.bill.remaining))),
              btn(ctx, { key: 'another', class: 'pd-btn pd-cta pd-cta--ghost', cmd: 'pay_another', disabled: !ctx.demo.can('pay_another'), next: false }, h('span', { class: 'pd-cta-label' }, ctx.t('done.payAnother'))),
            ]),
      ]),
      h('div', { class: 'pd-tb-foot' }, [
        btn(ctx, { key: 'cta', class: 'pd-btn pd-cta pd-cta--teal', cmd: 'finish' }, h('span', { class: 'pd-cta-label' }, ctx.t('done.done'))),
        h('div', { class: 'pd-done-secure' }, [h('span', { class: 'pd-dot', 'aria-hidden': 'true' }), h('span', null, fill(ctx.raw('done.confirmed'), { restaurant: t.venue }))]),
      ]),
    ]);
  }

  function closedView(ctx, t) {
    var rate;
    if (t.rated) {
      rate = h('div', { key: 'rated', class: 'pd-rate' }, h('div', { class: 'pd-rate-l' }, ctx.t('done.rated')));
    } else {
      rate = h('div', { key: 'rate', class: 'pd-rate' }, [
        h('div', { class: 'pd-rate-l', id: ctx.id + '-rate-l' }, ctx.t('done.rate')),
        h(
          'div',
          { class: 'pd-stars', role: 'group', 'aria-labelledby': ctx.id + '-rate-l', dir: 'ltr' },
          [1, 2, 3, 4, 5].map(function (n) {
            return btn(ctx, { key: 'star-' + n, class: 'pd-star' + (n <= t.rating ? ' pd-star--on' : ''), cmd: 'rate', payload: { stars: n }, pressed: n === t.rating, label: fill(ctx.raw('sim.stars'), { n: n }), next: false }, icon('star'));
          })
        ),
        t.rating > 0 && !ctx.isStatic
          ? h('input', {
              key: 'comment',
              class: 'pd-rate-in',
              'data-pd-key': 'comment',
              type: 'text',
              maxlength: '500',
              placeholder: ctx.t('review.comment'),
              'aria-label': ctx.t('review.comment'),
              oninput: function (e) {
                ctx.local.comment = e.target.value;
              },
            })
          : null,
        t.rating > 0
          ? btn(
              ctx,
              {
                key: 'cta',
                class: 'pd-btn pd-rate-submit',
                next: false,
                onclick: function () {
                  ctx.send('submit_rating', { comment: ctx.local.comment || '' });
                },
              },
              ctx.t('review.submit')
            )
          : null,
      ]);
    }
    return h('div', { class: 'pd-tb pd-tb-done pd-tb-closed' }, [
      h('div', { class: 'pd-scroll pd-done-body' }, [
        h('div', { class: 'pd-closed-mark', 'aria-hidden': 'true' }, t.monogram),
        h('div', { class: 'pd-done-title', role: 'heading', 'aria-level': '2' }, ctx.t('closed.title')),
        h('div', { class: 'pd-done-sub' }, fill(ctx.raw('closed.sub'), { restaurant: t.venue })),
        rate,
      ]),
    ]);
  }

  /* ═════════════════════════ the staff surfaces ═════════════════════════ */

  function staffTree(ctx) {
    var s = ctx.state;
    var pager = s.scenario === 'pager';
    var variant = ctx.opts.variant === 'card' ? 'card' : 'board';
    var body = pager ? (variant === 'card' ? pagerCard(ctx) : pagerBoard(ctx)) : variant === 'card' ? tableCard(ctx) : tableBoard(ctx);
    var statusText = 'Illustrative demo · ' + s.statusTag;
    return h(
      'div',
      {
        class: 'pd-staff pd-staff--' + variant + ' pd-staff--' + s.scenario + (ctx.isStatic ? ' pd-static' : ''),
        'data-pd-surface': 'staff',
        'data-pd-variant': variant,
        'data-pd-scenario': s.scenario,
        'data-pd-state': pager ? s.pager.order.status : s.table.table12.status,
        role: ctx.isStatic ? 'img' : 'group',
        'aria-label': ctx.isStatic ? staffAlt(s) : 'Restaurant side, ' + s.product + ' (' + statusText + ')',
        tabindex: ctx.isStatic ? null : '-1',
        lang: 'en',
        dir: 'ltr',
      },
      [body, ctx.isStatic ? null : h('div', { key: 'sr', class: 'pd-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, ctx.say || '')]
    );
  }
  function staffAlt(s) {
    if (s.scenario === 'pager') {
      var o = s.pager.order;
      return 'Staff order board: order ' + o.ref + ' is ' + o.statusLabel + ', ' + o.guestFact.text + ' (illustration)';
    }
    var t = s.table.table12;
    return 'Restaurant live floor: Table ' + s.table.tableNumber + ' is ' + t.label + '. ' + s.table.pos.text + ' (illustration)';
  }

  function staffHead(ctx, title, sub, tools) {
    var s = ctx.state;
    return h('div', { key: 'head', class: 'pd-st-head' }, [
      h('div', { class: 'pd-st-head-t' }, [h('div', { class: 'pd-st-title', role: 'heading', 'aria-level': '2' }, title), sub ? h('div', { class: 'pd-st-sub' }, sub) : null]),
      h('div', { class: 'pd-st-tools' }, [
        h('span', { class: 'pd-chip pd-chip--demo' }, 'Illustrative demo · ' + s.statusTag),
        h('span', { class: 'pd-conn' }, [h('span', { class: 'pd-conn-dot', 'aria-hidden': 'true' }), STAFF.live]),
        tools,
      ]),
    ]);
  }

  /* ── Order Pager board (PagerBoard.tsx) ── */
  function ticket(ctx, o, compact) {
    var open = !!ctx.local['panel-' + o.id] && !ctx.isStatic;
    var cancelOpen = !!ctx.local['cancel-' + o.id];
    var kids = [
      h('div', { key: 'top', class: 'pd-tk-top' }, [
        h('div', null, [h('div', { class: 'pd-tk-ref' }, o.ref), h('div', { class: 'pd-tk-meta' }, o.meta)]),
        h('span', { key: 'tag-' + o.status, enter: true, class: 'pd-tag pd-tag--' + o.status }, o.statusLabel),
      ]),
      h('div', { key: 'items', class: 'pd-tk-items' }, o.summary),
      h('div', { key: 'facts', class: 'pd-tk-facts' }, [
        h('span', { key: 't-' + o.timeFact.text.replace(/\(\d+s\)/, ''), enter: true, class: 'pd-fact pd-fact--mono' + (o.timeFact.late ? ' pd-fact--warn' : '') }, o.timeFact.text),
        o.open ? h('span', { key: 'g-' + o.guestFact.text, enter: true, class: 'pd-fact pd-fact--' + o.guestFact.tone, 'data-pd-fact': 'guest' }, o.guestFact.text) : null,
        o.status === 'cancelled' ? h('span', { key: 'reason', class: 'pd-fact' }, o.cancelReasonLabel) : null,
      ]),
    ];
    if (o.actions.length) {
      kids.push(
        h(
          'div',
          { key: 'actions', class: 'pd-tk-actions' },
          o.actions.map(function (a) {
            return btn(ctx, { key: 'o' + o.number + '-' + a.command, class: 'pd-act pd-act--' + a.kind, cmd: a.command, payload: { order: o.id }, order: o.id, disabled: a.disabled, next: a.next }, [a.icon ? icon(a.icon, 'pd-act-ic') : null, h('span', null, a.label)]);
          })
        )
      );
    }
    if (o.open && !compact && !ctx.isStatic) {
      kids.push(
        btn(
          ctx,
          {
            key: 'o' + o.number + '-more',
            class: 'pd-tk-more',
            expanded: open,
            next: false,
            onclick: function () {
              ctx.local['panel-' + o.id] = !open;
              ctx.rerender();
            },
          },
          [h('span', null, 'Details'), icon('chev', 'pd-tk-chev' + (open ? ' pd-tk-chev--open' : ''))]
        )
      );
    }
    if (open && o.open) {
      var P = STAFF.panel;
      var kv = function (rows) {
        return h(
          'div',
          { class: 'pd-kv' },
          rows.map(function (r, i) {
            return h('div', { key: 'r' + i, class: 'pd-kv-row' }, [h('span', { class: 'pd-kv-k' }, r.label), h('span', { class: 'pd-kv-v' }, r.value)]);
          })
        );
      };
      kids.push(
        h('div', { key: 'panel', enter: true, class: 'pd-tk-panel' }, [
          h('div', { class: 'pd-pn' }, [
            h('div', { class: 'pd-pn-title' }, P.timing),
            kv(o.timing),
            o.canAdjust
              ? h(
                  'div',
                  { class: 'pd-chips', role: 'group', 'aria-label': 'Adjust the estimate' },
                  api.adjustSteps.map(function (m) {
                    return btn(ctx, { key: 'o' + o.number + '-adj' + m, class: 'pd-chipbtn', cmd: 'adjust', payload: { order: o.id, minutes: m }, order: o.id, next: false }, (m > 0 ? '+' + m : '−' + Math.abs(m)) + ' min');
                  })
                )
              : null,
          ]),
          h('div', { class: 'pd-pn' }, [h('div', { class: 'pd-pn-title' }, P.guest), kv(o.guestRows), h('div', { class: 'pd-pn-note' }, P.honesty)]),
          h('div', { class: 'pd-pn' }, [
            h('div', { class: 'pd-pn-title' }, P.history),
            h(
              'div',
              { class: 'pd-hist', role: 'list' },
              o.history.map(function (x, i) {
                return h('div', { key: 'h' + i, class: 'pd-hist-row', role: 'listitem' }, [h('span', { class: 'pd-hist-t' }, x.clock), h('span', null, x.text)]);
              })
            ),
          ]),
          cancelOpen
            ? h('div', { key: 'cancelform', class: 'pd-pn pd-pn--cancel' }, [
                h('div', { class: 'pd-pn-title' }, P.cancelTitle),
                h('label', { class: 'pd-field' }, [
                  h('span', { class: 'pd-field-l' }, P.cancelReason),
                  h(
                    'select',
                    {
                      key: 'o' + o.number + '-reason',
                      class: 'pd-select',
                      'data-pd-key': 'o' + o.number + '-reason',
                      onchange: function (e) {
                        ctx.local['reason-' + o.id] = e.target.value;
                      },
                    },
                    api.cancelReasons.map(function (r) {
                      return h('option', { key: r.id, value: r.id, selected: (ctx.local['reason-' + o.id] || 'out_of_stock') === r.id }, r.label);
                    })
                  ),
                ]),
                h('div', { class: 'pd-tk-actions' }, [
                  btn(
                    ctx,
                    {
                      key: 'o' + o.number + '-keep',
                      class: 'pd-act pd-act--ghost',
                      next: false,
                      onclick: function () {
                        ctx.local['cancel-' + o.id] = false;
                        ctx.rerender();
                      },
                    },
                    P.keep
                  ),
                  btn(
                    ctx,
                    {
                      key: 'o' + o.number + '-cancel',
                      class: 'pd-act pd-act--danger',
                      next: false,
                      order: o.id,
                      cmd: 'cancel',
                      onclick: function () {
                        ctx.send('cancel', { order: o.id, reason: ctx.local['reason-' + o.id] || 'out_of_stock' });
                      },
                    },
                    P.cancelOrder
                  ),
                ]),
              ])
            : btn(
                ctx,
                {
                  key: 'o' + o.number + '-cancellink',
                  class: 'pd-dangerlink',
                  next: false,
                  onclick: function () {
                    ctx.local['cancel-' + o.id] = true;
                    ctx.rerender();
                  },
                },
                P.cancelLink
              ),
        ])
      );
    }
    return h(
      'div',
      {
        key: 'card-' + o.id + '-' + o.status,
        enter: true,
        class: 'pd-ticket pd-ticket--' + o.status + (o.main ? ' pd-ticket--main' : '') + (compact ? ' pd-ticket--compact' : ''),
        role: 'group',
        'aria-label': 'Order ' + o.ref + ', ' + o.statusLabel,
        'data-pd-card': o.id,
        'data-pd-group': 'card-' + o.id,
        'data-pd-status': o.status,
        'data-pd-main': o.main ? 'true' : null,
      },
      kids
    );
  }

  function livePanel(ctx, lp) {
    var s = ctx.state;
    return h('div', { key: 'live', enter: true, class: 'pd-livepanel', role: 'group', 'aria-label': lp.title }, [
      h('div', { class: 'pd-livepanel-card' }, [
        h('span', { class: 'pd-livepanel-qr', 'aria-hidden': 'true', html: qrSvg(s.pager.order.number) }),
        h('div', { class: 'pd-livepanel-t' }, [
          h('div', { class: 'pd-livepanel-title', role: 'heading', 'aria-level': '3' }, lp.title),
          h('div', { class: 'pd-livepanel-body' }, lp.body),
          btn(ctx, { key: 'live-done', class: 'pd-act pd-act--ghost pd-livepanel-done', cmd: 'live_done', next: false }, STAFF.liveDone),
        ]),
      ]),
    ]);
  }

  function pagerBoard(ctx) {
    var p = ctx.state.pager;
    var guide = ctx.state.guide;
    var covered = !!p.livePanel;
    return [
      staffHead(
        ctx,
        STAFF.pagerTitle,
        STAFF.pagerSub,
        btn(ctx, { key: 'new-order', class: 'pd-act pd-act--primary pd-st-new', cmd: 'new_order', disabled: !p.canNewOrder && !ctx.isStatic, next: guide.command === 'new_order' && p.canNewOrder }, STAFF.newOrder)
      ),
      h('div', { key: 'stage', class: 'pd-st-stage' }, [
        h('div', { key: 'under', class: 'pd-st-under' + (covered ? ' pd-st-under--covered' : ''), inert: covered && !ctx.isStatic, 'aria-hidden': covered ? 'true' : null }, [
          h(
            'div',
            { class: 'pd-cols' },
            p.columns.map(function (col) {
              return h('div', { key: col.status, class: 'pd-col', role: 'group', 'aria-label': col.title, 'data-pd-col': col.status }, [
                h('div', { class: 'pd-col-head' }, [h('span', null, col.title), h('span', { class: 'pd-col-count' }, String(col.orders.length))]),
                h('div', { class: 'pd-col-list' }, col.orders.length ? col.orders.map(function (o) { return ticket(ctx, o, false); }) : h('div', { key: 'empty', class: 'pd-col-empty' }, col.empty)),
              ]);
            })
          ),
          p.done.length
            ? h('div', { class: 'pd-done', role: 'group', 'aria-label': STAFF.doneRecently, 'data-pd-col': 'done' }, [
                h('div', { class: 'pd-col-head' }, [h('span', null, STAFF.doneRecently), h('span', { class: 'pd-col-count' }, String(p.done.length))]),
                h('div', { class: 'pd-done-list' }, p.done.slice(0, 6).map(function (o) { return ticket(ctx, o, true); })),
              ])
            : null,
        ]),
        covered ? livePanel(ctx, p.livePanel) : null,
      ]),
    ];
  }

  function pagerCard(ctx) {
    var p = ctx.state.pager;
    var guide = ctx.state.guide;
    var covered = !!p.livePanel;
    return [
      staffHead(ctx, STAFF.pagerTitle, null, null),
      h('div', { key: 'stage', class: 'pd-st-stage' }, [
        h('div', { key: 'under', class: 'pd-st-under' + (covered ? ' pd-st-under--covered' : ''), inert: covered && !ctx.isStatic, 'aria-hidden': covered ? 'true' : null }, [
          h('div', { class: 'pd-col-head' }, [h('span', null, p.order.open ? STAFF.columns.filter(function (c) { return c.status === p.order.status; })[0].title : STAFF.doneRecently), h('span', { class: 'pd-col-count' }, '1')]),
          ticket(ctx, p.order, false),
          p.canNewOrder ? btn(ctx, { key: 'new-order', class: 'pd-act pd-act--primary pd-st-new pd-st-new--card', cmd: 'new_order', next: guide.command === 'new_order' }, STAFF.newOrder) : null,
        ]),
        covered ? livePanel(ctx, p.livePanel) : null,
      ]),
    ];
  }

  /* ── Pay at Table: live floor, payments, POS line (TableFloor.tsx) ── */
  function tile(ctx, f, big) {
    return h(
      'div',
      {
        key: 'tile-' + f.n,
        class: 'pd-tile pd-tile--' + f.status + (f.me ? ' pd-tile--me' : '') + (big ? ' pd-tile--big' : ''),
        role: 'group',
        'aria-label': 'Table ' + f.n + ', ' + f.label,
        'data-pd-table': String(f.n),
        'data-pd-status': f.status,
        'data-pd-me': f.me ? 'true' : null,
      },
      [
        h('span', { class: 'pd-tile-bar', 'aria-hidden': 'true' }),
        h('div', { class: 'pd-tile-head' }, h('span', { class: 'pd-tile-n' }, String(f.n))),
        h('span', { key: 'st-' + f.status, enter: true, class: 'pd-tstatus pd-tstatus--' + f.status }, [f.status === 'paying' ? h('span', { class: 'pd-tstatus-dot', 'aria-hidden': 'true' }) : null, f.label]),
        h('div', { class: 'pd-tile-rem' }, [
          h('span', { class: 'pd-tile-rem-l' }, f.remaining > 0 ? STAFF.stillToPay : STAFF.nothingDue),
          f.remaining > 0 ? h('span', { key: 'v-' + f.remaining, enter: true, class: 'pd-tile-rem-v' }, fmt(f.remaining)) : null,
        ]),
        h('div', { class: 'pd-tile-note' }, f.note || ' '),
      ]
    );
  }
  function posLine(ctx) {
    var pos = ctx.state.table.pos;
    return h('div', { key: 'pos', class: 'pd-pos' + (pos.posted ? ' pd-pos--posted' : ''), 'data-pd-posted': String(pos.posted) }, [
      h('span', { class: 'pd-pos-l' }, STAFF.pos),
      h('span', { key: 'p-' + pos.posted, enter: true, class: 'pd-pos-t' }, [pos.posted ? icon('check', 'pd-pos-ic') : h('span', { class: 'pd-pos-wait', 'aria-hidden': 'true' }), h('span', null, pos.text)]),
    ]);
  }
  function restButton(ctx) {
    var a = ctx.state.table.staffActions[0];
    return btn(ctx, { key: 'rest', class: 'pd-act pd-act--primary pd-rest', cmd: 'rest_of_table', disabled: a.disabled, next: a.next }, a.label);
  }
  function paymentsList(ctx, rows, withRefund) {
    var t = ctx.state.table;
    var C = STAFF.paymentCols;
    var canRefund = !t.staffActions[1].disabled;
    return h('div', { key: 'payments', class: 'pd-pay-list', role: 'table', 'aria-label': STAFF.payments }, [
      h('div', { class: 'pd-pl-row pd-pl-row--head', role: 'row' }, [
        h('span', { class: 'pd-pl-c pd-pl-time', role: 'columnheader' }, C.time),
        h('span', { class: 'pd-pl-c pd-pl-table', role: 'columnheader' }, C.table),
        h('span', { class: 'pd-pl-c pd-pl-num', role: 'columnheader' }, C.bill),
        h('span', { class: 'pd-pl-c pd-pl-num', role: 'columnheader' }, C.tip),
        h('span', { class: 'pd-pl-c pd-pl-num', role: 'columnheader' }, C.total),
        h('span', { class: 'pd-pl-c pd-pl-method', role: 'columnheader' }, C.method),
      ]),
      rows.map(function (r, i) {
        var last = withRefund && i === 0 && r.mine;
        return h('div', { key: 'pay-' + r.id, enter: true, class: 'pd-pl-row' + (r.mine ? ' pd-pl-row--mine' : '') + (r.refunded ? ' pd-pl-row--refunded' : '') + (r.method !== STAFF.method ? ' pd-pl-row--wallet' : ''), role: 'row', 'data-pd-payment': r.id }, [
          h('span', { class: 'pd-pl-c pd-pl-time', role: 'cell' }, r.time),
          h('span', { class: 'pd-pl-c pd-pl-table', role: 'cell' }, String(r.table)),
          h('span', { class: 'pd-pl-c pd-pl-num', role: 'cell' }, fmt(r.bill)),
          h('span', { class: 'pd-pl-c pd-pl-num', role: 'cell' }, fmt(r.tip)),
          h('span', { class: 'pd-pl-c pd-pl-num pd-pl-total', role: 'cell' }, fmt(r.total)),
          h('span', { class: 'pd-pl-c pd-pl-method', role: 'cell' }, [
            h('span', { class: 'pd-pl-method-name' }, r.method),
            r.refunded ? h('span', { key: 'refunded', class: 'pd-tag pd-tag--refunded' }, STAFF.refunded) : null,
            last && !r.refunded && canRefund && !ctx.isStatic ? btn(ctx, { key: 'refund', class: 'pd-chipbtn pd-refund', cmd: 'refund_last', next: false, label: STAFF.refund + ' this payment' }, STAFF.refund) : null,
          ]),
        ]);
      }),
    ]);
  }
  function table12Card(ctx) {
    var t = ctx.state.table;
    var x = t.table12;
    var pct = Math.round((x.paid / x.bill) * 1000) / 10;
    return h('div', { key: 't12', class: 'pd-t12', role: 'group', 'aria-label': 'Table ' + t.tableNumber, 'data-pd-status': x.status }, [
      h('div', { class: 'pd-t12-head' }, [h('span', { class: 'pd-t12-n' }, 'Table ' + t.tableNumber), h('span', { key: 'st-' + x.status, enter: true, class: 'pd-tstatus pd-tstatus--' + x.status }, [x.status === 'paying' ? h('span', { class: 'pd-tstatus-dot', 'aria-hidden': 'true' }) : null, x.label])]),
      h('div', { class: 'pd-t12-bar', 'aria-hidden': 'true' }, h('span', { class: 'pd-t12-fill', style: 'width:' + pct + '%' })),
      h('div', { class: 'pd-t12-nums' }, [
        h('div', { class: 'pd-t12-num' }, [h('span', { class: 'pd-t12-k' }, STAFF.bill), h('span', { class: 'pd-t12-v' }, fmt(x.bill))]),
        h('div', { class: 'pd-t12-num' }, [h('span', { class: 'pd-t12-k' }, STAFF.paid), h('span', { key: 'p-' + x.paid, enter: true, class: 'pd-t12-v' }, fmt(x.paid))]),
        h('div', { class: 'pd-t12-num' }, [h('span', { class: 'pd-t12-k' }, x.remaining > 0 ? STAFF.stillToPay : STAFF.nothingDue), h('span', { key: 'r-' + x.remaining, enter: true, class: 'pd-t12-v' }, fmt(x.remaining))]),
      ]),
      h('div', { class: 'pd-t12-note' }, x.note || ' '),
      ctx.isStatic ? null : h('div', { key: 'democtl', class: 'pd-democtl' }, 'Demo control'),
      ctx.isStatic ? null : restButton(ctx),
    ]);
  }

  function tableBoard(ctx) {
    var t = ctx.state.table;
    var legend = ['empty', 'open', 'paying', 'paid'];
    return [
      staffHead(ctx, STAFF.floorTitle, t.venue, null),
      h(
        'div',
        { key: 'legend', class: 'pd-legend', role: 'list', 'aria-label': 'Table states' },
        legend.map(function (st) {
          return h('span', { key: st, class: 'pd-legend-i', role: 'listitem' }, [h('span', { class: 'pd-legend-dot pd-legend-dot--' + st, 'aria-hidden': 'true' }), STAFF.tableStatus[st], h('span', { class: 'pd-legend-n' }, String(t.counts[st]))]);
        })
      ),
      h('div', { key: 'floor', class: 'pd-floor' }, t.floor.map(function (f) { return tile(ctx, f, false); })),
      h('div', { key: 'grid', class: 'pd-st-grid' }, [
        h('div', { class: 'pd-st-panel pd-st-panel--pay' }, [
          h('div', { class: 'pd-col-head' }, [h('span', null, STAFF.payments), h('span', { class: 'pd-col-count' }, String(t.payments.length))]),
          paymentsList(ctx, t.payments.slice(0, 6), true),
          t.refundNote ? h('div', { key: 'refundnote', class: 'pd-refund-note' }, t.refundNote) : null,
        ]),
        h('div', { class: 'pd-st-panel pd-st-panel--t12' }, [table12Card(ctx), posLine(ctx)]),
      ]),
    ];
  }

  function tableCard(ctx) {
    var t = ctx.state.table;
    var me = t.floor.filter(function (f) { return f.me; })[0];
    var mine = t.payments.filter(function (p) { return p.mine; }).slice(0, 1);
    return [
      staffHead(ctx, STAFF.floorTitle, null, null),
      h('div', { key: 'cardgrid', class: 'pd-cardgrid' }, [
        tile(ctx, me, true),
        h('div', { class: 'pd-cardgrid-side' }, [
          mine.length ? paymentsList(ctx, mine, true) : h('div', { key: 'nopay', class: 'pd-col-empty pd-col-empty--pay' }, STAFF.payments + ': 0'),
          t.refundNote ? h('div', { key: 'refundnote', class: 'pd-refund-note' }, t.refundNote) : null,
          posLine(ctx),
          ctx.isStatic ? null : h('div', { key: 'democtl', class: 'pd-democtl' }, 'Demo control'),
          ctx.isStatic ? null : restButton(ctx),
        ]),
      ]),
    ];
  }

  /* ═════════════════════════ sound (off until the visitor asks) ═════════════════════════ */

  var audioByDemo = typeof WeakMap === 'function' ? new WeakMap() : null;
  var sharedAudio = null;
  function chime(times) {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    try {
      if (!sharedAudio) sharedAudio = new AC();
      if (sharedAudio.state === 'suspended') sharedAudio.resume();
      var t0 = sharedAudio.currentTime + 0.03;
      for (var r = 0; r < times; r++) {
        // two soft sine notes, a falling fourth; synthesised here, not a recorded file
        note(sharedAudio, 1046.5, t0 + r * 0.72, 0.42);
        note(sharedAudio, 784, t0 + r * 0.72 + 0.17, 0.5);
      }
    } catch (e) {
      /* sound is a nicety; never let it break the demo */
    }
  }
  function note(ac, freq, at, len) {
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(at);
    osc.stop(at + len + 0.05);
  }
  function attachAudio(demo) {
    if (!audioByDemo || audioByDemo.has(demo)) return;
    audioByDemo.set(
      demo,
      demo.subscribe(function (state, ev) {
        if (ev && ev.chime > 0 && api.audio !== false) chime(ev.chime);
      })
    );
  }
  api.audio = true; // set PayliDemo.audio = false to silence the engine altogether

  /* ═════════════════════════ mounts ═════════════════════════ */

  var mountSeq = 0;
  function resolveEl(el) {
    var node = typeof el === 'string' ? doc.querySelector(el) : el;
    if (!node || node.nodeType !== 1) throw new Error('PayliDemo: mount target not found');
    return node;
  }
  function makeCtx(demo, side, opts, isStatic) {
    var ctx = {
      id: 'pd' + ++mountSeq,
      demo: demo,
      side: side,
      opts: opts,
      isStatic: isStatic,
      state: demo.getState(),
      local: {},
      say: '',
      focusAfter: null,
      send: function (cmd, payload) {
        return demo.dispatch(cmd, payload);
      },
      raw: function (key) {
        return api.strings.guest[ctx.state.lang][key];
      },
      t: function (key, vars) {
        return fill(api.strings.guest[ctx.state.lang][key], vars);
      },
      rerender: function () {},
    };
    return ctx;
  }

  function mountTree(el, demo, side, opts, build) {
    var host = resolveEl(el);
    host.classList.add('pd-root');
    var ctx = makeCtx(demo, side, opts, false);
    var vnode = null;
    var sayFlip = false;
    var alive = true;

    function render(state, ev) {
      if (!alive) return;
      ctx.state = state;
      if (ev) {
        var said = side === 'guest' ? ev.phoneSays : ev.staffSays;
        if (said) {
          sayFlip = !sayFlip;
          ctx.say = said + (sayFlip ? '' : ' '); // identical text twice is still announced
        }
      }
      var next = build(ctx);
      if (!vnode) {
        host.appendChild(createNode(next));
      } else {
        keepFocus(vnode.el, function () {
          ENTERING = true;
          try {
            updateNode(vnode, next);
          } finally {
            ENTERING = false;
          }
        });
      }
      vnode = next;
      if (ctx.focusAfter) {
        var f = vnode.el.querySelector('[data-pd-key="' + ctx.focusAfter + '"]');
        ctx.focusAfter = null;
        if (f) f.focus({ preventScroll: true });
      }
      if (ev && side === 'guest' && (ev.type === 'ready' || ev.type === 'ring_again' || ev.type === 'complete' || ev.type === 'cancel' || ev.type === 'reset' || ev.type === 'seed' || ev.type === 'scenario')) {
        var sc = vnode.el.querySelector('.pd-scroll');
        if (sc) sc.scrollTop = 0;
      }
    }
    ctx.rerender = function () {
      render(demo.getState(), null);
    };
    var unsub = demo.subscribe(render);
    render(demo.getState(), null);
    return {
      el: vnode.el,
      destroy: function () {
        if (!alive) return;
        alive = false;
        unsub();
        if (vnode && vnode.el.parentNode) vnode.el.parentNode.removeChild(vnode.el);
        if (!host.querySelector('.pd-phone, .pd-staff, .pd-log, .pd-guide')) host.classList.remove('pd-root');
      },
    };
  }

  function phoneOpts(o) {
    o = o || {};
    return { frame: o.frame === true, statusBar: o.statusBar !== false, fill: o.fill === true, caption: o.caption, detailsOpen: o.detailsOpen === true };
  }

  api.mountPhone = function (el, demo, options) {
    var opts = phoneOpts(options);
    if (!options || options.audio !== false) attachAudio(demo);
    return mountTree(el, demo, 'guest', opts, phoneTree);
  };

  api.mountStaff = function (el, demo, options) {
    return mountTree(el, demo, 'staff', { variant: options && options.variant === 'card' ? 'card' : 'board' }, staffTree);
  };

  var SIDE_LABEL = { staff: 'Restaurant', guest: 'Guest', system: 'Demo' };
  api.mountLog = function (el, demo, options) {
    var host = resolveEl(el);
    host.classList.add('pd-root');
    var max = options && options.max > 0 ? Math.round(options.max) : 8;
    var ul = doc.createElement('ul');
    ul.className = 'pd-log';
    ul.setAttribute('role', 'log');
    ul.setAttribute('aria-live', 'off');
    ul.setAttribute('aria-label', 'Demo events');
    host.appendChild(ul);
    var kids = [];
    function render(state) {
      var rows = state.log.slice(-max).map(function (e) {
        return h('li', { key: 'e' + e.id, class: 'pd-log-item', 'data-pd-side': e.side, 'data-pd-type': e.type }, [h('span', { class: 'pd-log-side' }, SIDE_LABEL[e.side] || e.side), h('span', { class: 'pd-log-text' }, e.text)]);
      });
      reconcile(ul, kids, rows);
      kids = rows;
      ul.setAttribute('data-pd-empty', rows.length ? 'false' : 'true');
    }
    var unsub = demo.subscribe(render);
    render(demo.getState());
    return {
      el: ul,
      destroy: function () {
        unsub();
        if (ul.parentNode) ul.parentNode.removeChild(ul);
        if (!host.querySelector('.pd-phone, .pd-staff, .pd-log, .pd-guide')) host.classList.remove('pd-root');
      },
    };
  };

  api.mountGuide = function (el, demo) {
    var host = resolveEl(el);
    host.classList.add('pd-root');
    var box = doc.createElement('div');
    box.className = 'pd-guide';
    box.setAttribute('aria-live', 'polite');
    box.setAttribute('aria-atomic', 'true');
    host.appendChild(box);
    var kids = [];
    function render(state) {
      var g = state.guide;
      box.setAttribute('data-pd-side', g.side);
      box.setAttribute('data-pd-done', String(g.done));
      box.setAttribute('data-pd-step', String(g.step));
      var rows = [
        h('span', { class: 'pd-guide-step' }, 'Step ' + g.step + ' of ' + g.total),
        h('span', { class: 'pd-guide-title' }, g.title),
        h('span', { class: 'pd-guide-body' }, g.body),
      ];
      reconcile(box, kids, rows);
      kids = rows;
    }
    var unsub = demo.subscribe(render);
    render(demo.getState());
    return {
      el: box,
      destroy: function () {
        unsub();
        if (box.parentNode) box.parentNode.removeChild(box);
        if (!host.querySelector('.pd-phone, .pd-staff, .pd-log, .pd-guide')) host.classList.remove('pd-root');
      },
    };
  };

  /**
   * A static, non-interactive render of a named moment. Synchronous: the DOM is complete when
   * this returns; only fonts and the four dish photos load afterwards (see PayliDemo.whenReady).
   */
  api.snapshot = function (el, options) {
    var o = options || {};
    var scenario = o.scenario === 'table' ? 'table' : 'pager';
    var at = o.at || 'scan';
    if (api.moments[scenario].indexOf(at) === -1) {
      throw new Error('PayliDemo.snapshot: unknown moment "' + at + '" for ' + scenario + '. Use one of: ' + api.moments[scenario].join(', '));
    }
    var host = resolveEl(el);
    host.classList.add('pd-root');
    var demo = api.create({ scenario: scenario, lang: o.lang, appearance: o.appearance, clockTime: o.clockTime || '14:32', ringCooldownSec: o.ringCooldownSec });
    demo.seed(at, { sound: o.sound === true, notifications: o.notifications === true, banner: o.banner === true });
    var staff = o.surface === 'staff';
    var ctx = makeCtx(demo, staff ? 'staff' : 'guest', staff ? { variant: o.variant === 'card' ? 'card' : 'board' } : phoneOpts(o), true);
    var node = createNode(staff ? staffTree(ctx) : phoneTree(ctx));
    node.setAttribute('data-pd-snapshot', scenario + ':' + at);
    host.appendChild(node);
    demo.destroy();
    return {
      el: node,
      destroy: function () {
        if (node.parentNode) node.parentNode.removeChild(node);
        if (!host.querySelector('.pd-phone, .pd-staff, .pd-log, .pd-guide')) host.classList.remove('pd-root');
      },
    };
  };

  /**
   * Resolves when the fonts are loaded and every image inside a .pd-root has decoded: the moment
   * a page full of snapshots is safe to print or to turn into a PDF.
   */
  api.whenReady = function (scope) {
    var base = scope && scope.querySelectorAll ? scope : doc;
    var imgs = Array.prototype.slice.call(base.querySelectorAll('.pd-root img'));
    var waits = imgs.map(function (img) {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(function (res) {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });
      });
    });
    if (doc.fonts && doc.fonts.ready) waits.push(doc.fonts.ready);
    return Promise.all(waits).then(function () {
      return doc.fonts && doc.fonts.ready ? doc.fonts.ready : undefined;
    }).then(function () {});
  };
})(typeof window !== 'undefined' ? window : globalThis);
