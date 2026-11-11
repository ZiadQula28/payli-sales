/*!
 * Payli demo engine: core (headless store).
 *
 * A local, clearly labelled simulation of verified Payli product behaviour. No network, no backend,
 * no real notifications. This file knows nothing about the DOM: it holds state, commands, events,
 * the guide, timers and reset, and runs unchanged in Node (see test/store.test.mjs).
 *
 * Product truth: company-profile-payli/round-3/PAYLI_BUSINESS_RESEARCH.md §4, §5, §14 and the
 * product code it cites (payli-bajer, branch feat/bajer). Guest wording, English and Arabic, is
 * copied from apps/web-payer/src/i18n/strings.ts; staff wording from
 * apps/web-restaurant/src/components/pager/{PagerBoard,TicketDrawer,meta}.tsx and
 * components/TableFloor.tsx. Where the simulation simplifies the product, README.md lists it
 * under "Assumptions".
 *
 * Classic script, one global: window.PayliDemo. Works from file://.
 */
(function (root) {
  'use strict';

  var VERSION = '3.1.0';
  var api = (root.PayliDemo = root.PayliDemo || {});

  /* ───────────────────────── money: integer fils, three decimals ───────────────────────── */

  /** 45298 → "45.298". Integer arithmetic only; never a float division. */
  function formatFils(fils) {
    var n = Math.abs(Math.trunc(fils));
    var whole = Math.floor(n / 1000);
    var frac = String(n % 1000);
    while (frac.length < 3) frac = '0' + frac;
    return (fils < 0 ? '-' : '') + whole + '.' + frac;
  }

  /**
   * "12.5" → 12500, "0.075" → 75. Returns null for anything that is not an amount with at most
   * three decimals. Accepts a comma as the decimal mark and Arabic-Indic digits.
   */
  function parseJod(text) {
    var s = String(text == null ? '' : text).trim().replace(/[٠-٩]/g, function (d) {
      return String(d.charCodeAt(0) - 0x0660);
    }).replace(',', '.');
    var m = /^(\d{1,6})?(?:\.(\d{0,3}))?$/.exec(s);
    if (!m || (m[1] === undefined && (m[2] === undefined || m[2] === ''))) return null;
    var frac = m[2] || '';
    while (frac.length < 3) frac += '0';
    return Number(m[1] || '0') * 1000 + Number(frac);
  }

  /** round(a × b ÷ c) on integers, halves up. */
  function mulDivRound(a, b, c) {
    return Math.floor((a * b + Math.floor(c / 2)) / c);
  }

  /* ───────────────────────── canonical sample data (research §14) ───────────────────────── */

  var VENUE = { name: 'Cedar & Sage', monogram: 'CS', table: 12 };

  var MENU = {
    cookies: { id: 'cookies', en: 'Crushed cookies', ar: 'كوكيز مطحون', unit: 7500, image: 'cookies' },
    latte: { id: 'latte', en: 'Spanish ice latte', ar: 'لاتيه إسباني مثلّج', unit: 5250, image: 'latte' },
    eggs: { id: 'eggs', en: 'Eggs & greens skillet', ar: 'بيض وخضار بالمقلاة', unit: 6500, image: 'eggs-greens' },
    avocado: { id: 'avocado', en: 'Avocado toast', ar: 'توست أفوكادو', unit: 8750, image: 'avocado' },
  };
  var OAT = { en: 'Oat milk', ar: 'حليب شوفان' };

  var BILL_LINES = [
    { item: MENU.cookies, qty: 2 },
    { item: MENU.latte, qty: 1 },
    { item: MENU.eggs, qty: 1 },
    { item: MENU.avocado, qty: 1 },
  ];
  var SERVICE_PCT = 10;
  var TAX_PCT = 16;

  /** Totals for a list of bill lines. Service on the subtotal, tax on subtotal + service. */
  function billTotals(lines) {
    var subtotal = 0;
    for (var i = 0; i < lines.length; i++) subtotal += lines[i].qty * lines[i].item.unit;
    var service = mulDivRound(subtotal, SERVICE_PCT, 100);
    var tax = mulDivRound(subtotal + service, TAX_PCT, 100);
    return { subtotal: subtotal, service: service, tax: tax, total: subtotal + service + tax };
  }
  var BILL = billTotals(BILL_LINES); // 35500 + 3550 + 6248 = 45298

  /** One selectable unit per item ordered, so two cookies can be paid for by two people. */
  var BILL_UNITS = (function () {
    var out = [];
    BILL_LINES.forEach(function (l) {
      for (var n = 1; n <= l.qty; n++) out.push({ id: l.item.id + '-' + n, item: l.item, n: n, of: l.qty });
    });
    return out;
  })();

  /* ───────────────────────── share and tip arithmetic (pure, exported for tests) ─────────── */

  /**
   * What one payer owes. `ctx` = { total, subtotal, remaining }.
   *  - equal:  `covers` of the `coversLeft` shares still unpaid; the last payer takes the remainder.
   *  - item:   service and tax follow the chosen items in proportion (total × chosen ÷ subtotal),
   *            never more than what is left; choosing everything unpaid pays the remainder exactly.
   *  - custom: any amount from 1 fils up to the remainder.
   *  - full:   the remainder.
   */
  function shareFor(ctx, sel) {
    var rem = ctx.remaining;
    if (rem <= 0) return 0;
    if (sel.mode === 'full') return rem;
    if (sel.mode === 'equal') {
      var left = sel.coversLeft;
      var k = Math.min(sel.covers, left);
      if (left <= 0 || k <= 0) return 0;
      return k >= left ? rem : mulDivRound(rem, k, left);
    }
    if (sel.mode === 'item') {
      if (!sel.chosen) return 0;
      if (sel.chosen >= sel.unpaid) return rem;
      return Math.min(rem, mulDivRound(ctx.total, sel.chosen, ctx.subtotal));
    }
    if (sel.mode === 'custom') {
      var v = sel.amount;
      return typeof v === 'number' && v > 0 && v <= rem ? v : 0;
    }
    return 0;
  }

  /** Tip in fils. `choice` is 'none' | '5' | '10' | 'custom'. */
  function tipFor(share, choice, customFils) {
    if (choice === '5') return mulDivRound(share, 5, 100);
    if (choice === '10') return mulDivRound(share, 10, 100);
    if (choice === 'custom') return typeof customFils === 'number' && customFils > 0 ? customFils : 0;
    return 0;
  }

  /* ───────────────────────── wording ───────────────────────── */

  /* Guest strings: verbatim from apps/web-payer/src/i18n/strings.ts (feat/bajer), EN L9–216 and
     AR L218–425. Keys keep the product's names. Three product strings are deliberately not used
     because the claims register forbids what they say (email receipts; tips "to the team"):
     done.receipt, closed.hint, tip.sub. Strings marked SIM belong to the simulation, not the product. */
  var GUEST = {
    en: {
      'nav.back': 'Back',
      'nav.switch': 'العربية',
      'bill.lead': 'Whenever you’re ready, here’s your table.',
      'bill.subtotal': 'Subtotal',
      'bill.service': 'Service charge',
      'bill.tax': 'Tax',
      'bill.billTotal': 'Bill total',
      'bill.alreadyPaid': 'Already paid',
      'bill.remaining': 'Remaining',
      'bill.total': 'Total',
      'bill.payRemaining': 'Pay remaining',
      'bill.payFull': 'Pay full',
      'bill.split': 'Split the bill',
      'bill.splitOn': 'Split bill',
      'bill.payShare': 'Pay my share',
      'bill.payRest': 'Pay the remaining {n} shares',
      'item.alreadyPaid': 'Already paid',
      'common.of': 'of',
      'summary.share': 'Your share',
      'summary.tip': 'Tip',
      'summary.youPay': 'You pay',
      'split.title': 'Split the bill',
      'split.sub': 'Pay for exactly what you had — or divide it.',
      'split.shareLabel': 'Your share',
      'split.shareNote': 'Service & tax are shared in proportion to your items.',
      'split.equal': 'Equally',
      'split.equalSub': 'Divide evenly',
      'split.item': 'By item',
      'split.itemSub': 'What you had',
      'split.custom': 'Custom',
      'split.customSub': 'An amount',
      'split.people': 'People at your table',
      'split.peopleSub': 'How many are sharing',
      'split.youPayFor': 'You pay for',
      'split.youPayForSub': 'Cover yourself or others',
      'split.chooseItems': 'Choose your items',
      'split.enterAmount': 'Enter an amount',
      'split.upTo': 'Up to {amount} remaining on this bill.',
      'split.propNote': 'Service fee & tax are distributed proportionally',
      'split.continue': 'Continue to tip',
      'tip.title': 'Add a tip',
      'tip.service': 'A {pct}% service charge is already included on your bill.',
      'tip.noTip': 'No tip',
      'tip.kind': 'Kind',
      'tip.generous': 'Generous',
      'tip.custom': 'Enter a custom tip',
      'tip.continue': 'Continue to payment',
      'pay.paying': 'You’re paying',
      'pay.yourShare': 'Your share',
      'pay.tip': 'Tip',
      'pay.total': 'Total',
      'pay.card': 'Pay by card',
      'pay.apple': 'Pay with Apple Pay',
      'pay.secure': 'Card details go to our payment provider, never to Payli',
      'done.title': 'You’re good to go',
      'done.paid': 'You paid',
      'done.paidTo': 'to {restaurant}.',
      'done.rate': 'How was your visit?',
      'done.rated': 'Thanks for the feedback.',
      'done.done': 'Done',
      'done.confirmed': 'Payment confirmed · appears as {restaurant}',
      'done.settled': 'This bill is fully settled',
      'done.tableLeft': 'Your table still has {amount} left.',
      'done.payAnother': 'Pay another share',
      'closed.title': 'Thanks for dining with us',
      'closed.sub': 'Hope to see you again at {restaurant}.',
      'review.comment': 'Add a comment (optional)',
      'review.submit': 'Submit',

      'pager.yourOrder': 'Your order',
      'pager.status.received': 'Order received',
      'pager.status.preparing': 'Preparing',
      'pager.status.ready': 'Ready',
      'pager.status.collected': 'Collected',
      'pager.status.cancelled': 'Cancelled',
      'pager.headline.received': 'We’ve got your order',
      'pager.headline.preparing': 'We’re preparing your order',
      'pager.headline.ready': 'Your order is ready',
      'pager.headline.collected': 'Enjoy your order',
      'pager.headline.cancelled': 'Your order was cancelled',
      'pager.message.received': 'We’ll let you know the moment it’s ready.',
      'pager.message.preparing': 'It’s being made now.',
      'pager.message.ready': 'Come and collect it.',
      'pager.message.collected': 'Thanks for your order.',
      'pager.message.cancelled': 'Please speak to the staff.',
      'pager.eta.countdown': 'Ready in about {range} min',
      'pager.eta.soon': 'Almost ready — any minute now',
      'pager.eta.late': 'Taking a little longer than expected',
      'pager.eta.updated': 'Updated',
      'pager.ready.collectAt': 'Collect at {place}',
      'pager.ready.onMyWay': 'I’m on my way',
      'pager.ready.acknowledged': 'Thanks — it’s waiting for you.',
      'pager.ready.since': 'Ready since {time}',
      'pager.cancel.out_of_stock': 'An item ran out.',
      'pager.cancel.customer_request': 'Cancelled at your request.',
      'pager.cancel.duplicate': 'It was a duplicate order.',
      'pager.cancel.kitchen_issue': 'The kitchen couldn’t prepare it.',
      'pager.alerts.title': 'Alert me when it’s ready',
      'pager.alerts.sound': 'Sound',
      'pager.alerts.turnOn': 'Turn on',
      'pager.alerts.on': 'On',
      'pager.alerts.test': 'Play test',
      'pager.alerts.notifications': 'Notifications',
      'pager.alerts.allow': 'Allow',
      'pager.alerts.keepOpen': 'Keep this page open and we’ll chime when your order is ready.',
      'pager.alerts.foreground': 'You’ll be notified while this page is open in the background.',
      'pager.items.title': 'Order details',
      'pager.items.count': 'Items: {n}',
      'pager.timeline.label': 'Order progress',
      'pager.step.done': 'done',
      'pager.step.current': 'now',
      'pager.conn.live': 'Live',
      'pager.poweredBy': 'Powered by Payli',
      'pager.notify.readyTitle': '{name}: order {ref} is ready',
      'pager.notify.readyBody': 'Come and collect it.',

      /* SIM: the simulation's own controls and labels. */
      'sim.table': 'Table {n}',
      'sim.scan': 'Scan the QR',
      'sim.scanTicket': 'Scan to follow your order and get an alert when it’s ready.',
      'sim.scanTable': 'The itemised bill opens in your phone’s browser.',
      'sim.now': 'now',
      'sim.provider.tag': 'Simulated payment',
      'sim.provider.note': 'Simulated payment. In the product, this step happens on the payment provider’s own secure page.',
      'sim.provider.fields': 'Card number, expiry and security code are entered on the provider’s page. Payli never sees them.',
      'sim.provider.confirm': 'Approve simulated payment',
      'sim.provider.waiting': 'Waiting for approval…',
      'sim.provider.none': 'No real card is charged.',
      'sim.wallet.title': 'Apple Pay',
      'sim.wallet.note': 'Simulated payment. In the product, Apple Pay opens Apple’s own payment sheet, where the restaurant’s payment provider enables it.',
      'sim.stars': '{n} of 5 stars',
    },
    ar: {
      'nav.back': 'رجوع',
      'nav.switch': 'English',
      'bill.lead': 'متى ما كنت جاهزًا — هذه طاولتك.',
      'bill.subtotal': 'المجموع الفرعي',
      'bill.service': 'رسوم الخدمة',
      'bill.tax': 'الضريبة',
      'bill.billTotal': 'إجمالي الفاتورة',
      'bill.alreadyPaid': 'مدفوع مسبقًا',
      'bill.remaining': 'المتبقّي',
      'bill.total': 'الإجمالي',
      'bill.payRemaining': 'ادفع المتبقّي',
      'bill.payFull': 'ادفع كامل المبلغ',
      'bill.split': 'قسّم الفاتورة',
      'bill.splitOn': 'فاتورة مقسومة',
      'bill.payShare': 'ادفع حصتي',
      'bill.payRest': 'ادفع الحصص المتبقية ({n})',
      'item.alreadyPaid': 'مدفوع مسبقًا',
      'common.of': 'من',
      'summary.share': 'حصّتك',
      'summary.tip': 'البقشيش',
      'summary.youPay': 'تدفع',
      'split.title': 'قسّم الفاتورة',
      'split.sub': 'ادفع تمامًا مقابل ما طلبته — أو قسّمها.',
      'split.shareLabel': 'حصّتك',
      'split.shareNote': 'تُوزَّع الخدمة والضريبة بنسبة ما طلبته.',
      'split.equal': 'بالتساوي',
      'split.equalSub': 'تقسيم متساوٍ',
      'split.item': 'حسب الصنف',
      'split.itemSub': 'ما طلبته',
      'split.custom': 'مبلغ',
      'split.customSub': 'مبلغ مخصّص',
      'split.people': 'عدد الأشخاص على طاولتك',
      'split.peopleSub': 'كم شخصًا يتقاسم',
      'split.youPayFor': 'تدفع عن',
      'split.youPayForSub': 'ادفع عن نفسك أو عن غيرك',
      'split.chooseItems': 'اختر أصنافك',
      'split.enterAmount': 'أدخل مبلغًا',
      'split.upTo': 'حتى {amount} متبقّ على هذه الفاتورة.',
      'split.propNote': 'تُوزَّع رسوم الخدمة والضريبة بالتناسب',
      'split.continue': 'المتابعة إلى البقشيش',
      'tip.title': 'أضف بقشيشًا',
      'tip.service': 'رسوم خدمة {pct}% مضمَّنة أصلًا في فاتورتك.',
      'tip.noTip': 'بدون بقشيش',
      'tip.kind': 'كريم',
      'tip.generous': 'سخيّ',
      'tip.custom': 'أدخل بقشيشًا مخصّصًا',
      'tip.continue': 'المتابعة إلى الدفع',
      'pay.paying': 'أنت تدفع',
      'pay.yourShare': 'حصّتك',
      'pay.tip': 'البقشيش',
      'pay.total': 'الإجمالي',
      'pay.card': 'ادفع بالبطاقة',
      'pay.apple': 'الدفع عبر Apple Pay',
      'pay.secure': 'تفاصيل البطاقة تذهب إلى مزوّد الدفع، لا إلى Payli أبدًا.',
      'done.title': 'أصبحت جاهزًا للانطلاق',
      'done.paid': 'دفعت',
      'done.paidTo': 'إلى {restaurant}.',
      'done.rate': 'كيف كانت زيارتك؟',
      'done.rated': 'شكرًا لتقييمك.',
      'done.done': 'تم',
      'done.confirmed': 'تم تأكيد الدفع · يظهر باسم {restaurant}',
      'done.settled': 'تم تسديد الفاتورة بالكامل',
      'done.tableLeft': 'لا يزال على طاولتك {amount}.',
      'done.payAnother': 'ادفع حصة أخرى',
      'closed.title': 'شكرًا لزيارتك',
      'closed.sub': 'نتطلّع لرؤيتك مجددًا في {restaurant}.',
      'review.comment': 'أضف تعليقًا (اختياري)',
      'review.submit': 'إرسال',

      'pager.yourOrder': 'طلبك',
      'pager.status.received': 'تم الاستلام',
      'pager.status.preparing': 'قيد التحضير',
      'pager.status.ready': 'جاهز',
      'pager.status.collected': 'تم التسليم',
      'pager.status.cancelled': 'أُلغي',
      'pager.headline.received': 'استلمنا طلبك',
      'pager.headline.preparing': 'نحضّر طلبك الآن',
      'pager.headline.ready': 'طلبك جاهز',
      'pager.headline.collected': 'بالهناء والعافية',
      'pager.headline.cancelled': 'تم إلغاء طلبك',
      'pager.message.received': 'سنخبرك فور جهوزه.',
      'pager.message.preparing': 'يُحضَّر الآن.',
      'pager.message.ready': 'تفضّل باستلامه.',
      'pager.message.collected': 'شكرًا لطلبك.',
      'pager.message.cancelled': 'يرجى مراجعة الموظفين.',
      'pager.eta.countdown': 'جاهز خلال {range} دقيقة تقريبًا',
      'pager.eta.soon': 'أوشك على الجهوز',
      'pager.eta.late': 'يستغرق وقتًا أطول قليلًا من المتوقع',
      'pager.eta.updated': 'محدَّث',
      'pager.ready.collectAt': 'الاستلام من {place}',
      'pager.ready.onMyWay': 'أنا في الطريق',
      'pager.ready.acknowledged': 'شكرًا، طلبك بانتظارك.',
      'pager.ready.since': 'جاهز منذ {time}',
      'pager.cancel.out_of_stock': 'نفد أحد الأصناف.',
      'pager.cancel.customer_request': 'أُلغي بناءً على طلبك.',
      'pager.cancel.duplicate': 'كان طلبًا مكررًا.',
      'pager.cancel.kitchen_issue': 'تعذّر على المطبخ تحضيره.',
      'pager.alerts.title': 'نبّهني عندما يجهز',
      'pager.alerts.sound': 'الصوت',
      'pager.alerts.turnOn': 'تفعيل',
      'pager.alerts.on': 'مفعّل',
      'pager.alerts.test': 'تجربة',
      'pager.alerts.notifications': 'الإشعارات',
      'pager.alerts.allow': 'السماح',
      'pager.alerts.keepOpen': 'أبقِ هذه الصفحة مفتوحة وسننبّهك بصوت عند جهوز طلبك.',
      'pager.alerts.foreground': 'سيصلك إشعار ما دامت الصفحة مفتوحة في الخلفية.',
      'pager.items.title': 'تفاصيل الطلب',
      'pager.items.count': 'عدد الأصناف: {n}',
      'pager.timeline.label': 'مراحل الطلب',
      'pager.step.done': 'مكتملة',
      'pager.step.current': 'الآن',
      'pager.conn.live': 'مباشر',
      'pager.poweredBy': 'بواسطة Payli',
      'pager.notify.readyTitle': '{name}: طلبك {ref} جاهز',
      'pager.notify.readyBody': 'تفضّل باستلامه.',

      /* SIM: the simulation's own controls and labels (not product wording). */
      'sim.table': 'الطاولة {n}',
      'sim.scan': 'امسح رمز QR',
      'sim.scanTicket': 'Scan to follow your order and get an alert when it’s ready.',
      'sim.scanTable': 'تُفتح الفاتورة المفصّلة في متصفّح هاتفك.',
      'sim.now': 'الآن',
      'sim.provider.tag': 'دفع تجريبي',
      'sim.provider.note': 'دفع تجريبي. في المنتج، تتم هذه الخطوة على الصفحة الآمنة الخاصة بمزوّد الدفع.',
      'sim.provider.fields': 'يُدخَل رقم البطاقة وتاريخ الانتهاء ورمز الأمان على صفحة المزوّد. لا تراها Payli أبدًا.',
      'sim.provider.confirm': 'الموافقة على الدفع التجريبي',
      'sim.provider.waiting': 'بانتظار الموافقة…',
      'sim.provider.none': 'لا تُخصم أي بطاقة حقيقية.',
      'sim.wallet.title': 'Apple Pay',
      'sim.wallet.note': 'دفع تجريبي. في المنتج، يفتح Apple Pay نافذة الدفع الخاصة بـ Apple، حيثما يفعّله مزوّد الدفع الخاص بالمطعم.',
      'sim.stars': '{n} من 5 نجوم',
    },
  };

  /* Staff wording: English only, as in the product's dashboard. */
  var STAFF = {
    pagerTitle: 'Order pager',
    pagerSub: 'Guests follow their order on their phone and get an alert when you ring it ready.',
    newOrder: '+ New order',
    live: 'Live',
    columns: [
      { status: 'received', title: 'New', empty: 'No new orders' },
      { status: 'preparing', title: 'Preparing', empty: 'Nothing in preparation' },
      { status: 'ready', title: 'Ready', empty: 'Nothing waiting to be collected' },
    ],
    doneRecently: 'Done recently',
    statusLabel: { received: 'New', preparing: 'Preparing', ready: 'Ready', collected: 'Collected', cancelled: 'Cancelled' },
    actions: { start: 'Start', ready: 'Ready & ring', ring_again: 'Ring again', complete: 'Collected' },
    liveTitle: 'Order {ref} is live',
    liveBody: 'Show the guest this QR, or send the link. They will be alerted when you ring it.',
    liveDone: 'Done',
    panel: {
      order: 'Order',
      timing: 'Timing',
      now: 'Now',
      firstEstimate: 'First estimate',
      currentEstimate: 'Current estimate',
      setByStaff: 'set by staff',
      started: 'Started',
      ready: 'Ready',
      collected: 'Collected',
      collectAt: 'Collect at',
      guest: 'Guest',
      status: 'Status',
      devices: 'Devices',
      soundNotifications: 'Sound / notifications',
      lastAlert: 'Last alert',
      honesty: 'A received alert means the guest’s page got it, not that anyone heard it.',
      history: 'History',
      cancelLink: 'Cancel this order…',
      cancelTitle: 'Cancel this order',
      cancelReason: 'Reason (shown to the guest)',
      keep: 'Keep the order',
      cancelOrder: 'Cancel order',
      cancelled: 'Cancelled',
    },
    cancelReasons: {
      out_of_stock: 'Item out of stock',
      customer_request: 'Customer asked to cancel',
      duplicate: 'Duplicate order',
      kitchen_issue: 'Kitchen issue',
      other: 'Other',
    },
    activity: {
      created: 'Order created',
      started: 'Preparation started',
      ready: 'Marked ready',
      alert_requested: 'Alert sent to the guest',
      collected: 'Collected',
      cancelled: 'Cancelled',
      estimate_changed: 'Estimate changed',
      customer_joined: 'A guest opened the order',
      sound_enabled: 'Guest turned on sound',
      notifications_enabled: 'Guest allowed notifications',
      tracker_updated: 'Guest’s page received the alert',
      acknowledged: 'Guest is on the way',
    },
    floorTitle: 'Live floor',
    tableStatus: { empty: 'Empty', open: 'Bill open', paying: 'Paying now', paid: 'Paid' },
    stillToPay: 'Still to pay',
    nothingDue: 'Nothing due',
    payingOne: '1 person is paying now',
    payingMany: '{n} people are paying now',
    payments: 'Payments',
    paymentCols: { time: 'Time', table: 'Table', bill: 'Bill', tip: 'Tip', total: 'Total', method: 'Method' },
    method: 'Card',
    methodApple: 'Apple Pay',
    refunded: 'Refunded',
    refund: 'Refund',
    refundNote: 'Refund started; the provider returns it to the original card',
    posWaiting: 'Waiting for the table to be fully paid',
    posPosted: 'Sale posted to the POS',
    pos: 'POS',
    restOfTable: 'The rest of the table pays',
    bill: 'Bill',
    paid: 'Paid',
  };

  var LEGAL = {
    all: 'Illustrative demo running in your browser with sample data. It is not connected to a restaurant, a payment provider or a notification service. Cedar & Sage is a fictional venue.',
    pager: 'Order Pager is in development and not yet live at any venue.',
    table: 'Pay at Table is in closed beta in Amman. No restaurant is live yet.',
  };
  var STATUS_TAGS = { pager: 'In development', table: 'Closed beta' };
  var PRODUCT_NAMES = { pager: 'Order Pager', table: 'Pay at Table' };

  var CANCEL_REASONS = ['out_of_stock', 'customer_request', 'duplicate', 'kitchen_issue', 'other'];
  var ADJUST_STEPS = [-5, 5, 10];

  var MOMENTS = {
    pager: ['scan', 'received', 'preparing', 'ready', 'on_my_way', 'collected', 'cancelled'],
    table: ['scan', 'bill', 'split', 'tip', 'pay', 'paid', 'floor_open', 'floor_paying', 'floor_paid'],
  };

  /* Timings of the simulation itself (ms). None of them moves an order. */
  var T = {
    receipt: 350, // the phone's "alert received" report reaching the board
    ringFx: 2800, // how long state.pager.guest.ringing stays true
    banner: 6500, // how long the simulated notification banner stays
    unconfirmed: 8000, // product rule: after 8 s with no receipt the board says so (meta.ts)
    approve: 1300, // simulated provider approval
    restPaying: 1100, // a further guest shows as "paying now" for this long
    restGap: 700,
  };

  /* ───────────────────────── small helpers ───────────────────────── */

  function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (m, k) {
      return vars && vars[k] !== undefined ? String(vars[k]) : m;
    });
  }
  function clockLabel(minutes) {
    var m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    var hh = Math.floor(m / 60);
    var mm = m % 60;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function parseClock(text) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(text || ''));
    if (!m) return null;
    var h = Number(m[1]);
    var mi = Number(m[2]);
    return h < 24 && mi < 60 ? h * 60 + mi : null;
  }
  function minutesRange(from, to) {
    return from === to ? String(from) : from + '–' + to;
  }
  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) deepFreeze(o[k]);
    }
    return o;
  }
  function isHex(c) {
    return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  }

  var realClock = {
    now: function () {
      return Date.now();
    },
    setTimeout: function (fn, ms) {
      return setTimeout(fn, ms);
    },
    clearTimeout: function (id) {
      clearTimeout(id);
    },
  };

  /**
   * A clock that only moves when told to: for tests and for guided tours that want to drive the
   * demo frame by frame. `advance(ms)` runs every timer that falls due, in order.
   */
  function manualClock(startMs) {
    var now = typeof startMs === 'number' ? startMs : 1794400000000;
    var seq = 0;
    var queue = [];
    return {
      now: function () {
        return now;
      },
      setTimeout: function (fn, ms) {
        var id = ++seq;
        queue.push({ id: id, at: now + Math.max(0, ms || 0), fn: fn });
        return id;
      },
      clearTimeout: function (id) {
        queue = queue.filter(function (t) {
          return t.id !== id;
        });
      },
      advance: function (ms) {
        var end = now + Math.max(0, ms || 0);
        for (;;) {
          var next = null;
          for (var i = 0; i < queue.length; i++) {
            if (queue[i].at <= end && (next === null || queue[i].at < next.at || (queue[i].at === next.at && queue[i].id < next.id))) next = queue[i];
          }
          if (next === null) break;
          queue.splice(queue.indexOf(next), 1);
          now = next.at;
          next.fn();
        }
        now = end;
      },
      pending: function () {
        return queue.length;
      },
    };
  }


  /* ───────────────────────── guest-page theme (packages/pager/src/theme.ts) ───────────────── */

  /* A restaurant's colours turned into the variables the guest page is written against. Whatever
     colour comes in, text on it is the one of near-black or white that reads better, and lines
     drawn in it are darkened (or lightened, on the dark theme) until they stand out (WCAG AA). */
  var INK = '#0a1a1d';
  var WHITE = '#ffffff';
  var SURFACES = {
    classic: { bg: '#f7faf9', surface: '#ffffff', text: INK, soft: '#4f6366', line: 'rgba(11, 73, 82, 0.12)' },
    bold: { bg: '#f7faf9', surface: '#ffffff', text: INK, soft: '#4f6366', line: 'rgba(11, 73, 82, 0.12)' },
    dark: { bg: '#061518', surface: '#0b2226', text: '#e6f0ee', soft: '#9fb3b5', line: 'rgba(230, 240, 238, 0.12)' },
  };
  function parseHex(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    var v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function toHex(rgb) {
    return (
      '#' +
      rgb
        .map(function (c) {
          var h = Math.round(Math.min(255, Math.max(0, c))).toString(16);
          return h.length < 2 ? '0' + h : h;
        })
        .join('')
    );
  }
  function luminance(hex) {
    var rgb = parseHex(hex);
    if (!rgb) return 0;
    var l = rgb.map(function (c) {
      var s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  }
  function contrast(a, b) {
    var la = luminance(a);
    var lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function mix(a, b, t) {
    var x = parseHex(a) || [0, 0, 0];
    var y = parseHex(b) || [0, 0, 0];
    return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  }
  function textOn(background) {
    return contrast(INK, background) >= contrast(WHITE, background) ? INK : WHITE;
  }
  function ensureContrast(color, background, ratio) {
    if (contrast(color, background) >= ratio) return color;
    var toward = luminance(background) > 0.4 ? '#000000' : WHITE;
    for (var t = 0.05; t <= 1; t += 0.05) {
      var candidate = mix(color, toward, t);
      if (contrast(candidate, background) >= ratio) return candidate;
    }
    return toward;
  }
  function fillFor(color) {
    return contrast(textOn(color), color) >= 4.5 ? color : ensureContrast(color, WHITE, 4.5);
  }
  /** The colours derived from a brand and an accent on a theme: { brand, brandInk, brandStrong, brandTint, accent, accentInk, accentTint }. */
  function themeColours(themeName, brandHex, accentHex) {
    var s = SURFACES[themeName] || SURFACES.classic;
    var brand = fillFor(String(brandHex).toLowerCase());
    var accent = fillFor(String(accentHex).toLowerCase());
    return {
      brand: brand,
      brandInk: textOn(brand),
      brandStrong: ensureContrast(brand, s.bg, 3),
      brandTint: mix(brand, s.bg, 0.9),
      accent: accent,
      accentInk: textOn(accent),
      accentTint: mix(accent, s.bg, 0.82),
    };
  }

  /* ───────────────────────── the store ───────────────────────── */

  var DEFAULT_APPEARANCE = { theme: 'classic', brand: '#043C44', accent: '#19C3A6' };

  function create(options) {
    var o = options || {};
    var clock = o.clock || realClock;
    var cfg = {
      scenario: o.scenario === 'table' ? 'table' : 'pager',
      lang: o.lang === 'ar' ? 'ar' : 'en',
      appearance: normaliseAppearance(o.appearance, DEFAULT_APPEARANCE),
      appearanceSet: { brand: !!(o.appearance && isHex(o.appearance.brand)), accent: !!(o.appearance && isHex(o.appearance.accent)) },
      sound: o.sound === true,
      cooldown: clampInt(o.ringCooldownSec, 10, 600, 10),
      // Order #24 shows the product's default range, 8–12 min (settings.ts: mode `fixed`).
      estimate: Array.isArray(o.estimateMin) && o.estimateMin.length === 2 ? [clampInt(o.estimateMin[0], 1, 240, 8), clampInt(o.estimateMin[1], 1, 240, 12)] : [8, 12],
      opening: typeof o.opening === 'string' ? o.opening : 'scan',
      clockTime: parseClock(o.clockTime),
    };
    if (cfg.estimate[1] < cfg.estimate[0]) cfg.estimate[1] = cfg.estimate[0];

    var subs = [];
    var timers = {}; // name → clock id
    var eventSeq = 0;
    var destroyed = false;
    var S = null; // mutable state of the current run
    var cache = null;
    var quiet = 0; // > 0 while seeding: timers run at once, subscribers are told once at the end
    var auto = null; // { stop } while autoplay runs

    function normaliseAppearance(a, base) {
      var out = { theme: base.theme, brand: base.brand, accent: base.accent };
      if (a) {
        if (a.theme === 'classic' || a.theme === 'bold' || a.theme === 'dark') out.theme = a.theme;
        if (isHex(a.brand)) out.brand = a.brand;
        if (isHex(a.accent)) out.accent = a.accent;
      }
      return out;
    }
    function clampInt(v, min, max, dflt) {
      var n = Math.round(Number(v));
      if (!isFinite(n)) return dflt;
      return Math.min(max, Math.max(min, n));
    }

    /* ── timers: every one goes through here, so reset() and destroy() cancel them all ── */
    function later(name, ms, fn) {
      cancel(name);
      if (quiet > 0) {
        fn();
        return;
      }
      timers[name] = clock.setTimeout(function () {
        delete timers[name];
        if (!destroyed) fn();
      }, ms);
    }
    function cancel(name) {
      if (timers[name] !== undefined) {
        clock.clearTimeout(timers[name]);
        delete timers[name];
      }
    }
    function cancelAll() {
      Object.keys(timers).forEach(cancel);
    }

    /* ── events ── */
    function emit(side, type, text, extra) {
      var ev = { id: ++eventSeq, at: clock.now(), side: side, type: type, text: text || '' };
      if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) ev[k] = extra[k];
      if (ev.text) {
        S.log.push({ id: ev.id, at: ev.at, side: ev.side, type: ev.type, text: ev.text });
        if (S.log.length > 50) S.log.splice(0, S.log.length - 50);
      }
      cache = null;
      if (quiet > 0) return ev;
      Object.freeze(ev);
      var state = getState();
      subs.slice().forEach(function (fn) {
        fn(state, ev);
      });
      return ev;
    }

    /* ═════════════════════ scenario: pager ═════════════════════ */

    function pagerItems(list) {
      return list.map(function (x) {
        return { qty: x[1], item: MENU[x[0]], mods: x[2] ? [x[2]] : [] };
      });
    }
    function newOrder(number, main) {
      return {
        id: 'o' + number,
        number: number,
        ref: '#' + number,
        main: !!main,
        status: 'received',
        items: pagerItems([['latte', 1, OAT], ['avocado', 1]]),
        ageMin: 0,
        est: { from: cfg.estimate[0], to: cfg.estimate[1], first: [cfg.estimate[0], cfg.estimate[1]], changed: false },
        devices: { total: 0, live: 0, sound: 0, notifications: 0 },
        simPhone: false, // ambient orders may have a pretend phone attached
        alert: null, // { clock, receipts, soundOn, unconfirmed }
        ack: false,
        rings: 0,
        ringEndsAt: 0, // cooldown end (clock ms)
        readyMin: 0,
        clocks: { created: S.clockMin, started: null, ready: null, done: null },
        doneSeq: 0,
        cancelReason: null,
        history: [{ clock: S.clockMin, type: 'created' }],
      };
    }
    function pagerFresh() {
      var p = {
        nextNumber: 24,
        doneSeq: 0,
        orders: [],
        mainId: null,
        livePanel: true,
        phone: { joined: false, sound: false, notifications: false, ringing: false, ringCount: 0, banner: false, alertsSeen: 0 },
      };
      S.pager = p;
      // Ambient orders: they make the board look alive and can be operated, but no phone follows them.
      var a21 = newOrder(21, false);
      a21.items = pagerItems([['latte', 1]]);
      a21.status = 'collected';
      a21.ageMin = 14;
      a21.clocks = { created: S.clockMin - 14, started: S.clockMin - 13, ready: S.clockMin - 8, done: S.clockMin - 6 };
      a21.history = [];
      var a22 = newOrder(22, false);
      a22.items = pagerItems([['cookies', 2]]);
      a22.status = 'preparing';
      a22.ageMin = 4;
      a22.est = { from: 4, to: 8, first: [8, 12], changed: false };
      a22.clocks = { created: S.clockMin - 4, started: S.clockMin - 3, ready: null, done: null };
      a22.history = [{ clock: S.clockMin - 4, type: 'created' }, { clock: S.clockMin - 3, type: 'started' }];
      var a23 = newOrder(23, false);
      a23.items = pagerItems([['eggs', 1], ['latte', 1]]);
      a23.status = 'ready';
      a23.ageMin = 9;
      a23.readyMin = 2;
      a23.simPhone = true;
      a23.devices = { total: 1, live: 1, sound: 0, notifications: 0 };
      a23.alert = { clock: S.clockMin - 2, receipts: 1, soundOn: false, unconfirmed: false };
      a23.rings = 1;
      a23.clocks = { created: S.clockMin - 9, started: S.clockMin - 8, ready: S.clockMin - 2, done: null };
      a23.history = [
        { clock: S.clockMin - 9, type: 'created' },
        { clock: S.clockMin - 9, type: 'customer_joined' },
        { clock: S.clockMin - 8, type: 'started' },
        { clock: S.clockMin - 2, type: 'ready' },
        { clock: S.clockMin - 2, type: 'alert_requested' },
        { clock: S.clockMin - 2, type: 'tracker_updated' },
      ];
      p.orders.push(a21, a22, a23);
      addMainOrder();
    }
    function addMainOrder() {
      var p = S.pager;
      var ord = newOrder(p.nextNumber++, true);
      p.orders.push(ord);
      p.mainId = ord.id;
      p.livePanel = true;
      p.phone = { joined: false, sound: false, notifications: false, ringing: false, ringCount: p.phone.ringCount, banner: false, alertsSeen: 0 };
      return ord;
    }
    function orderById(id) {
      var list = S.pager.orders;
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    }
    function mainOrder() {
      return orderById(S.pager.mainId);
    }
    function targetOrder(payload) {
      var id = payload && payload.order;
      if (id === undefined || id === null) return mainOrder();
      if (typeof id === 'number') id = 'o' + id;
      return orderById(String(id));
    }
    function isOpen(ord) {
      return ord.status === 'received' || ord.status === 'preparing' || ord.status === 'ready';
    }
    function cooldownLeft(ord) {
      if (ord.status !== 'ready') return 0;
      return Math.max(0, Math.ceil((ord.ringEndsAt - clock.now()) / 1000));
    }
    function alertsCardVisible() {
      var m = mainOrder();
      return S.pager.phone.joined && isOpen(m) && !(m.status === 'ready' && m.ack);
    }

    /** The guest fact on a staff card: only what the stored facts support (meta.ts guestFact). */
    function guestFact(ord) {
      if (ord.status === 'ready' && ord.ack) return { text: 'On the way', tone: 'good' };
      if (ord.status === 'ready' && ord.alert) {
        if (ord.alert.receipts > 0) return { text: ord.alert.soundOn ? 'Phone alerted · sound on' : 'Phone alerted · sound off', tone: 'good' };
        if (ord.alert.unconfirmed) return { text: 'No phone confirmed the alert', tone: 'warn' };
      }
      if (ord.devices.live > 0) return { text: ord.devices.live > 1 ? ord.devices.live + ' phones watching' : 'Guest watching', tone: 'plain' };
      if (ord.devices.total > 0) return { text: 'Guest joined · not connected now', tone: 'plain' };
      return { text: 'No guest joined', tone: 'plain' };
    }
    /** The time fact on a staff card (meta.ts staffEta). The demo clock stands still. */
    function timeFact(ord) {
      if (ord.status === 'ready') return { text: ord.readyMin < 1 ? 'Ready just now' : 'Ready ' + ord.readyMin + ' min', late: ord.readyMin >= 10 && !ord.ack };
      if (ord.status === 'collected') return { text: 'Collected ' + clockLabel(ord.clocks.done), late: false };
      if (ord.status === 'cancelled') return { text: 'Cancelled ' + clockLabel(ord.clocks.done), late: false };
      return { text: 'Due in ' + minutesRange(ord.est.from, ord.est.to) + ' min', late: false };
    }
    function itemsSummary(ord) {
      return ord.items
        .map(function (i) {
          return i.qty + '× ' + i.item.en + (i.mods.length ? ' (' + i.mods.map(function (m) { return m.en; }).join(', ') + ')' : '');
        })
        .join(' · ');
    }

    function ring(ord, firstRing) {
      var p = S.pager;
      ord.rings += 1;
      ord.ringEndsAt = clock.now() + cfg.cooldown * 1000;
      ord.alert = { clock: S.clockMin, receipts: 0, soundOn: false, unconfirmed: false };
      ord.history.push({ clock: S.clockMin, type: 'alert_requested' });
      var reaches = ord.main ? p.phone.joined : ord.simPhone;
      var chime = 0;
      if (ord.main && p.phone.joined) {
        p.phone.ringing = true;
        p.phone.ringCount += 1;
        p.phone.banner = p.phone.notifications;
        chime = p.phone.sound ? (firstRing ? 2 : 1) : 0;
        later('ringfx', T.ringFx, function () {
          if (!S.pager.phone.ringing) return;
          S.pager.phone.ringing = false;
          emit('system', 'ring_end', '');
        });
        if (p.phone.banner) {
          later('banner', T.banner, function () {
            if (!S.pager.phone.banner) return;
            S.pager.phone.banner = false;
            emit('system', 'banner_end', '');
          });
        }
      }
      startCooldownTick(ord);
      if (reaches) {
        later('receipt:' + ord.id, T.receipt, function () {
          if (ord.status !== 'ready' || !ord.alert) return;
          ord.alert.receipts = 1;
          ord.alert.soundOn = ord.main ? S.pager.phone.sound : false;
          ord.history.push({ clock: S.clockMin, type: 'tracker_updated' });
          var fact = guestFact(ord).text;
          emit('guest', 'alert_received', 'Guest’s phone received the alert' + (ord.main ? '' : ' (order ' + ord.ref + ')'), {
            order: ord.id,
            staffSays: 'Order ' + ord.ref + ': ' + fact,
          });
        });
      } else {
        later('unconfirmed:' + ord.id, T.unconfirmed, function () {
          if (ord.status !== 'ready' || !ord.alert || ord.alert.receipts > 0) return;
          ord.alert.unconfirmed = true;
          emit('system', 'alert_unconfirmed', 'No phone confirmed the alert for order ' + ord.ref, {
            order: ord.id,
            staffSays: 'Order ' + ord.ref + ': No phone confirmed the alert',
          });
        });
      }
      return chime;
    }
    function startCooldownTick(ord) {
      var name = 'cool:' + ord.id;
      function tick() {
        if (ord.status !== 'ready') return;
        var leftMs = ord.ringEndsAt - clock.now();
        emit('system', 'tick', '');
        if (leftMs > 0) later(name, Math.min(1000, leftMs), tick);
      }
      if (quiet > 0) {
        ord.ringEndsAt = clock.now(); // seeded moments start with the cooldown over
        return;
      }
      later(name, 1000, tick);
    }
    function stopRinging() {
      var p = S.pager.phone;
      p.ringing = false;
      p.banner = false;
      cancel('ringfx');
      cancel('banner');
    }
    function closeOrderTimers(ord) {
      cancel('receipt:' + ord.id);
      cancel('unconfirmed:' + ord.id);
      cancel('cool:' + ord.id);
    }
    function L(key, vars) {
      return fill(GUEST[cfg.lang][key], vars);
    }
    function guestHeadline(ord) {
      return L('pager.headline.' + ord.status) + ' ' + L('pager.message.' + ord.status);
    }

    var PAGER = {
      scan: {
        side: 'guest',
        can: function () {
          return !S.pager.phone.joined;
        },
        run: function () {
          var p = S.pager;
          var ord = mainOrder();
          p.phone.joined = true;
          p.phone.sound = cfg.sound;
          p.livePanel = false;
          ord.devices = { total: 1, live: 1, sound: cfg.sound ? 1 : 0, notifications: 0 };
          ord.history.push({ clock: S.clockMin, type: 'customer_joined' });
          emit('guest', 'scan', 'Guest scanned the QR. The order page opened on the phone', {
            order: ord.id,
            phoneSays: L('pager.yourOrder') + ' ' + ord.ref + '. ' + guestHeadline(ord),
            staffSays: 'Order ' + ord.ref + ': ' + guestFact(ord).text,
          });
        },
      },
      live_done: {
        side: 'staff',
        can: function () {
          return S.pager.livePanel;
        },
        run: function () {
          S.pager.livePanel = false;
          emit('staff', 'live_done', '');
        },
      },
      sound_on: {
        side: 'guest',
        can: function () {
          return alertsCardVisible() && !S.pager.phone.sound;
        },
        run: function () {
          var ord = mainOrder();
          S.pager.phone.sound = true;
          ord.devices.sound = 1;
          ord.history.push({ clock: S.clockMin, type: 'sound_enabled' });
          emit('guest', 'sound_on', 'Guest turned on sound', { chime: 1, phoneSays: L('pager.alerts.sound') + ': ' + L('pager.alerts.on') });
        },
      },
      sound_test: {
        side: 'guest',
        can: function () {
          return alertsCardVisible() && S.pager.phone.sound;
        },
        run: function () {
          emit('guest', 'sound_test', 'Guest played the test chime', { chime: 1 });
        },
      },
      notify_allow: {
        side: 'guest',
        can: function () {
          return alertsCardVisible() && !S.pager.phone.notifications;
        },
        run: function () {
          var ord = mainOrder();
          S.pager.phone.notifications = true;
          ord.devices.notifications = 1;
          ord.history.push({ clock: S.clockMin, type: 'notifications_enabled' });
          emit('guest', 'notify_allow', 'Guest allowed notifications', { phoneSays: L('pager.alerts.notifications') + ': ' + L('pager.alerts.on') });
        },
      },
      start: {
        side: 'staff',
        can: function (p) {
          var ord = targetOrder(p);
          return !!ord && ord.status === 'received';
        },
        run: function (p) {
          var ord = targetOrder(p);
          ord.status = 'preparing';
          ord.clocks.started = S.clockMin;
          ord.history.push({ clock: S.clockMin, type: 'started' });
          if (ord.main) S.pager.livePanel = false;
          emit('staff', 'start', 'Staff pressed Start. Order ' + ord.ref + ' is being prepared', {
            order: ord.id,
            staffSays: 'Order ' + ord.ref + ' moved to Preparing',
            phoneSays: ord.main && S.pager.phone.joined ? guestHeadline(ord) : '',
          });
        },
      },
      adjust: {
        side: 'staff',
        can: function (p) {
          var ord = targetOrder(p);
          return !!ord && (ord.status === 'received' || ord.status === 'preparing') && !!p && ADJUST_STEPS.indexOf(p.minutes) !== -1;
        },
        run: function (p) {
          var ord = targetOrder(p);
          var width = ord.est.to - ord.est.from;
          // Product rule (pager.service.ts): never into the past, at least a minute from now.
          var from = Math.max(1, ord.est.from + p.minutes);
          ord.est.from = from;
          ord.est.to = from + width;
          ord.est.changed = true;
          ord.history.push({ clock: S.clockMin, type: 'estimate_changed' });
          var range = minutesRange(ord.est.from, ord.est.to);
          emit('staff', 'adjust', 'Staff changed the estimate by ' + (p.minutes > 0 ? '+' : '−') + Math.abs(p.minutes) + ' min. Now ' + range + ' min', {
            order: ord.id,
            staffSays: 'Order ' + ord.ref + ': Due in ' + range + ' min',
            phoneSays: ord.main && S.pager.phone.joined ? L('pager.eta.countdown', { range: range }) + '. ' + L('pager.eta.updated') : '',
          });
        },
      },
      ready: {
        side: 'staff',
        can: function (p) {
          var ord = targetOrder(p);
          return !!ord && (ord.status === 'received' || ord.status === 'preparing');
        },
        run: function (p) {
          var ord = targetOrder(p);
          ord.status = 'ready';
          ord.readyMin = 0;
          ord.clocks.ready = S.clockMin;
          ord.history.push({ clock: S.clockMin, type: 'ready' });
          if (ord.main) S.pager.livePanel = false;
          var chime = ring(ord, true);
          emit('staff', 'ready', 'Staff pressed Ready & ring' + (ord.main ? '' : ' on order ' + ord.ref), {
            order: ord.id,
            chime: chime,
            ring: ord.main && S.pager.phone.joined,
            staffSays: 'Order ' + ord.ref + ' moved to Ready',
            phoneSays: ord.main && S.pager.phone.joined ? guestHeadline(ord) : '',
          });
        },
      },
      ring_again: {
        side: 'staff',
        can: function (p) {
          var ord = targetOrder(p);
          return !!ord && ord.status === 'ready' && !ord.ack && cooldownLeft(ord) === 0;
        },
        run: function (p) {
          var ord = targetOrder(p);
          var chime = ring(ord, false);
          emit('staff', 'ring_again', 'Staff pressed Ring again' + (ord.main ? '' : ' on order ' + ord.ref), {
            order: ord.id,
            chime: chime,
            ring: ord.main && S.pager.phone.joined,
            staffSays: 'Order ' + ord.ref + ': rang again',
            phoneSays: ord.main && S.pager.phone.joined ? guestHeadline(ord) : '',
          });
        },
      },
      on_my_way: {
        side: 'guest',
        can: function () {
          var ord = mainOrder();
          return S.pager.phone.joined && ord.status === 'ready' && !ord.ack;
        },
        run: function () {
          var ord = mainOrder();
          ord.ack = true;
          ord.history.push({ clock: S.clockMin, type: 'acknowledged' });
          stopRinging();
          cancel('cool:' + ord.id);
          emit('guest', 'on_my_way', 'Guest tapped I’m on my way', {
            order: ord.id,
            phoneSays: L('pager.ready.acknowledged'),
            staffSays: 'Order ' + ord.ref + ': On the way',
          });
        },
      },
      complete: {
        side: 'staff',
        can: function (p) {
          var ord = targetOrder(p);
          return !!ord && ord.status === 'ready';
        },
        run: function (p) {
          var ord = targetOrder(p);
          ord.status = 'collected';
          ord.clocks.done = S.clockMin;
          ord.doneSeq = ++S.pager.doneSeq;
          ord.history.push({ clock: S.clockMin, type: 'collected' });
          closeOrderTimers(ord);
          if (ord.main) stopRinging();
          emit('staff', 'complete', 'Staff pressed Collected. Order ' + ord.ref + ' is closed', {
            order: ord.id,
            staffSays: 'Order ' + ord.ref + ' moved to Done recently',
            phoneSays: ord.main && S.pager.phone.joined ? guestHeadline(ord) : '',
          });
        },
      },
      cancel: {
        side: 'staff',
        can: function (p) {
          var ord = targetOrder(p);
          var reason = p && p.reason !== undefined ? p.reason : 'out_of_stock';
          return !!ord && isOpen(ord) && CANCEL_REASONS.indexOf(reason) !== -1;
        },
        run: function (p) {
          var ord = targetOrder(p);
          var reason = p && p.reason !== undefined ? p.reason : 'out_of_stock';
          ord.status = 'cancelled';
          ord.cancelReason = reason;
          ord.clocks.done = S.clockMin;
          ord.doneSeq = ++S.pager.doneSeq;
          ord.history.push({ clock: S.clockMin, type: 'cancelled' });
          closeOrderTimers(ord);
          if (ord.main) {
            stopRinging();
            S.pager.livePanel = false;
          }
          emit('staff', 'cancel', 'Staff cancelled order ' + ord.ref + ': ' + STAFF.cancelReasons[reason], {
            order: ord.id,
            staffSays: 'Order ' + ord.ref + ' cancelled',
            phoneSays: ord.main && S.pager.phone.joined ? guestHeadline(ord) : '',
          });
        },
      },
      new_order: {
        side: 'staff',
        can: function () {
          return !isOpen(mainOrder());
        },
        run: function () {
          var prev = mainOrder();
          prev.main = false;
          stopRinging();
          var ord = addMainOrder();
          emit('staff', 'new_order', 'Staff created order ' + ord.ref + '. It is live', {
            order: ord.id,
            staffSays: fill(STAFF.liveTitle, { ref: ord.ref }),
          });
        },
      },
    };

    function pagerGuide() {
      var p = S.pager;
      var ord = mainOrder();
      var total = 5;
      function g(step, side, command, title, body) {
        return { step: step, total: total, side: side, command: command, payload: null, title: title, body: body, done: false };
      }
      if (!isOpen(ord)) {
        return {
          step: total,
          total: total,
          side: 'staff',
          command: 'new_order',
          payload: null,
          title: ord.status === 'cancelled' ? 'Order ' + ord.ref + ' was cancelled' : 'Order ' + ord.ref + ' is collected',
          body: 'Press + New order to run it again with the next order number, or reset the demo.',
          done: true,
        };
      }
      if (!p.phone.joined && ord.status !== 'ready') {
        return g(1, 'guest', 'scan', 'Scan the QR with the guest’s phone', 'The order page opens in the phone’s browser. No app, no account, no phone number.');
      }
      if (ord.status === 'received') {
        return g(2, 'staff', 'start', 'Press Start to begin preparing order ' + ord.ref, 'Only staff move an order. The phone follows at once.');
      }
      if (ord.status === 'preparing') {
        return g(3, 'staff', 'ready', 'Press Ready & ring when order ' + ord.ref + ' is ready', 'The guest’s phone is alerted. Turn on Sound on the phone first to hear the chime.');
      }
      if (p.phone.joined && !ord.ack) {
        return g(4, 'guest', 'on_my_way', 'Tap I’m on my way on the phone', 'The board shows On the way. If nobody responds, staff can ring again after a short cooldown.');
      }
      return g(5, 'staff', 'complete', 'Press Collected to close order ' + ord.ref, 'The card moves to Done recently and the phone shows the thank-you.');
    }

    function pagerView() {
      var p = S.pager;
      var main = mainOrder();
      var guide = S.guide;
      function orderView(ord) {
        var open = isOpen(ord);
        var left = cooldownLeft(ord);
        var actions = [];
        function act(command, kind, icon, disabled, label) {
          actions.push({
            command: command,
            label: label || STAFF.actions[command],
            kind: kind,
            icon: icon,
            disabled: !!disabled,
            next: ord.main && guide.side === 'staff' && guide.command === command && !guide.done,
          });
        }
        if (ord.status === 'received') act('start', 'ghost', null, false);
        if (ord.status === 'received' || ord.status === 'preparing') act('ready', 'ready', 'bell', false);
        if (ord.status === 'ready') {
          act('ring_again', 'ghost', 'bell', ord.ack || left > 0, left > 0 && !ord.ack ? STAFF.actions.ring_again + ' (' + left + 's)' : STAFF.actions.ring_again);
          act('complete', 'primary', null, false);
        }
        var tf = timeFact(ord);
        var gf = guestFact(ord);
        var timing = [{ label: STAFF.panel.now, value: open ? tf.text : STAFF.statusLabel[ord.status] }];
        timing.push({ label: STAFF.panel.firstEstimate, value: clockLabel(ord.clocks.created + ord.est.first[0]) + '–' + clockLabel(ord.clocks.created + ord.est.first[1]) });
        if (ord.est.changed) {
          timing.push({
            label: STAFF.panel.currentEstimate,
            value: clockLabel(S.clockMin + ord.est.from) + '–' + clockLabel(S.clockMin + ord.est.to) + ' (' + STAFF.panel.setByStaff + ')',
          });
        }
        timing.push({ label: STAFF.panel.started, value: ord.clocks.started === null ? '—' : clockLabel(ord.clocks.started) });
        timing.push({ label: STAFF.panel.ready, value: ord.clocks.ready === null ? '—' : clockLabel(ord.clocks.ready) });
        if (ord.status === 'collected') timing.push({ label: STAFF.panel.collected, value: clockLabel(ord.clocks.done) });
        var guestRows = [
          { label: STAFF.panel.status, value: gf.text },
          { label: STAFF.panel.devices, value: ord.devices.total + ' joined · ' + ord.devices.live + ' connected now' },
          { label: STAFF.panel.soundNotifications, value: ord.devices.sound + ' on · ' + ord.devices.notifications + ' allowed' },
        ];
        if (ord.alert) {
          guestRows.push({
            label: STAFF.panel.lastAlert,
            value: clockLabel(ord.alert.clock) + ' · received by ' + ord.alert.receipts + ' page' + (ord.alert.receipts === 1 ? '' : 's'),
          });
        }
        return {
          id: ord.id,
          number: ord.number,
          ref: ord.ref,
          main: ord.main,
          status: ord.status,
          statusLabel: STAFF.statusLabel[ord.status],
          open: open,
          age: ord.ageMin < 1 ? 'just now' : ord.ageMin + ' min ago',
          pickup: 'Counter',
          meta: (ord.ageMin < 1 ? 'just now' : ord.ageMin + ' min ago') + ' · Counter',
          summary: itemsSummary(ord),
          timeFact: tf,
          guestFact: gf,
          estimate: { from: ord.est.from, to: ord.est.to, updated: ord.est.changed, range: minutesRange(ord.est.from, ord.est.to) },
          joined: ord.devices.total > 0,
          onTheWay: ord.ack,
          rings: ord.rings,
          cooldownLeft: ord.ack ? 0 : left,
          cancelReason: ord.cancelReason,
          cancelReasonLabel: ord.cancelReason ? STAFF.cancelReasons[ord.cancelReason] : null,
          doneSeq: ord.doneSeq,
          actions: actions,
          canAdjust: ord.status === 'received' || ord.status === 'preparing',
          canCancel: open,
          timing: timing,
          guestRows: guestRows,
          history: ord.history.map(function (h) {
            return { clock: clockLabel(h.clock), text: STAFF.activity[h.type] };
          }),
        };
      }

      var views = p.orders.map(orderView);
      var byStatus = function (st) {
        return views.filter(function (v) {
          return v.status === st;
        });
      };
      var columns = STAFF.columns.map(function (c) {
        return { status: c.status, title: c.title, empty: c.empty, orders: byStatus(c.status) };
      });
      var done = views
        .filter(function (v) {
          return !v.open;
        })
        .sort(function (a, b) {
          return b.doneSeq - a.doneSeq || b.number - a.number;
        });

      /* The guest's page, in the guest's language. */
      var joined = p.phone.joined;
      var steps = ['received', 'preparing', 'ready', 'collected'];
      var current = main.status === 'cancelled' ? -1 : steps.indexOf(main.status);
      var eta = null;
      if (main.status === 'received' || main.status === 'preparing') {
        var range = minutesRange(main.est.from, main.est.to);
        eta = {
          kind: 'countdown',
          template: GUEST[cfg.lang]['pager.eta.countdown'],
          range: range,
          text: L('pager.eta.countdown', { range: range }),
          updated: main.est.changed,
          updatedLabel: L('pager.eta.updated'),
        };
      }
      var message = L('pager.message.' + main.status);
      if (main.status === 'cancelled' && main.cancelReason && main.cancelReason !== 'other') {
        message = L('pager.cancel.' + main.cancelReason) + ' ' + message;
      }
      var cardVisible = alertsCardVisible();
      var guest = {
        screen: joined ? 'order' : 'scan',
        joined: joined,
        status: main.status,
        ref: main.ref,
        venue: VENUE.name,
        monogram: VENUE.monogram,
        welcome: cfg.lang === 'ar' ? 'شكرًا لطلبك. سننبّه هاتفك عندما يجهز.' : 'Thanks for ordering. We will ring your phone when it is ready.',
        eyebrow: L('pager.yourOrder'),
        headline: L('pager.headline.' + main.status),
        message: message,
        eta: eta,
        steps: steps.map(function (st, i) {
          var isDone = i < current || (i === current && st === 'collected');
          return { id: st, label: L('pager.status.' + st), done: isDone, now: i === current && !isDone };
        }),
        showTimeline: main.status !== 'cancelled',
        collect:
          main.status === 'ready'
            ? {
                place: L('pager.ready.collectAt', { place: cfg.lang === 'ar' ? 'الكاونتر' : 'Counter' }),
                note: cfg.lang === 'ar' ? 'استلم طلبك من الكاونتر بجانب الباب.' : 'Collect from the counter by the door.',
              }
            : null,
        canAck: joined && main.status === 'ready' && !main.ack,
        acked: main.status === 'ready' && main.ack,
        readySince: main.status === 'ready' ? { template: GUEST[cfg.lang]['pager.ready.since'], time: clockLabel(main.clocks.ready) } : null,
        alerts: {
          visible: cardVisible,
          sound: p.phone.sound,
          notifications: p.phone.notifications,
        },
        items: main.items.map(function (i) {
          return {
            qty: i.qty,
            name: i.item[cfg.lang],
            mods: i.mods.map(function (m) {
              return m[cfg.lang];
            }),
          };
        }),
        itemCount: main.items.reduce(function (n, i) {
          return n + i.qty;
        }, 0),
        live: joined && isOpen(main),
        ringing: p.phone.ringing,
        ringCount: p.phone.ringCount,
        banner: p.phone.banner
          ? { title: L('pager.notify.readyTitle', { name: VENUE.name, ref: main.ref }), body: L('pager.notify.readyBody'), when: L('sim.now') }
          : null,
        ticket: { venue: VENUE.name, ref: main.ref, line: GUEST.en['sim.scanTicket'] },
      };

      return {
        mainId: main.id,
        order: views.filter(function (v) {
          return v.id === main.id;
        })[0],
        orders: views,
        columns: columns,
        done: done,
        livePanel: p.livePanel ? { title: fill(STAFF.liveTitle, { ref: main.ref }), body: STAFF.liveBody, ref: main.ref } : null,
        cooldownSec: cfg.cooldown,
        canNewOrder: !isOpen(main),
        guest: guest,
      };
    }

    /* ═════════════════════ scenario: table ═════════════════════ */

    function tableFresh() {
      S.table = {
        screen: 'scan',
        payments: [],
        paidUnits: {},
        people: 2,
        coversPaid: 0,
        equalOn: false, // an equal split is in progress (some shares paid, some not)
        cur: { mode: 'equal', covers: 1, sel: {}, customText: '', tip: 'none', tipText: '', via: 'split' },
        processing: false,
        method: 'card', // how the guest is paying this share: 'card' (Pay by card) or 'apple' (Apple Pay)
        payingNow: 0,
        resting: false,
        posted: false,
        rating: 0,
        comment: '',
        rated: false,
        last: null,
        feed: [
          { id: 'f1', table: 6, share: 49571, tip: 2609, clock: S.clockMin - 41, refunded: false },
          { id: 'f2', table: 3, share: 23640, tip: 0, clock: S.clockMin - 27, refunded: false },
        ],
        floor: [
          { n: 3, status: 'paid' },
          { n: 4, status: 'open', remaining: 28420 },
          { n: 5, status: 'empty' },
          { n: 6, status: 'paid' },
          { n: 7, status: 'open', remaining: 19350 },
          { n: 8, status: 'empty' },
          { n: 9, status: 'paying', remaining: 41870, payingCount: 1 },
          { n: 10, status: 'open', remaining: 33900 },
          { n: 11, status: 'empty' },
          { n: 12, me: true },
        ],
      };
    }
    function tPaid() {
      return S.table.payments.reduce(function (a, p) {
        return a + p.share;
      }, 0);
    }
    function tRemaining() {
      return BILL.total - tPaid();
    }
    function unpaidUnits() {
      return BILL_UNITS.filter(function (u) {
        return !S.table.paidUnits[u.id];
      });
    }
    function curShare() {
      var t = S.table;
      var c = t.cur;
      var ctx = { total: BILL.total, subtotal: BILL.subtotal, remaining: tRemaining() };
      if (c.mode === 'equal') return shareFor(ctx, { mode: 'equal', covers: c.covers, coversLeft: t.people - t.coversPaid });
      if (c.mode === 'item') {
        var chosen = 0;
        var unpaid = 0;
        unpaidUnits().forEach(function (u) {
          unpaid += u.item.unit;
          if (c.sel[u.id]) chosen += u.item.unit;
        });
        return shareFor(ctx, { mode: 'item', chosen: chosen, unpaid: unpaid });
      }
      if (c.mode === 'custom') return shareFor(ctx, { mode: 'custom', amount: parseJod(c.customText) });
      return shareFor(ctx, { mode: 'full' });
    }
    function curTip() {
      var c = S.table.cur;
      var custom = parseJod(c.tipText);
      return tipFor(curShare(), c.tip, custom === null ? 0 : custom);
    }
    function tableStatus() {
      var t = S.table;
      if (t.payingNow > 0) return 'paying';
      return tRemaining() === 0 ? 'paid' : 'open';
    }
    function freshCur(mode) {
      return { mode: mode, covers: 1, sel: {}, customText: '', tip: 'none', tipText: '', via: 'split' };
    }
    function jod(fils) {
      return 'JOD ' + formatFils(fils);
    }
    function record(share, tip, by, label, method) {
      var t = S.table;
      var pay = { id: 'p' + (t.payments.length + 1), table: VENUE.table, share: share, tip: tip, by: by, label: label, clock: S.clockMin, refunded: false, method: method === 'apple' ? STAFF.methodApple : STAFF.method };
      t.payments.push(pay);
      t.last = pay;
      return pay;
    }
    function afterPayment(pay, who) {
      var t = S.table;
      var rem = tRemaining();
      // Card payments keep their original wording; only a wallet payment names its method.
      var wallet = pay.method === STAFF.methodApple;
      emit(who === 'guest' ? 'guest' : 'system', 'payment', (who === 'guest' ? (wallet ? 'Payment approved with ' + pay.method + ': ' : 'Payment approved: ') : 'Another guest at Table ' + VENUE.table + ' paid ') + jod(pay.share + pay.tip) + (pay.tip ? ' including a ' + jod(pay.tip) + ' tip' : '') + '. It appears in the payments list', {
        staffSays: 'Table ' + VENUE.table + ': ' + (wallet ? pay.method + ' payment of ' : 'payment of ') + jod(pay.share + pay.tip) + ' recorded. ' + (rem ? jod(rem) + ' still to pay' : 'Paid'),
        phoneSays: who === 'guest' ? L('done.title') + '. ' + L('done.paid') + ' ' + jod(pay.share + pay.tip) + ' ' + L('done.paidTo', { restaurant: VENUE.name }) : '',
      });
      if (rem === 0 && !t.posted) {
        t.posted = true;
        t.equalOn = false;
        emit('system', 'pos_posted', 'Table ' + VENUE.table + ' fully paid. Sale posted to the POS', {
          staffSays: 'Table ' + VENUE.table + ' is Paid. ' + STAFF.posPosted,
          phoneSays: t.screen === 'paid' ? L('done.settled') : '',
        });
      }
    }
    function approve() {
      var t = S.table;
      var c = t.cur;
      var share = curShare();
      var tip = curTip();
      var label = c.mode === 'equal' ? (c.covers > 1 ? c.covers + ' equal shares' : 'Equal share') : c.mode === 'item' ? 'By item' : c.mode === 'custom' ? 'Custom amount' : t.payments.length ? 'Remaining' : 'Full bill';
      if (c.mode === 'equal') {
        t.coversPaid += Math.min(c.covers, t.people - t.coversPaid);
        t.equalOn = t.coversPaid < t.people;
      }
      if (c.mode === 'item') {
        unpaidUnits().forEach(function (u) {
          if (c.sel[u.id]) t.paidUnits[u.id] = true;
        });
      }
      if (c.mode === 'full') {
        t.equalOn = false;
      }
      var pay = record(share, tip, 'guest', label, t.method);
      t.method = 'card';
      t.processing = false;
      t.payingNow = 0;
      t.screen = 'paid';
      t.cur = freshCur(t.equalOn ? 'equal' : 'equal');
      afterPayment(pay, 'guest');
    }
    function restStep(k) {
      var t = S.table;
      if (tRemaining() <= 0) {
        t.resting = false;
        return;
      }
      t.payingNow = 1;
      emit('system', 'rest_paying', '', { staffSays: 'Table ' + VENUE.table + ': ' + STAFF.payingOne });
      later('rest', T.restPaying, function () {
        var rem = tRemaining();
        var share;
        var label;
        if (t.equalOn) {
          share = shareFor({ total: BILL.total, subtotal: BILL.subtotal, remaining: rem }, { mode: 'equal', covers: 1, coversLeft: t.people - t.coversPaid });
          t.coversPaid += 1;
          t.equalOn = t.coversPaid < t.people;
          label = 'Equal share';
        } else {
          share = rem;
          unpaidUnits().forEach(function (u) {
            t.paidUnits[u.id] = true;
          });
          label = 'Remaining';
        }
        var tipChoice = ['10', 'none', '5'][k % 3];
        var pay = record(share, tipFor(share, tipChoice, 0), 'table', label);
        t.payingNow = 0;
        var more = tRemaining() > 0;
        if (!more) {
          t.resting = false;
          if (t.screen === 'bill') t.screen = 'closed';
        }
        afterPayment(pay, 'table');
        if (more) {
          later('rest', T.restGap, function () {
            restStep(k + 1);
          });
        }
      });
    }
    var PAY_SCREENS = { paid: 1, closed: 1, bill: 1 };

    var TABLE = {
      scan: {
        side: 'guest',
        can: function () {
          return S.table.screen === 'scan';
        },
        run: function () {
          S.table.screen = 'bill';
          emit('guest', 'scan', 'Guest scanned the QR on Table ' + VENUE.table + '. The bill opened on the phone', {
            phoneSays: VENUE.name + ', ' + L('sim.table', { n: VENUE.table }) + '. ' + L('bill.total') + ' ' + jod(BILL.total),
          });
        },
      },
      open_split: {
        side: 'guest',
        can: function () {
          var t = S.table;
          return t.screen === 'bill' && tRemaining() > 0 && !t.equalOn && !t.resting;
        },
        run: function () {
          var t = S.table;
          t.screen = 'split';
          if (t.cur.mode === 'full') t.cur = freshCur('equal');
          t.cur.via = 'split';
          if (!t.equalOn && t.coversPaid >= t.people) t.coversPaid = 0;
          emit('guest', 'open_split', 'Guest opened Split the bill', { phoneSays: L('split.title') + '. ' + L('split.shareLabel') + ' ' + jod(curShare()) });
        },
      },
      pay_full: {
        side: 'guest',
        can: function () {
          var t = S.table;
          return t.screen === 'bill' && tRemaining() > 0 && !t.equalOn && !t.resting;
        },
        run: function () {
          var t = S.table;
          t.cur = freshCur('full');
          t.cur.via = 'bill';
          t.screen = 'tip';
          emit('guest', 'pay_full', 'Guest chose to pay ' + (t.payments.length ? 'the remaining ' : 'the full bill, ') + jod(tRemaining()), { phoneSays: L('tip.title') });
        },
      },
      pay_share: {
        side: 'guest',
        can: function (p) {
          var t = S.table;
          var left = t.people - t.coversPaid;
          var n = p && p.shares !== undefined ? p.shares : 1;
          return t.screen === 'bill' && t.equalOn && !t.resting && tRemaining() > 0 && Number.isInteger(n) && n >= 1 && n <= left;
        },
        run: function (p) {
          var t = S.table;
          t.cur = freshCur('equal');
          t.cur.covers = p && p.shares !== undefined ? p.shares : 1;
          t.cur.via = 'bill';
          t.screen = 'tip';
          emit('guest', 'pay_share', 'Guest chose to pay ' + (t.cur.covers > 1 ? t.cur.covers + ' shares' : 'one share') + ': ' + jod(curShare()), { phoneSays: L('tip.title') });
        },
      },
      set_split_mode: {
        side: 'guest',
        can: function (p) {
          return S.table.screen === 'split' && !!p && (p.mode === 'equal' || p.mode === 'item' || p.mode === 'custom');
        },
        run: function (p) {
          S.table.cur.mode = p.mode;
          emit('guest', 'input', '', { phoneSays: L('split.' + p.mode) + '. ' + L('split.shareLabel') + ' ' + jod(curShare()) });
        },
      },
      set_people: {
        side: 'guest',
        can: function (p) {
          var t = S.table;
          return t.screen === 'split' && t.cur.mode === 'equal' && t.coversPaid === 0 && !!p && Number.isInteger(p.people) && p.people >= 2 && p.people <= 10;
        },
        run: function (p) {
          var t = S.table;
          t.people = p.people;
          t.cur.covers = Math.min(t.cur.covers, t.people);
          emit('guest', 'input', '', { phoneSays: L('split.people') + ' ' + t.people + '. ' + L('split.shareLabel') + ' ' + jod(curShare()) });
        },
      },
      set_covers: {
        side: 'guest',
        can: function (p) {
          var t = S.table;
          return t.screen === 'split' && t.cur.mode === 'equal' && !!p && Number.isInteger(p.covers) && p.covers >= 1 && p.covers <= t.people - t.coversPaid;
        },
        run: function (p) {
          S.table.cur.covers = p.covers;
          emit('guest', 'input', '', { phoneSays: L('split.youPayFor') + ' ' + p.covers + '. ' + L('split.shareLabel') + ' ' + jod(curShare()) });
        },
      },
      toggle_item: {
        side: 'guest',
        can: function (p) {
          var t = S.table;
          if (t.screen !== 'split' || t.cur.mode !== 'item' || !p) return false;
          return unpaidUnits().some(function (u) {
            return u.id === p.unit;
          });
        },
        run: function (p) {
          var sel = S.table.cur.sel;
          if (sel[p.unit]) delete sel[p.unit];
          else sel[p.unit] = true;
          emit('guest', 'input', '', { phoneSays: L('split.shareLabel') + ' ' + jod(curShare()) });
        },
      },
      set_custom: {
        side: 'guest',
        can: function (p) {
          return S.table.screen === 'split' && S.table.cur.mode === 'custom' && !!p && p.amount !== undefined;
        },
        run: function (p) {
          S.table.cur.customText = typeof p.amount === 'number' ? formatFils(p.amount) : String(p.amount).slice(0, 12);
          emit('guest', 'input', '');
        },
      },
      to_tip: {
        side: 'guest',
        can: function () {
          return S.table.screen === 'split' && curShare() > 0;
        },
        run: function () {
          S.table.screen = 'tip';
          emit('guest', 'to_tip', 'Guest chose a share of ' + jod(curShare()), { phoneSays: L('tip.title') });
        },
      },
      set_tip: {
        side: 'guest',
        can: function (p) {
          return S.table.screen === 'tip' && !!p && (p.tip === 'none' || p.tip === '5' || p.tip === '10' || p.tip === 'custom');
        },
        run: function (p) {
          var c = S.table.cur;
          c.tip = p.tip;
          if (p.tip === 'custom' && p.amount !== undefined) c.tipText = typeof p.amount === 'number' ? formatFils(p.amount) : String(p.amount).slice(0, 12);
          emit('guest', 'input', '', { phoneSays: L('summary.tip') + ' ' + jod(curTip()) + '. ' + L('summary.youPay') + ' ' + jod(curShare() + curTip()) });
        },
      },
      to_pay: {
        side: 'guest',
        can: function () {
          return S.table.screen === 'tip' && curShare() > 0 && !S.table.resting;
        },
        run: function () {
          var t = S.table;
          t.screen = 'pay';
          t.payingNow = 1;
          emit('guest', 'to_pay', 'Guest continued to payment. Table ' + VENUE.table + ' shows Paying now', {
            phoneSays: L('pay.paying') + ' ' + jod(curShare() + curTip()),
            staffSays: 'Table ' + VENUE.table + ': ' + STAFF.tableStatus.paying + '. ' + STAFF.payingOne,
          });
        },
      },
      pay_card: {
        side: 'guest',
        can: function () {
          return S.table.screen === 'pay';
        },
        run: function () {
          S.table.method = 'card';
          S.table.screen = 'provider';
          emit('guest', 'pay_card', 'Guest tapped Pay by card. In the product the payment provider’s own page opens here', { phoneSays: L('sim.provider.note') });
        },
      },
      /* Apple Pay: legal exactly when pay_card is, and it shares the simulated approval step
         (confirm_payment, same timer). Only the wording and the recorded method differ. */
      pay_apple: {
        side: 'guest',
        can: function () {
          return TABLE.pay_card.can();
        },
        run: function () {
          S.table.method = 'apple';
          S.table.screen = 'provider';
          emit('guest', 'pay_apple', 'Guest tapped Apple Pay. In the product Apple’s own payment sheet opens here', { phoneSays: L('sim.wallet.note') });
        },
      },
      confirm_payment: {
        side: 'guest',
        can: function () {
          return S.table.screen === 'provider' && !S.table.processing;
        },
        run: function () {
          S.table.processing = true;
          emit('guest', 'confirm_payment', 'Simulated payment sent for approval', { phoneSays: L('sim.provider.waiting') });
          later('approve', T.approve, approve);
        },
      },
      back: {
        side: 'guest',
        can: function () {
          var t = S.table;
          return (t.screen === 'split' || t.screen === 'tip' || t.screen === 'pay' || t.screen === 'provider') && !t.processing;
        },
        run: function () {
          var t = S.table;
          var from = t.screen;
          if (from === 'split') t.screen = 'bill';
          else if (from === 'tip') t.screen = t.cur.via === 'bill' ? 'bill' : 'split';
          else if (from === 'pay') t.screen = 'tip';
          else t.screen = 'pay';
          var left = from === 'pay' && t.payingNow > 0;
          if (left) t.payingNow = 0;
          emit('guest', 'back', '', {
            phoneSays: L('nav.back'),
            staffSays: left ? 'Table ' + VENUE.table + ': ' + STAFF.tableStatus[tableStatus()] : '',
          });
        },
      },
      finish: {
        side: 'guest',
        can: function () {
          return S.table.screen === 'paid';
        },
        run: function () {
          S.table.screen = 'closed';
          emit('guest', 'finish', '', { phoneSays: L('closed.title') + '. ' + L('done.rate') });
        },
      },
      pay_another: {
        side: 'guest',
        can: function () {
          var t = S.table;
          return t.screen === 'paid' && tRemaining() > 0 && !t.resting;
        },
        run: function () {
          var t = S.table;
          t.screen = 'bill';
          t.cur = freshCur('equal');
          emit('guest', 'pay_another', 'Guest handed the phone on to pay another share', { phoneSays: L('bill.remaining') + ' ' + jod(tRemaining()) });
        },
      },
      rate: {
        side: 'guest',
        can: function (p) {
          return S.table.screen === 'closed' && !S.table.rated && !!p && Number.isInteger(p.stars) && p.stars >= 1 && p.stars <= 5;
        },
        run: function (p) {
          S.table.rating = p.stars;
          emit('guest', 'input', '', { phoneSays: L('sim.stars', { n: p.stars }) });
        },
      },
      submit_rating: {
        side: 'guest',
        can: function () {
          return S.table.screen === 'closed' && !S.table.rated && S.table.rating > 0;
        },
        run: function (p) {
          var t = S.table;
          t.rated = true;
          t.comment = p && typeof p.comment === 'string' ? p.comment.slice(0, 500) : '';
          emit('guest', 'rating', 'Guest left a ' + t.rating + '-star rating. It reaches the dashboard', { phoneSays: L('done.rated') });
        },
      },
      rest_of_table: {
        side: 'staff',
        can: function () {
          var t = S.table;
          return t.payments.length > 0 && tRemaining() > 0 && !t.resting && !t.processing && PAY_SCREENS[t.screen] === 1;
        },
        run: function () {
          var t = S.table;
          t.resting = true;
          emit('staff', 'rest_of_table', 'The rest of the table pays', { staffSays: STAFF.restOfTable });
          restStep(0);
        },
      },
      refund_last: {
        side: 'staff',
        can: function () {
          var t = S.table;
          return !!t.last && !t.last.refunded && !t.resting && !t.processing;
        },
        run: function () {
          S.table.last.refunded = true;
          emit('staff', 'refund_last', STAFF.refundNote, { staffSays: STAFF.refundNote });
        },
      },
    };

    function tableGuide() {
      var t = S.table;
      var total = 7;
      function g(step, side, command, title, body) {
        return { step: step, total: total, side: side, command: command, payload: null, title: title, body: body, done: false };
      }
      var rem = tRemaining();
      switch (t.screen) {
        case 'scan':
          return g(1, 'guest', 'scan', 'Scan the QR on Table ' + VENUE.table, 'The itemised bill opens in the phone’s browser. No app, no sign-up.');
        case 'bill':
          if (t.equalOn) return g(2, 'guest', 'pay_share', 'Tap Pay my share', 'The table is splitting equally. Each guest pays one share, or covers the rest.');
          if (t.payments.length) return g(2, 'guest', 'pay_full', 'Tap Pay remaining, or split again', 'The bill shows what is already paid and what is left.');
          return g(2, 'guest', 'open_split', 'Tap Split the bill', 'Or pay the full bill in one go. The floor shows Table ' + VENUE.table + ' as Bill open.');
        case 'split':
          return g(3, 'guest', 'to_tip', 'Choose how to split, then continue to tip', 'Equally, by item or a custom amount. Service and tax follow the items in proportion.');
        case 'tip':
          return g(4, 'guest', 'to_pay', 'Pick a tip, then continue to payment', 'No tip, 5%, 10% or a custom amount. The total updates to the fils.');
        case 'pay':
          return g(5, 'guest', 'pay_card', 'Tap Pay by card', 'The floor now shows Table ' + VENUE.table + ' as Paying now.');
        case 'provider':
          if (t.method === 'apple') return g(6, 'guest', 'confirm_payment', 'Approve the simulated payment', 'In the product this step happens on Apple’s own payment sheet.');
          return g(6, 'guest', 'confirm_payment', 'Approve the simulated payment', 'In the product this step happens on the payment provider’s own secure page.');
        default:
          if (rem > 0 && !t.resting) {
            return g(7, 'staff', 'rest_of_table', 'On the restaurant side, press The rest of the table pays', 'Only a fully paid bill is posted to the POS. Partial payments never are.');
          }
          if (rem > 0) return g(7, 'staff', null, 'The rest of the table is paying', 'Watch the floor tile and the payments list.');
          return {
            step: total,
            total: total,
            side: 'system',
            command: null,
            payload: null,
            title: 'Table ' + VENUE.table + ' is fully paid',
            body: 'The sale is posted to the POS. Reset the demo to run it again.',
            done: true,
          };
      }
    }

    function tableView() {
      var t = S.table;
      var c = t.cur;
      var lang = cfg.lang;
      var paid = tPaid();
      var rem = BILL.total - paid;
      var share = curShare();
      var tip = curTip();
      var left = t.people - t.coversPaid;
      var perShare = t.equalOn ? shareFor({ total: BILL.total, subtotal: BILL.subtotal, remaining: rem }, { mode: 'equal', covers: 1, coversLeft: left }) : 0;
      var customFils = parseJod(c.customText);
      var status = tableStatus();

      var lines = BILL_LINES.map(function (l) {
        var paidUnitsN = 0;
        for (var n = 1; n <= l.qty; n++) if (t.paidUnits[l.item.id + '-' + n]) paidUnitsN++;
        return { id: l.item.id, name: l.item[lang], image: l.item.image, qty: l.qty, unit: l.item.unit, amount: l.qty * l.item.unit, paid: paidUnitsN === l.qty || rem === 0, paidUnits: paidUnitsN };
      });
      var units = BILL_UNITS.map(function (u) {
        return { id: u.id, name: u.item[lang], image: u.item.image, amount: u.item.unit, n: u.n, of: u.of, paid: !!t.paidUnits[u.id], selected: !!c.sel[u.id] && !t.paidUnits[u.id] };
      });
      var floor = t.floor.map(function (f) {
        if (!f.me) {
          return {
            n: f.n,
            me: false,
            status: f.status,
            label: STAFF.tableStatus[f.status],
            remaining: f.remaining || 0,
            payingCount: f.payingCount || 0,
            note: f.status === 'paying' ? STAFF.payingOne : '',
          };
        }
        return {
          n: f.n,
          me: true,
          status: status,
          label: STAFF.tableStatus[status],
          remaining: rem,
          payingCount: t.payingNow,
          note: t.payingNow === 1 ? STAFF.payingOne : t.payingNow > 1 ? fill(STAFF.payingMany, { n: t.payingNow }) : '',
        };
      });
      var counts = { empty: 0, open: 0, paying: 0, paid: 0 };
      floor.forEach(function (f) {
        counts[f.status] += 1;
      });
      var feed = t.feed
        .concat(t.payments)
        .map(function (p) {
          return { id: p.id, table: p.table, bill: p.share, tip: p.tip, total: p.share + p.tip, method: p.method || STAFF.method, time: clockLabel(p.clock), refunded: p.refunded, label: p.label || '', mine: p.table === VENUE.table };
        })
        .reverse();
      var guide = S.guide;

      return {
        screen: t.screen,
        venue: VENUE.name,
        monogram: VENUE.monogram,
        tableNumber: VENUE.table,
        tableLabel: L('sim.table', { n: VENUE.table }),
        bill: {
          lines: lines,
          units: units,
          subtotal: BILL.subtotal,
          service: BILL.service,
          servicePct: SERVICE_PCT,
          tax: BILL.tax,
          total: BILL.total,
          paid: paid,
          remaining: rem,
          partial: paid > 0 && rem > 0,
          settled: rem === 0,
        },
        inProgress: t.equalOn ? { sharesTaken: t.coversPaid, headcount: t.people, sharesRemaining: left, perShare: perShare } : null,
        split: {
          mode: c.mode,
          people: t.people,
          covers: Math.min(c.covers, Math.max(1, left)),
          coversLeft: left,
          canPeopleLess: t.coversPaid === 0 && t.people > 2,
          canPeopleMore: t.coversPaid === 0 && t.people < 10,
          canCoversLess: c.covers > 1,
          canCoversMore: c.covers < left,
          customText: c.customText,
          customInvalid: c.customText !== '' && (customFils === null || customFils <= 0 || customFils > rem),
          share: share,
        },
        tip: { choice: c.tip, customText: c.tipText, amount: tip },
        pay: { share: share, tip: tip, total: share + tip },
        payMethod: t.method, // 'card' | 'apple': which button opened the simulated provider step
        processing: t.processing,
        last: t.last ? { share: t.last.share, tip: t.last.tip, total: t.last.share + t.last.tip, refunded: t.last.refunded } : null,
        rating: t.rating,
        rated: t.rated,
        resting: t.resting,
        floor: floor,
        counts: counts,
        table12: {
          status: status,
          label: STAFF.tableStatus[status],
          bill: BILL.total,
          paid: paid,
          remaining: rem,
          payingCount: t.payingNow,
          note: t.payingNow === 1 ? STAFF.payingOne : '',
          payments: t.payments.length,
        },
        payments: feed,
        pos: { posted: t.posted, text: t.posted ? STAFF.posPosted : STAFF.posWaiting },
        staffActions: [
          { command: 'rest_of_table', label: STAFF.restOfTable, disabled: !TABLE.rest_of_table.can(), next: guide.command === 'rest_of_table' && !guide.done },
          { command: 'refund_last', label: STAFF.refund, disabled: !TABLE.refund_last.can(), next: false },
        ],
        refundNote: t.last && t.last.refunded ? STAFF.refundNote : '',
      };
    }

    /* ═════════════════════ shared store plumbing ═════════════════════ */

    function rules() {
      return cfg.scenario === 'pager' ? PAGER : TABLE;
    }

    function fresh() {
      var now = new Date(clock.now());
      S = {
        clockMin: cfg.clockTime !== null ? cfg.clockTime : now.getHours() * 60 + now.getMinutes(),
        log: [],
        pager: null,
        table: null,
        guide: null,
        autoplay: false,
      };
      if (cfg.scenario === 'pager') pagerFresh();
      else tableFresh();
      cache = null;
    }

    function refreshGuide() {
      S.guide = cfg.scenario === 'pager' ? pagerGuide() : tableGuide();
    }

    function getState() {
      if (cache) return cache;
      refreshGuide();
      var st = {
        version: VERSION,
        scenario: cfg.scenario,
        product: PRODUCT_NAMES[cfg.scenario],
        statusTag: STATUS_TAGS[cfg.scenario],
        lang: cfg.lang,
        dir: cfg.lang === 'ar' ? 'rtl' : 'ltr',
        appearance: { theme: cfg.appearance.theme, brand: cfg.appearance.brand, accent: cfg.appearance.accent, brandSet: cfg.appearanceSet.brand, accentSet: cfg.appearanceSet.accent },
        venue: { name: VENUE.name, monogram: VENUE.monogram },
        clock: clockLabel(S.clockMin),
        autoplay: S.autoplay,
        guide: S.guide,
        log: S.log.slice(),
        pager: cfg.scenario === 'pager' ? pagerView() : null,
        table: cfg.scenario === 'table' ? tableView() : null,
      };
      cache = deepFreeze(st);
      return cache;
    }

    function can(command, payload) {
      if (destroyed) return false;
      var r = rules()[command];
      return !!r && !!r.can(payload);
    }

    function apply(command, payload) {
      if (destroyed) return false;
      var r = rules()[command];
      if (!r || !r.can(payload)) return false;
      refreshGuide();
      r.run(payload);
      return true;
    }

    /** Manual dispatch: an explicit action by the visitor. Stops autoplay. */
    function dispatch(command, payload) {
      if (auto) auto.stop('manual');
      return apply(command, payload);
    }

    function stopAuto(reason) {
      if (auto) auto.stop(reason || 'reset');
    }

    /* Named moments: the same commands a visitor would press, run with every delay collapsed. */
    var SCRIPTS = {
      pager: {
        scan: [],
        received: [['scan']],
        preparing: [['scan'], ['start']],
        ready: [['scan'], ['start'], ['ready']],
        on_my_way: [['scan'], ['start'], ['ready'], ['on_my_way']],
        collected: [['scan'], ['start'], ['ready'], ['on_my_way'], ['complete']],
        cancelled: [['scan'], ['start'], ['cancel', { reason: 'out_of_stock' }]],
      },
      table: {
        scan: [],
        bill: [['scan']],
        split: [['scan'], ['open_split']],
        tip: [['scan'], ['open_split'], ['to_tip']],
        pay: [['scan'], ['open_split'], ['to_tip'], ['to_pay']],
        paid: [['scan'], ['open_split'], ['to_tip'], ['to_pay'], ['pay_card'], ['confirm_payment']],
        floor_open: [['scan']],
        floor_paying: [['scan'], ['open_split'], ['to_tip'], ['to_pay']],
        floor_paid: [['scan'], ['open_split'], ['to_tip'], ['to_pay'], ['pay_card'], ['confirm_payment'], ['rest_of_table']],
      },
    };

    /**
     * `extras` (pager only): { sound, notifications } switch the guest's alert settings on right
     * after the scan; { banner: true } leaves the simulated notification on screen in a ready moment.
     */
    function runMoment(at, extras) {
      var script = SCRIPTS[cfg.scenario][at];
      if (!script) return false;
      var x = extras || {};
      quiet += 1;
      try {
        for (var i = 0; i < script.length; i++) {
          apply(script[i][0], script[i][1]);
          if (cfg.scenario === 'pager' && script[i][0] === 'scan') {
            if (x.sound) apply('sound_on');
            if (x.notifications || x.banner) apply('notify_allow');
          }
        }
        if (cfg.scenario === 'pager' && x.banner && mainOrder().status === 'ready' && !mainOrder().ack) S.pager.phone.banner = true;
      } finally {
        quiet -= 1;
      }
      return true;
    }

    function restart(type, text, at, extras) {
      stopAuto('reset');
      cancelAll();
      fresh();
      var moment = at || cfg.opening;
      if (moment !== 'scan' && !runMoment(moment, extras)) moment = 'scan';
      emit('system', type, text, { moment: moment });
    }

    function reset() {
      if (destroyed) return;
      restart('reset', 'Demo reset');
    }
    /** Jump to a named moment (see PayliDemo.moments). Cancels timers like reset(). */
    function seed(at, extras) {
      if (destroyed || !SCRIPTS[cfg.scenario][at]) return false;
      restart('seed', '', at, extras);
      return true;
    }
    function setScenario(id) {
      if (destroyed || (id !== 'pager' && id !== 'table')) return false;
      cfg.scenario = id;
      if (!SCRIPTS[id][cfg.opening]) cfg.opening = 'scan';
      restart('scenario', 'Scenario: ' + PRODUCT_NAMES[id]);
      return true;
    }
    function setLang(lang) {
      if (destroyed || (lang !== 'en' && lang !== 'ar') || lang === cfg.lang) return false;
      cfg.lang = lang;
      emit('system', 'lang', '');
      return true;
    }
    function setAppearance(a) {
      if (destroyed || !a) return false;
      cfg.appearance = normaliseAppearance(a, cfg.appearance);
      if (isHex(a.brand)) cfg.appearanceSet.brand = true;
      if (isHex(a.accent)) cfg.appearanceSet.accent = true;
      emit('system', 'appearance', '');
      return true;
    }
    function subscribe(fn) {
      if (typeof fn !== 'function') return function () {};
      subs.push(fn);
      return function () {
        var i = subs.indexOf(fn);
        if (i !== -1) subs.splice(i, 1);
      };
    }
    function destroy() {
      if (destroyed) return;
      stopAuto('destroy');
      cancelAll();
      destroyed = true;
      subs = [];
    }

    fresh();
    if (cfg.opening !== 'scan' && !runMoment(cfg.opening)) cfg.opening = 'scan';
    cache = null;

    var demo = {
      getState: getState,
      subscribe: subscribe,
      can: can,
      dispatch: dispatch,
      reset: reset,
      seed: seed,
      setScenario: setScenario,
      setLang: setLang,
      setAppearance: setAppearance,
      destroy: destroy,
      /* Used by PayliDemo.autoplay; not part of the public contract. */
      _internal: {
        apply: apply,
        later: later,
        cancel: cancel,
        emit: function (side, type, text, extra) {
          return emit(side, type, text, extra);
        },
        setAuto: function (ctl) {
          auto = ctl;
          S.autoplay = !!ctl;
        },
        isDestroyed: function () {
          return destroyed;
        },
      },
    };
    return demo;
  }

  /* ───────────────────────── autoplay ───────────────────────── */

  var AUTOPLAY = {
    pager: [['scan'], ['notify_allow'], ['start'], ['adjust', { minutes: 5 }], ['ready'], ['on_my_way'], ['complete']],
    table: [['scan'], ['open_split'], ['to_tip'], ['set_tip', { tip: '5' }], ['to_pay'], ['pay_card'], ['confirm_payment'], ['rest_of_table']],
  };

  /**
   * Plays the canonical script from the opening state, one command every `stepMs`. The visitor
   * starts it; any manual dispatch, reset, scenario switch or destroy stops it. Its timer is the
   * store's, so reset() cancels it. Returns { stop() }.
   */
  function autoplay(demo, options) {
    var o = options || {};
    var stepMs = typeof o.stepMs === 'number' && o.stepMs >= 0 ? o.stepMs : 1800;
    var onStep = typeof o.onStep === 'function' ? o.onStep : null;
    var it = demo._internal;
    if (it.isDestroyed()) return { stop: function () {} };
    demo.reset();
    var script = AUTOPLAY[demo.getState().scenario];
    var i = 0;
    var waited = 0;
    var running = true;
    var ctl = {
      stop: function (reason) {
        if (!running) return;
        running = false;
        it.cancel('autoplay');
        it.setAuto(null);
        if (!it.isDestroyed() && reason !== 'reset' && reason !== 'destroy') it.emit('system', 'autoplay_stop', reason === 'end' ? 'Autoplay finished' : 'Autoplay stopped', { reason: reason || 'stop' });
      },
    };
    it.setAuto(ctl);
    it.emit('system', 'autoplay_start', 'Autoplay started');
    function next() {
      if (!running) return;
      if (i >= script.length) {
        // let the last command's own timers (approval, rest of the table) finish before reporting the end
        ctl.stop('end');
        return;
      }
      var step = script[i];
      if (it.apply(step[0], step[1])) {
        var st = demo.getState();
        if (onStep) onStep({ index: i, total: script.length, command: step[0], payload: step[1] || null, state: st });
        i += 1;
        waited = 0;
        it.later('autoplay', stepMs, next);
      } else if (waited < 40) {
        // the command is not legal yet (a simulated approval is still running): look again shortly
        waited += 1;
        it.later('autoplay', 250, next);
      } else {
        ctl.stop('blocked');
      }
    }
    it.later('autoplay', stepMs, next);
    return {
      stop: function () {
        ctl.stop('stop');
      },
    };
  }

  /* ───────────────────────── exports ───────────────────────── */

  api.version = VERSION;
  api.create = create;
  api.autoplay = autoplay;
  api.legal = Object.freeze({ all: LEGAL.all, pager: LEGAL.pager, table: LEGAL.table });
  api.statusTags = Object.freeze({ pager: STATUS_TAGS.pager, table: STATUS_TAGS.table });
  api.productNames = Object.freeze({ pager: PRODUCT_NAMES.pager, table: PRODUCT_NAMES.table });
  api.moments = deepFreeze({ pager: MOMENTS.pager.slice(), table: MOMENTS.table.slice() });
  api.cancelReasons = deepFreeze(
    CANCEL_REASONS.map(function (id) {
      return { id: id, label: STAFF.cancelReasons[id] };
    })
  );
  api.adjustSteps = Object.freeze(ADJUST_STEPS.slice());
  api.manualClock = manualClock;
  api.money = Object.freeze({ format: formatFils, parse: parseJod, mulDivRound: mulDivRound, shareFor: shareFor, tipFor: tipFor, billTotals: billTotals });
  api.sample = deepFreeze({
    venue: VENUE,
    bill: { lines: BILL_LINES, units: BILL_UNITS, totals: BILL, servicePct: SERVICE_PCT, taxPct: TAX_PCT },
  });
  api.strings = deepFreeze({ guest: GUEST, staff: STAFF });
  api.timings = Object.freeze(T);
  api.theme = Object.freeze({ contrast: contrast, textOn: textOn, fillFor: fillFor, ensureContrast: ensureContrast, mix: mix, colours: themeColours, surfaces: deepFreeze(SURFACES) });
})(typeof window !== 'undefined' ? window : globalThis);
