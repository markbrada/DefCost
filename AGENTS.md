# AGENTS.md – DefCost Project

## Overview
DefCost is a browser-based estimating and quoting tool for Workplace Defender.
It loads Excel price lists, lets users build sectioned quotes (parent/child items), and supports CSV import/export with round-trip capability. State is stored locally (localStorage) and future cloud sync is planned.

---

## Active Agent: DefCost-UI

### Role
Maintain and extend the front-end quoting experience while keeping the codebase modular, stable, and versioned.

### Focus Areas
- HTML/Tailwind UI
- Quote builder (sections, items, notes, totals)
- CSV import/export flows
- Floating catalogue window
- Local persistence and undo history
- JavaScript module consistency

### Constraints
- Do not alter storage keys or schema without a migration plan:
  - defcost_basket_v2  (current quote data)
  - defcost_basket_backup  (undo buffer)
  - defcost_catalogue_state  (catalogue window state)
- Preserve CSV contract:
  - Header: Section,Item,Quantity,Price,Line Total
  - Notes row: “Section X Notes” in Section; notes text in Item
  - Children: Item prefixed with “- ”
- Keep dark-mode, responsive layout, SortableJS ordering, and current UI spacing intact.

---

## Architecture (v3.0.7+)

### Module Map
| File            | Purpose                                                         |
|-----------------|-----------------------------------------------------------------|
| js/main.js      | Boot sequence, event listeners, orchestration between modules   |
| js/ui.js        | Rendering (sections/tables/modals/toasts, Import Summary modal) |
| js/storage.js   | localStorage, undo stack, CSV import/export (Papa Parse), backup|
| js/calc.js      | Currency helpers; totals/discount/GST calculations              |
| js/catalogue.js | Floating catalogue (open/close, drag/resize/search, state)      |
| js/utils.js     | Shared helpers (DOM selectors, debounce/throttle, parsing, ids) |

### Global Namespace
Lightweight inter-module bridge exposed on window:

    window.DefCost = {
      state: {},     // transient runtime data
      api: {},       // selected functions from storage/calc exposed for UI
      ui: {},        // UI helpers (modals, toasts, renderers)
      catalogue: {}  // catalogue behaviour
    };

---

## Versioning Rules
| Type               | When to bump                                      | Example |
|--------------------|----------------------------------------------------|---------|
| Major (X.0.0)      | Structural refactor or platform feature (e.g. Drive sync) | 4.0.0  |
| Minor (X.Y.0)      | New functionality or UI feature                    | 3.1.0  |
| Patch (X.Y.Z)      | Bug fix or small UX polish                         | 3.0.8  |

Always update:
1) Visible version header in the UI (e.g., “DefCost 3.0.7”)
2) CHANGELOG in README.md

---

## Editing Guidelines for Codex
1) Pull latest before edits.
2) Prefer small, reversible patches (≤ ~300 lines) and avoid mega-refactors in one step.
3) Keep module boundaries clear; avoid circular imports.
4) Totals logic lives in js/calc.js only.
5) Persistence and CSV logic live in js/storage.js only.
6) UI rendering and modals live in js/ui.js.
7) If schemas/modules change, update README.md (Architecture + Versioning).
8) Follow the versioning rules above and bump the header accordingly.

---

## Current Version
DefCost v3.0.7 — Catalogue module completed (open/close/state persistence, drag/resize/search polish, debounce search).
