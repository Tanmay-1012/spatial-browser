# Spatial Browser History — Release Notes v0.1.0

**Release Version:** `0.1.0`  
**Date:** 2026-11-12  
**Manifest Format:** Manifest V3 (Cross-browser for Google Chrome & Mozilla Firefox)  
**License:** Private / Academic Project  

---

## 1. Supported Browser Versions

| Browser | Minimum Version Declared | Runtime Verification Target | Status |
| :--- | :--- | :--- | :--- |
| **Google Chrome** | **109.0+** (`minimum_chrome_version: "109"`) | Chrome `157.0.8103.78` (`main`; `156.0.8078.48` at `v0.1.0` tag) | **Verified (0 errors, 0 warnings)** |
| **Mozilla Firefox** | **115.0+** (`strict_min_version: "115.0"`) | Firefox `160.0` (`main`; `158.0.1` at `v0.1.0` tag) | **Verified (0 errors, 0 warnings)** |

---

## 2. Release Deliverables & SHA-256 Checksums

All distribution packages are generated deterministically with zero external dependencies and verified byte-for-byte against their unpacked source directories. Checksums are written to `outputs/SHA256SUMS` on build and published alongside GitHub Release assets.

| Deliverable | Path | Size | SHA-256 Hash |
| :--- | :--- | :--- | :--- |
| **Chrome Release Archive** | `outputs/chrome/spatial-browser-history-extension.zip` | Build output | See `outputs/SHA256SUMS` |
| **Firefox Release Archive** | `outputs/firefox/spatial-browser-history-firefox.zip` | Build output | See `outputs/SHA256SUMS` |
| **Firefox Add-on Package** | `outputs/firefox/spatial-browser-history-firefox.xpi` | Build output | See `outputs/SHA256SUMS` |
| **Chrome Unpacked Build** | `outputs/chrome/unpacked/` | Directory | Matches zip contents byte-for-byte |
| **Firefox Unpacked Build** | `outputs/firefox/unpacked/` | Directory | Matches zip/xpi contents byte-for-byte |

---

## 3. Installation & Verification Instructions

### Google Chrome & Chromium Browsers

1. Build the distribution (optional if using prebuilt `outputs/`):
   ```bash
   node scripts/build.mjs
   ```
2. Open Chrome and navigate to `chrome://extensions`.
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. Click **Load unpacked** in the top-left toolbar.
5. In the file picker, select:
   `D:\Projects\HCI Project\outputs\chrome\unpacked`
   *(Alternatively, extract `outputs/chrome/spatial-browser-history-extension.zip` into a directory and select that folder).*
6. Confirm that **Spatial Browser History** appears in the extensions list with version `0.1.0` and no errors.
7. Click the toolbar action icon to launch the history map. Click it again from another tab to verify single-tab focus behavior.

---

### Mozilla Firefox

> [!IMPORTANT]
> **Firefox Unsigned Extension Limitation:**  
> Standard Release and Beta channels of Mozilla Firefox strictly enforce extension signature verification (`xpinstall.signatures.required = true`, which cannot be disabled via `about:config` in release builds). Attempting to install an unsigned `.xpi` via `about:addons` or drag-and-drop will produce a "This add-on could not be installed because it has not been verified" error.
> 
> For evaluation, grading, and development verification, Firefox provides the **Temporary Extensions** interface, which loads unsigned extensions without signature enforcement. For permanent unbranded deployment, Mozilla Firefox Developer Edition or Nightly can disable signature checks, or the extension can be submitted to Mozilla Add-ons (AMO) for signing.

#### Temporary Installation Steps (Standard Firefox):
1. Build the distribution (optional if using prebuilt `outputs/`):
   ```bash
   node scripts/build.mjs
   ```
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Under the **Temporary Extensions** section, click **Load Temporary Add-on...**.
4. In the file picker, choose any of the following:
   - The manifest file: `outputs/firefox/unpacked/manifest.json`
   - The `.xpi` package: `outputs/firefox/spatial-browser-history-firefox.xpi`
   - The `.zip` archive: `outputs/firefox/spatial-browser-history-firefox.zip`
5. Verify that **Spatial Browser History** is active under Temporary Extensions with ID `spatial-browser-history@term-project.local` and 0 errors.
6. Click the extension toolbar button to open the map. Switch tabs and click again to verify existing-tab refocusing.

---

## 4. Key Capabilities & Architectural Highlights

- **Single-Tab Toolbar Behavior:** Clicking the browser toolbar action opens `index.html` in a new tab if absent, or immediately focuses the existing tab and its containing window if already open, eliminating duplicate map tabs.
- **Robust Navigation Capture:**
  - Tracks top-level navigation, same-tab sequences, HTTP 302/301 redirects, and `history.pushState` SPA route updates.
  - De-duplicates reloads and updates node titles dynamically on `tabs.onUpdated`.
  - Links child tabs to opener tabs via `tab.openerTabId` and `webNavigation.onCreatedNavigationTarget`.
  - Safely falls back to root checkpoints (`parentNodeId: null`, `isCheckpoint: true`) when openers are closed or untracked (`about:blank`), preventing dangling pointers.
- **Interactive Spatial Map & Retrieval UI:**
  - Dynamic hierarchical forest layout with cubic bezier connectors and arrowheads.
  - Title and URL search with 150ms debounce and responsive matching count badge.
  - Granular time filters: All History, Past Hour, Past 24 Hours, and Past 7 Days.
  - Visit details drawer with ancestor/descendant jump pills.
  - Safe URL reopening: Strictly validates `http:` and `https:` schemes before creating tabs.
  - Full keyboard accessibility: Arrow keys pan, `+`/`-`/`0` zoom/fit, Tab/Enter navigates and activates nodes.
  - Accessible clear-map confirmation dialog with Tab/Shift+Tab focus trapping.
- **Local-First Storage, Schema V2 & Download Provenance (Milestone 11):**
  - Schema V2 stored entirely in `chrome.storage.local` / `browser.storage.local` with stable `treeId`, reciprocal parent/child links, download nodes, and `downloadNodeMap`.
  - Crash-safe V1 migration with raw backup `spatial_browser_history_data_v1_backup` and passive 24-hour expiration on wake.
  - Same-tab Back/Forward traversal branches subsequent navigations as siblings.
  - Startup barrier with `storage.session` marker gate and fail-closed storage protection.
  - Completed download capture via `downloads` permission, recording only non-sensitive basename, originating domain derived from unique source page/referrer ($|M|=1$), completion time, and deduplication index; missing or ambiguous referrers set to "Source unavailable".
  - Least-privilege permissions: Only `tabs`, `storage`, `webNavigation`, and `downloads` are requested. Zero content scripts, zero remote telemetry, zero `innerHTML`.

---

## 5. Verification Evidence & Test Reports

### Automated Test Suite
Run command: `npm test`  
Result: **61 passed, 0 failed** (Task 12 main branch; `v0.1.0` tagged at 55/55)
- Build, Manifest, CSP, Parity, and Archive Integrity: **12 tests passed**
- Navigation Tracker, Sibling Branching, Session Safety & Storage V2: **35 tests passed**
- Research Tree Explorer UI, Reflow Layout, Contrast, and Security: **14 tests passed**

### Cross-Browser End-to-End Test Records

**Task 11 & Task 12 verification status (2026-11-13):** Task 11 backend/provenance is accepted (Section 57). Task 12 narrow detail-map legibility & navigability are verified across 61 automated checks, Firefox `160.0` E2E, and Chrome `157.0.8103.78` isolated-profile E2E runs (`12 -> 12` restart persistence, narrow drawer-closed map captures with `scale = 1.05`, `effectiveTitleFontSize = 13.7px`, `renderedTitleHeight >= 10px`); submitted for lead acceptance in Section 11 of [`task output overview/task-12-output.md`](task%20output%20overview/task-12-output.md#11-developer-follow-up--narrow-detail-map-legibility--navigability-verification-2026-11-13).
Detailed test records and methodologies are documented in [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md).

- **Google Chrome `157.0.8103.78` (x64 Windows; declared floor `Chrome 109+`):**
  - Consecutive Full E2E Logs: [`docs/test-results/chrome-e2e-run1.log`](docs/test-results/chrome-e2e-run1.log) & [`docs/test-results/chrome-e2e.log`](docs/test-results/chrome-e2e.log) ([`chrome-e2e-run2.log`](docs/test-results/chrome-e2e-run2.log))
  - Run 1 Audits: [`chrome-errors-pre-restart-run1.json`](docs/test-results/chrome-errors-pre-restart-run1.json) (`266` CDP records: **0 errors, 0 warnings**), [`chrome-errors-post-restart-run1.json`](docs/test-results/chrome-errors-post-restart-run1.json) (`18` CDP records: **0 errors, 0 warnings**)
  - Run 2 Audits: [`docs/test-results/chrome-errors-pre-restart.json`](docs/test-results/chrome-errors-pre-restart.json) (`271` CDP records: **0 errors, 0 warnings**), [`docs/test-results/chrome-errors-post-restart.json`](docs/test-results/chrome-errors-post-restart.json) (`18` CDP records: **0 errors, 0 warnings**)
  - Responsive Viewport Captures (`1280x800` & `420x800`): [`chrome-overview-desktop.png`](docs/test-results/chrome-overview-desktop.png), [`chrome-overview-narrow.png`](docs/test-results/chrome-overview-narrow.png), [`chrome-detail-desktop.png`](docs/test-results/chrome-detail-desktop.png), [`chrome-detail-narrow.png`](docs/test-results/chrome-detail-narrow.png), [`chrome-detail-narrow-map.png`](docs/test-results/chrome-detail-narrow-map.png)
- **Mozilla Firefox `160.0` (x64 Windows; declared floor `Firefox 115.0+`):**
  - Full E2E Execution Log: [`docs/test-results/firefox-e2e.log`](docs/test-results/firefox-e2e.log)
  - Pre-Restart Console Audit: [`docs/test-results/firefox-errors-pre-restart.json`](docs/test-results/firefox-errors-pre-restart.json) — **0 errors, 0 warnings** (`6` Gecko records)
  - Post-Restart Console Audit: [`docs/test-results/firefox-errors-post-restart.json`](docs/test-results/firefox-errors-post-restart.json) — **0 errors, 0 warnings** (`24` Gecko records)
  - Responsive Viewport Captures (`1280x800` & `500x800` Windows min from `420x800` request): [`firefox-overview-desktop.png`](docs/test-results/firefox-overview-desktop.png), [`firefox-overview-narrow.png`](docs/test-results/firefox-overview-narrow.png), [`firefox-detail-desktop.png`](docs/test-results/firefox-detail-desktop.png), [`firefox-detail-narrow.png`](docs/test-results/firefox-detail-narrow.png), [`firefox-detail-narrow-map.png`](docs/test-results/firefox-detail-narrow-map.png)


