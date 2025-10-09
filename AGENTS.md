# AGENTS.md – DefCost Project

## Overview
This project uses AI-assisted development (Codex) to maintain and improve the **DefCost** quoting system — a browser-based tool for Workplace Defender that loads Excel price lists, allows adding catalogue items to a quote, and exports CSVs.

## Active Agent: `DefCost-UI`
**Role:**  
Implement and optimise the front-end quoting interface, including:
- Table layouts and totals logic
- Catalogue window behaviour
- UI polish and dark-mode styling

**Focus Areas:**  
HTML, TailwindCSS, and JavaScript logic directly related to quote building and catalogue display.

**Constraints:**
- Preserve existing localStorage keys (`defcost_basket_v2`, `defcost_catalogue_state`)
- Maintain responsive layout and dark-mode compatibility
- Keep export logic (`exportCSV`, PDF preparation) untouched unless requested
- Maintain section note persistence (the `notes` field on each section stored in `defcost_basket_v2`)

---

## Versioning Rules
Codex must update the **project version string** displayed at the top of the page  
(e.g. `DefCost 1.2.0` in the main header) whenever a patch is applied.

Version naming convention:
- **Major (X.0)** → Structural overhaul or major new system (e.g. new export engine)
- **Minor (X.Y)** → Functional enhancement or UI update
- **Patch (X.Y.Z)** → Bug fix or minor UI adjustment

Example:
DefCost 1.2.0 → DefCost 1.2.1 (bug fix)
DefCost 1.3.0 → DefCost 1.4.0 (new feature)
DefCost 2.0.0 (major rework)

---

## Guidelines
- Always back up `index.html` and `main.js` before large modifications.  
- Reflect every visual or behavioural change in `README.md` under the changelog.  
- Maintain semantic version consistency between displayed version (UI header) and repo tags/releases.  
- Document all localStorage or data structure key updates.  
- Codex should always pull latest main before editing index.html

---

## Current Version
DefCost **v2.0.0** — Section notes and redesigned totals sidebar.
