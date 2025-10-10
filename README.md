# DefCost – Workplace Defender Pricing Tool

DefCost is a browser-based estimating and quoting tool for Workplace Defender.
It loads an Excel workbook of products/services and lets estimators build quotes structured into **Sections**, with support for **sub-items**, drag-reorder, per-section notes, and CSV export.

---

## Tech Stack

- Pure **HTML / CSS / Vanilla JavaScript** (single file: `index.html`)
- Hosted on **GitHub Pages**
- Libraries
  - **SheetJS** (`xlsx.full.min.js`) – Excel parsing
  - **SortableJS** – drag-and-drop ordering
- Data source: **`Defender Price List.xlsx`** (must be in repo root)
- Persistence: **localStorage** key `defcost_basket_v2`
- Locale: **AUD**, **GST 10%**
- Dark mode supported

---

## Core Features

### Quote Builder (primary workspace)

- **Sections**: create, rename, delete; one **active** section at a time
- **Items**: add from catalog or custom; qty, unit price, line totals (Ex. GST)
- **Sub-items**: optional nested lines that roll up into the parent and section totals
- **Section notes**: dedicated notes field stored alongside each section in localStorage
- **Reorder**: drag-and-drop for items (and keep sub-items with their parent)
- **Totals**:
  - Right-aligned summary table (beneath the active section) lists **Total (Ex. GST)**, **Discount %**, **Grand Total (Ex. GST)**, **GST (10%)**, **Grand Total (Incl. GST)**
  - Discount % and Grand Total inputs stay in sync
- **CSV export**: section-aware, includes grand totals
- **Clipboard**: click any non-input cell to copy its text
- **Sticky header**: stable sizing with `scrollbar-gutter: stable`

### Catalogue (floating utility window)
- **Excel-driven** data rendered from the included workbook tabs
- **Search**: keyword filtering per sheet with highlight on matches
- **Click-to-copy**: quickly copies values for use in the Quote Builder
- **Add buttons**: send catalogue items straight into the active section
- **Window controls**: drag, minimise to dock icon, or toggle full-screen view
- **Dark mode aware** so the window matches the active theme

---

## Totals Logic

- Line Total (displayed) = `qty × price` (Ex. GST)
- Section Ex. GST subtotal = sum of **parent items + sub-items** in that section
- Discounted Grand Total (Ex. GST) = `Section Ex. GST subtotal × (1 - Discount %)`
- GST (10%) = `Discounted Grand Total × 0.10`
- Grand Total (Incl. GST) = `Discounted Grand Total + GST`

---

## File Layout
index.html                 # All UI + logic
xlsx.full.min.js           # SheetJS (local fallback)
Defender Price List.xlsx   # Workbook loaded by the app
---

## Do Not Break

- **Workbook loading** path or filename
- **localStorage schema** and key: `defcost_basket_v2`
- **Sections** structure and item→sub-item relationships
- **Sticky header** / seam fix (don’t move padding/borders from the sticky wrapper)
- **CSV export** shape and ordering
- **Clipboard copy** behavior
- **Dark mode** toggle

---

## Current Status

- Implemented: **Sections, sub-items, and per-section notes** with persistence
- Implemented: **Quote Builder** promoted to the main workspace
- Implemented: **Catalogue** running in the floating macOS-style window
- Implemented: **Window controls** – delete quote modal, minimise, dock icon, full-screen toggle

---

## Versioning

- **2.0.5** – Simplified line total header copy and reduced Quote Builder title size
- **2.0.4** – Refined section tabs, tightened quote row spacing, refreshed notes + totals styling
- **2.0.3** – Hardened the dark mode toggle binding and bumped the displayed version
- **2.0.2** – Repositioned the quote totals into a dedicated table beneath the sections
- **2.0.1** – Fixed merge regression that duplicated the totals sidebar and broke the main script bootstrap
- **2.0.0** – Added per-section notes, Ex. GST line totals, and redesigned totals sidebar with synced discount logic
- **1.2.0** – Quote Builder moved to the main page; Catalogue lives in the floating window with macOS-style controls
- **1.1.1** – Sections UI refinements, bug fixes
- **1.1.0** – Introduced Sections and section totals

---

## For Codex & AI Editors

When you make feature changes in this repo, also keep this README aligned.

1. **Update the version** in this README when you change the `<title>` and `<h1>` in `index.html`.
2. Add a concise bullet under **Versioning** describing the change.
3. Preserve the **Do Not Break** rules (don’t alter the loading path, persistence key, or sticky header structure).
4. Keep the **CSV export format** and **section/sub-item** relationships intact.
5. If you modify basket/sections/sub-items logic, confirm **grand totals** still equal the sum of all sections and that CSV export remains consistent.

---

## Author

Maintained by **markbrada** for [Workplace Defender](https://workplacedefender.com.au)
