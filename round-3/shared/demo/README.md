# Payli demo engine (Round 3)

One shared, framework-free product demonstration that the three Round 3 websites stage differently, and that the PDFs use for static product pictures. It is a local, clearly labelled simulation of verified Payli product behaviour: no network, no backend, no real notifications.

Product truth comes from `round-3/PAYLI_BUSINESS_RESEARCH.md` (§4, §5, §14) and the product code it cites (`payli-bajer`, branch `feat/bajer`). The contract is `round-3/DEMO_SPEC.md`. Where the simulation simplifies the product, see [Assumptions](#assumptions).

## Files

| File | What it is |
|---|---|
| `payli-demo-core.js` | The headless store: state, commands, events, guide, timers, reset, autoplay, money arithmetic, wording. No DOM; runs in Node. |
| `payli-demo-ui.js` | Product-UI renderers: the guest's phone screen, the staff surfaces, the optional log and guide, snapshots, the chime. |
| `payli-demo.css` | Product-UI styles. Every class is `pd-`; no element selectors; themable through `--pd-*`. |
| `harness.html` | Bare reference page: both scenarios, every renderer and option, every snapshot. The test target. |
| `test/store.test.mjs` | Node tests for the store (`node --test`). |
| `test/harness.pw.mjs` | Playwright run over the harness. |

## Use

```html
<link rel="stylesheet" href="../shared/demo/payli-demo.css">
<script src="../shared/demo/payli-demo-core.js"></script>
<script src="../shared/demo/payli-demo-ui.js"></script>
<script>
  const demo = PayliDemo.create({ scenario: 'pager' });
  PayliDemo.mountPhone(document.querySelector('#screen'), demo, { frame: false });
  PayliDemo.mountStaff(document.querySelector('#board'), demo, { variant: 'board' });
</script>
```

Classic scripts, one global (`window.PayliDemo`), no modules, no fetch, no build step, no dependencies. Works from `file://`. Load the core before the UI. Fonts, the four dish photos and the logo are referenced by relative path from these files (`../../../shared/fonts`, `…/product`, `…/img/logo.svg`); if you move the engine, set `PayliDemo.assets.product` and `PayliDemo.assets.logo` before mounting and fix the `@font-face` URLs.

Show next to every demo, in your own typography: the status tag (`PayliDemo.statusTags[scenario]`) and the small print (`PayliDemo.legal.all` plus `PayliDemo.legal[scenario]`). The staff surfaces always carry an "Illustrative demo · In development / Closed beta" chip themselves; the phone only does when the engine draws the frame (`frame: true`).

## Store API

```js
const demo = PayliDemo.create({
  scenario: 'pager',          // 'pager' | 'table'
  lang: 'en',                 // guest-screen language: 'en' | 'ar'
  appearance: {               // the product's pager appearance settings (pager guest page only)
    theme: 'classic',         // 'classic' | 'bold' | 'dark'
    brand: '#043C44', accent: '#19C3A6',   // #rrggbb; contrast is corrected as in the product
  },
  sound: false,               // preset of the guest's Sound switch; stays off until the visitor turns it on
  ringCooldownSec: 10,        // clamped to the product range 10–600
  // additions to the spec:
  estimateMin: [8, 12],       // order #24's estimate range in minutes (default: the product's default range)
  opening: 'scan',            // the moment reset() returns to (any name in PayliDemo.moments[scenario])
  clockTime: undefined,       // 'HH:MM' to fix the demo clock (snapshots use '14:32'); default: the visitor's time
  clock: undefined,           // { now(), setTimeout(fn, ms), clearTimeout(id) }; see PayliDemo.manualClock()
});

demo.getState()                 // deeply frozen snapshot; the same object until something changes
demo.subscribe(fn)              // fn(state, event) after every change; returns unsubscribe
demo.can(command, payload?)     // is this command legal now?
demo.dispatch(command, payload?)// true if applied; illegal commands are ignored and return false. Stops autoplay
demo.reset()                    // back to the opening state; cancels every timer; stops autoplay
demo.seed(at, extras?)          // jump to a named moment (PayliDemo.moments); pager extras: { sound, notifications, banner }
demo.setScenario(id)            // switches and resets
demo.setLang('ar')
demo.setAppearance({ theme, brand, accent })   // any subset
demo.destroy()

PayliDemo.autoplay(demo, { stepMs: 1800, onStep })   // resets, then plays the canonical script; returns { stop() }
PayliDemo.legal            // { all, pager, table }
PayliDemo.statusTags       // { pager: 'In development', table: 'Closed beta' }
PayliDemo.productNames     // { pager: 'Order Pager', table: 'Pay at Table' }
PayliDemo.moments          // { pager: [...], table: [...] }  the `at` names
PayliDemo.cancelReasons    // [{ id, label }] the five product reasons
PayliDemo.adjustSteps      // [-5, 5, 10]
PayliDemo.money            // { format(fils), parse(text), shareFor, tipFor, billTotals, mulDivRound }
PayliDemo.theme            // { colours(theme, brand, accent), contrast, textOn, ... } ported from the product
PayliDemo.strings          // { guest: { en, ar }, staff }
PayliDemo.sample           // venue and the canonical bill
PayliDemo.timings          // the simulation's own delays in ms
PayliDemo.manualClock()    // a clock that moves only on advance(ms): for tests and frame-by-frame tours
PayliDemo.version
```

Autoplay is started by the visitor (your button). It stops on any manual `dispatch` (legal or not), on `reset`, `seed`, `setScenario`, `destroy`, or `stop()`. `onStep({ index, total, command, payload, state })` fires after each scripted command. `state.autoplay` tells you whether it is running. Scripts: pager `scan, notify_allow, start, adjust +5, ready, on_my_way, complete` (no sound: the visitor did not ask for it); table `scan, open_split, to_tip, set_tip 5%, to_pay, pay_card, confirm_payment, rest_of_table`.

### Events

`fn(state, event)`; `event = { id, at, side: 'staff'|'guest'|'system', type, text }`. Events with a non-empty `text` are collected in `state.log` (newest last, capped at 50): "Staff pressed Ready & ring", "Guest’s phone received the alert", "Guest tapped I’m on my way", "Table 12 fully paid. Sale posted to the POS". Events with empty `text` are housekeeping (`tick` each second of a cooldown, `input`, `ring_end`, `banner_end`, `back`, `lang`, `appearance`, `seed`). Extra fields some events carry: `order` (order id), `chime` (how many times the chime plays; 0 when the guest's sound is off), `ring` (the demo phone rang), `phoneSays` / `staffSays` (what each mount announces through its live region), `moment`, `reason`.

### State

Common: `scenario, product, statusTag, lang, dir, appearance { theme, brand, accent, brandSet, accentSet }, venue, clock, autoplay, guide, log, pager | table` (the other is `null`).

`state.guide = { step, total, side, command, payload, title, body, done }` always points at the next sensible action. Renderers put `data-pd-next="true"` on the matching control.

`state.pager`:
- `order` (the order with the phone attached) and `orders[]`, each `{ id, number, ref, main, status, statusLabel, open, age, pickup, meta, summary, timeFact { text, late }, guestFact { text, tone }, estimate { from, to, range, updated }, joined, onTheWay, rings, cooldownLeft, cancelReason, cancelReasonLabel, actions[{ command, label, kind, icon, disabled, next }], canAdjust, canCancel, timing[], guestRows[], history[] }`
- `mainId`, `columns[{ status, title, empty, orders }]`, `done[]`, `livePanel { title, body, ref } | null`, `cooldownSec`, `canNewOrder`
- `guest` (what the phone shows, in the guest's language): `{ screen: 'scan'|'order', joined, status, ref, venue, monogram, welcome, eyebrow, headline, message, eta { template, range, text, updated, updatedLabel } | null, steps[{ id, label, done, now }], showTimeline, collect { place, note } | null, canAck, acked, readySince, alerts { visible, sound, notifications }, items[], itemCount, live, ringing, ringCount, banner { title, body, when } | null, ticket }`

`state.table`: `screen` (`scan | bill | split | tip | pay | provider | paid | closed`), `bill { lines[], units[], subtotal, service, servicePct, tax, total, paid, remaining, partial, settled }`, `inProgress { sharesTaken, headcount, sharesRemaining, perShare } | null`, `split { mode, people, covers, coversLeft, can…, customText, customInvalid, share }`, `tip { choice, customText, amount }`, `pay { share, tip, total }`, `processing`, `last`, `rating`, `rated`, `resting`, `floor[{ n, me, status, label, remaining, payingCount, note }]`, `counts`, `table12`, `payments[{ id, table, bill, tip, total, method, time, refunded, label, mine }]` (newest first), `pos { posted, text }`, `staffActions[]`, `refundNote`. All amounts are integers in fils.

### Commands: `pager`

States `received → preparing → ready → collected`; `cancelled` from any open state. Only staff commands move an order. Staff commands take an optional `{ order: 'o22' }` to act on an ambient order; without it they act on the order the phone follows.

| Command | Side | Legal when | Effect |
|---|---|---|---|
| `scan` | guest | phone not joined | Order page opens; card fact "No guest joined" → "Guest watching"; QR panel closes |
| `live_done` | staff | QR panel open | Closes the "Order #24 is live" panel without a scan (addition to the spec) |
| `sound_on` | guest | alert card visible, sound off | Sound "Turn on" → "On" + "Play test"; chime once |
| `sound_test` | guest | sound on | Chime once |
| `notify_allow` | guest | alert card visible, not yet allowed | Notifications "Allow" → "On" |
| `start` | staff | received | → preparing |
| `adjust` `{ minutes: -5 \| 5 \| 10 }` | staff | received, preparing | Window shifts (never earlier than 1 min from now); phone tag "Updated" |
| `ready` | staff | received, preparing | → ready; the phone rings; cooldown starts; after 350 ms the card reports "Phone alerted · sound on/off" |
| `ring_again` | staff | ready, cooldown over, guest not on the way | Rings once more; cooldown restarts |
| `on_my_way` | guest | joined, ready, not yet tapped | "Thanks — it’s waiting for you."; card fact "On the way"; ringing stops |
| `complete` | staff | ready | → collected; card to "Done recently" |
| `cancel` `{ reason }` | staff | any open state | → cancelled; `reason` is one of `PayliDemo.cancelReasons` (default `out_of_stock`) |
| `new_order` | staff | the phone's order is closed | Next order number (#25, #26, …), same items, phone back at the scan prompt |

The alert card is visible while the order is open and the guest has not tapped "I’m on my way" (as in the product).

### Commands: `table`

| Command | Side | Legal when | Effect |
|---|---|---|---|
| `scan` | guest | scan prompt | Bill opens |
| `open_split` | guest | bill, amount left, no equal split in progress | Split screen |
| `pay_full` | guest | bill, amount left, no equal split in progress | "Pay full" / "Pay remaining": straight to tip |
| `pay_share` `{ shares? }` | guest | bill, equal split in progress | "Pay my share" (1) or "Pay the remaining N shares" |
| `set_split_mode` `{ mode: 'equal' \| 'item' \| 'custom' }` | guest | split | |
| `set_people` `{ people: 2–10 }` | guest | split, equal, before the first share is paid | |
| `set_covers` `{ covers }` | guest | split, equal, 1 to shares left | "You pay for" |
| `toggle_item` `{ unit }` | guest | split, by item, unit unpaid | Units: `cookies-1`, `cookies-2`, `latte-1`, `eggs-1`, `avocado-1` |
| `set_custom` `{ amount }` | guest | split, custom | Text ("12.5") or fils (12500) |
| `to_tip` | guest | split, share > 0 | |
| `set_tip` `{ tip: 'none' \| '5' \| '10' \| 'custom', amount? }` | guest | tip | |
| `to_pay` | guest | tip | Pay screen; Table 12 → "Paying now", "1 person is paying now" |
| `pay_card` | guest | pay | The labelled simulated provider step |
| `pay_apple` | guest | pay (legal exactly when `pay_card` is) | Apple Pay (3.1.0): the same simulated approval step, labelled for the wallet; the payment is recorded with method "Apple Pay". Button key `apple-pay`, shown above "Pay by card". Guide and autoplay stay on `pay_card` |
| `confirm_payment` | guest | provider, not yet sent | Approves after 1.3 s → paid; payment appears in the list |
| `back` | guest | split, tip, pay, provider (not while approving) | One step back; leaving the pay screen releases "Paying now" |
| `finish` | guest | paid | "Done" → the thank-you with the rating |
| `pay_another` | guest | paid, amount left | "Pay another share" → bill |
| `rate` `{ stars: 1–5 }`, `submit_rating` `{ comment? }` | guest | thank-you, not yet sent | |
| `rest_of_table` | staff | after the first payment, amount left, guest on bill/paid/thank-you | Settles the remaining shares one by one; then "Sale posted to the POS" |
| `refund_last` | staff | a payment exists, not yet refunded | Marks it "Refunded"; "Refund started; the provider returns it to the original card" |

Arithmetic (all in integer fils, unit-tested): service = round(subtotal × 10 ÷ 100), tax = round((subtotal + service) × 16 ÷ 100); equal share = round(remaining × covers ÷ shares left) and the last payer takes the remainder; by-item share = round(total × chosen ÷ subtotal), never more than what is left, and choosing everything unpaid pays the remainder exactly; tip = round(share × 5 or 10 ÷ 100); halves round up.

## Renderers

Every mount takes an element or a selector, adds the class `pd-root` to it, appends its own root inside and returns `{ el, destroy() }`. Several mounts may share one store (that is how the two sides stay in sync) and a page may hold several stores. The DOM is patched in place, so keyboard focus, carets and scroll positions survive state changes; if the focused control disappears (Start, once pressed), focus moves to the next control of the same card.

```js
PayliDemo.mountPhone(el, demo, { frame: false, statusBar: true, fill: false, caption: true, audio: true })
```
Draws the guest's screen. `frame: false`: `el` is the screen area and you supply the device; the screen takes `el`'s width and a 390:844 aspect ratio (`fill: true` makes it fill `el`'s height instead). `frame: true`: a neutral device with a caption "Illustrative demo · In development" (`caption: false` removes it). The screen is designed at 390 × 844 and scales with its own width from 220 to 430 px through CSS container units, so text stays crisp. Content taller than the screen scrolls inside it.

```js
PayliDemo.mountStaff(el, demo, { variant: 'board' })   // or 'card'
```
pager `board`: header, columns New / Preparing / Ready, "Done recently", the "Order #24 is live" QR panel, "Details" on each open card (timing, −5/+5/+10 min, guest facts, the honesty line, history, cancel with a reason). pager `card`: the phone's order alone. table `board`: live floor of ten tables, payments list, Table 12 card with "The rest of the table pays", POS line. table `card`: Table 12 tile, its last payment, POS line, the button. The board stacks its columns below 640 px of its own width and works from 320 to 900 px and beyond.

```js
PayliDemo.mountLog(el, demo, { max: 8 })   // ul.pd-log > li.pd-log-item[data-pd-side][data-pd-type] > .pd-log-side + .pd-log-text
PayliDemo.mountGuide(el, demo)             // .pd-guide[aria-live=polite][data-pd-side][data-pd-done][data-pd-step] > .pd-guide-step, -title, -body
```
Both are plain on purpose: they inherit your typography.

```js
PayliDemo.snapshot(el, {
  scenario, at, surface: 'phone' | 'staff', variant, lang, appearance, frame,
  statusBar, caption, clockTime: '14:32', detailsOpen, sound, notifications, banner,
})
PayliDemo.whenReady(scope?)   // Promise: fonts loaded and every image inside a .pd-root decoded
```
A static picture of a named moment. `at`: pager `scan | received | preparing | ready | on_my_way | collected | cancelled`; table `scan | bill | split | tip | pay | paid | floor_open | floor_paying | floor_paid`. Any name works with either surface. An unknown name throws with the list of valid ones. The DOM is complete when the call returns; nothing animates; there are no buttons, inputs, handlers or live regions; the root is `role="img"` with a description. For PDFs: `await PayliDemo.whenReady()` (it includes `document.fonts.ready`), then print with backgrounds. `banner: true` shows the simulated notification on a ready phone; `sound: true` makes the board say "Phone alerted · sound on".

### Markup hooks (stable; style your staging around them, never the `pd-` classes)

| Hook | Where | Values |
|---|---|---|
| `data-pd-surface` | mount root (`.pd-phone`, `.pd-staff`) | `phone`, `staff` |
| `data-pd-scenario` | mount root | `pager`, `table` |
| `data-pd-state` | mount root | pager: order status; table phone: screen; table staff: Table 12 status |
| `data-pd-screen` | phone root | `scan`, `order`, `bill`, `split`, `tip`, `pay`, `provider`, `paid`, `closed` |
| `data-pd-ringing` | phone root | `"true"` for 2.8 s after each ring: hook your device frame's reaction here |
| `data-pd-rings` | phone root | ring count |
| `data-pd-joined`, `data-pd-theme`, `data-pd-lang` | phone root | |
| `data-pd-variant` | staff root | `board`, `card` |
| `data-pd-snapshot` | snapshot root | `pager:ready` |
| `data-pd-cmd` | every command control | the command name |
| `data-pd-key` | every control | stable key, e.g. `o24-ready`, `cta`, `back`, `mode-item`, `tip-10`, `star-5` |
| `data-pd-next="true"` | the control the guide points at | |
| `data-pd-off` | unavailable control (also `aria-disabled="true"`) | |
| `data-pd-on` | selected option / checked item | |
| `data-pd-card`, `data-pd-status`, `data-pd-main` | staff order card | `o24`, status |
| `data-pd-order` | staff action buttons | the order id the button acts on, e.g. `o24` |
| `data-pd-group` | staff order card | focus group used to keep keyboard focus inside the card |
| `data-pd-col` | board column | `received`, `preparing`, `ready`, `done` |
| `data-pd-fact="guest"` | the guest fact chip on a card | |
| `data-pd-table`, `data-pd-status`, `data-pd-me` | floor tile | |
| `data-pd-payment` | payments row | `p1` |
| `data-pd-posted` | POS line | `true`, `false` |

## Theming

Set these custom properties on the mount element or any ancestor. Do not override `pd-` selectors. Defaults reproduce the real product.

| Property | Default | Applies to |
|---|---|---|
| `--pd-brand` | `#043c44` | primary actions, brand marks (phone and staff) |
| `--pd-brand-ink` | `#ffffff` | text on the brand colour; set it if you change `--pd-brand` to a light colour |
| `--pd-brand-strong`, `--pd-brand-tint` | derived | lines/icons in the brand colour; the estimate strip |
| `--pd-accent` | `#19c3a6` | the "ready" moment, live dots, selected states |
| `--pd-accent-ink`, `--pd-accent-tint` | `#0a1a1d` (phone) / `#043c44` (staff), derived | |
| `--pd-bg`, `--pd-surface`, `--pd-text`, `--pd-muted`, `--pd-line` | `#f7faf9`, `#fff`, `#0a1a1d`, `#4f6366`, `rgba(11,73,82,.12)` | guest screen (classic and bold; the dark theme uses the product's dark palette) |
| `--pd-radius` | 24 design px (phone cards), 16px (staff cards) | card radius, both surfaces |
| `--pd-font`, `--pd-font-display`, `--pd-font-mono`, `--pd-font-arabic` | Switzer, Clash Display, JetBrains Mono, Alexandria (loaded as `"PD …"` families so they never collide with yours) | Give family names only, without generic fallbacks (`sans-serif`, `system-ui`): the engine appends the Arabic face and the fallbacks itself. A generic inside `--pd-font` would draw Arabic text in a system font |
| `--pd-frame-color`, `--pd-frame-radius` | `#0d1b1e`, 15.5% of the device width | the neutral device (`frame: true`) |
| `--pd-screen-radius` | `0` | the screen's own corner radius when you supply the frame |
| `--pd-staff-bg`, `--pd-staff-surface`, `--pd-staff-text` | `#f7faf9`, `#fff`, `#0a1a1d` | staff surfaces (soft text and lines are derived from these) |
| `--pd-staff-radius` | `0` | outer corners of the staff surface |
| `--pd-hint` | the accent | the pulsing ring on the next action; `transparent` switches it off |

The guest page's `appearance` (`classic`, `bold`, `dark`, brand, accent) is the product's real per-restaurant setting, so it is state, not CSS: use `create({ appearance })` / `setAppearance()`. A brand or accent passed that way is contrast-corrected exactly as the product does (`packages/pager/src/theme.ts`) and wins over `--pd-brand` / `--pd-accent` on the pager guest page. The Pay at Table screens always use the product's own look. Status colours on the staff side (blue new, amber preparing/bill open, green paid, red cancelled) are the product's and are not themable.

`payli-demo.css` contains one normalising rule, `:where(.pd-root) [class*="pd-"]`, so that the host page's element styles (`button`, `img`, `ul` …) do not leak into the product UI. It only matches elements that carry a `pd-` class inside a mount (every element the engine creates does). The browser test mounts the UI on a page with aggressive `button`, `img`, `input`, `div`, `span`, `svg` and `body` styles and checks that nothing moves or changes colour. It cannot defend against ID-based or `!important` rules that reach into a mount, so avoid those.

## Accessibility

Real `<button>`s with clear names; unavailable controls use `aria-disabled` and stay focusable, so focus never drops when a button greys out. One `aria-live="polite"` region per mount announces what changed on that side. Visible `:focus-visible` rings. Staff controls are at least 44 px tall; guest controls keep the product's sizes on a 390 px screen. Arabic sets `dir="rtl"` and `lang="ar"` on the phone screen only; amounts, order numbers and times are isolated left-to-right. Under `prefers-reduced-motion` nothing animates and the ring becomes a steady accent border for as long as the phone rings. Sound is a two-note chime synthesised with WebAudio, off until the guest's Sound switch is turned on; `PayliDemo.audio = false` silences the engine altogether, and `mountPhone(…, { audio: false })` keeps one phone from attaching it.

## Assumptions

Where the demo simplifies or stands in for the product. None of this is a product feature.

1. **One guest phone.** The product supports several phones per order ("2 phones watching"); the demo has one. Ambient orders #21–#23 are seeded, operable and have no phone (#23 has a pretend one that always reports "sound off").
2. **The demo clock stands still.** Ages and time facts ("just now", "Due in 8–12 min", "Ready just now", "Ready since 14:32") use the product's formats but do not count down, so the late states ("Taking a little longer than expected", "Late 3 min", "Almost ready — any minute now") are never shown. The clock time is the visitor's local time at reset (fixed at 14:32 in snapshots).
3. **Ring-again cooldown is 10 s** (product default 30 s, range 10–600 s; `ringCooldownSec` changes it). It also applies after the first ring, as in the product.
4. **The phone's "alert received" report reaches the board after 350 ms**, a stand-in for the network round trip. "No phone confirmed the alert" appears 8 s after a ring with no phone joined, which is the product's rule.
5. **The new-order dialog is reduced to a prefilled order**: "+ New order" creates the next number with the same two items. The "Order #24 is live" panel keeps the QR, the text and "Done"; "Copy link", "Print ticket" and "Another order" are left out. The QR is a pattern, not a scannable code.
6. **The order panel is inline.** In the product it is a drawer opened from the card; here it opens under the card ("Details") with Timing, the ±5/+10 chips, Guest, History and Cancel. "Ready in [min] Set", "Collect at" and the staff note on cancel are left out. Tabs "Active / All of today" and "Settings" are left out.
7. **"I’m on my way" is instant**; the product's brief "Letting them know…" state is skipped. The demo also makes "Ring again" unavailable after it (the product spec says nothing sounds after "I’m on my way").
8. **The simulated notification is drawn inside the phone screen**, over the page. In the product it is the browser's own notification, shown when the page is in the background. Vibration, Web Push with the page closed, the lost-link recovery page, loading, expired, offline and reconnecting states are not simulated.
9. **Sound is a synthesised two-note chime**, not the product's sound files (chime/bell/pager). It plays twice on Ready & ring and once on Ring again and on the test.
10. **Estimate 8–12 min** is the product's default fixed range ("Ready in about 8–12 min"). The demo does not run the product's dynamic estimator; the research's hand-worked figure for this order from the demo seed (7–10 min) is available through `estimateMin: [7, 10]`.
11. **The payment provider's page is replaced by a labelled placeholder** with no card fields; approval always succeeds after 1.3 s. 3-D Secure, declines, wallets and cancelled payments are not simulated.
12. **The POS is a status line.** Menu import and the posted sale's contents are not shown.
13. **"The rest of the table pays"** is a demo control, not a dashboard button (the staff surface labels it "Demo control"): it stands for the other guests paying on their own phones (one by one, 1.1 s each, with illustrative tips of 10%, none, 5%).
14. **Refund** marks the latest payment "Refunded" and shows the product's sentence; the bill is not reopened and no reason is asked for (the product requires one).
15. **Split rules across modes.** Once an equal split has started, the bill offers "Pay my share" / "Pay the remaining N shares" (as in the product). After a by-item or custom payment any mode may be used on what is left; how the product restricts mixed modes was not verified. By item works per unit (two cookies are two units), which matches the amounts on the real product screen.
16. **Custom tip** accepts any amount up to JOD 999999.999; the product's limits were not verified.
17. **Paid and thank-you screens.** The product's email-receipt lines ("A receipt is on its way…") and the tip sub-line ("100% goes to the team…") are left out because the claims register forbids them. The rating comment is not stored or shown on the staff side; it only reaches the event log.
18. **The floor is static** apart from Table 12: ten tables with seeded states and amounts, two seeded earlier payments. The "Inactive" state and the dashboard's filters, QR and edit buttons are not shown.
19. **Simulation-only wording** (not product copy): the scan prompt's "Scan the QR" / "امسح رمز QR", the simulated provider step, the star labels, "Details", event-log sentences and guide texts. Their Arabic was written for this demo, not taken from product code. All other guest strings, English and Arabic, are verbatim from `apps/web-payer/src/i18n/strings.ts`; staff strings from the dashboard components (English only, as in the product).
20. **Appearance** covers theme, brand and accent. Fonts (`payli/rounded/serif`), logo, header image, custom wording, the two-column flow (preparing step off) and estimate display as clock times are not implemented.

- **Apple Pay (3.1.0).** The pay screen shows an Apple Pay button above Pay by card because the product offers Apple Pay where the payment provider enables it. In the demo it is a labelled simulation: no Apple service is contacted and no payment sheet opens.

## Tests

```sh
# store: transitions, illegal commands, bill arithmetic, cooldown, reset, autoplay, Arabic, seeds
node --test                       # from this folder; or: node --test test/store.test.mjs

# browser: needs the static server (cd company-profile-payli/qa && npm run serve)
node test/harness.pw.mjs
```

The browser run performs the acceptance test in both scenarios at 1440 and 390 px and once from `file://`, checks keyboard focus, touch targets, live regions, Arabic, the three themes, autoplay, reduced motion, snapshots (no focusable controls, nothing animating, fonts and images ready), phone widths 220–430 px and board widths 320–900 px, a host page with hostile element styles, writes an A4 PDF of the snapshots, and saves screenshots to `company-profile-payli/round-3/screenshots/demo-engine/`. It fails on any console error or warning, failed request or external request.
