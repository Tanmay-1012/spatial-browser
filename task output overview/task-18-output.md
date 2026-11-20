# Task 18 Implementation & Verification Report — Study Readiness: Repair Visible Branching and Add Private Study Export

**Date:** 2026-11-20  
**Author:** Tanmay Tejaswi  
**GitHub Repository:** [https://github.com/TanmayTejaswi/spatial-browser](https://github.com/TanmayTejaswi/spatial-browser)  
**Branch:** `codex/task-18-user-study`  
**Status:** Submitted for lead review (Lead corrections implemented and verified).  
**Constraint Notice:** As specified in [`task-18.md`](tasks/task-18.md), [`task-18-review.md`](tasks/task-18-review.md), and [`USER_STUDY_PLAN.md`](../docs/USER_STUDY_PLAN.md), no human participants were recruited, no live human study was executed, no efficiency superiority claims are made, and the published `v2.0.0` release remains unaltered.

---

## 1. Executive Summary

Task 18 prepares the Spatial Browser History extension for a future controlled within-subject experimental evaluation comparing it with standard Chrome History. All work was executed strictly on branch `codex/task-18-user-study`. Following the lead review checklist ([`tasks/task-18-review.md`](tasks/task-18-review.md)), all requested corrections were implemented and verified across seven core areas:

1. **Part A (Linear-Map Reproduction & Repair):** Diagnosed and reproduced the user-reported "linear map" appearance. Fixed a timing race in `src/shared/tracker.js` where rapid multi-tab opening from a parent tab could outpace storage queue write completion, causing child tabs to detach into root checkpoints. Verified genuine tree branching in desktop horizontal layout and hierarchical vertical indent in narrow reflow layout across both Google Chrome and Mozilla Firefox. Captured browser-named screenshots with the details panel closed (`chrome-branch-desktop.png`, `chrome-branch-reflow.png`, `firefox-branch-desktop.png`, `firefox-branch-reflow.png`).
2. **Part B (Matched Study Materials & Genuine Depth 2):** Created two synthetic, locally hosted topic packs (`study/fixtures/pack_x` for Solar Energy and `study/fixtures/pack_y` for Olympic History) matched across page count (8 pages each), link topology, branching opportunities, title specificity, and genuine **Depth 2** traversal (`Hub → Sibling Listing → Target`: `index` &rarr; `perovskite` &rarr; `materials` in Pack X; `index` &rarr; `antiquity` &rarr; `modern1896` in Pack Y). Updated researcher protocols, standardized verbal scripts, and task cards in [`docs/STUDY_PROTOCOL.md`](../docs/STUDY_PROTOCOL.md).
3. **Part C (Counterbalanced Latin Square & Target Load Completion):** Enforced the four counterbalanced Latin square sequences in both the extension UI and `StudyManager.startTrial()`, auto-populating and locking assigned Condition and Topic Pack. Restricted target completion timing so that retrieval success and timer stopping require document load completion (`webNavigation.onCompleted` / `status === 'complete'`) rather than navigation commit. Added delayed-response browser tests proving the trial remains active while the target is in flight.
4. **Part D (Local Loopback Privacy Boundary & Deduplication):** Enforced strict local loopback origin requirements (`http://127.0.0.1` or `http://localhost`) and exact study paths in `matchCorpusPage()`, rejecting external domains, non-HTTP schemes, and lookalike paths. Replaced global last-seen tracking with event-level deduplication tracking per-tab navigation state, correctly capturing genuine opens across separate tabs and after off-corpus visits while collapsing redirects and excluding reloads and hash changes.
5. **Part E (Session Controls & Auditing):** Added a visible **Finish Session** control (`#study-finish-session-btn` and banner button) that ends the researcher session without deleting data, records an auditable `session_finish` event, and blocks extra trials until **Start New Session** is clicked. Enforced strict pseudonymous participant code validation (`P01`–`P999`), rejecting formula injection characters (`=`, `+`, `-`, `@`) and free-form text.
6. **Part F (NASA-TLX Step Alignment & Data Dictionary):** Configured NASA-TLX range sliders with `step="5"`, validated ratings as increments of 5 in $[0, 100]$, and live-calculated Raw TLX unweighted summary scores rounded to 1 decimal place. Harmonized all JSON audit event keys to `snake_case` agreeing with [`docs/STUDY_DATA_DICTIONARY.md`](../docs/STUDY_DATA_DICTIONARY.md) and standardized trial ID formatting to `trial_{participant}_p{period}_{condition}`. Made the complete data dictionary accessible directly inside the extension UI (`#study-dict-panel`) and downloadable as markdown (`#study-export-dict-btn`).
7. **Part G (Automated & Runtime Verification):** Build and sequential automated test suite pass at **75 passed, 0 failed** (12 build/manifest, 16 baseline tracker, 19 schema/branching, 14 UI explorer, 4 branching/layout, 10 user study & privacy). Executed isolated-profile browser runtime checks in **Google Chrome 157.0.8103.80** and **Mozilla Firefox 160.0.1** with valid sequence assignments (`seq_4` in Chrome; `seq_1` in Firefox), timeout outcome demonstration, stored sibling graph verification, and 0 console errors pre- and post-test.

---

## 2. Lead Review Correction Checklist — Implementation & Verification

| Checklist Item | Requirement | Resolution & Evidence |
| :--- | :--- | :--- |
| **1. Enforce Counterbalanced Sequences** | Enforce 4 Latin square sequences in UI and manager; auto-derive/lock choices; test all 8 valid cells and invalid rejections; run valid sequences in E2E. | Added `LATIN_SQUARE_SEQUENCES` specification and validation in `StudyManager.startTrial()`. UI auto-populates and locks `#study-condition` and `#study-topic-pack`. Added 8-cell matrix tests in `tests/test-study.mjs`. Chrome E2E runs `seq_4` (P1: B/pack_x, P2: A/pack_y); Firefox E2E runs `seq_1` (P1: A/pack_x, P2: B/pack_y). |
| **2. Target Load Completion Timing** | Stop timing only after exact allowlisted target document finishes loading (`status === 'complete'`); committed navigations must not finalize trial. | Updated `handleNavigationCommitted` to only flag committed state without finalizing; success finalized strictly in `handleNavigationCompleted` (`webNavigation.onCompleted`). Added delayed target response test in browser E2E proving trial stays active during loading and completes on load finish. |
| **3. Restrict Corpus to Loopback Origin** | Require local loopback origin (`http://127.0.0.1` or `http://localhost`) and exact study paths; reject lookalikes, non-HTTP schemes, and external domains. | Enforced in `src/shared/study-corpus.js` via `URL.protocol === 'http:'` and `hostname === '127.0.0.1' \|\| 'localhost'`. Tested in `tests/test-study.mjs` against external domains, HTTPS, file schemes, and lookalike paths (`.bak`, `/subpath`). |
| **4. Event-Level Deduplication** | Replace global deduplication with per-tab state; permit opens across separate tabs and after off-corpus visits; collapse redirects; exclude reloads and hash changes. | Implemented `tabNavState[tabId]` tracking in `StudyManager.handleNavigationCommitted`. Two tabs opening same wrong page both increment `incorrectPageOpens`. Off-corpus navigation resets tab state so return counts. Redirect intermediates and reloads excluded. Tested in `tests/test-study.mjs`. |
| **5. Finish Session Controls & Participant Codes** | Add visible Finish Session action that audits session, ends active trial as abandoned, and blocks extra trials; enforce `P01`–`P999` and reject formula injection. | Added `#study-finish-session-btn` and `#study-new-session-btn` in modal and banner. Implemented `finishSession()` logging `session_finish` and setting `sessionStatus = 'finished'`. Enforced regex `/^P\d{2,3}$/` and rejected `^[=+\-@]`. Tested in `tests/test-study.mjs` and both browser E2E runs. |
| **6. Align NASA-TLX, Exports & Dictionary** | Set slider `step="5"`; validate multiples of 5; harmonize exported JSON to `snake_case`; correct trial ID format in dictionary; make dictionary accessible in UI. | Added `step="5"` on range sliders and validated `val % 5 === 0`. Harmonized all JSON audit event keys to `snake_case`. Updated dictionary to `trial_{participant}_p{period}_{condition}`. Added `#study-dict-panel` and `#study-export-dict-btn` in extension UI. |
| **7. Protocol, Fixture Depth & Screenshots** | Ensure genuine Depth 2 (`Hub → Sibling Listing → Target`); demonstrate timeout in browser; assert stored sibling graph in Firefox; capture browser-named desktop and reflow screenshots. | Updated fixtures so `materials.html` is reached via `perovskite.html` (Pack X) and `modern1896.html` via `antiquity.html` (Pack Y). Demonstrated 120s timeout in both browsers. Audited stored sibling graph in Firefox. Captured `chrome-branch-desktop.png`, `chrome-branch-reflow.png`, `firefox-branch-desktop.png`, and `firefox-branch-reflow.png`. |

---

## 3. Part A — Linear-Map Reproduction, Diagnosis & Sibling Branch Verification

### 3.1 Navigation Scenario & Root Cause
In an isolated clean profile, Tab 1 navigates to Research Hub (`/hub`), opens Tab 2 (`/source-tab2`) and Tab 3 (`/source-tab3`) via `target="_blank"`, then navigates `/hub` &rarr; `/source-a` &rarr; `/child-a` &rarr; Back &rarr; download (`sample.pdf`) &rarr; Back &rarr; `/source-b`.

- **Storage Queue Race (`tracker.js`):** Multi-tab opens from parent tab could commit in `webNavigation.onCommitted` before parent node updates finished in the storage queue, creating disconnected root checkpoints. Resolved with bounded retry polling (`_resolveOpenerParent`).
- **Narrow Layout Reflow (`ui-logic.js` & `styles.css`):** In viewports &le; 900px, sibling cards vertically stacked at uniform indent looked visually linear. Reflow layout was refined to maintain distinct card boundaries, hierarchical depth indicators, and SVG bezier connector branches.

### 3.2 Visual Evidence by Browser & Viewport
- **Chrome Desktop Layout:** [`docs/test-results/chrome-branch-desktop.png`](file:///D:/Projects/HCI%20Project/docs/test-results/chrome-branch-desktop.png) (1280&times;800). Research Hub displays 4 distinct sibling branches (Product 1, Product 2, Source A, and Source B) with horizontal branches and verified download provenance under Source A.
- **Chrome Narrow Reflow:** [`docs/test-results/chrome-branch-reflow.png`](file:///D:/Projects/HCI%20Project/docs/test-results/chrome-branch-reflow.png) (480&times;800). Responsive vertical card stacking maintains indent depth, card boundaries, and edge connections.
- **Firefox Desktop Layout:** [`docs/test-results/firefox-branch-desktop.png`](file:///D:/Projects/HCI%20Project/docs/test-results/firefox-branch-desktop.png) (1280&times;800). Complete parity with Chrome: 4 visible sibling branches and attributed download node.
- **Firefox Narrow Reflow:** [`docs/test-results/firefox-branch-reflow.png`](file:///D:/Projects/HCI%20Project/docs/test-results/firefox-branch-reflow.png) (480&times;800). Responsive vertical layout preserving hierarchy.
- **Stored Graph Audit in Both Browsers:** 7 total nodes; Hub node has 4 sibling children; Source A has Child A and download node.

---

## 4. Part B — Matched Synthetic Topic Packs & Genuine Depth 2 Traversal

Two synthetic local topic packs under `study/fixtures/` provide zero-network-variance evaluation:

| Dimension | Topic Pack X: Solar Energy Technology | Topic Pack Y: Olympic Games History |
| :--- | :--- | :--- |
| **Directory** | `study/fixtures/pack_x/` | `study/fixtures/pack_y/` |
| **Page Count** | 8 static HTML pages | 8 static HTML pages |
| **Hub / Index** | `index.html` (Solar Energy Portal) | `index.html` (Olympic Historical Archive) |
| **Sibling Listing** | `perovskite.html` (Perovskite Stability & Tandem Benchmark) | `antiquity.html` (Ancient Games & Classical Heritage) |
| **Target Page** | `materials.html` (Photovoltaic Materials & Efficiency Record) | `modern1896.html` (Inaugural 1896 Summer Olympic Games) |
| **Target Depth** | **Depth 2** (`index.html` &rarr; `perovskite.html` &rarr; `materials.html`) | **Depth 2** (`index.html` &rarr; `antiquity.html` &rarr; `modern1896.html`) |
| **Opaque Target Key** | `px_materials` | `py_modern1896` |
| **Sibling Pages** | Silicon, Perovskites, Efficiency, Storage, Grid, Economics | Marathon, Antiquity, Winter Games, Paralympics, Torches, Economics |
| **Allowlist Mapping** | `px_hub`, `px_materials`, `px_perovskite`, `px_silicon`, `px_efficiency`, `px_storage`, `px_grid`, `px_economics` | `py_hub`, `py_modern1896`, `py_marathon`, `py_antiquity`, `py_winter`, `py_paralympic`, `py_torches`, `py_economics` |

---

## 5. Part C & D — Study Manager, Sequence Mapping & Privacy Boundary

### 5.1 Counterbalanced Latin Square Matrix
The 4-sequence Latin square allocation is strictly enforced:

| Sequence | Period 1 | Period 2 |
| :---: | :---: | :---: |
| **`seq_1`** | Condition A (Chrome) / Pack X | Condition B (Spatial) / Pack Y |
| **`seq_2`** | Condition B (Spatial) / Pack Y | Condition A (Chrome) / Pack X |
| **`seq_3`** | Condition A (Chrome) / Pack Y | Condition B (Spatial) / Pack X |
| **`seq_4`** | Condition B (Spatial) / Pack X | Condition A (Chrome) / Pack Y |

When Sequence and Period are selected, `#study-condition` and `#study-topic-pack` are automatically populated and locked in the UI, and verified by `StudyManager.startTrial()`.

### 5.2 Target Load Completion Verification
In `src/shared/study-manager.js`:
- `handleNavigationCommitted()` records qualifying non-target page opens, but does **not** finalize target success when reaching `targetKey`.
- `handleNavigationCompleted()` verifies document load completion (`status === 'complete'` or `webNavigation.onCompleted`) before concluding the trial with outcome `success`.
- Runtime evidence: Delayed target response test (`?delay=1`) demonstrated that the trial remained active in storage while the document was loading, and concluded only upon document load completion.

### 5.3 Local Loopback Privacy Boundary
`src/shared/study-corpus.js` restricts matching to `http://` on loopback hostnames (`127.0.0.1` or `localhost`). External origins, HTTPS, file schemes, and lookalike paths return `null` and are completely ignored.

### 5.4 Event-Level Deduplication
Tracks per-tab navigation state (`tabNavState[tabIdStr]`):
- Two separate tabs opening the same wrong page each trigger a qualifying page open.
- Navigating to an off-corpus site and returning to a corpus page counts as a genuine reopen.
- Suppressed events: client/server redirect intermediates, tab reloads (`transitionType === 'reload'`), same-document hash changes (`isHashChange === true`), and rapid identical duplicate signals within 600ms.

---

## 6. Part E & F — Session Controls, Workload Scoring & Data Dictionary

### 6.1 Session Controls
- **Finish Session Action:** Accessible via `#study-finish-session-btn` in the controller and `#study-banner-finish-btn` in the sticky banner. Concludes any active trial as `abandoned` with reason `session_finished`, appends a `session_finish` audit event, sets `sessionStatus = 'finished'`, and disables `#study-start-btn`.
- **Start New Session Action:** Displays `#study-new-session-btn`, re-enabling trial configuration for the next participant block.
- **Participant Code Validation:** Strictly validates format `P01`–`P999` using regex `/^P\d{2,3}$/` and rejects leading formula injection characters (`=`, `+`, `-`, `@`).

### 6.2 NASA-TLX Alignment & Data Dictionary
- **Range Sliders:** HTML inputs set to `step="5"`. Input handler and manager validation reject non-multiples of 5 or values outside $[0, 100]$.
- **Raw TLX Score:** Live unweighted arithmetic mean across all six subscales rounded to 1 decimal place (e.g. `23.3 / 100`).
- **Harmonized `snake_case` Format:** Exported JSON events, CSV headers, data dictionary entries, and automated tests use identical `snake_case` keys:
  - `trial_id`, `timestamp_utc`, `elapsed_ms`, `event_type`, `page_key`, `navigation_type`, `qualifiers`, `tab_ephemeral_key`.
  - Trial ID format: `trial_{participant}_p{period}_{condition}`.
- **In-App Data Dictionary:** Collapsible panel `#study-dict-panel` renders data dictionary text in the UI; `#study-export-dict-btn` triggers direct download of `STUDY_DATA_DICTIONARY.md`.

---

## 7. Sample Export Data (Verified Corrected Formats)

### 7.1 Sample `study-trials.csv` (Sequence Agreement)
```csv
participant_id,sequence,period,condition,tool,topic_pack,target_key,start_time_utc,end_time_utc,elapsed_ms,outcome,target_revisited_delay,protocol_deviation,incorrect_page_opens,tlx_mental_demand,tlx_physical_demand,tlx_temporal_demand,tlx_performance,tlx_effort,tlx_frustration,raw_tlx
P01,seq_4,1,B,spatial_history,pack_x,px_materials,2026-11-20T23:30:00.100Z,2026-11-20T23:30:03.136Z,3036,success,false,false,1,30,10,40,20,25,15,23.3
P01,seq_4,2,A,chrome_history,pack_y,py_modern1896,2026-11-20T23:30:08.500Z,2026-11-20T23:32:08.500Z,120000,timeout,false,false,0,,,,,,,
```

### 7.2 Sample `study-events.json` (`snake_case` Audit Trace)
```json
[
  {
    "trial_id": "trial_P01_p1_B",
    "timestamp_utc": "2026-11-20T23:30:00.100Z",
    "elapsed_ms": 0,
    "event_type": "trial_start",
    "page_key": null,
    "navigation_type": null,
    "qualifiers": null,
    "tab_ephemeral_key": null
  },
  {
    "trial_id": "trial_P01_p1_B",
    "timestamp_utc": "2026-11-20T23:30:00.850Z",
    "elapsed_ms": 750,
    "event_type": "corpus_navigation",
    "page_key": "px_efficiency",
    "navigation_type": "link",
    "qualifiers": [],
    "tab_ephemeral_key": "tab_1"
  },
  {
    "trial_id": "trial_P01_p1_B",
    "timestamp_utc": "2026-11-20T23:30:03.136Z",
    "elapsed_ms": 3036,
    "event_type": "trial_success",
    "page_key": "px_materials",
    "navigation_type": "link",
    "qualifiers": [],
    "tab_ephemeral_key": "tab_1"
  },
  {
    "trial_id": "trial_P01_p1_B",
    "timestamp_utc": "2026-11-20T23:30:05.200Z",
    "elapsed_ms": 3036,
    "event_type": "tlx_submitted",
    "page_key": null,
    "navigation_type": null,
    "qualifiers": null,
    "tab_ephemeral_key": null
  },
  {
    "trial_id": "trial_P01_p2_A",
    "timestamp_utc": "2026-11-20T23:30:15.000Z",
    "elapsed_ms": 0,
    "event_type": "session_finish",
    "page_key": null,
    "navigation_type": null,
    "qualifiers": null,
    "tab_ephemeral_key": null
  }
]
```

---

## 8. Automated Test Suite Results

The build and automated test suite were run sequentially via `npm.cmd run build; npm.cmd test`:

```
=== Running Build & Manifest Verification ===
  12 passed, 0 failed.

=== Running Task 2 Tracker & Storage Tests (Baseline Suite) ===
  16 passed, 0 failed.

=== Running Task 11 V2 Schema, Sibling Branching & Provenance Tests ===
  19 passed, 0 failed.

=== Running Task 12 Research Tree Explorer UI Tests ===
  14 passed, 0 failed.

=== Running Task 18 Branching & Layout Tests ===
  4 passed, 0 failed.

=== Running Task 18 User Study & Privacy Tests ===
  10 passed, 0 failed.

Total: 75 passed, 0 failed.
```

### New Tests in `tests/test-study.mjs` (10 tests)
1. Study mode disabled by default; zero capture when inactive.
2. Counterbalanced Latin square: enforces all 8 valid cells and rejects invalid combinations.
3. Participant ID validation: enforces `P01`–`P999`, rejects formula injection and free-form names.
4. Corpus allowlist: strictly requires local loopback origin and exact study paths.
5. Target completion: requires document load completion (`status === 'complete'`).
6. Event-level deduplication: counts across separate tabs and after off-corpus visits; excludes reloads, hash changes, and redirects.
7. Finish session action: audits session, completes active trial as abandoned, and blocks extra trials.
8. NASA-TLX: enforces step-5 increments, validates boundaries, and computes raw TLX.
9. Privacy audit: CSV and JSON exports contain zero raw URLs, titles, search queries, or off-corpus records.
10. Data dictionary file and manager export match exact schema and `snake_case` format.

---

## 9. Isolated-Profile Browser Runtime Checks (E2E)

Automated runtime verification via `scripts/e2e-task18-runtime.py`:

| Browser | Version | Test Framework | Results Log | Pre-Test Errors | Post-Test Errors | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Google Chrome** | `157.0.8103.80` (x64 Windows) | Chrome DevTools Protocol (CDP) | [`chrome-task18-e2e.log`](file:///D:/Projects/HCI%20Project/docs/test-results/chrome-task18-e2e.log) | 0 errors | 0 errors | **PASSED** |
| **Mozilla Firefox** | `160.0.1` (x64 Windows) | Marionette WebDriver | [`firefox-task18-e2e.log`](file:///D:/Projects/HCI%20Project/docs/test-results/firefox-task18-e2e.log) | 0 errors | 0 errors | **PASSED** |

### Verified Runtime Sequences & Behaviors
- **Chrome (`seq_4`):** Participant `P01`. Period 1 assigns Condition B (Spatial History) / Pack X. Verified wrong-page count (`1`), in-flight active state during delayed target load (`?delay=1`), target completion upon load finish, NASA-TLX submission (`23.3`), Period 2 Condition A / Pack Y timeout outcome (`120000ms`), Finish Session action, CSV/JSON export, inter-round reset survival, and deletion.
- **Firefox (`seq_1`):** Participant `P02`. Period 1 assigns Condition A (Chrome History) / Pack X. Verified delayed target load completion, NASA-TLX submission (`23.3`), Period 2 Condition B / Pack Y timeout outcome (`120000ms`), stored sibling graph assertion, Finish Session action, CSV/JSON export, inter-round reset survival, and deletion.
- **Stored Graph Assertion in Both Browsers:** 7 total nodes; Hub has 4 sibling children; Source A has Child A and download node.

### Compatibility Floor Status
- **Mozilla Firefox 115.0+ ESR:** Verified compatible in Task 14 and retained.
- **Branded Google Chrome 109:** Declared minimum version remains `109+`. Remains **UNVERIFIED** due to hosted environment limitations.

---

## 10. Deliverables Index

| Deliverable | Location | Description |
| :--- | :--- | :--- |
| **Branching Fix** | `src/shared/tracker.js` | Bounded parent resolution retry on opener child navigation |
| **Corpus & Local Allowlist** | `src/shared/study-corpus.js` | Loopback origin requirement, exact study path matching, opaque key mapping |
| **Study Manager** | `src/shared/study-manager.js` | Latin square matrix, load-complete target detection, event deduplication, Finish Session, CSV/JSON exports |
| **UI Controller & Banner** | `src/shared/app.js`, `index.html`, `styles.css` | Auto-derived assignments, step-5 TLX sliders, Finish Session button, Data Dictionary viewer |
| **Synthetic Topic Packs** | `study/fixtures/pack_x/`, `study/fixtures/pack_y/` | Matched 8-page fixtures with Depth 2 target traversal |
| **Study Protocol & Manuals** | `docs/STUDY_PROTOCOL.md` | Standardized scripts, task cards, reset checklist |
| **Data Dictionary** | `docs/STUDY_DATA_DICTIONARY.md` | Standardized `snake_case` schema specification |
| **Automated Test Suites** | `tests/test-branch.mjs`, `tests/test-study.mjs` | 14 new automated tests (75 tests total in suite) |
| **Browser Runtime Runner** | `scripts/e2e-task18-runtime.py` | Isolated-profile browser automation for Chrome 157 and Firefox 160 |
| **Browser Runtime Logs** | `docs/test-results/*task18-*.{log,json}` | Full Chrome & Firefox execution logs and 0-error audits |
| **Browser Screenshots** | `docs/test-results/*branch-*.png` | Browser-named desktop and reflow screenshots |
| **Build Outputs & Checksums** | `outputs/`, `outputs/SHA256SUMS` | Freshly built Chrome & Firefox packages |
| **Task 18 Report** | `task output overview/task-18-output.md` | This document |

---

## 11. Conclusion & Submission for Lead Review

All checklist items from [`tasks/task-18-review.md`](tasks/task-18-review.md) have been implemented, tested, and verified across both Google Chrome and Mozilla Firefox. Branch `codex/task-18-user-study` is submitted for lead review.

In compliance with project boundaries, no human participants were recruited, no live study was run, no efficiency superiority claims are made, and release `v2.0.0` remains unchanged.
