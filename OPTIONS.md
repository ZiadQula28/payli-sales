# Payli sales website + company profile: five design options

**Date:** 3 November 2026 · **Status:** for the team to choose one direction
**Live chooser (share this link):** https://ziadqula28.github.io/payli-sales/
**Local folder:** `~/Desktop/Payli/company-profile-payli/options/`

Each option is a matching pair: a **website** with the interactive pay-at-table demo, and a **PDF company profile** in the same style. The facts, claims and wording are identical in all five; only the design changes. Whichever you choose becomes the final version, and the other four can be deleted.

| # | Name | Look | Feels | Best for |
|---|---|---|---|---|
| 01 | **Luminous** | Dark sea background, mint light ribbons and glows, glass cards, floating product, giant wordmark | Premium fintech, cinematic | Investors, launch events, dark rooms |
| 02 | **Editorial** | Light paper, magazine typography, hairline grid, numbered chapters, figure captions, one mint highlight per page | Calm, exact, printed | Owners who read, finance teams, printed leave-behinds |
| 03 | **Studio** | Soft grey canvas, white rounded tiles, real product screens as the hero, quiet mint halos | Clean, modern, approachable | Showing the software itself |
| 04 | **Blueprint** | Deep-teal drafting sheet, grid paper, mono labels, system schematic, spec tables, title block on every page | Engineered, precise, honest | Operations/finance people, POS partners |
| 05 | **Poster** | Full-bleed mint / teal / cream fields, giant uppercase type, thick rules, stickers, marquee strips | Energetic, consumer, memorable | Cafés, younger venues, social, events |

## Files

```
options/
├── index.html                      the chooser page (links to all five)
├── OPTIONS.md                      this document
├── shared/                         fonts, images, demo engine shared by all five sites
├── 01-luminous/   index.html · style.css · Payli-Company-Profile-01-Luminous.pdf  · build/
├── 02-editorial/  index.html · style.css · Payli-Company-Profile-02-Editorial.pdf · build/
├── 03-studio/     index.html · style.css · Payli-Company-Profile-03-Studio.pdf    · build/
├── 04-blueprint/  index.html · style.css · Payli-Company-Profile-04-Blueprint.pdf · build/
└── 05-poster/     index.html · style.css · Payli-Company-Profile-05-Poster.pdf    · build/
```

- **Website:** open `index.html` in Chrome. Each site needs the `shared/` folder next to its option folder, so share the whole `options/` folder (or the live link).
- **PDF:** the file in each option folder. `build/` holds the source it was generated from.

## What's the same in all five

- The interactive demo (guest phone + restaurant dashboard, English/Arabic, auto-play for presenting, "rest of the table pays").
- The value calculator built on the restaurant's own numbers (and the fill-in worksheet page in each PDF).
- Every claim: closed beta, no restaurant live yet, Payli never holds money, integration statuses as of November 2026, no fee on tips, no price list. Source of truth: `../facts.yaml`.
- Payli's real brand: Clash Display, Switzer, JetBrains Mono; mint `#1AD9AD`, teal `#043C44`; real product screens; Cedar & Sage is a fictional venue.

## What was fixed since the last round

- The earlier PDF looked broken in Preview/Mail/iPhone because some effects (gradient-filled text, masks, glow shadows) only render in a browser. Every PDF is now built from PDF-safe elements only (light effects are flattened to images where used) and was rendered in **three independent PDF engines** (Apple PDFKit, Chrome's PDFium, MuPDF) before delivery. All five match in all three.
- Odd-looking "0" numerals (the monospace font's dotted zero) are gone from headline figures; phone screenshots are cut out cleanly with no grey fringe.
- Mobile layouts were checked at 390 px wide on all five sites; no horizontal scrolling, demo runs through a full payment without errors.

## How to decide

1. Open the chooser link on a laptop; open each website; run the demo; scroll on your phone too.
2. Open each PDF in whatever app the sales team actually uses (Preview, Acrobat, WhatsApp, Mail).
3. Reply with the option number. Mixing is possible (e.g. Option 2's PDF with Option 3's website), since all five share the same content and brand.
