/* Payli sales site — page content + small interactions (everything except the live demo).
   Facts: ../../facts.yaml. Statuses are deliberately conservative (code-verified 2026-11-03). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  /* ── Integrations ─────────────────────────────────────────── */
  var POS = [
    { name: "AQUA POS", st: "build", label: "In development", note: "Built to import your menu and post every fully paid table back as a sale with its items, tax, service and tip. Sale posting is being tested on AQUA's test server." },
    { name: "Foodics", st: "build", label: "In development", note: "Reads the live order on each table so guests see the bill your team rang up. Staff confirm the paid order in the Foodics cashier, using Foodics' own pay-at-table flow." },
    { name: "POSRocket", st: "soon", label: "Planned", note: "Planned together with Foodics, which acquired POSRocket." },
    { name: "Oracle MICROS Simphony", st: "soon", label: "Planned", note: "Designed to post each fully paid table to Simphony as a check with its tender and tip." },
  ];
  var PAY = [
    { name: "A licensed payment provider in Jordan", st: "build", label: "In testing", note: "Guests pay on the provider's own hosted page. The money settles to the restaurant's own merchant account. We confirm which providers are available for your venue in the demo." },
  ];
  function intRows(list) {
    return list.map(function (i) {
      return '<div class="int"><b>' + esc(i.name) + '</b><span class="st ' + i.st + '">' + esc(i.label) + "</span><p>" + esc(i.note) + "</p></div>";
    }).join("");
  }
  if ($("#posList")) $("#posList").innerHTML = intRows(POS);
  if ($("#payList")) $("#payList").innerHTML = intRows(PAY);
  if ($("#statusNote")) $("#statusNote").textContent =
    "Status as of November 2026. In development: the connector is being built and tested against the vendor's test system; it is not yet live at any restaurant. Planned: not built yet. Running a different POS? Tell us in the demo. Where restaurants are decides what we build next.";

  /* ── Getting started ──────────────────────────────────────── */
  var STEPS = [
    ["See it on your phone", "A 15-minute demo of the guest's side and yours, with your questions answered."],
    ["Check the fit", "We confirm your POS and payment provider, and what's ready for your venue today."],
    ["Set up your venue", "We create your restaurant on Payli, connect your POS and bring in your menu and service charge."],
    ["Put a QR on every table", "Add your tables in the dashboard and print a QR code for each one."],
    ["Walk the team through it", "The floor board, receipts and refunds take minutes to learn. Then your first tables pay."],
  ];
  if ($("#golive")) $("#golive").innerHTML = STEPS.map(function (s) { return "<li class=\"rv\"><b>" + esc(s[0]) + "</b><p>" + esc(s[1]) + "</p></li>"; }).join("");
  var NEED = [
    ["Point of sale", "A POS Payli connects to, or one you'd like us to"],
    ["Payments", "A merchant account with a licensed payment provider"],
    ["Devices", "Any tablet, phone or laptop with a web browser"],
    ["Tables", "A printed QR code for each table"],
  ];
  if ($("#need")) $("#need").innerHTML = NEED.map(function (n) { return "<div><small>" + esc(n[0]) + "</small>" + esc(n[1]) + "</div>"; }).join("");

  /* ── FAQ (each answer restates published wording) ─────────── */
  var FAQ = [
    ["Is Payli live yet?", "Payli is in closed beta in Amman and is talking to its first restaurants. No restaurant is live yet. We're choosing a small first group of restaurants, and we say plainly what works today and what's coming."],
    ["Does Payli hold our money?", "Never. A licensed payment provider processes each payment and settles it into your own merchant account. You're the merchant of record. Payli's own fees are invoiced separately, never deducted."],
    ["Is Payli a payment company?", "No. Payli is software, not a bank and not a licensed payment company. It never receives, holds or pays out money. Your payment provider holds the licence; Payli does not."],
    ["When do we receive our money?", "Straight from your payment provider into your merchant account, on the schedule in your merchant agreement. Payli doesn't set or control that schedule. Every bill, split and tip is recorded to the fils in your dashboard."],
    ["Does Payli replace our POS?", "No. Payli works alongside the POS you already run: the bill comes from your POS, and when the table is fully paid the sale is posted back to it. See the integrations above for where each system stands."],
    ["Do guests need an app?", "No. The QR on the table opens the bill in the phone's browser. No app, no account, no Wi-Fi password, and guests give no name, email or phone number to pay."],
    ["How do guests pay?", "With a Visa or Mastercard card, or with Apple Pay or Google Pay where the payment provider enables them, always on the provider's own secure page. CliQ isn't supported."],
    ["What happens to tips?", "Guests choose 5%, 10%, a custom amount or no tip. The full tip goes to the restaurant, which shares it with its team its own way. Payli takes no fee on tips."],
    ["Who handles refunds and chargebacks?", "The restaurant, as the merchant of record. Your team starts a refund from the Payli dashboard, and your payment provider returns the money to the guest's original card. Payli never funds or holds a refund."],
    ["How are card details protected?", "Guests type their card details on the payment provider's own secure page, so Payli never sees or stores the full card number or security code. Payli itself hasn't yet been independently audited or certified, including against PCI DSS, and doesn't claim to be."],
    ["How much does it cost?", "Payli doesn't publish a price list: pricing depends on your venue, and we walk you through it in the demo. There's no hardware to buy, fees are invoiced separately and never deducted from your payments, and tips never carry a Payli fee."],
    ["Does it work in Arabic?", "Yes. The guest flow is in English and العربية, switched with one tap, and amounts are always shown in JOD to three decimal places. Menu items can carry Arabic names. The restaurant dashboard is in English today."],
  ];
  if ($("#faqList")) $("#faqList").innerHTML = FAQ.map(function (f) { return "<details class=\"rv\"><summary>" + esc(f[0]) + "</summary><p>" + esc(f[1]) + "</p></details>"; }).join("");

  /* ── Feature tabs ─────────────────────────────────────────── */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.classList.toggle("active", on);
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { selectTab(t); });
    t.addEventListener("keydown", function (e) {
      var k = e.key, n = null;
      if (k === "ArrowDown" || k === "ArrowRight") n = tabs[(i + 1) % tabs.length];
      if (k === "ArrowUp" || k === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
      if (n) { e.preventDefault(); n.focus(); selectTab(n); }
    });
  });

  /* ── Value estimator ──────────────────────────────────────── */
  var F = { tables: "c-tables", turns: "c-turns", mins: "c-mins", seat: "c-seat", check: "c-check", nights: "c-nights" };
  var fmt = function (n, d) { return n.toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  function calc() {
    var v = {};
    Object.keys(F).forEach(function (k) { var el = document.getElementById(F[k]); if (el) v[k] = parseFloat(el.value); });
    if (!("tables" in v)) return;
    $("#o-tables").textContent = fmt(v.tables);
    $("#o-turns").textContent = fmt(v.turns, v.turns % 1 ? 1 : 0);
    $("#o-mins").textContent = fmt(v.mins) + " min";
    $("#o-seat").textContent = fmt(v.seat) + " min";
    $("#o-check").textContent = "JOD " + fmt(v.check);
    $("#o-nights").textContent = fmt(v.nights);
    var freedMin = v.mins * v.turns * v.tables;              // per busy night
    var extraSeatings = (freedMin / v.seat) * v.nights;      // per month
    var revenue = extraSeatings * v.check;                   // per month
    $("#r-hours").innerHTML = fmt(freedMin / 60, 1) + '<span class="cur"> h</span>';
    $("#r-seats").textContent = fmt(Math.floor(extraSeatings));
    $("#r-rev").innerHTML = '<span class="cur">JOD</span>' + fmt(Math.floor(extraSeatings) * v.check);
  }
  Object.keys(F).forEach(function (k) { var el = document.getElementById(F[k]); if (el) el.addEventListener("input", calc); });
  calc();

  /* ── Header: dark while over the hero ─────────────────────── */
  var hdr = $(".hdr"), hero = $("#hero");
  if (hero && hero.dataset.dark === "false") hero = null;
  function hdrState() { if (hdr && hero) hdr.classList.toggle("on-dark", window.scrollY < hero.offsetHeight - 70); }
  window.addEventListener("scroll", hdrState, { passive: true }); hdrState();

  /* ── Reveal on scroll ─────────────────────────────────────── */
  var rv = document.querySelectorAll(".rv");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    rv.forEach(function (el) { io.observe(el); });
  } else rv.forEach(function (el) { el.classList.add("in"); });
})();
