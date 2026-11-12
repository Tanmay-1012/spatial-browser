# Task 12 Output — Research Tree Explorer Overview & Detail UI

**Status:** Pending Lead Review (Implementation & Cross-Browser Verification Complete)  
**Milestone:** 12 (Research Tree Explorer Overview & Detail UI — Task 10 v15 Sections 51–52)  
**Browser Targets:** Google Chrome 156.0.8078.48 (min 109+) & Mozilla Firefox 158.0.1 (strict_min_version: 115.0)  
**Execution Date:** 2026-11-12  

---

## 1. Executive Summary & Scope Boundaries

Task 12 replaces the flat single-forest landing screen with the approved Task 10 v15 **two-level Research Tree Explorer** while leaving the Task 11 backend storage engine, tracking state machine, permissions, and browser manifests completely unchanged:

- **Level 1 — Research Tree Explorer Overview (`#overview-view`):** Renders one summary card per stable `treeId` (grouping multi-tab product siblings and same-tab Back/Forward branches into unified Research Tree cards) displaying root domain, root title, visit/branch/open-tab/download counts, latest activity (including attributed downloads when newer than visits), relative timestamp, and a distinct **Open Tree Detail View** action (`.tree-open-btn`). Root-pruned trees preserve one card via oldest surviving visual roots (`rootPruned` indicator), and missing/ambiguous downloads appear exclusively in the separate **Unattributed Downloads** shelf (`#unattributed-section`) labeled `Source unavailable` without ever creating fake Research Tree cards.
- **Level 2 — Interactive Tree Detail View (`#detail-view`):** Strictly isolates one `treeId`, renders a readable horizontal branch-fan SVG tree, activates pan/zoom/fit controls (`#zoom-controls`), and returns to Overview via `#back-to-overview-btn` while restoring prior overview `scrollTop`, `query`, `timeFilter`, and focused card button (`overviewFilters.focusedTreeId`). Search and time filtering preserve non-matching ancestor nodes as dimmed context (`.is-context-ancestor`) with `#detail-context-banner` so surviving child branches never detach or claim false parents.
- **Download Provenance & Safety:** Selecting an attributed download node opens `#details-panel` displaying `"Downloaded from <originDomain>"` (`#details-source-field`) while keeping `#details-url-field` and `#details-actions` (`#reopen-btn`) hidden and blocked.
- **Locked Constraints Maintained:** `src/shared/tracker.js`, `src/shared/storage.js`, `src/chrome/manifest.json`, `src/firefox/manifest.json`, permissions (`tabs`, `storage`, `webNavigation`, `downloads`), and minimum versions (`Chrome 109+`, `Firefox 115.0+`) remain untouched. Zero `.innerHTML` usage across all extension scripts.

---

## 2. Changed Files Summary

| File | Change Scope & Purpose |
| :--- | :--- |
| [`src/shared/ui-logic.js`](file:///D:/Projects/HCI%20Project/src/shared/ui-logic.js) | Added two-level explorer pure helpers: `isDownloadNode`, `isUnattributedDownload`, `getDomainLabel`, `collectActiveTabHeads`, `summarizeTreeGroup`, `buildResearchTrees` (strict `treeId` card grouping + separated unattributed downloads + global filter), `buildTreeDetailView` (single-`treeId` scoping + non-distorting context ancestor closure), enhanced `computeGraphLayout` (`nodeType`, `filename`, `originDomain`, `isContextAncestor`, `isActiveHead`, `isMatch`), and strict HTTP/HTTPS `isSafeHttpUrl`. |
| [`src/shared/index.html`](file:///D:/Projects/HCI%20Project/src/shared/index.html) | Replaced single-canvas shell with two-level Explorer landmarks: `#overview-brand`, `#detail-brand`, `#back-to-overview-btn`, `#detail-tree-domain`, `#detail-tree-title`, `#detail-count-badge`, `#zoom-controls` (hidden on Overview), `#overview-view` (`#trees-grid`, `#unattributed-section`, `#unattributed-list`), `#detail-view` (`#detail-context-banner`, `#detail-no-results`, `#map-container`), `#details-panel` (`#details-source-field`, `#details-url-field`, `#details-actions`), preserved `#empty-state` (`#placeholder-heading`: `No Browsing Map Yet`), `#no-results-state`, and `#clear-modal`. Zero inline scripts or handlers. |
| [`src/shared/styles.css`](file:///D:/Projects/HCI%20Project/src/shared/styles.css) | Added `[hidden] { display: none !important; }`, accessible dark/light theme tokens (`--color-badge-download-text`, `--color-badge-unattributed-text`, `--color-badge-tab-text`, `--node-download-border`), Research Tree card grid styling, Unattributed Downloads shelf, context-ancestor dimming (`.is-context-ancestor`), download pill styling (`.is-download`), open-tab indicator (`.is-active-head`), `@media (max-width: 900px)` responsive layout, and `@media (prefers-reduced-motion: reduce)`. |
| [`src/shared/app.js`](file:///D:/Projects/HCI%20Project/src/shared/app.js) | Implemented `viewMode` (`'overview' \| 'detail'`), independent `overviewFilters` (preserving `query`, `timeFilter`, `scrollTop`, `focusedTreeId`) and `detailFilters`, safe DOM-based card and shelf rendering, `openTreeDetail()`, `returnToOverview()` focus/scroll restoration, download provenance drawer (hiding URL and `#reopen-btn`), context ancestor rendering, pan/zoom/fit/keyboard navigation, and Clear Map persistence reset. Zero `.innerHTML`. |
| [`tests/test-ui.mjs`](file:///D:/Projects/HCI%20Project/tests/test-ui.mjs) | Expanded from 8 to 12 tests covering Explorer landmarks/CSP/XSS/download-reopen checks, WCAG AA contrast + reduced motion + responsive CSS, 3 independent roots $\to$ 3 cards, multi-tab product siblings $\to$ 1 card, Back-to-parent branches $\to$ 1 card + sibling layout, `treeId` detail isolation & Back-to-Overview state restoration, attributed vs. unattributed downloads, global & tree-local filtering with context ancestors, root-pruned trees & 301-node/cyclic scalability, HTTP/HTTPS URL guard, and background clear-history reset. |
| [`scripts/e2e-chrome-verification.py`](file:///D:/Projects/HCI%20Project/scripts/e2e-chrome-verification.py) | Updated Chrome CDP E2E assertions for Overview/Detail transitions, 2 $\to$ 3 tree-card reopening isolation, Overview & Detail search/time filtering with dimmed `.is-context-ancestor` preservation, Back-to-Overview focus/filter restoration, Step 6.5e live Explorer verification (sibling SVG fan coordinates, `"Downloaded from localhost"`, hidden `#reopen-btn` & `#details-url-field`, and Unattributed Downloads shelf labeled `"Source unavailable"`), and Step 8c post-restart reconciliation. Added deterministic storage polling across rapid tab closures/navigations. |
| [`scripts/e2e-firefox-verification.py`](file:///D:/Projects/HCI%20Project/scripts/e2e-firefox-verification.py) | Updated Firefox Marionette/WebDriver E2E assertions for full cross-browser parity across Overview cards, Detail scoping, focus/filter restoration, context-ancestor filtering, Step 6.5e sibling SVG geometry & download provenance UI, and Step 8c post-restart reconciliation. |
| [`outputs/`](file:///D:/Projects/HCI%20Project/outputs) | Deterministic rebuild artifacts generated by `npm run build` (`spatial-browser-history-extension.zip`: 43,700 bytes; `spatial-browser-history-firefox.zip` & `.xpi`: 43,734 bytes each; updated `SHA256SUMS`). |

---

## 3. Automated Test & Build Results (`npm.cmd run build; npm.cmd test`)

Executed after final source edits (`D:\Projects\HCI Project`):

- **Build (`node scripts/build.mjs`):**
  - Chrome Unpacked & Zip (`43,700` bytes), Firefox Unpacked & Zip/XPI (`43,734` bytes each), SHA-256 checksums (`outputs/SHA256SUMS`) built with exit code `0`.
  - Versions & compatibility floors unchanged (`Chrome 0.1.0 / min 109`, `Firefox 0.1.0 / min 115.0`).
- **Automated Test Suite (`npm.cmd test` — 59 passed, 0 failed):**
  - `tests/verify-builds.mjs`: **12 passed, 0 failed** (outputs, archive-unpacked parity, shared-file parity, Chrome/Firefox MV3 manifests, CSP & zero `.innerHTML`, icons, launch behavior).
  - `tests/test-tracker.mjs`: **35 passed, 0 failed** (all Task 2 & Task 11 V2 storage, migration, branch-aware tracking, startup barrier, fail-closed safety, distinct-host CDN provenance, ambiguous/missing referrer fallback, pruning, and wipe tests intact).
  - `tests/test-ui.mjs`: **12 passed, 0 failed**:
    1. Two-level Explorer controls, overview/detail landmarks, dialog semantics, and script order.
    2. Extension markup and dynamic rendering CSP, XSS safety (`.innerHTML` absent), and download-reopen restrictions.
    3. WCAG AA contrast across light/dark badges and text + `@media (max-width: 900px)` + `@media (prefers-reduced-motion: reduce)`.
    4. Three independent root `treeId`s produce three Overview cards.
    5. Multiple opener-created product tabs stay in one card and align as parallel siblings.
    6. Back-to-parent same-tab branches remain in one card and align as siblings in Detail View.
    7. Detail View isolates one `treeId` without cross-tree leakage and restores Overview scroll/query/timeFilter/focus.
    8. Attributed downloads nest under verified source page; unattributed downloads render only in the separate shelf labeled `Source unavailable`.
    9. Global and tree-local filters search titles/domains/filenames and keep non-matching ancestors dimmed (`.is-context-ancestor`) without false parents.
    10. Root-pruned trees keep one card and large (301 nodes) or cyclic graphs render deterministically.
    11. Safe URL guard allows only HTTP and HTTPS.
    12. Background clear-history queue clears graph and tab links cleanly.

---

## 4. Isolated-Profile Cross-Browser Runtime Verification

Both browser suites were executed sequentially against fresh unpacked Task 12 builds in isolated temporary profiles:

### 4.1 Google Chrome `156.0.8078.48` (x64 Windows CDP)
- **Full Log:** [`docs/test-results/chrome-e2e.log`](file:///D:/Projects/HCI%20Project/docs/test-results/chrome-e2e.log)
- **Error Audits:** [`docs/test-results/chrome-errors-pre-restart.json`](file:///D:/Projects/HCI%20Project/docs/test-results/chrome-errors-pre-restart.json) (254 CDP records: **0 errors, 0 warnings**) · [`docs/test-results/chrome-errors-post-restart.json`](file:///D:/Projects/HCI%20Project/docs/test-results/chrome-errors-post-restart.json) (16 CDP records: **0 errors, 0 warnings**)
- **Verified Runtime Flow:**
  - Toolbar open-or-focus parity across initial open (`total=2`) and repeat focus (`total=3` with blank tab).
  - Initial Overview showed `2 Research Trees · 7 Visits` (`#overview-view` visible, `#detail-view` & `#zoom-controls` hidden). Opening main tree showed strictly `6` scoped SVG nodes; reopening closed `/child` increased storage to `8` visits / `3` Research Trees in Overview while keeping main Detail View isolated at `6` nodes.
  - Overview search (`'target'`) narrowed cards from `3` to `1`; opening Detail View + pressing `#back-to-overview-btn` restored `query === 'target'` and keyboard focus on `.tree-open-btn[data-tree-id]`.
  - Detail search (`'target'`) displayed `'2 of 6 matching (+2 context)'` (`2` `.map-node.is-search-match`, `2` `.map-node.is-context-ancestor`, `#detail-context-banner` visible). Aging Page 1 by 2 hours under `'hour'` filter rendered `'5 of 6 matching (+1 context)'` with Page 1 dimmed (`isMatch: false, isContext: true`), while `'all'` and `'day'` restored all `6` nodes.
  - Pointer pan, zoom in/out/fit, `Enter` node selection, Clear Map Tab/Shift+Tab focus trap, cancel preservation, and confirm reset to `0 visits` + `#empty-state`.
  - Step 6.5e live Explorer verification: Overview separated unattributed `dataset.zip` and `ambiguous.bin` into `#unattributed-section` (`Source unavailable`, zero tree cards); `/wiki` Detail View rendered Source A (`x=350, y=80`) and Source B (`x=350, y=182`) as parallel vertical siblings under Wikipedia (`x=80, y=131`); attributed `research_paper.pdf` rendered `Downloaded from localhost` (zero `127.0.0.1` leakage) and clicking it opened `#details-panel` with `#details-source: 'Downloaded from localhost'`, `#details-url-field.hidden === true`, and `#details-actions.hidden === true`.
  - Step 8c post-restart reconciliation: `12` stored nodes intact (`9` visits, `1` attributed download, `2` unattributed downloads), multi-node live tab collapsed to `[step3]`, Overview displayed `3 cards (3 Research Trees · 9 Visits)` and opening session tree card rendered `3` `.map-node`s.

### 4.2 Mozilla Firefox `158.0.1` (x64 Windows Marionette / WebDriver)
- **Full Log:** [`docs/test-results/firefox-e2e.log`](file:///D:/Projects/HCI%20Project/docs/test-results/firefox-e2e.log)
- **Error Audits:** [`docs/test-results/firefox-errors-pre-restart.json`](file:///D:/Projects/HCI%20Project/docs/test-results/firefox-errors-pre-restart.json) (5 Gecko records: **0 errors, 0 warnings, 0 info**) · [`docs/test-results/firefox-errors-post-restart.json`](file:///D:/Projects/HCI%20Project/docs/test-results/firefox-errors-post-restart.json) (24 Gecko records: **0 errors, 0 warnings, 0 info**)
- **Verified Runtime Flow:** Exact cross-browser parity across every Step 1–10 scenario via genuine WebDriver pointer clicks, W3C wheel zoom, `ElementSendKeys`, native `<option>` clicks, Back-to-Overview focus/query restoration, sibling SVG layout geometry (`x=80` parent vs `x=350` siblings), distinct-host download provenance drawer (`Downloaded from localhost`, hidden URL/Reopen), Unattributed Downloads shelf (`Source unavailable`), and post-restart SQLite graph + single-node baseline UI reconciliation (`0` failures).

---

## 5. Task 10 v15 Acceptance Alignment

- **Tree Card Separation & Grouping:** Verified (3 independent roots $\to$ 3 cards; multi-tab product siblings & Back-to-parent branches $\to$ 1 card each; live E2E checks in both browsers).
- **Detail Scoping & Hierarchy Preservation:** Verified (strict single-`treeId` canvas isolation; global/local filtering retains `.is-context-ancestor` parents with `#detail-context-banner`).
- **Downloads & Privacy Boundaries:** Verified (attributed downloads attach cleanly and show `"Downloaded from <originDomain>"` with URL/reopen disabled; unattributed/ambiguous downloads stay in `#unattributed-section` labeled `"Source unavailable"`).
- **Accessibility & UX Polish:** Verified (WCAG AA tokens, keyboard navigation & focus restoration on `#back-to-overview-btn`, modal Tab/Shift+Tab trap, `<= 900px` responsive stacking, `prefers-reduced-motion`).
