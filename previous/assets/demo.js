/* Payli — interactive pay-at-table demo.
   Guest phone (left) drives the restaurant dashboard (right). All money is integer fils.
   Demo data mirrors the marketing site's canonical bill: Cedar & Sage (fictional), Table 12,
   subtotal 35.500 + service 10% 3.550 + sales tax 16% 6.248 = 45.298 JOD.
   Flow fidelity (apps/web-payer, apps/web-restaurant): only a fully paid bill is posted to the POS;
   floor states are Empty / Bill open / Paying now / Paid. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var screenEl = $("#screen"), screensEl = $("#screens"), sheetEl = $("#sheet");
  if (!screenEl) return;

  /* ── Bill ─────────────────────────────────────────────────── */
  var ITEMS = [
    { id: "c", en: "Crushed cookies", ar: "كوكيز مطحونة", qty: 2, unit: 7500, e: "🍪" },
    { id: "l", en: "Spanish ice latte", ar: "لاتيه مثلّج إسباني", qty: 1, unit: 5250, e: "☕" },
    { id: "s", en: "Eggs & greens skillet", ar: "مقلاة بيض وخضار", qty: 1, unit: 6500, e: "🍳" },
    { id: "a", en: "Avocado toast", ar: "توست أفوكادو", qty: 1, unit: 8750, e: "🥑" },
  ];
  var line = function (it) { return it.qty * it.unit; };
  var SUB = ITEMS.reduce(function (a, it) { return a + line(it); }, 0);
  var SERVICE = Math.round(SUB * 0.10);
  var TAX = Math.round((SUB + SERVICE) * 0.16);
  var TOTAL = SUB + SERVICE + TAX; // 45298

  /* ── Copy ─────────────────────────────────────────────────── */
  var T = {
    en: {
      table: "Table 12", back: "Back", scanH: "Scan to see your bill",
      scanP: "Point your camera at the QR on the table. The bill opens in your browser, with no app to download.",
      scanBtn: "Scan the QR code", hello: "Whenever you're ready, here's your table.",
      subtotal: "Subtotal", service: "Service charge (10%)", tax: "Sales tax (16%)", total: "Bill total",
      already: "Already paid", remaining: "Remaining", payFull: "Pay full bill", payRem: "Pay remaining",
      split: "Split the bill", payMine: "Pay my share", splitOther: "Change how I pay",
      splitTitle: "Split the bill", splitSub: "Pay for exactly what you had, or divide it.",
      yourShare: "Your share", shareNote: "Service & tax are shared in proportion to your items.",
      modes: [["Equally", "Divide evenly"], ["By item", "What you had"], ["Custom", "An amount"]],
      people: "People at your table", peopleSub: "How many are sharing", mine: "You pay for", mineSub: "Yourself or others too",
      locked: "This table is already splitting {m}.", lockedEq: "equally", lockedIt: "by item",
      paidTag: "Paid", customLbl: "Enter an amount", customErr: "Enter an amount up to the remaining {x}.",
      pickErr: "Pick at least one item.", toTip: "Continue to tip",
      tipTitle: "Add a tip", tipInfo: "A 10% service charge is already included on your bill.",
      noTip: "No tip", kind: "Kind", generous: "Generous", customTip: "Enter a custom tip",
      tipNote: "Payli takes no fee on tips. The full tip goes to the restaurant.",
      lShare: "Your share", lTip: "Tip", lPay: "You pay", toPay: "Continue to payment",
      paying: "You're paying", payCard: "Pay by card", wallets: "Apple Pay and Google Pay where the provider enables them",
      secure: "Card details go on the provider's secure page, never on Payli.",
      paid: "Paid", paidTo: "to Cedar & Sage", settled: "This bill is fully settled", left: "Your table still has {x} left",
      good: "You're good to go", rateQ: "How was your visit?", ratePh: "Tell the restaurant (optional)", send: "Send rating",
      thanks: "Thanks. The restaurant can see your rating now.", another: "Pay another share", tipLbl: "tip",
    },
    ar: {
      table: "الطاولة 12", back: "رجوع", scanH: "امسح الرمز لعرض فاتورتك",
      scanP: "وجّه كاميرا هاتفك نحو رمز QR على الطاولة. تُفتح الفاتورة في المتصفح دون الحاجة إلى تحميل أي تطبيق.",
      scanBtn: "امسح رمز QR", hello: "حين تكون جاهزًا، هذه فاتورة طاولتك.",
      subtotal: "المجموع الفرعي", service: "رسوم الخدمة (10%)", tax: "ضريبة المبيعات (16%)", total: "إجمالي الفاتورة",
      already: "مدفوع مسبقًا", remaining: "المتبقي", payFull: "ادفع الفاتورة كاملة", payRem: "ادفع المتبقي",
      split: "قسّم الفاتورة", payMine: "ادفع حصتي", splitOther: "غيّر طريقة الدفع",
      splitTitle: "تقسيم الفاتورة", splitSub: "ادفع ثمن ما طلبته بالضبط — أو اقسمها.",
      yourShare: "حصتك", shareNote: "تتوزّع الخدمة والضريبة على أصنافك بالتناسب.",
      modes: [["بالتساوي", "تقسيم متساوٍ"], ["حسب الأصناف", "ما طلبته"], ["مخصّص", "مبلغ تحدّده"]],
      people: "عدد الأشخاص على طاولتك", peopleSub: "كم شخصًا يتشاركون", mine: "تدفع عن", mineSub: "نفسك أو آخرين أيضًا",
      locked: "هذه الطاولة تُقسّم الفاتورة {m}.", lockedEq: "بالتساوي", lockedIt: "حسب الأصناف",
      paidTag: "مدفوع", customLbl: "أدخل مبلغًا", customErr: "أدخل مبلغًا لا يتجاوز المتبقي {x}.",
      pickErr: "اختر صنفًا واحدًا على الأقل.", toTip: "المتابعة إلى الإكرامية",
      tipTitle: "أضف إكرامية", tipInfo: "رسوم خدمة بنسبة 10% مضمّنة في فاتورتك.",
      noTip: "بلا إكرامية", kind: "لطيفة", generous: "سخيّة", customTip: "أدخل إكرامية مخصّصة",
      tipNote: "لا تتقاضى Payli أي رسوم على الإكرامية، وتذهب كاملةً إلى المطعم.",
      lShare: "حصتك", lTip: "الإكرامية", lPay: "المبلغ المدفوع", toPay: "المتابعة إلى الدفع",
      paying: "أنت تدفع", payCard: "ادفع بالبطاقة", wallets: "Apple Pay وGoogle Pay حيث يفعّلهما مزوّد الدفع",
      secure: "تُدخل بيانات البطاقة في صفحة المزوّد الآمنة، لا في Payli أبدًا.",
      paid: "تم الدفع", paidTo: "إلى Cedar & Sage", settled: "سُدّدت هذه الفاتورة بالكامل", left: "يتبقّى على طاولتك {x}",
      good: "كل شيء جاهز", rateQ: "كيف كانت زيارتك؟", ratePh: "اكتب ملاحظتك للمطعم (اختياري)", send: "إرسال التقييم",
      thanks: "شكرًا. يرى المطعم تقييمك الآن.", another: "ادفع حصة أخرى", tipLbl: "إكرامية",
    },
  };

  var NARR = [
    "The guest scans the <b>QR on Table 12</b>. No app, no sign-up: the bill opens in the phone's browser.",
    "The <b>live, itemised bill</b> comes from the restaurant's POS, the same one the team rang up, with service and tax exact to the fils.",
    "Splitting is built in: <b>evenly, by item, or a custom amount</b>. Service and tax follow the items, and nobody can pay twice for the same item.",
    "The tip is asked while the service is fresh. <b>Payli takes no fee on tips</b>; the full tip goes to the restaurant.",
    "Look at the dashboard: Table 12 now shows <b>Paying now</b>. Next, the guest moves to the payment provider's own page.",
    "Card details go on the <b>licensed provider's secure page</b>, never on Payli. Payli only sends the amount to charge.",
    "Approved. The payment lands in <b>Transactions</b> instantly and settles to the restaurant's own merchant account. The table stays open until the last share is paid.",
    "Right after paying, guests can <b>rate the visit</b>. It reaches the dashboard while the team can still act on it.",
    "When the last share is paid, Table 12 turns <b>Paid</b> and the full sale (items, tax, service, tip and tender) is <b>posted back to the POS</b>. No re-keying.",
  ];
  var STEP_OF = { scan: 0, bill: 1, split: 2, tip: 3, pay: 4, sheet: 5, paid: 6, rated: 7, full: 8 };

  /* ── State ────────────────────────────────────────────────── */
  var S;
  function fresh() {
    return {
      lang: S ? S.lang : "en", screen: "scan", sheet: false, processing: false,
      payments: [], paidItems: {}, people: 3, coversPaid: 0, lock: null, payingNow: 0,
      cur: { mode: "equal", mine: 1, sel: {}, custom: "", tip: "none", tipCustom: "" },
      rating: 0, comment: "", rated: false, sync: 0, posted: false, guestNo: 1, step: 0, maxStep: 0,
    };
  }

  /* ── Helpers ──────────────────────────────────────────────── */
  var fmt = function (f) { return (f / 1000).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }); };
  var money = function (f) { return '<span class="money"><span class="cur">JOD</span>' + fmt(f) + "</span>"; };
  var t = function (k) { return T[S.lang][k]; };
  var paidTotal = function () { return S.payments.reduce(function (a, p) { return a + p.share; }, 0); };
  var tipsTotal = function () { return S.payments.reduce(function (a, p) { return a + p.tip; }, 0); };
  var remaining = function () { return TOTAL - paidTotal(); };
  var now = function (offsetMin) { var d = new Date(Date.now() - (offsetMin || 0) * 60000); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); };
  var parseJOD = function (s) { s = String(s || "").replace(/[^\d.]/g, ""); if (!s) return 0; var n = Math.round(parseFloat(s) * 1000); return isFinite(n) ? n : 0; };

  function share() {
    var c = S.cur, rem = remaining();
    if (c.mode === "full") return rem;
    if (c.mode === "equal") {
      var rc = S.people - S.coversPaid, k = Math.min(c.mine, rc);
      if (rc <= 0) return 0;
      return k >= rc ? rem : Math.round(rem * k / rc);
    }
    if (c.mode === "item") {
      var sel = 0, unpaid = 0;
      ITEMS.forEach(function (it) {
        if (S.paidItems[it.id]) return;
        unpaid += line(it);
        if (c.sel[it.id]) sel += line(it);
      });
      if (!sel) return 0;
      if (sel === unpaid) return rem;
      return Math.min(rem, Math.round(TOTAL * sel / SUB));
    }
    if (c.mode === "custom") { var v = parseJOD(c.custom); return v > 0 && v <= rem ? v : 0; }
    return 0;
  }
  function tipFils(sh) {
    var c = S.cur;
    if (c.tip === "5") return Math.round(sh * 0.05);
    if (c.tip === "10") return Math.round(sh * 0.10);
    if (c.tip === "custom") return parseJOD(c.tipCustom);
    return 0;
  }

  /* ── Phone rendering ──────────────────────────────────────── */
  var ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 18l-6-6 6-6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  };
  function qrSVG() {
    var n = 25, seed = 7, cells = "";
    var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    var finder = function (x, y) { return (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7); };
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) { if (!finder(x, y) && rnd() > 0.52) cells += "M" + x + " " + y + "h1v1h-1z"; }
    var fp = function (x, y) { return '<rect x="' + (x + .5) + '" y="' + (y + .5) + '" width="6" height="6" fill="none" stroke="#043c44"/><rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" fill="#043c44"/>'; };
    return '<svg viewBox="0 0 25 25" shape-rendering="crispEdges"><path d="' + cells + '" fill="#043c44"/>' + fp(0, 0) + fp(n - 7, 0) + fp(0, n - 7) + "</svg>";
  }
  function top(backTo) {
    return '<div class="topnav">' + (backTo ? '<button class="back" data-go="' + backTo + '">' + ICON.back + t("back") + "</button>" : "<span></span>") +
      '<button class="langpill" data-act="lang">' + (S.lang === "en" ? "العربية" : "English") + "</button></div>";
  }
  function venue() {
    return '<div class="venue"><span class="av">CS</span><div><b>Cedar &amp; Sage</b><small>' + t("table") + "</small></div></div>";
  }
  function sumRows() {
    var p = paidTotal();
    return '<div class="sum"><div><span>' + t("subtotal") + "</span>" + money(SUB) + "</div><div><span>" + t("service") + "</span>" + money(SERVICE) +
      "</div><div><span>" + t("tax") + "</span>" + money(TAX) + '</div><div class="tot"><span>' + t("total") + "</span>" + money(TOTAL) + "</div>" +
      (p ? '<div class="paidrow"><span>' + t("already") + "</span>" + money(p) + '</div><div class="tot"><span>' + t("remaining") + "</span>" + money(remaining()) + "</div>" : "") + "</div>";
  }

  var R = {};
  R.scan = function () {
    return '<div class="scan"><div class="stand"><div class="qr">' + qrSVG() + '<span class="laser"></span></div><span class="tn">' + t("table") +
      '</span><img src="assets/img/logo.svg" alt=""></div><h4>' + t("scanH") + "</h4><p>" + t("scanP") +
      '</p><button class="pbtn hint-pulse" data-act="scan">' + t("scanBtn") + "</button></div>";
  };
  R.bill = function () {
    var rows = ITEMS.map(function (it) {
      return '<div class="item' + (S.paidItems[it.id] ? " paid" : "") + '"><span class="th">' + it.e + '</span><div><b data-paid="' + t("paidTag") + '">' + it[S.lang] +
        '</b><small dir="ltr">' + it.qty + " × " + fmt(it.unit) + "</small></div>" + '<span class="money">' + fmt(line(it)) + "</span></div>";
    }).join("");
    var rem = remaining(), eqRunning = S.lock === "equal" && S.people - S.coversPaid > 0;
    var primary = eqRunning
      ? '<button class="pbtn" data-act="payMine">' + t("payMine") + " · " + money(shareFor1()) + "</button>"
      : '<button class="pbtn" data-act="payFull">' + (paidTotal() ? t("payRem") : t("payFull")) + " · " + money(rem) + "</button>";
    return '<div class="body">' + top() + venue() + '<p class="hello">' + t("hello") + '</p><div class="items">' + rows + "</div>" + sumRows() +
      '</div><div class="foot">' + primary + '<button class="plink hint-pulse" data-act="toSplit">' + (eqRunning ? t("splitOther") : t("split")) + "</button></div>";
  };
  function shareFor1() { var rc = S.people - S.coversPaid; return rc <= 1 ? remaining() : Math.round(remaining() / rc); }
  R.split = function () {
    var c = S.cur, sh = share(), rem = remaining();
    var modes = ["equal", "item", "custom"].map(function (m, i) {
      var dis = S.lock && S.lock !== m && m !== "custom" ? " disabled" : "";
      if (S.lock && m === "custom") dis = " disabled";
      return '<button data-mode="' + m + '" aria-pressed="' + (c.mode === m) + '"' + dis + "><b>" + t("modes")[i][0] + "</b><small>" + t("modes")[i][1] + "</small></button>";
    }).join("");
    var body = "";
    if (c.mode === "equal") {
      var rc = S.people - S.coversPaid;
      body = '<div class="stepper"><div><b>' + t("people") + "</b><small>" + t("peopleSub") + '</small></div><div class="ctrl"><button data-act="ppl-" ' + (S.people <= 2 || S.coversPaid ? "disabled" : "") +
        '>−</button><span>' + S.people + '</span><button class="plus" data-act="ppl+" ' + (S.people >= 10 || S.coversPaid ? "disabled" : "") + ">+</button></div></div>" +
        '<div class="stepper"><div><b>' + t("mine") + "</b><small>" + t("mineSub") + '</small></div><div class="ctrl"><button data-act="mine-" ' + (c.mine <= 1 ? "disabled" : "") +
        '>−</button><span>' + c.mine + '</span><button class="plus" data-act="mine+" ' + (c.mine >= rc ? "disabled" : "") + ">+</button></div></div>";
    } else if (c.mode === "item") {
      body = ITEMS.map(function (it) {
        var paid = !!S.paidItems[it.id];
        return '<label class="pick' + (paid ? " paid" : "") + '"><input type="checkbox" data-item="' + it.id + '"' + (c.sel[it.id] ? " checked" : "") + (paid ? " disabled" : "") + "><span>" +
          it[S.lang] + (paid ? " · " + t("paidTag") : "") + '</span><span class="money">' + fmt(line(it)) + "</span></label>";
      }).join("");
    } else {
      body = '<p class="psub" style="margin:6px 0 8px">' + t("customLbl") + '</p><div class="custom-in"><span class="cur">JOD</span><input inputmode="decimal" data-in="custom" placeholder="0.000" value="' +
        (c.custom || "") + '"></div><p class="err" id="cerr">' + (c.custom && !sh ? t("customErr").replace("{x}", "JOD " + fmt(rem)) : "") + "</p>";
    }
    var lockNote = S.lock ? '<p class="note">' + t("locked").replace("{m}", S.lock === "equal" ? t("lockedEq") : t("lockedIt")) + "</p>" : "";
    return '<div class="body">' + top("bill") + '<h3 class="ptitle">' + t("splitTitle") + '</h3><p class="psub">' + t("splitSub") + '</p><div class="share"><small>' + t("yourShare") +
      '</small><div class="big" id="shareBig">' + money(sh) + "</div><p>" + t("shareNote") + '</p></div><div class="modes">' + modes + "</div>" + body + lockNote +
      '</div><div class="foot"><button class="pbtn" data-act="toTip" ' + (sh ? "" : "disabled") + ">" + t("toTip") + " · " + money(sh) + "</button></div>";
  };
  R.tip = function () {
    var sh = share(), tp = tipFils(sh), c = S.cur;
    var opt = function (k, label, hint) { return '<button data-tip="' + k + '" aria-pressed="' + (c.tip === k) + '"><b>' + label + "</b>" + (hint ? "<small>" + hint + "</small>" : "") + "</button>"; };
    return '<div class="body">' + top("split") + '<h3 class="ptitle">' + t("tipTitle") + '</h3><p class="note" style="margin:8px 0 0">' + t("tipInfo") + '</p><div class="tips">' +
      opt("none", t("noTip")) + opt("5", "5%", t("kind")) + opt("10", "10%", t("generous")) + "</div>" +
      (c.tip === "custom" ? '<div class="custom-in"><span class="cur">JOD</span><input inputmode="decimal" data-in="tip" placeholder="0.000" value="' + (c.tipCustom || "") + '"></div>'
        : '<button class="ctip" data-tip="custom">✎ ' + t("customTip") + "</button>") +
      '<div class="lines"><div><span>' + t("lShare") + "</span>" + money(sh) + "</div><div><span>" + t("lTip") + "</span>" + money(tp) + '</div><div class="tot"><span>' + t("lPay") + "</span>" + money(sh + tp) +
      '</div></div><p class="note">' + t("tipNote") + '</p></div><div class="foot"><button class="pbtn" data-act="toPay">' + t("toPay") + " · " + money(sh + tp) + "</button></div>";
  };
  R.pay = function () {
    var sh = share(), tp = tipFils(sh);
    return '<div class="paybody">' + top("tip") + '<div class="paying"><small>' + t("paying") + '</small><div class="hero-fig">' + money(sh + tp) + "</div><p>Cedar &amp; Sage · " + t("table") +
      '</p></div><div class="paybox lines"><div><span>' + t("lShare") + "</span>" + money(sh) + "</div><div><span>" + t("lTip") + "</span>" + money(tp) + '</div><div class="tot"><span>' + t("lPay") + "</span>" + money(sh + tp) +
      '</div></div><div class="paybtns"><button class="pbtn hint-pulse" data-act="sheet">' + t("payCard") + '</button><p class="wallets">' + t("wallets") + '</p><p class="secure">' + ICON.lock + t("secure") + "</p></div></div>";
  };
  R.paid = function () {
    var last = S.payments[S.payments.length - 1], rem = remaining();
    var status = rem ? t("left").replace("{x}", "JOD " + fmt(rem)) : t("settled");
    var rate = S.rated
      ? '<p class="thanks">' + t("thanks") + "</p>"
      : '<div class="rate"><b>' + t("rateQ") + '</b><div class="stars">' + [1, 2, 3, 4, 5].map(function (n) { return '<button data-star="' + n + '" class="' + (n <= S.rating ? "on" : "") + '" aria-label="' + n + ' stars">★</button>'; }).join("") +
        '</div><textarea data-in="comment" placeholder="' + t("ratePh") + '">' + (S.comment || "") + '</textarea><button class="pbtn" data-act="rate" ' + (S.rating ? "" : "disabled") + ">" + t("send") + "</button></div>";
    var again = S.rated && rem ? '<button class="pbtn" style="margin-top:12px;width:100%;background:var(--payli-mint);color:var(--payli-teal)" data-act="another">' + t("another") + "</button>" : "";
    return '<div class="moment"><span class="bloom"></span><span class="check">' + ICON.check + "</span><h4>" + t("paid") + '</h4><p class="amt"><b>' + money(last ? last.share + last.tip : 0) + "</b> " + t("paidTo") +
      '</p><span class="tbl">' + t("table") + " · " + status + "</span>" + rate + again + "</div>";
  };

  function renderPhone() {
    screenEl.setAttribute("dir", S.lang === "ar" ? "rtl" : "ltr");
    screenEl.setAttribute("lang", S.lang);
    screenEl.classList.toggle("dark-mode", S.screen === "pay" || S.screen === "paid");
    var prevScroll = screensEl.querySelector(".body"); var keep = prevScroll && screensEl.dataset.s === S.screen ? prevScroll.scrollTop : 0;
    var same = screensEl.dataset.s === S.screen;
    screensEl.dataset.s = S.screen;
    screensEl.innerHTML = '<div class="scr' + (same ? " active" : "") + '">' + R[S.screen]() + "</div>";
    var scr = screensEl.firstChild;
    var b = scr.querySelector(".body"); if (b && keep) b.scrollTop = keep;
    if (!same) requestAnimationFrame(function () { requestAnimationFrame(function () { scr.classList.add("active"); }); });
  }
  function renderSheet() {
    var sh = share(), tp = tipFils(sh);
    sheetEl.innerHTML = '<div class="grab"></div><div class="prov">' + ICON.lock + "Licensed payment provider · secure page</div><h4>Pay Cedar &amp; Sage</h4><p class=\"sub\">Card details are entered here, never on Payli.</p>" +
      '<label>Card number</label><div class="fld">4242 4242 4242 4242</div><div class="row"><div><label>Expiry</label><div class="fld">12 / 28</div></div><div><label>Security code</label><div class="fld">•••</div></div></div>' +
      '<button class="go" data-act="authorize">' + (S.processing ? '<span class="spin"></span>Waiting for approval…' : "Pay " + '<span class="money">JOD ' + fmt(sh + tp) + "</span>") + "</button>" +
      '<p class="tds">Your bank may ask you to confirm with 3-D Secure. Demo: no real card is charged.</p>';
    sheetEl.classList.toggle("open", S.sheet);
  }

  /* ── Board ────────────────────────────────────────────────── */
  var FLOOR, FEED, REVIEWS;
  function freshBoard() {
    FLOOR = [
      { n: 1, s: "paid" }, { n: 2, s: "empty" }, { n: 3, s: "open", a: 28420 }, { n: 4, s: "open", a: 61775 },
      { n: 5, s: "empty" }, { n: 6, s: "paid" }, { n: 7, s: "open", a: 19350 }, { n: 8, s: "empty" },
      { n: 9, s: "paying", a: 41870, p: 1 }, { n: 10, s: "open", a: 33900 }, { n: 11, s: "empty" }, { n: 12, me: true },
    ];
    FEED = [
      { tm: now(41), tb: 6, total: 52180, tip: 2609, m: "Card" },
      { tm: now(27), tb: 1, total: 23640, tip: 0, m: "Card" },
    ];
    REVIEWS = [];
  }
  var LBL = { empty: "Empty", open: "Bill open", paying: "Paying now", paid: "Paid" };
  function t12State() { if (S.payingNow) return "paying"; return remaining() === 0 ? "paid" : "open"; }
  function renderBoard(flashT12) {
    var floor = $("#floor");
    floor.innerHTML = FLOOR.map(function (f) {
      var st = f.me ? t12State() : f.s, amt = "";
      if (f.me) {
        if (st === "paying") amt = S.payingNow + " paying";
        else if (st === "open") amt = paidTotal() ? fmt(remaining()) + " left" : fmt(TOTAL);
        else amt = S.posted ? "In POS ✓" : fmt(TOTAL);
      } else if (st === "open") amt = fmt(f.a);
      else if (st === "paying") amt = (f.p || 1) + " paying";
      return '<div class="tbl ' + st + (f.me ? " me" : "") + (f.me && flashT12 ? " flash" : "") + '"><span class="no">' + f.n + '</span><span class="st">' + LBL[st] + "</span>" + (amt ? '<span class="amt">' + amt + "</span>" : "") + "</div>";
    }).join("");
    var st = t12State(), badge = $("#t12badge");
    badge.className = "badge " + st;
    badge.textContent = st === "paying" ? "Paying now" : st === "paid" ? (S.posted ? "Paid · in POS" : "Paid") : S.payments.length ? "Bill open · " + S.payments.length + " paid" : "Bill open";
    $("#t12bar").style.width = (paidTotal() / TOTAL * 100) + "%";
    $("#t12paid").textContent = fmt(paidTotal());
    $("#t12rem").textContent = fmt(remaining());
    $("#t12shares").innerHTML = S.payments.map(function (p, i) {
      return "<div><span>Guest " + (i + 1) + " · " + p.label + "</span><span class=\"money\">" + fmt(p.share) + (p.tip ? ' <span style="color:var(--mint-700)">+' + fmt(p.tip) + "</span>" : "") + "</span></div>";
    }).join("");
    var feed = $("#feed");
    feed.innerHTML = FEED.length ? FEED.slice(-6).reverse().map(function (r) {
      return '<div class="row' + (r.fresh ? " new" : "") + '"><span class="tm">' + r.tm + "</span><span>Table " + r.tb + " · " + r.m + "</span>" + '<span class="tip">' + (r.tip ? "+" + fmt(r.tip) : "") + '</span><span class="money">' + fmt(r.total) + "</span></div>";
    }).join("") : '<div class="empty">Payments appear here the moment the provider approves them.</div>';
    FEED.forEach(function (r) { r.fresh = false; });
    $("#feedCount").textContent = FEED.length + " tonight";
    Array.prototype.forEach.call(document.querySelectorAll("#sync div"), function (d) { d.classList.toggle("on", +d.dataset.s <= S.sync); });
    $("#posState").textContent = S.posted ? "Posted ✓" : S.payments.length ? "Waiting for full payment" : "Bill from POS";
    $("#reconV").textContent = S.payments.length ? fmt(paidTotal() + tipsTotal()) + " recorded ✓" : "—";
    var rv = $("#reviews");
    rv.innerHTML = REVIEWS.length ? REVIEWS.slice(-2).reverse().map(function (r) {
      return '<div class="review"><span class="s">' + "★★★★★".slice(0, r.n) + '<span style="color:var(--line-3)">' + "★★★★★".slice(r.n) + "</span></span> · Table 12 · " + r.tm + (r.c ? '<div style="margin-top:4px">' + escapeHTML(r.c) + "</div>" : "") + "</div>";
    }).join("") : '<div class="feed"><div class="empty">Guests can rate their visit right after paying.</div></div>';
  }
  function escapeHTML(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ── Narration + tracker ──────────────────────────────────── */
  function narr(key) {
    var i = STEP_OF[key]; S.step = i; S.maxStep = Math.max(S.maxStep, i);
    $("#narrN").textContent = (i + 1) + "/" + NARR.length;
    $("#narrT").innerHTML = NARR[i];
    $("#tracker").innerHTML = NARR.map(function (_, k) { return '<span class="' + (k <= S.maxStep ? "done" : "") + '"></span>'; }).join("");
  }

  /* ── Actions ──────────────────────────────────────────────── */
  function go(screen) {
    S.screen = screen;
    if (screen === "pay") { S.payingNow = 1; renderBoard(true); }
    else if (S.payingNow && screen !== "paid" && !S.sheet) { S.payingNow = 0; renderBoard(); }
    renderPhone();
    if (screen in STEP_OF) narr(screen);
  }
  function approve() {
    var c = S.cur, sh = share(), tp = tipFils(sh);
    var label = c.mode === "equal" ? (c.mine > 1 ? c.mine + " equal shares" : "equal share") : c.mode === "item" ? "by item" : c.mode === "custom" ? "custom amount" : "full bill";
    S.payments.push({ share: sh, tip: tp, label: label });
    if (c.mode === "equal") { S.coversPaid += Math.min(c.mine, S.people - S.coversPaid); S.lock = "equal"; }
    if (c.mode === "item") { ITEMS.forEach(function (it) { if (c.sel[it.id]) S.paidItems[it.id] = true; }); S.lock = "item"; c.sel = {}; }
    FEED.push({ tm: now(0), tb: 12, total: sh + tp, tip: tp, m: "Card", fresh: true });
    S.payingNow = 0; S.sheet = false; S.processing = false; S.sync = 2;
    renderSheet(); go("paid"); renderBoard(true);
    if (!remaining()) postToPOS();
    $("#rest").hidden = !remaining();
  }
  function postToPOS() {
    later(function () { S.sync = 3; S.posted = true; renderBoard(true); narr("full"); if (S.screen === "paid") renderPhone(); }, 1300);
  }
  function authorize() {
    if (S.processing) return;
    S.processing = true; S.sync = 1; renderSheet(); renderBoard();
    later(approve, 1700);
  }

  var timers = [];
  function later(fn, ms) { var id = setTimeout(function () { timers = timers.filter(function (x) { return x !== id; }); fn(); }, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  screenEl.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act],[data-go],[data-mode],[data-tip],[data-star]");
    if (!el || el.disabled) return;
    if (e.isTrusted && auto.on) stopAuto();
    var a = el.dataset.act, c = S.cur;
    if (el.dataset.go) { if (S.sheet) { S.sheet = false; renderSheet(); } go(el.dataset.go); return; }
    if (el.dataset.mode) { c.mode = el.dataset.mode; renderPhone(); return; }
    if (el.dataset.tip) { c.tip = el.dataset.tip; renderPhone(); if (c.tip === "custom") { var i = screensEl.querySelector('[data-in="tip"]'); if (i) i.focus(); } return; }
    if (el.dataset.star) { S.rating = +el.dataset.star; renderPhone(); return; }
    switch (a) {
      case "scan": go("bill"); break;
      case "lang": setLang(S.lang === "en" ? "ar" : "en"); break;
      case "payFull": c.mode = "full"; go("tip"); break;
      case "payMine": c.mode = "equal"; c.mine = 1; go("tip"); break;
      case "toSplit": if (S.lock) c.mode = S.lock; go("split"); break;
      case "ppl-": S.people = Math.max(2, S.people - 1); c.mine = Math.min(c.mine, S.people); renderPhone(); break;
      case "ppl+": S.people = Math.min(10, S.people + 1); renderPhone(); break;
      case "mine-": c.mine = Math.max(1, c.mine - 1); renderPhone(); break;
      case "mine+": c.mine = Math.min(S.people - S.coversPaid, c.mine + 1); renderPhone(); break;
      case "toTip": if (share()) go("tip"); break;
      case "toPay": go("pay"); break;
      case "sheet": S.sheet = true; renderSheet(); narr("sheet"); break;
      case "authorize": authorize(); break;
      case "rate":
        S.rated = true; REVIEWS.push({ n: S.rating, c: S.comment, tm: now(0) }); renderPhone(); renderBoard(); narr("rated");
        if (remaining()) $("#rest").classList.add("on");
        break;
      case "another":
        S.guestNo++; S.rated = false; S.rating = 0; S.comment = "";
        S.cur = { mode: S.lock || "equal", mine: 1, sel: {}, custom: "", tip: "none", tipCustom: "" };
        go("bill"); break;
    }
  });
  sheetEl.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]"); if (!el) return;
    if (e.isTrusted && auto.on) stopAuto();
    if (el.dataset.act === "authorize") authorize();
  });
  screenEl.addEventListener("input", function (e) {
    var k = e.target.dataset.in; if (!k) return;
    if (k === "custom") {
      S.cur.custom = e.target.value;
      var sh = share(); $("#shareBig").innerHTML = money(sh);
      var btn = screensEl.querySelector('[data-act="toTip"]'); btn.disabled = !sh; btn.innerHTML = t("toTip") + " · " + money(sh);
      $("#cerr").textContent = S.cur.custom && !sh ? t("customErr").replace("{x}", "JOD " + fmt(remaining())) : "";
    }
    if (k === "tip") {
      S.cur.tipCustom = e.target.value;
      var s2 = share(), tp = tipFils(s2), ls = screensEl.querySelectorAll(".lines .money");
      ls[1].outerHTML = money(tp); ls[2].outerHTML = money(s2 + tp);
      screensEl.querySelector('[data-act="toPay"]').innerHTML = t("toPay") + " · " + money(s2 + tp);
    }
    if (k === "comment") S.comment = e.target.value;
  });
  screenEl.addEventListener("change", function (e) {
    var id = e.target.dataset.item; if (!id) return;
    if (e.target.checked) S.cur.sel[id] = true; else delete S.cur.sel[id];
    renderPhone();
  });

  /* ── Rest of the table ────────────────────────────────────── */
  function restOfTable() {
    var rem = remaining(); if (!rem) return;
    $("#rest").classList.remove("on"); $("#rest").hidden = true;
    var queue = [];
    if (S.lock === "equal") { for (var i = S.coversPaid; i < S.people; i++) queue.push("equal"); }
    else queue.push(S.lock === "item" ? "itemRest" : "rest");
    var tips = ["10", "none", "5", "10", "5"];
    var stepPay = function (k) {
      if (!queue.length) return;
      var kind = queue.shift();
      S.payingNow = 1; renderBoard(true);
      later(function () {
        var r = remaining(), sh, label;
        if (kind === "equal") { var rc = S.people - S.coversPaid; sh = rc <= 1 ? r : Math.round(r / rc); S.coversPaid++; label = "equal share"; }
        else if (kind === "itemRest") { sh = r; ITEMS.forEach(function (it) { S.paidItems[it.id] = true; }); label = "by item"; }
        else { sh = r; label = "remaining"; }
        var tk = tips[k % tips.length], tp = tk === "5" ? Math.round(sh * .05) : tk === "10" ? Math.round(sh * .1) : 0;
        S.payments.push({ share: sh, tip: tp, label: label });
        FEED.push({ tm: now(0), tb: 12, total: sh + tp, tip: tp, m: "Card", fresh: true });
        S.payingNow = 0; S.sync = 2; renderBoard(true);
        if (S.screen === "paid") renderPhone();
        if (!remaining()) postToPOS(); else later(function () { stepPay(k + 1); }, 900);
      }, 1500);
    };
    stepPay(0);
  }
  $("#rest").addEventListener("click", function (e) { if (e.isTrusted && auto.on) stopAuto(); restOfTable(); });

  /* ── Ambient floor (other tables) ─────────────────────────── */
  var ambientId = null;
  var cycle = { empty: "open", open: "paying", paying: "paid", paid: "empty" };
  function ambient() {
    var others = FLOOR.filter(function (f) { return !f.me; });
    var f = others[Math.floor(Math.random() * others.length)];
    var next = cycle[f.s];
    if (next === "paid") {
      var total = f.a || 30000, tip = Math.random() < .5 ? Math.round(total * .05) : 0;
      FEED.push({ tm: now(0), tb: f.n, total: total + tip, tip: tip, m: "Card" });
    }
    if (next === "open") f.a = 12000 + Math.round(Math.random() * 60) * 1000 + Math.round(Math.random() * 999);
    f.s = next; f.p = 1;
    renderBoard();
  }
  function startAmbient() { stopAmbient(); ambientId = setInterval(ambient, 6500); }
  function stopAmbient() { if (ambientId) clearInterval(ambientId); ambientId = null; }

  /* ── Auto-play (presenter mode) ───────────────────────────── */
  var auto = { on: false, token: 0 };
  var autoBtn = $("#autoplay");
  function sleep(ms, tok) { return new Promise(function (res, rej) { later(function () { tok === auto.token ? res() : rej("stop"); }, ms); }); }
  function tap(sel, tok) {
    var el = (sel.indexOf("#") === 0 ? document : screenEl).querySelector(sel);
    if (!el) return Promise.resolve();
    el.classList.add("hint-pulse");
    return sleep(700, tok).then(function () { el.click(); });
  }
  function stopAuto() { auto.on = false; auto.token++; autoBtn.classList.remove("on"); autoBtn.querySelector("span").textContent = "Auto-play for presenting"; }
  autoBtn.addEventListener("click", function () {
    if (auto.on) { stopAuto(); return; }
    reset(); auto.on = true; var tok = ++auto.token;
    autoBtn.classList.add("on"); autoBtn.querySelector("span").textContent = "Stop auto-play";
    var p = sleep(2600, tok)
      .then(function () { return tap('[data-act="scan"]', tok); })
      .then(function () { return sleep(3800, tok); })
      .then(function () { return tap('[data-act="toSplit"]', tok); })
      .then(function () { return sleep(3000, tok); })
      .then(function () { return tap('[data-act="mine+"]', tok); })
      .then(function () { return sleep(1400, tok); })
      .then(function () { return tap('[data-act="mine-"]', tok); })
      .then(function () { return sleep(2200, tok); })
      .then(function () { return tap('[data-act="toTip"]', tok); })
      .then(function () { return sleep(2600, tok); })
      .then(function () { return tap('[data-tip="5"]', tok); })
      .then(function () { return sleep(1800, tok); })
      .then(function () { return tap('[data-act="toPay"]', tok); })
      .then(function () { return sleep(3600, tok); })
      .then(function () { return tap('[data-act="sheet"]', tok); })
      .then(function () { return sleep(3400, tok); })
      .then(function () { var b = sheetEl.querySelector('[data-act="authorize"]'); if (b) b.click(); return sleep(5200, tok); })
      .then(function () { return tap('[data-star="5"]', tok); })
      .then(function () { S.comment = S.lang === "ar" ? "أمسية جميلة — والتقسيم استغرق ثوانٍ." : "Lovely evening. The split took seconds."; renderPhone(); return sleep(1600, tok); })
      .then(function () { return tap('[data-act="rate"]', tok); })
      .then(function () { return sleep(3800, tok); })
      .then(function () { return tap("#rest", tok); })
      .then(function () { return sleep(9000, tok); })
      .then(function () { stopAuto(); });
    p.catch(function () { /* stopped */ });
  });

  /* ── Language, reset, init ────────────────────────────────── */
  function setLang(l) {
    S.lang = l;
    Array.prototype.forEach.call(document.querySelectorAll("[data-lang]"), function (x) { x.setAttribute("aria-pressed", x.dataset.lang === l ? "true" : "false"); });
    renderPhone(); if (S.sheet) renderSheet();
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-lang]"), function (b) {
    b.addEventListener("click", function () { setLang(b.dataset.lang); });
  });
  function reset() {
    clearTimers(); if (auto.on) stopAuto();
    S = fresh(); freshBoard();
    $("#rest").hidden = true; $("#rest").classList.remove("on");
    S.sheet = false; renderSheet(); renderPhone(); renderBoard(); narr("scan");
    startAmbient();
  }
  $("#reset").addEventListener("click", reset);
  document.addEventListener("visibilitychange", function () { if (document.hidden) stopAmbient(); else if (!ambientId) startAmbient(); });
  S = null; reset();
})();
