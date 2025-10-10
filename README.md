# DefCost — Workplace Defender Quoting Tool

DefCost is a browser-based estimating/quoting app for Workplace Defender.
It loads an Excel price list (catalogue), lets you build sectioned quotes with parent/child items, and supports CSV import/export with full round-trip capability. State is stored locally in the browser (localStorage). Future cloud sync (Google Drive) is planned.

---

## Features

- Section-based quote builder with parent and child items
- Per-section notes
- Quote-level totals with discount ↔ grand total sync and 10% GST
- CSV export and import (round-trip, including notes)
- Floating catalogue window (open/close, drag/resize/search, position persistence)
- Undo backup on imports and destructive actions
- Dark-mode friendly UI and responsive layout

---

## Architecture (v3.1.0-B+)

Modules (ES6):

- js/main.js — App bootstrap, event wiring, orchestration
- js/ui.js — Render sections/items/notes/totals, dialogs, toasts, import summary modal
- js/storage.js — localStorage, undo history, CSV import/export (Papa Parse), backups
- js/calc.js — Currency helpers; totals/discount/GST calculations and formatting
- js/catalogue.js — Floating catalogue (open/close, drag/resize/search, state persistence)
- js/utils.js — Shared helpers (DOM selectors, debounce/throttle, parsing, ids)

Global interop (lightweight bridge on window):

    window.DefCost = {
      state: {},
      api: {},
      ui: {},
      catalogue: {}
    };

External libraries:

- SheetJS (xlsx.full.min.js) — kept for future XLSX export
- Papa Parse — CSV parsing
- SortableJS — drag/drop reordering

---

## Data Model & Persistence

localStorage keys:

- defcost_basket_v2 — canonical quote state (sections, items, notes, totals)
- defcost_basket_backup — last backup (for Undo)
- defcost_catalogue_state — catalogue window UI state (x, y, w, h, isOpen)

Sections & items:

- Parent items may have children[]
- Per-section notes stored as a string and exported as a dedicated CSV row

Totals:

- Centralised in js/calc.js
- Discount (%) and Grand Total (ex GST) inputs keep each other in sync
- GST = 10% of Grand Total (ex GST)
- Grand Total (Incl. GST) = Grand Total + GST

---

## CSV Format (Round-Trip)

Header (strict):

    Section,Item,Quantity,Price,Line Total

Row types:

- Parent item — normal item name in Item
- Child item — Item begins with "- " (hyphen + space)
- Notes row — Section contains "Section X Notes"; notes text stored in Item; numeric columns empty

Rules:

- Import ignores CSV Line Total and recomputes values
- Commas/newlines in notes are quoted by the exporter for Excel compatibility
- If an item name must literally start with "- ", escape it as "\- " (importer strips the backslash)

---

## Usage

- Export CSV — saves the current quote to a CSV file using the format above
- Import CSV — validates headers, parses rows, rebuilds sections/items/notes, shows an Import Summary modal, and offers Undo
- Catalogue — open/close via button; drag, resize, and search; state is persisted across reloads
- Totals — edit Discount (%) or Grand Total (ex GST); other totals update automatically

---

## Contributing / Editing with Codex

- Prefer small, reversible patches (≤ ~300 lines)
- Keep module boundaries:
  - js/calc.js — all totals math and currency helpers
  - js/storage.js — persistence and CSV import/export
  - js/ui.js — DOM rendering and modals/toasts
  - js/catalogue.js — catalogue behaviours
- If you change persistence schema or CSV shape, update this README and bump version appropriately
- Quick smoke test after changes:
  1) Add parent + child, edit qty/price → totals update
  2) Import known CSV → Import Summary counts correct → Undo works
  3) Open catalogue → drag/resize/search → refresh → state persists
  4) Export CSV → headers + Notes rows correct

---

## Versioning

Semantic rules:

- Major (X.0.0) — structural refactor or platform feature (e.g., Drive sync)
- Minor (X.Y.0) — new functionality or UI feature
- Patch (X.Y.Z) — bug fix or UX polish

Always update:
1) Visible version header in the UI
2) Changelog below

Changelog:
- **3.1.0-B** – Optimised renderBasket(): now debounced per animation frame to reduce redundant DOM rebuilds on edits. No functional change.
- **3.0.7** – Completed catalogue module; added debounce search + drag/resize polish.
- **3.0.6** – Hybrid modularisation C: Minimal catalogue module for open/close/state persistence. No functional changes.
- **3.0.5** – Hybrid modularisation B: Moved renderBasket into /js/ui.js; render uses window.DefCost state/API. No functional changes.
- **3.0.4** – Hybrid modularisation A: Introduced global namespace and moved Import Summary modal + toast to /js/ui.js (reads/writes global state). No functional changes.
- **3.0.3** – Split calculation and storage logic into dedicated modules (calc.js and storage.js). No behavioural changes.
- **3.0.2** – Extracted inline JavaScript from index.html into /js/main.js — no logic changes.
- **3.0.1** – Added Import Summary modal after CSV import — shows counts of sections, items, notes, and total value with Undo option.
- **3.0.0** – Added CSV Import: restores sections, items, children ('- ' prefix), and per-section notes ('Section X Notes' rows). Includes backup/undo and strict header validation.
- **2.0.7** – Fixed CSV header ('Line Total' label) and added Notes rows under each section in CSV export.
- **2.0.6** – Section selector moved to its own column; children inherit section (read-only)
- **2.0.5** – Simplified line total header copy and reduced Quote Builder title size
- **2.0.4** – Refined section tabs, tightened quote row spacing, refreshed notes + totals styling
- **2.0.3** – Hardened the dark mode toggle binding and bumped the displayed version
- **2.0.2** – Repositioned the quote totals into a dedicated table beneath the sections
- **2.0.1** – Fixed merge regression that duplicated the totals sidebar and broke the main script bootstrap
- **2.0.0** – Added per-section notes, Ex. GST line totals, and redesigned totals sidebar with synced discount logic
- **1.2.0** – Quote Builder moved to the main page; Catalogue lives in the floating window with macOS-style controls
- **1.1.1** – Sections UI refinements, bug fixes
- **1.1.0** – Introduced Sections and section totals
