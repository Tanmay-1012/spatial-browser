# Task 14 Output — Minimum-Supported Browser Compatibility Audit

**Status:** Accepted with one open evidence limitation (branded Chrome 109 stable remains unverified; see Section 9).
**Milestone:** 14 (Compatibility Floor: Chrome `109+`, Firefox `115.0+`)  
**Prerequisite:** Task 13 accepted in Section 7 of [`task output overview/task-13-output.md`](task-13-output.md#7-lead-review--task-13-accepted-task-14-assigned-2026-11-13)  
**Declared Minimum Compatibility Floors:** Google Chrome `109+` (`minimum_chrome_version: "109"` in [`src/chrome/manifest.json`](../src/chrome/manifest.json)) & Mozilla Firefox `115.0+` (`strict_min_version: "115.0"` in [`src/firefox/manifest.json`](../src/firefox/manifest.json))  
**Tested Environments:** Unbranded Chromium snapshot `109.0.5414.0` (x64 Windows; engine proxy only, not Google Chrome stable) & Mozilla Firefox `115.0` ESR (x64 Windows; Marionette protocol `3`)
**Comparison Latest Environments:** Google Chrome `157.0.8103.78` (x64 Windows) & Mozilla Firefox `160.0` (x64 Windows)  
**Execution Date:** 2026-11-14  

---

## 1. Executive Summary & Compatibility Matrix

Task 14 provides live minimum-version evidence for Firefox `115.0` ESR and engine-level proxy evidence from an unbranded Chromium `109.0.5414.0` snapshot. The Chromium run passed, but it is not a branded Google Chrome 109 stable build. Therefore the exact Google Chrome 109 runtime floor remains unverified; the Chromium run must not be presented as proof of the branded Chrome floor. Current Chrome `157.0.8103.78` and Firefox `160.0` runtime checks remain separate evidence.

Both code paths were audited, and the tested browser environments used isolated temporary profiles without reusing personal browsing data. The exact branded Chrome 109 environment was not available:
1. **Source & API Inspection:** Static review found no obvious use of APIs, syntax, or platform features newer than the declared Chrome 109 and Firefox 115.0 floors. This source review does not replace a branded Chrome 109 runtime run.
2. **Chromium Engine-Proxy Runtime Verification (`109.0.5414.0`):** Executed the complete 10-step isolated E2E suite against fresh unpacked packages. The unbranded Chromium snapshot passed toolbar open-or-focus, browsing topology, search/filter restoration, distinct-host download provenance, narrow-map reflow, and `12 -> 12` restart persistence with **0 failures, 0 extension errors, and 0 extension warnings**. This is useful upstream-engine evidence, but does not close the Google Chrome 109 stable verification requirement.
3. **Floor Runtime Verification on Mozilla Firefox `115.0` ESR:** Executed the complete 10-step isolated E2E suite using Marionette. Handled the Firefox 115 Unified Extensions inner button architecture (`#spatial-browser-history_term-project_local-BAP`). Verified all navigation scenarios, download provenance, narrow-viewport reflow, and clean `12 -> 12` restart persistence with **0 failures, 0 errors, and 0 warnings**.
4. **Observed Behavior:** The tested Chromium snapshot, Firefox floor, and latest browser builds produced matching results for the exercised scenarios. This observation does not establish branded Google Chrome 109 behavior. No changes to declared browser floors, storage schemas, permissions, or privacy boundaries were made.
5. **Release Constraints:** No external release has been tagged, published, pushed, or distributed. The Chrome 109 evidence gap is carried into Task 15.

### 1.1 Compatibility Matrix

The `Chromium 109` column is an **unbranded upstream-engine proxy**, not a Google Chrome 109 stable installation. Matrix results describe only the binaries actually exercised. The exact branded Chrome 109 runtime remains open and is tracked by Task 15.

| Capability / Acceptance Criteria | Declared Floor Specification | Chromium 109.0.5414.0 (Engine Proxy) | Firefox 115.0 ESR (Floor) | Chrome 157.0.8103.78 (Latest) | Firefox 160.0 (Latest) | Parity among tested binaries |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **MV3 Manifest & Unpacked Installation** | Chrome MV3 (SW), Firefox MV3 (Event Page) | **PASS** (`--load-extension`) | **PASS** (`Addon:Install`) | **PASS** (`Extensions.loadUnpacked`) | **PASS** (`Addon:Install`) | **Exact Parity** |
| **Single-Tab Action Open-or-Focus** | Single-tab focus, no duplicate map tabs | **PASS** (MSAA + Focus) | **PASS** (BAP click + Focus) | **PASS** (UIA + Focus) | **PASS** (BAP click + Focus) | **Exact Parity** |
| **Same-Tab & Opener Navigation Capture** | Linear same-tab edges, opener child links | **PASS** (7/7 visits) | **PASS** (7/7 visits) | **PASS** (7/7 visits) | **PASS** (7/7 visits) | **Exact Parity** |
| **Unknown/Closed Opener Safe Fallback** | Unlinked openers fall back to root checkpoint | **PASS** (`parentNodeId: null`) | **PASS** (`parentNodeId: null`) | **PASS** (`parentNodeId: null`) | **PASS** (`parentNodeId: null`) | **Exact Parity** |
| **Reload Deduplication & Dynamic Metadata** | In-place title/hash updates, reload deduplication | **PASS** (1 node /target) | **PASS** (1 node /target) | **PASS** (1 node /target) | **PASS** (1 node /target) | **Exact Parity** |
| **Sibling Branching (History Traversal)** | Back/Forward traversal branches siblings | **PASS** (Source A & B siblings) | **PASS** (Source A & B siblings) | **PASS** (Source A & B siblings) | **PASS** (Source A & B siblings) | **Exact Parity** |
| **Distinct-Host Download Provenance** | Attribution derived strictly from source page | **PASS** (localhost attributed) | **PASS** (localhost attributed) | **PASS** (localhost attributed) | **PASS** (localhost attributed) | **Exact Parity** |
| **Unattributed / Ambiguous Download Fallback** | Unattributed/ambiguous fall back safely | **PASS** (`Source unavailable`) | **PASS** (`Source unavailable`) | **PASS** (`Source unavailable`) | **PASS** (`Source unavailable`) | **Exact Parity** |
| **Research Tree Explorer UI (Overview & Detail)** | Strict tree isolation, separate download shelf | **PASS** (Cards, Detail, Shelf) | **PASS** (Cards, Detail, Shelf) | **PASS** (Cards, Detail, Shelf) | **PASS** (Cards, Detail, Shelf) | **Exact Parity** |
| **Keyboard Input & Focus Trapping** | Native key navigation, modal focus trap | **PASS** (Real CDP keys) | **PASS** (Real Marionette keys) | **PASS** (Real CDP keys) | **PASS** (Real Marionette keys) | **Exact Parity** |
| **Narrow Responsive Viewport Reflow** | Zero overflow, title height $\ge 10\text{px}$, Fit view | **PASS** ($420\times 800$, $17.6\text{px}$) | **PASS** ($450\times 800$, $17.6\text{px}$) | **PASS** ($420\times 800$, $17.6\text{px}$) | **PASS** ($500\times 800$, $20.4\text{px}$) | **Exact Parity** |
| **Session Restart Persistence** | Multi-node stacks collapse; graph intact | **PASS** ($12 \rightarrow 12$ nodes) | **PASS** ($12 \rightarrow 12$ nodes) | **PASS** ($12 \rightarrow 12$ nodes) | **PASS** ($12 \rightarrow 12$ nodes) | **Exact Parity** |
| **Console Error & Warning Telemetry** | Zero extension errors, zero warnings | **PASS** ($0\text{E} / 0\text{W}$) | **PASS** ($0\text{E} / 0\text{W}$) | **PASS** ($0\text{E} / 0\text{W}$) | **PASS** ($0\text{E} / 0\text{W}$) | **Exact Parity** |

---

## 2. Codebase API & Manifest Compatibility Audit

A systematic source-code audit was conducted to verify every manifest property, API call, syntax feature, and UI mechanism against the Chrome 109 and Firefox 115.0 baselines:

### 2.1 Manifest Configuration & Platform Specifications
- **Google Chrome Manifest ([`src/chrome/manifest.json`](../src/chrome/manifest.json)):**
  - `manifest_version: 3`: Fully supported in Chrome 109 (MV3 was stable in Chrome 88+).
  - `minimum_chrome_version: "109"`: Explicitly declared.
  - `background.service_worker: "background.js"`: Service workers for MV3 supported in Chrome 88+.
  - `permissions: ["storage", "tabs", "webNavigation", "downloads"]`: All 4 permissions supported in Chrome 31+.
  - `action`: Supported in Chrome 88+.
- **Mozilla Firefox Manifest ([`src/firefox/manifest.json`](../src/firefox/manifest.json)):**
  - `manifest_version: 3`: Supported in Firefox 109+.
  - `browser_specific_settings.gecko.strict_min_version: "115.0"`: Explicitly declared.
  - `background.scripts`: Background event pages in MV3 supported in Firefox 109+.
  - `browser_specific_settings.gecko.id: "spatial-browser-history@term-project.local"`: Standard extension ID format.
  - `permissions: ["storage", "tabs", "webNavigation", "downloads"]`: All supported in Firefox 55+.

### 2.2 Storage & Session Readiness Gateway
- **`chrome.storage.local` / `browser.storage.local`:** Supported across all Chrome and Firefox versions.
- **`chrome.storage.session` / `browser.storage.session`:**
  - Chrome added `storage.session` in Chrome 102.
  - Firefox added `browser.storage.session` in **Firefox 115.0** (making Firefox 115 ESR the exact minimum floor supporting session storage).
  - The implementation in [`src/shared/tracker.js`](../src/shared/tracker.js:230-285) gates startup through `ensureSessionReady()`, reading and writing `sessionInitialized` with exponential backoff retries (`[50, 100, 200]ms`).
  - If `storage.session` is absent or throws, `ensureSessionReady()` fails closed without writing invalid checkpoints.

### 2.3 Navigation & Download Listeners
- **`webNavigation.onCommitted`:** Supported in Chrome 16+, Firefox 55+. Evaluates `transitionQualifiers` (`"forward_back"`) and `transitionType` reliably.
- **`webNavigation.onHistoryStateUpdated` & `onReferenceFragmentUpdated`:** Supported in Chrome 16+, Firefox 55+.
- **`webNavigation.onCreatedNavigationTarget`:** Supported in Chrome 16+, Firefox 55+. Resolves opener-tab relationships before tab creation.
- **`downloads.onCreated` & `downloads.onChanged`:** Supported in Chrome 31+, Firefox 47+. Intercepts `downloadDelta.state.current === "complete"` and resolves source page domain without requesting the sensitive `<all_urls>` permission.

### 2.4 UI, SVG, CSS, and DOM APIs
- **HTML `<dialog>` element:** Native support added in Chrome 37 and Firefox 98. Modal methods `showModal()` and `close()` are fully functional on both Chrome 109 and Firefox 115.
- **SVG rendering:** Standard elements (`<svg>`, `<g>`, `<rect>`, `<path>`, `<text>`, `<title>`) and DOM methods (`createElementNS`, `getBBox`, `getBoundingClientRect`) are supported across all tested platforms.
- **CSS Grid & Flexbox:** Fully supported in Chrome 57+, Firefox 52+.
- **CSS Custom Properties & `prefers-reduced-motion`:** Supported in Chrome 74+, Firefox 63+.
- **No Incompatible Syntax:** All code is written in standard ES2020 (arrow functions, `async`/`await`, optional chaining `?.`, nullish coalescing `??`, `Set`, `Map`). Supported natively in V8 8.0+ (Chrome 80+) and SpiderMonkey 78+ (Firefox 78+).

---

## 3. Chromium 109 Snapshot Runtime Results (Engine Proxy; Chrome Stable Not Run)

### 3.1 Test Environment & Execution Details
- **Browser Binary:** Chromium `109.0.5414.0` (x64 Windows standalone build; Git commit snapshot).
- **Architecture:** Windows 10/11 x64, V8 JavaScript engine `10.9.194`, DevTools Protocol `1.3`.
- **Harness & Profile:** Isolated temporary user-data directory (`test-chrome-109-*`), remote debugging port, clean process termination.
- **Harness Execution Command:**
  ```powershell
  $env:CHROME_BINARY = "C:\Users\tanma\.gemini\antigravity\brain\d4f1498c-651c-415e-8b90-130f9ddafa66\scratch\chromium-109\chrome-win\chrome.exe"
  $env:CHROME_LOG_PATH = "D:\Projects\HCI Project\docs\test-results\chrome-109-e2e.log"
  $env:CHROME_PRE_ERRORS_PATH = "D:\Projects\HCI Project\docs\test-results\chrome-109-errors-pre-restart.json"
  $env:CHROME_POST_ERRORS_PATH = "D:\Projects\HCI Project\docs\test-results\chrome-109-errors-post-restart.json"
  $env:CHROME_SCREENSHOT_PREFIX = "chrome-109"
  python.exe scripts/e2e-chrome-verification.py
  ```

### 3.2 Snapshot-Specific Architecture Findings & Harness Enhancements
1. **Unpacked Extension Loading via CLI (`--load-extension`):**
   - *Discovery:* The unbranded Chromium `109.0.5414.0` snapshot does not expose CDP `Extensions.loadUnpacked`; invoking it returns error `-32601` (`Method not found`).
   - *Enhancement:* Updated [`scripts/e2e-chrome-verification.py`](../scripts/e2e-chrome-verification.py:716) to launch Chrome with `--load-extension={EXT_DIR}` and `--disable-extensions-except={EXT_DIR}`, discovering the extension ID from the registered service worker target and falling back to `Extensions.loadUnpacked` on Chrome 116+.
2. **Toolbar Action Accessibility via MSAA (`IAccessible`):**
   - *Discovery:* This Chromium snapshot's Views implementation did not expose the UIAutomation (`IRawElementProviderSimple`) provider interface; UIA queries for `ToolbarActionView` found no elements.
   - *Enhancement:* Updated [`scripts/e2e-chrome-verification.py`](../scripts/e2e-chrome-verification.py:554-589) with a native MSAA fallback using `AccessibleObjectFromPoint`, scanning toolbar coordinates, verifying `accName` (`"Spatial Browser History"`), and invoking `accDoDefaultAction` (falling back to physical mouse clicks). Verified live on the unbranded Chromium snapshot.
3. **Session Restore Persistence on Relaunch:**
   - *Discovery:* Relaunching Chrome with a CLI URL argument races with service worker initialization.
   - *Enhancement:* Updated [`scripts/e2e-chrome-verification.py`](../scripts/e2e-chrome-verification.py:1918-1932) to perform a graceful browser shutdown via CDP `Browser.close` and relaunch with `--restore-last-session`. Restored live tabs commit deterministically and reconcile against existing stored graph nodes.

### 3.3 Verification Step Results & Metrics

```
============================================================================
ALL EXECUTED CHECKS PASSED FOR CHROMIUM 109 SNAPSHOT (UNBRANDED) 109.0.5414.0.
This unbranded snapshot run does not verify Google Chrome 109 stable.
============================================================================
```

- **Step 1 (Process Startup & Extension Load):** Chromium `109.0.5414.0` connected cleanly via CDP. Background service worker initialized, storage manager initialized, session readiness verified (`initialized: True, initializing: False`).
- **Step 2 (Toolbar Action & Single-Tab Focus):** First click opened `chrome-extension://.../index.html` (total pages: 1 $\rightarrow$ 2). Switched focus to blank tab; second click focused existing map tab without duplicate creation.
- **Step 3 (Browsing Topology & Deduplication):**
  - Page 1 recorded as root checkpoint (`parentNodeId: null`).
  - Page 2 recorded as child of Page 1.
  - Redirect `/redirect -> /target` recorded `/target` as child of Page 2.
  - Target reload deduplicated: exactly 1 node stored for `/target`.
  - Dynamic `document.title` and hash `#section1` updated in place.
  - SPA pushState (`/target/spa-route`) attached as child.
  - Opener child `/child` attached to `/opener`.
  - Unknown/closed opener recorded safely as independent root checkpoint.
  - Pre-reopen visit audit: 7 visits across 2 trees.
- **Step 4 (Closed Child Reopen):** Child node selected and reopened in new tab. Visit count explicitly increased to 8 visits across 3 trees while Detail View remained strictly scoped to 6 nodes.
- **Step 5 (Search & Filter Restoration):**
  - Overview search `"target"`: filtered to 1 matching tree card.
  - Detail search `"target"`: 2 matches with 2 non-distorting context ancestors.
  - Search clear: restored full 6-node view and badge.
  - Time filter: non-matching Page 1 dimmed while maintaining hierarchy.
- **Step 6 (Interactive Keyboard Navigation & Focus Trapping):**
  - Arrow keys (ArrowRight/ArrowDown) panned map viewport; zoom in/out/fit verified.
  - Node selection via Enter and Space keys opened `#details-panel`.
  - Clear Map dialog focus trap: Tab wrapped focus to `"confirm-clear-btn"`, Shift+Tab wrapped to `"cancel-clear-btn"`.
  - Cancel preserved data; Confirm cleared storage and reset map to 0 visits.
- **Step 6.5 (Task 11 Sibling Branching & Distinct-Host Provenance):**
  - Sibling branching: Wikipedia $\rightarrow$ Source A $\rightarrow$ Back $\rightarrow$ Source B created Source A and Source B as parallel siblings under Wikipedia in `tree_node_1794656256037_0tvfm7`.
  - Distinct-host download provenance: `research_paper.pdf` downloaded from `127.0.0.1:55814` CDN portal attributed strictly to source page hostname (`localhost:55813`), with CDN URL and file paths omitted.
  - Unattributed download (`dataset.zip`) recorded safely as root checkpoint labeled `"Source unavailable"`.
  - Ambiguous referrer download (`ambiguous.bin` matching 2 pages) fell back safely to root checkpoint labeled `"Source unavailable"`.
  - UI Explorer verification: Tree cards, unattributed shelf, sibling layout, and download provenance drawer verified.
- **Step 6.5f (Responsive Layout & Legibility Checks):**
  - Desktop Viewport (`1280x800`): Zero horizontal overflow (`scrollWidth = 1280`).
  - Narrow Viewport (`420x800`): Zero horizontal overflow (`scrollWidth = 420`), Fit view scale `1.05`, effective title font size `13.7px`, rendered title height `17.6px` across all 6 nodes (exceeding 10px minimum). Map drawer toggle verified.
- **Step 7 (Pre-Restart Error Audit):**
  - Evaluated 238 CDP event records prior to restart.
  - Extension Errors: **0**, Warnings: **0** ([`docs/test-results/chrome-109-errors-pre-restart.json`](../docs/test-results/chrome-109-errors-pre-restart.json)).
- **Step 8 (Service Worker Suspension & Browser Restart Persistence):**
  - 3-step linear navigation in live tab (`/restart-step1 -> /restart-step2 -> /restart-step3`). Pre-restart stored node count: **12**.
  - Service worker suspended via `Target.closeTarget` and re-awakened on demand: 12 nodes intact.
  - Browser process cleanly terminated via `Browser.close` and relaunched with `--restore-last-session`.
  - Post-restart stored node count: **12** (clean $12 \rightarrow 12$ persistence). Live tab collapsed to single-node baseline `[step3]` (`baselineEstablished: True`).
  - UI reconciliation: 3 Overview cards (9 visits), Detail View scoped to 3 nodes.
- **Step 9 (Post-Restart Error Audit):**
  - Evaluated 16 CDP event records in restarted session.
  - Extension Errors: **0**, Warnings: **0** ([`docs/test-results/chrome-109-errors-post-restart.json`](../docs/test-results/chrome-109-errors-post-restart.json)).

---

## 4. Mozilla Firefox 115.0 ESR Floor Live Runtime Verification Results

### 4.1 Test Environment & Execution Details
- **Browser Binary:** Mozilla Firefox `115.0` ESR (x64 Windows standalone build; official release binary).
- **Architecture:** Windows 10/11 x64, Gecko rendering engine, Marionette protocol `3`.
- **Harness & Profile:** Isolated temporary profile directory (`test-firefox-115-*`), dynamic Marionette port, clean process-tree termination (`terminate_firefox_tree`).
- **Harness Execution Command:**
  ```powershell
  $env:FIREFOX_BINARY = "C:\Users\tanma\.gemini\antigravity\brain\d4f1498c-651c-415e-8b90-130f9ddafa66\scratch\firefox-115\core\firefox.exe"
  $env:FIREFOX_LOG_PATH = "D:\Projects\HCI Project\docs\test-results\firefox-115-e2e.log"
  $env:FIREFOX_PRE_ERRORS_PATH = "D:\Projects\HCI Project\docs\test-results\firefox-115-errors-pre-restart.json"
  $env:FIREFOX_POST_ERRORS_PATH = "D:\Projects\HCI Project\docs\test-results\firefox-115-errors-post-restart.json"
  $env:FIREFOX_SCREENSHOT_PREFIX = "firefox-115"
  python.exe scripts/e2e-firefox-verification.py
  ```

### 4.2 Floor-Specific Architecture Findings
1. **Unified Extensions Toolbar Structure:**
   - In Firefox 115 (the first ESR release featuring the Unified Extensions button), toolbar actions added via `CustomizableUI.addWidgetToArea` produce a wrapper `toolbaritem` (`spatial-browser-history_term-project_local-browser-action`) containing an inner `toolbarbutton` (`#spatial-browser-history_term-project_local-BAP`).
   - The harness targets `#spatial-browser-history_term-project_local-BAP` for `WebDriver:ElementClick`, ensuring reliable toolbar clicks across both Firefox 115 and Firefox 160.
2. **`browser.storage.session` Baseline:**
   - Firefox 115 is the earliest Firefox version to implement `browser.storage.session`. The extension's session readiness barrier initialized immediately without falling back to local storage simulation.
3. **Narrow Viewport Window Sizing:**
   - When requesting a narrow viewport of `420x800`, Firefox 115's native chrome minimum window size constraints produce an actual measured inner viewport of `450x800` (compared to `500x800` in Firefox 160).
   - In this `450x800` viewport, the reflow layout maintained zero horizontal overflow (`scrollWidth = 450`), `fitScale = 1.05`, and rendered title height of `17.6px`, satisfying all readability requirements.

### 4.3 Verification Step Results & Metrics

```
============================================================================
ALL EXECUTED MOZILLA FIREFOX 115.0 INTERACTIVE CHECKS PASSED (0 FAILURES)
============================================================================
```

- **Step 1 (Installation & Toolbar Setup):** Unpacked extension installed via Marionette `Addon:Install` (Addon ID: `spatial-browser-history@term-project.local`). Pinned to `nav-bar`.
- **Step 2 (Toolbar Action & Single-Tab Focus):** First click opened extension map (`moz-extension://.../index.html`; total tabs: 1 $\rightarrow$ 2). Switched focus to `about:home`; second click focused existing map tab without duplicate creation.
- **Step 3 (Browsing Topology & Deduplication):** Full parity across Page 1, Page 2, `/redirect -> /target`, reload deduplication (1 node), title update, anchor fragment, SPA pushState, opener child `/child`, and unknown opener fallback. Pre-reopen visit audit: 7 visits across 2 trees.
- **Step 4 (Closed Child Reopen):** Child node selected via browser click and reopened in new tab. Visit count explicitly increased to 8 visits across 3 trees while Detail View remained scoped to 6 nodes.
- **Step 5 (Search & Filter Restoration):** Overview card filtering, Detail match count (`2 of 6 matching (+2 context)`), non-distorting ancestor dimming, and search clearing verified.
- **Step 6 (Interactive Keyboard Navigation & Focus Trapping):** WebDriver keyboard actions (Arrow keys pan, zoom, node selection Enter/Space, Clear Modal Tab/Shift+Tab focus wrap) verified.
- **Step 6.5 (Task 11 Sibling Branching & Distinct-Host Provenance):**
  - Wikipedia $\rightarrow$ Source A $\rightarrow$ Back $\rightarrow$ Source B produced Source A and Source B as parallel siblings under Wikipedia.
  - Distinct-host download from `127.0.0.1:50414` CDN attributed strictly to source page hostname (`localhost:50413`).
  - Missing and ambiguous referrer downloads fell back safely to root checkpoints labeled `"Source unavailable"`.
- **Step 6.5f (Responsive Layout Checks):**
  - Desktop Viewport (`1280x800`): Zero horizontal overflow.
  - Narrow Viewport (`450x800` measured): Zero horizontal overflow, Fit view scale `1.05`, effective title font size `13.7px`, rendered title height `17.6px` across all 6 nodes.
- **Step 7 (Pre-Restart Error Audit):**
  - Evaluated 13 Gecko console records prior to restart.
  - Extension Errors: **0**, Warnings: **0** ([`docs/test-results/firefox-115-errors-pre-restart.json`](../docs/test-results/firefox-115-errors-pre-restart.json)).
- **Step 8 (Browser Restart Persistence):**
  - 3-step navigation in live tab (`/restart-step1 -> /restart-step2 -> /restart-step3`). Pre-restart stored node count in SQLite: **12**.
  - Process terminated cleanly via `terminate_firefox_tree` and relaunched with persistent profile and live tab.
  - Post-restart stored node count: **12** (clean $12 \rightarrow 12$ persistence). Live tab collapsed to single-node baseline `[step3]` (`baselineEstablished: True`).
  - Overview reconciled to 3 cards (9 visits), Detail View scoped to 3 nodes.
- **Step 9 (Post-Restart Error Audit):**
  - Evaluated 25 Gecko console records in restarted session.
  - Extension Errors: **0**, Warnings: **0** ([`docs/test-results/firefox-115-errors-post-restart.json`](../docs/test-results/firefox-115-errors-post-restart.json)).

---

## 5. Floor vs Latest Runtime Comparison & Architectural Discrepancies

Comparing the actually executed binaries shows matching behavior across the exercised scenarios. Chromium 109 is an unbranded engine proxy; this comparison does not verify Google Chrome 109 stable:

| Verification Dimension | Chromium 109 Snapshot (Proxy) | Google Chrome Latest (157.0) | Mozilla Firefox Floor (115.0 ESR) | Mozilla Firefox Latest (160.0) | Discrepancy & Evaluation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Extension Loading Mechanism** | CLI `--load-extension` flag | CDP `Extensions.loadUnpacked` | Marionette `Addon:Install` | Marionette `Addon:Install` | *Harness difference only.* Extension behaves identically once loaded. |
| **Toolbar Accessibility API** | MSAA (`IAccessible`) | UIAutomation (`IUIAutomation`) | Gecko DOM accessibility | Gecko DOM accessibility | *Runtime-specific harness difference.* The Chromium snapshot lacked UIA; this does not establish branded Chrome 109 behavior. |
| **Narrow Inner Viewport Width** | Exact requested `420px` | Exact requested `420px` | `450px` (min OS chrome constraint) | `500px` (min OS chrome constraint) | *Browser chrome constraint.* In both versions, reflow layout adapts with zero clipping. |
| **Narrow Title Height** | `17.6px` (scale: 1.05) | `17.6px` (scale: 1.05) | `17.6px` (scale: 1.05) | `20.4px` (scale: 1.05) | *Observed parity in tested binaries.* All exceed the $\ge 10\text{px}$ readability floor. |
| **Session Readiness Latency** | $< 50\text{ms}$ (`storage.session`) | $< 50\text{ms}$ (`storage.session`) | $< 50\text{ms}$ (`storage.session`) | $< 50\text{ms}$ (`storage.session`) | *Exact parity.* Session barrier resolves on first attempt. |
| **Restart Node Count** | $12 \rightarrow 12$ nodes | $12 \rightarrow 12$ nodes | $12 \rightarrow 12$ nodes | $12 \rightarrow 12$ nodes | *Exact parity.* Zero unexpected nodes or baseline leaks across restart. |
| **Console Errors / Warnings** | 0 errors, 0 warnings | 0 errors, 0 warnings | 0 errors, 0 warnings | 0 errors, 0 warnings | *Exact parity.* Clean console telemetry across all phases. |

---

## 6. Generated Floor Artifacts & Evidence Files

All live test logs, error telemetry JSONs, and responsive screenshots have been generated and persisted in [`docs/test-results/`](../docs/test-results/):

### 6.1 Chromium 109 Engine-Proxy Artifacts
- **Execution Log:** [`docs/test-results/chrome-109-e2e.log`](../docs/test-results/chrome-109-e2e.log) (Complete 10-step Chromium snapshot run; 0 failures; not branded Chrome 109 stable)
- **Pre-Restart Error Audit:** [`docs/test-results/chrome-109-errors-pre-restart.json`](../docs/test-results/chrome-109-errors-pre-restart.json) (238 events; 0 errors, 0 warnings)
- **Post-Restart Error Audit:** [`docs/test-results/chrome-109-errors-post-restart.json`](../docs/test-results/chrome-109-errors-post-restart.json) (16 events; 0 errors, 0 warnings)
- **Desktop Overview Screenshot (1280x800):** [`docs/test-results/chrome-109-overview-desktop.png`](../docs/test-results/chrome-109-overview-desktop.png)
- **Narrow Overview Screenshot (420x800):** [`docs/test-results/chrome-109-overview-narrow.png`](../docs/test-results/chrome-109-overview-narrow.png)
- **Desktop Detail Screenshot (1280x800):** [`docs/test-results/chrome-109-detail-desktop.png`](../docs/test-results/chrome-109-detail-desktop.png)
- **Narrow Detail Screenshot (420x800, Drawer Open):** [`docs/test-results/chrome-109-detail-narrow.png`](../docs/test-results/chrome-109-detail-narrow.png)
- **Narrow Detail Screenshot (420x800, Drawer Closed, Map Visible):** [`docs/test-results/chrome-109-detail-narrow-map.png`](../docs/test-results/chrome-109-detail-narrow-map.png)

### 6.2 Mozilla Firefox 115.0 ESR Floor Artifacts
- **Execution Log:** [`docs/test-results/firefox-115-e2e.log`](../docs/test-results/firefox-115-e2e.log) (Complete 10-step log; 0 failures)
- **Pre-Restart Error Audit:** [`docs/test-results/firefox-115-errors-pre-restart.json`](../docs/test-results/firefox-115-errors-pre-restart.json) (13 events; 0 errors, 0 warnings)
- **Post-Restart Error Audit:** [`docs/test-results/firefox-115-errors-post-restart.json`](../docs/test-results/firefox-115-errors-post-restart.json) (25 events; 0 errors, 0 warnings)
- **Desktop Overview Screenshot (1280x800):** [`docs/test-results/firefox-115-overview-desktop.png`](../docs/test-results/firefox-115-overview-desktop.png)
- **Narrow Overview Screenshot (450x800):** [`docs/test-results/firefox-115-overview-narrow.png`](../docs/test-results/firefox-115-overview-narrow.png)
- **Desktop Detail Screenshot (1280x800):** [`docs/test-results/firefox-115-detail-desktop.png`](../docs/test-results/firefox-115-detail-desktop.png)
- **Narrow Detail Screenshot (450x800, Drawer Open):** [`docs/test-results/firefox-115-detail-narrow.png`](../docs/test-results/firefox-115-detail-narrow.png)
- **Narrow Detail Screenshot (450x800, Drawer Closed, Map Visible):** [`docs/test-results/firefox-115-detail-narrow-map.png`](../docs/test-results/firefox-115-detail-narrow-map.png)

---

## 7. Documentation & Test Plan Alignment

At developer submission, the following documentation files described runtime checks for both declared floors. Section 9 corrects the Chrome wording: Chromium 109 is proxy evidence, and branded Chrome 109 stable remains open.
- **[`README.md`](../README.md):** Updated project status and compatibility tables with the Chromium `109.0.5414.0` snapshot and Firefox `115.0` ESR runs alongside Chrome `157.0` and Firefox `160.0`.
- **[`docs/TEST_PLAN.md`](../docs/TEST_PLAN.md):** Added dedicated subsections for Chrome 109 and Firefox 115 floor verification runs, documenting exact version numbers, test metrics, and artifact links.
- **[`task output overview/README.md`](README.md):** Updated Task 14 row to `"Completed (submitted for lead review)"`.
- **[`task output overview/tasks/README.md`](tasks/README.md):** Updated Task 14 listing to `"Completed (submitted for lead review)"`.
- **[`task output overview/tasks/task-14.md`](tasks/task-14.md):** Status updated to `"Completed — submitted for lead review."`

---

## 8. Developer Submission Checklist (Historical; Corrected by Section 9)

The developer submitted the following checklist. The exact Chrome stable floor item was not satisfied and is corrected in Section 9:
- [x] Inspected compatibility-sensitive code across manifests, background startup, storage, listeners, actions, and UI logic for APIs newer than declared floors.
- [x] Downloaded and executed live checks using an unbranded Chromium `109.0.5414.0` snapshot and Mozilla Firefox `115.0` ESR in isolated temporary profiles without touching personal user data.
- [x] Verified startup, toolbar open-or-focus, same-tab and opener navigation, tree overview/detail UI, download provenance, unattributed fallback, keyboard focus restoration, narrow responsive reflow, and restart persistence ($12 \rightarrow 12$).
- [x] Captured the exact tested binary versions, OS environment, test outcomes, logs, and pre/post restart error audits (0 extension errors and warnings in tested binaries).
- [x] Generated and verified all 10 responsive screenshots (5 Chromium snapshot, 5 Firefox 115) with zero clipping and legible node labels ($\ge 10\text{px}$).
- [x] Automated test suite passes completely (**61 passed, 0 failed**).
- [x] Clean packages rebuilt with byte-level parity and matching `SHA256SUMS`.
- [x] No changes made to storage schema, permissions, privacy rules, or declared browser floors.
- [x] No release was tagged, pushed, published, or distributed.
- [ ] Branded Google Chrome 109 stable runtime: **not run**. The closest tested binary is an unbranded Chromium 109 snapshot. Task 15 must obtain the branded build or document why it cannot be tested; until then, Chrome 109 floor support remains unverified.

## 9. Lead Review — Task 14 Accepted with Chrome Evidence Limitation; Task 15 Assigned (2026-11-14)

### Independent verification and correction

- Rebuilt Chrome and Firefox packages successfully and reran `npm.cmd test`: **61 passed, 0 failed**. Verified the package checksums against the generated archives.
- Reviewed both floor E2E logs and their evidence. Firefox `115.0` ESR is the exact declared Firefox floor; all 10 steps passed, restart persistence remained `12 -> 12`, and pre/post audits report zero extension errors and warnings.
- The Chrome 109 artifact is an **unbranded Chromium `109.0.5414.0` snapshot** from the Chromium project, not an installed Google Chrome 109 stable release. Its full 10-step run passed with `12 -> 12` persistence and zero extension errors/warnings, but it is only engine-proxy evidence. It does not prove behavior in branded Google Chrome 109 stable.
- Corrected the Chrome E2E harness and reran the suite so `chrome-109-e2e.log` names the unbranded Chromium snapshot and accurately reports `--load-extension` as the method used. A lead-review clarification was appended to the log stating that this proxy run does not verify Google Chrome 109 stable; the prior report and README overstated the result, and this section supersedes those statements. The final harness condition that emits this note for Chromium labels was syntax-checked; it changes reporting only.
- Reviewed the Chromium 109 and Firefox 115 narrow-map screenshots; both show readable node labels, clear sibling structure, and no horizontal overflow at their measured viewports.

### Decision

**Task 14 is accepted with an explicit open limitation.** The Firefox 115 floor is verified. The Chromium snapshot is documented as proxy evidence only, and the declared Google Chrome 109 floor remains unverified until branded Chrome 109 stable is tested. This matches Task 14's acceptance path for an unavailable exact browser, with the remaining evidence tracked in [`tasks/task-15.md`](tasks/task-15.md). No support-version declarations were changed, and no release was published or pushed.
