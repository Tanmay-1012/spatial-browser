# Task 13 Output — Release Candidate Readiness & Evidence Closeout

**Status:** Completed & Submitted for Lead Review  
**Milestone:** 13 (Quality & Handoff)  
**Prerequisite:** Task 12 accepted in Section 12 of [`task output overview/task-12-output.md`](task-12-output.md#12-lead-acceptance--task-12-complete-task-13-assigned-2026-11-13)  
**Browser Runtime Targets:** Google Chrome `157.0.8103.78` (x64 Windows; declared min `109+`) & Mozilla Firefox `160.0` (x64 Windows; `strict_min_version: 115.0`)  
**Execution Date:** 2026-11-13  

---

## 1. Executive Summary & Objective

Task 13 is a quality, packaging, and evidence closeout task to verify that the repository, checked-in sources, and Chrome/Firefox build outputs form a clean, reproducible release candidate. No new user-facing features or schema changes were introduced:

1. **Lead-Review Integration:** Inspected `git status` and preserved all lead-verified Task 12 corrections without discarding or reverting changes. Specifically preserved the synchronous focus-restoration correction in [`src/shared/app.js`](../src/shared/app.js), the atomic detail-filter query and screenshot timeout in [`scripts/e2e-chrome-verification.py`](../scripts/e2e-chrome-verification.py), the regex escape correction in [`scripts/e2e-firefox-verification.py`](../scripts/e2e-firefox-verification.py), and the latest passing Chrome and Firefox test logs, audits, and screenshots. Committed these integrations locally as commit `0cdf773`.
2. **Reproducible Build & Package Audit:** Rebuilt packages via `npm.cmd run build` and executed the automated suite via `npm.cmd test` (**61 passed, 0 failed**). Inspected unpacked extensions and archive packages (`.zip` and `.xpi`) against checked-in source files; verified byte-level parity, manifest permissions, and `SHA256SUMS` checksums. Audited packages for clean boundaries: zero test profiles, databases, fixtures, credentials, or machine-specific paths were found in any package.
3. **Browser Behavior Reconfirmation:** Executed both full isolated-profile E2E test suites against freshly built packages. Google Chrome `157.0.8103.78` and Mozilla Firefox `160.0` passed all 10 acceptance steps with zero errors, zero warnings, `12 -> 12` restart node persistence, and clean process teardown.
4. **Handoff Records Alignment:** Verified that `README.md`, `docs/TEST_PLAN.md`, `task output overview/README.md`, `task output overview/tasks/README.md`, and `task-12.md` consistently reflect Task 12 acceptance (Section 12) and Task 13 active assignment. All prior review checkpoints are preserved.
5. **Release Constraints Respected:** No release has been tagged, published, pushed, or distributed. Task 14 remains unstarted pending lead review.

---

## 2. Lead-Review Integration Audit

### 2.1 Preserved Working-Tree Corrections

- **Focus Restoration in [`src/shared/app.js`](../src/shared/app.js:632-646):**
  - Replaced asynchronous `requestAnimationFrame` callback with immediate post-render focus restoration:
    ```javascript
    if (!elOverviewView || elOverviewView.hidden) return;
    elOverviewView.scrollTop = overviewFilters.scrollTop || 0;
    if (overviewFilters.focusedTreeId) {
      const cardBtn = Array.from(elTreesGrid.querySelectorAll('.tree-open-btn'))
        .find((btn) => btn.getAttribute('data-tree-id') === overviewFilters.focusedTreeId);
      if (cardBtn) {
        cardBtn.focus({ preventScroll: true });
        return;
      }
    }
    elOverviewView.focus({ preventScroll: true });
    ```
  - Eliminates timing race where focus was previously attempted before the overview DOM button was populated.
- **Harness Stabilization in [`scripts/e2e-chrome-verification.py`](../scripts/e2e-chrome-verification.py):**
  - Extended CDP `Page.captureScreenshot` command timeout to `45s` to avoid spurious timeouts under high disk I/O.
  - Combined `detail-count-badge`, `.is-search-match`, `.is-context-ancestor`, and `#detail-context-banner` into a single atomic CDP evaluate call, preventing state observation desynchronization.
  - Corrected `scale\\(([\\d.]+)\\)` regex escape in `verify_responsive_and_capture` and `verify_responsive_and_capture_firefox`.
  - Upgraded `terminate_chrome_tree` to execute `taskkill /F /T /PID` before waiting, ensuring all child renderer and utility processes are terminated simultaneously with the parent, preventing orphaned profile locks across browser relaunch.
  - Added 1.0s OS socket settling delay after process teardown and increased reconnect polling to 60 iterations (30s max).

### 2.2 Local Integration Commit

The lead-review changes were integrated and committed locally:
- **Commit Hash:** `0cdf773`
- **Commit Message:** `fix(ui,e2e): integrate lead review focus restoration, harness stabilization, and Task 12 acceptance records`
- **Remote Push:** Skipped per Task 13 constraints (0 commits pushed to remote).

---

## 3. Reproducible Build & Package Content Audit

### 3.1 Automated Test Suite (`npm.cmd test`)

Ran `npm.cmd test` from the repository root:

```text
=== Running Build & Manifest Verification ===
  ✓ Outputs exist with all required build artifacts
  ✓ Release archives match unpacked builds and contain no extraneous, test, or profile files
  ✓ Every shared source asset is copied identically into both builds
  ✓ Chrome manifest adheres to MV3 specifications and declared permissions
  ✓ Firefox manifest adheres to MV3 specifications and declared permissions
  ✓ index.html complies with Extension MV3 CSP and contains empty state
  ✓ app.js does not execute unescaped innerHTML
  ✓ All referenced icons exist and have valid PNG signatures

=== Testing Toolbar Launch and Focus Behavior ===
  ✓ Opens new tab when placeholder page is not already open
  ✓ Focuses existing tab when placeholder page is already open
  ✓ Repeated clicks: first click opens, second click focuses existing tab
  ✓ Simultaneous toolbar clicks do not open duplicate tabs
Verification complete: 12 passed, 0 failed.

=== Running Task 2 Tracker & Storage Tests (Baseline Suite) ===
  ✓ 16/16 baseline tracker & storage tests passed.

=== Running Task 11 V2 Schema, Sibling Branching & Provenance Tests ===
  ✓ 19/19 V2 migration, branching, startup safety, and download provenance tests passed.
Verification Complete: 35 passed, 0 failed.

=== Running Task 12 Research Tree Explorer UI Tests ===
  ✓ 14/14 Explorer UI, layout reflow, contrast, navigability, and clear-history tests passed.
UI Test Verification Complete: 14 passed, 0 failed.
```

**Total Automated Suite:** **61 passed, 0 failed**.

### 3.2 Build Outputs & Parity (`npm.cmd run build`)

Ran `node scripts/build.mjs`:
- **Chrome Unpacked:** `outputs/chrome/unpacked/` (15 files)
- **Firefox Unpacked:** `outputs/firefox/unpacked/` (15 files)
- **Chrome Archive:** `outputs/chrome/spatial-browser-history-extension.zip` (44,358 bytes)
- **Firefox Archive:** `outputs/firefox/spatial-browser-history-firefox.zip` (44,392 bytes)
- **Firefox Package:** `outputs/firefox/spatial-browser-history-firefox.xpi` (44,392 bytes)

### 3.3 File-by-File Package Inventory

Every distributable package contains exactly 15 files with complete asset parity:

| File | Chrome Unpacked | Firefox Unpacked | In Zip / XPI | Parity Status | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `app.js` | 44,178 B | 44,178 B | Yes | Identical | UI rendering, reflow layout, pan/zoom, focus restoration |
| `background-messages.js` | 1,073 B | 1,073 B | Yes | Identical | Background clear-history action handler |
| `background.js` | 1,492 B | 1,416 B | Yes | Browser-specific | MV3 Service worker (Chrome) / Background script (Firefox) |
| `index.html` | 16,420 B | 16,420 B | Yes | Identical | Accessible Explorer landmarks, cards, drawer, dialog |
| `launch.js` | 3,815 B | 3,815 B | Yes | Identical | Single-tab toolbar open-or-focus behavior |
| `manifest.json` | 741 B | 959 B | Yes | Browser-specific | MV3 declarations, declared floors, Gecko ID |
| `storage.js` | 29,983 B | 29,983 B | Yes | Identical | V2 schema, serialized queue, pruning, V1 backup |
| `styles.css` | 24,709 B | 24,709 B | Yes | Identical | Theme tokens, card grid, reflow CSS, WCAG AA contrast |
| `tracker.js` | 30,241 B | 30,241 B | Yes | Identical | Navigation engine, sibling branching, downloads |
| `ui-logic.js` | 16,223 B | 16,223 B | Yes | Identical | Tree grouping, indented column reflow layout, URL safety |
| `icons/icon-16.png` | 288 B | 288 B | Yes | Identical | 16px extension icon |
| `icons/icon-32.png` | 554 B | 554 B | Yes | Identical | 32px extension icon |
| `icons/icon-48.png` | 784 B | 784 B | Yes | Identical | 48px extension icon |
| `icons/icon-128.png` | 2,209 B | 2,209 B | Yes | Identical | 128px extension icon |
| `icons/icon.svg` | 495 B | 495 B | Yes | Identical | SVG master icon |

### 3.4 SHA-256 Checksums (`outputs/SHA256SUMS`)

Checksums were computed and verified against disk files:

```text
de63faf624229ccb81f08937c4f710cf8f79a95a69e7193c357002f6f0ece737  chrome/spatial-browser-history-extension.zip
930a462762be4fd06a9a74994cfb2d1d49b41c0eb491424118c2b290b492f034  firefox/spatial-browser-history-firefox.zip
930a462762be4fd06a9a74994cfb2d1d49b41c0eb491424118c2b290b492f034  firefox/spatial-browser-history-firefox.xpi
```

Notice that `firefox.zip` and `firefox.xpi` are byte-for-byte identical (`930a462762be4fd06a9a74994cfb2d1d49b41c0eb491424118c2b290b492f034`).

### 3.5 Privacy & Package Boundary Audit

A recursive scan across `outputs/chrome/unpacked` and `outputs/firefox/unpacked` confirmed:
- Zero temporary test profiles or browser database files (`.sqlite`, `.ldb`, `Preferences`).
- Zero downloaded fixtures or intermediate test PDFs/zips (`research_paper.pdf`, `dataset.zip`, `ambiguous.bin`).
- Zero credentials, API keys, authentication tokens, or personal identifiers.
- Zero machine-specific absolute file paths (`D:\`, `C:\`, `/home/`, usernames).
- Zero extraneous files, hidden dotfiles, or test mocks.

---

## 4. Browser Behavior Reconfirmation

Both full isolated-profile browser E2E test suites were re-executed against the freshly built extension outputs:

### 4.1 Google Chrome `157.0.8103.78` (Floor: Chrome 109+)

- **Execution Log:** [`docs/test-results/chrome-e2e.log`](file:///D:/Projects/HCI%20Project/docs/test-results/chrome-e2e.log)
- **Test Summary:** **10 steps executed, 0 failures**.
- **Step 1:** Connected via CDP; loaded unpacked extension `edhmggcmhhmlbfmidpeamoiffebfijah`; pinned action; attached to MV3 service worker.
- **Step 2:** Toolbar UIA click 1 opened map tab; click 2 focused existing tab without duplication.
- **Step 3:** Browsing topology recorded: same-tab linear path, HTTP 302 redirect, reload deduplication (1 node for `/target`), title update in place, fragment route, SPA History API pushState route, known opener child tab, unknown/closed opener fallback (root checkpoint).
- **Step 4:** Reopened closed child URL (+1 visit, new tree card).
- **Step 5:** Search & time filtering: Overview filters tree cards; Detail keeps non-matching context ancestors dimmed (`.is-context-ancestor`) while descendants stay attached.
- **Step 6:** Real CDP keyboard navigation: pan (`ArrowRight`/`ArrowDown`), zoom controls, node selection (`Enter`/`Space`), and Clear Modal Tab / Shift+Tab focus trapping.
- **Step 6.5:** Live Explorer UI:
  - Overview: 3 cards for 3 trees; Unattributed Downloads shelf displays `dataset.zip` and `ambiguous.bin` labeled `Source unavailable` (zero cards).
  - Wikipedia Detail: Source A and Source B aligned as parallel vertical siblings under Wikipedia.
  - Download Provenance: `research_paper.pdf` displays `Downloaded from localhost` (never CDN host `127.0.0.1`); selection opens drawer with URL and reopen action hidden.
  - Narrow Reflow Legibility (`420x800` viewport, inner canvas `420x641`): `fitScale = 1.05`, `effectiveTitleFontSize = 13.7px`, `renderedTitleHeight = 17.6px` across all 6 nodes (`allReadable = True`). Zoom in (`scale(1.26)`) and Fit (`scale(1.05)`) navigability verified. Drawer-closed map screenshot captured cleanly.
- **Step 7:** Pre-restart error audit: evaluated 265 CDP event records — **0 extension errors, 0 warnings** ([`chrome-errors-pre-restart.json`](file:///D:/Projects/HCI%20Project/docs/test-results/chrome-errors-pre-restart.json)).
- **Step 8:** Background suspension signaled and re-awakened. Multi-node live tab session (`/restart-step1` $\to$ `/restart-step2` $\to$ `/restart-step3`, stack length 3) established. Chrome process terminated cleanly (`terminate_chrome_tree`). Relaunched with persistent profile and synchronized `/restart-step3` tab.
- **Step 8c Persistence:** Stored node count: **12 pre-restart $\to$ 12 post-restart**. Live tab collapsed to single-node baseline `[step3]`. Post-restart Overview rendered 3 cards (`3 Research Trees · 9 Visits`).
- **Step 9:** Post-restart error audit: evaluated 19 CDP event records — **0 extension errors, 0 warnings** ([`chrome-errors-post-restart.json`](file:///D:/Projects/HCI%20Project/docs/test-results/chrome-errors-post-restart.json)).
- **Step 10:** Cross-browser parity confirmed.

### 4.2 Mozilla Firefox `160.0` (Floor: Firefox 115.0+)

- **Execution Log:** [`docs/test-results/firefox-e2e.log`](file:///D:/Projects/HCI%20Project/docs/test-results/firefox-e2e.log)
- **Test Summary:** **10 steps executed, 0 failures**.
- **Measured Viewport:** Requested `420x800`; Windows Win32 window manager constrained outer window to $514\text{px}$, measuring inner viewport at $\mathbf{500 \times 800\text{px}}$ (canvas $500 \times 674\text{px}$). Enters responsive reflow layout ($<= 900\text{px}$).
- **Narrow Reflow Legibility:** `fitScale = 1.05`, `effectiveTitleFontSize = 13.7px`, `renderedTitleHeight = 20.4px` across all 6 nodes (`allReadable = True`). Zoom in (`scale(1.26)`) and Fit (`scale(1.05)`) navigability verified. Drawer-closed map screenshot captured cleanly.
- **Restart Persistence & Process Cleanup:** Pre-restart: 12 nodes $\to$ Post-restart: 12 nodes in SQLite. Live tab collapsed to single-node baseline `[step3]`. Isolated process tree cleaned up via `terminate_firefox_tree`. Exited with code `0`.
- **Telemetry:** Pre-restart audit evaluated 6 Gecko records (**0 errors, 0 warnings**, [`firefox-errors-pre-restart.json`](file:///D:/Projects/HCI%20Project/docs/test-results/firefox-errors-pre-restart.json)); Post-restart audit evaluated 24 Gecko records (**0 errors, 0 warnings**, [`firefox-errors-post-restart.json`](file:///D:/Projects/HCI%20Project/docs/test-results/firefox-errors-post-restart.json)).

---

## 5. Documentation & Task Index Alignment

Checked documentation and task indexes across the workspace:
- **`README.md`:** Accurately reflects Task 11 accepted, Task 12 accepted (Section 12), and Task 13 assigned for quality audit without publication.
- **`docs/TEST_PLAN.md`:** Records Task 12 acceptance (Section 12), 61 automated tests, and current Chrome 157 / Firefox 160 E2E results.
- **`task output overview/README.md`:** Updated index shows Task 12 accepted (Section 12) and Task 13 assigned.
- **`task output overview/tasks/README.md`:** Lists Task 12 accepted and Task 13 as active assignment.
- **`task output overview/tasks/task-12.md`:** Status updated to Accepted per Section 12.
- **`task output overview/tasks/task-13.md`:** Contains complete Task 13 assignment specification.

---

## 6. Acceptance Status & Handoff Gate

Every Task 13 requirement is satisfied:
- [x] Lead review focus restoration and E2E harness corrections are preserved and committed locally (`0cdf773`).
- [x] `npm.cmd test` passes: **61 passed, 0 failed**.
- [x] `npm.cmd run build` produces reproducible unpacked extensions, `.zip`, `.xpi`, and matching `SHA256SUMS`.
- [x] Chrome and Firefox packages audited: byte-level asset parity, 0 private/test files, 0 credentials, 0 machine paths.
- [x] Fresh Chrome `157.0.8103.78` and Firefox `160.0` isolated-profile E2E runs passed all 10 steps with `12 -> 12` restart persistence, zero errors, and zero warnings.
- [x] Documentation, test plan, and task indexes are completely aligned.
- [x] No release was tagged, pushed, published, or distributed.
- [x] Task 14 remains strictly unstarted.

Task 13 is complete and submitted for lead review.
