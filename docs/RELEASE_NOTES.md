# Spatial Browser History — Release Notes v2.1.0

**Release Version:** `2.1.0`  
**Date:** 2026-11-21  
**Manifest Format:** Manifest V3 (Cross-browser for Google Chrome & Mozilla Firefox)  
**License:** Private / Academic Project  

---

## 1. Supported Browser Versions

| Browser | Minimum Version Declared | Runtime Verification Target | Status |
| :--- | :--- | :--- | :--- |
| **Google Chrome** | **109.0+** (`minimum_chrome_version: "109"`) | Chrome `157.0.8103.80` | **Verified (0 errors, 0 warnings)** |
| **Mozilla Firefox** | **115.0+** (`strict_min_version: "115.0"`) | Firefox `160.0.1` (and `115.0` ESR) | **Verified (0 errors, 0 warnings)** |

---

## 2. Release Deliverables & SHA-256 Checksums

All distribution packages are generated deterministically with zero external dependencies and verified byte-for-byte against their unpacked source directories. Checksums are written to `outputs/SHA256SUMS` on build and published alongside GitHub Release assets.

| Deliverable | Path | Size | SHA-256 Hash |
| :--- | :--- | :--- | :--- |
| **Chrome Release Archive** | `outputs/chrome/spatial-browser-history-extension.zip` | 61,111 bytes | `28c32cffbf5be42e47615f8c612e6c9d88826daebdc663d506b0edaa577da8ea` |
| **Firefox Release Archive** | `outputs/firefox/spatial-browser-history-firefox.zip` | 61,073 bytes | `876071f2c4c3687d327abb614471387bc6b848baa0dd42b27ddc1330659f65f9` |
| **Firefox Add-on Package** | `outputs/firefox/spatial-browser-history-firefox.xpi` | 61,073 bytes | `876071f2c4c3687d327abb614471387bc6b848baa0dd42b27ddc1330659f65f9` |
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
6. Confirm that **Spatial Browser History** appears in the extensions list with version `2.1.0` and no errors.
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
- **Robust Navigation Capture & Branch-Aware Engine:**
  - Tracks top-level navigation, same-tab sequences, HTTP 302/301 redirects, and `history.pushState` SPA route updates.
  - Same-tab Back/Forward traversal branches subsequent navigations as siblings (`Wikipedia → Source A → Back → Source B`).
  - Symmetrical duplicate traversal invalidation severs cycles to clean root checkpoints.
  - Links child tabs to opener tabs via `tab.openerTabId` and `webNavigation.onCreatedNavigationTarget`.
  - Safely falls back to root checkpoints (`parentNodeId: null`, `isCheckpoint: true`) when openers are closed or untracked.
- **Visual Sibling Branching & Reflow Layout Engine (v2.1.0 Enhancement):**
  - Layout engine dynamically renders true sibling fan geometry in the detail view: siblings share the same horizontal depth level and are positioned with distinct, non-overlapping vertical offsets.
  - Indented-column reflow layout for narrow screens (`<= 900px`) maintains bounded indents and readable node labels.
- **Title Preservation Guard (v2.1.0 Enhancement):**
  - Title updates strictly require a matching HTTP/HTTPS web URL. Extension pages (`chrome-extension://`, `moz-extension://`) and browser URLs (`about:`, `chrome://`) never overwrite the title of the last visited web page.
- **Opt-in User Study Controller & Private Export Engine (v2.1.0 Feature):**
  - Built-in local study controller for Within-Subject Design (WSD) usability studies.
  - Balanced $2 \times 2$ Latin Square order enforcement (Condition A Chrome History vs. Condition B Spatial History map; Topic Pack X Solar Energy vs. Topic Pack Y Olympic Games).
  - 6-dimension NASA-TLX cognitive workload assessment with step-5 increments and automated score computation.
  - Zero-URL privacy boundary: CSV and JSON export strips/hashes all raw URLs, queries, fragments, and numeric tab IDs.
  - Server HTTP 302 redirect destination capture, meta-refresh redirect collapsing, and signal-level rapid-open deduplication.
- **Download Provenance Attribution:** Completed downloads resolve to initiating source pages strictly via referrer matching ($|M|=1$), recording only non-sensitive filename and originating domain (`originDomain`).
- **Local-First Storage & Schema V2:** Stored entirely in `chrome.storage.local` / `browser.storage.local` with stable `treeId`, node types, and serialized read-modify-write storage queue. Zero remote telemetry, zero `innerHTML`.

---

## 5. Verification Evidence & Test Reports

### Automated Test Suite
Run command: `npm test`  
Result: **80 passed, 0 failed**
- Build, Manifest, CSP, Parity, and Archive Integrity: **12 tests passed**
- Navigation Tracker, Sibling Branching, Session Safety & Storage V2: **35 tests passed**
- Research Tree Explorer UI, Reflow Layout, Contrast, and Security: **14 tests passed**
- Branching Layout & Reflow Geometry: **4 tests passed**
- User Study Controller, Latin Square, NASA-TLX & Privacy Boundaries: **15 tests passed**

### Cross-Browser End-to-End Test Records
Verified via automated runtime harness in isolated profiles:
- **Google Chrome `157.0.8103.80`:**
  - Automated run log: [`docs/test-results/chrome-task18-e2e.log`](docs/test-results/chrome-task18-e2e.log) — **0 errors, 0 warnings**
  - Detail Branch Screenshots: [`chrome-branch-desktop.png`](docs/test-results/chrome-branch-desktop.png) (`1280x800`), [`chrome-branch-reflow.png`](docs/test-results/chrome-branch-reflow.png) (`480x800`)
- **Mozilla Firefox `160.0.1`:**
  - Automated run log: [`docs/test-results/firefox-task18-e2e.log`](docs/test-results/firefox-task18-e2e.log) — **0 errors, 0 warnings**
  - Detail Branch Screenshots: [`firefox-branch-desktop.png`](docs/test-results/firefox-branch-desktop.png), [`firefox-branch-reflow.png`](docs/test-results/firefox-branch-reflow.png)
