# Task 18 Implementation & Verification Report — Study Readiness: Repair Visible Branching and Add Private Study Export

**Date:** 2026-11-21  
**Author:** Tanmay Tejaswi  
**GitHub Repository:** [https://github.com/TanmayTejaswi/spatial-browser](https://github.com/TanmayTejaswi/spatial-browser)  
**Branch:** `codex/task-18-user-study`  
**Status:** Accepted after lead re-review on 2026-11-21. Implementation is accepted for study readiness; human participation remains unauthorized pending supervisor/institution approval and owner authorization. See [`tasks/task-18-review-followup.md`](tasks/task-18-review-followup.md).

**Constraint Notice:** As specified in [`task-18.md`](tasks/task-18.md), [`task-18-review.md`](tasks/task-18-review.md), [`task-18-review-followup.md`](tasks/task-18-review-followup.md), and [`USER_STUDY_PLAN.md`](../docs/USER_STUDY_PLAN.md), no human participants were recruited, no live human study was executed, no efficiency superiority claims are made, and the published `v2.0.0` release remains unaltered.

---

## 1. Executive Summary

Task 18 prepares the Spatial Browser History extension for a future controlled within-subject experimental evaluation comparing it with standard Chrome History. All work was executed strictly on branch `codex/task-18-user-study`. Following the lead's follow-up review checklist ([`tasks/task-18-review-followup.md`](tasks/task-18-review-followup.md)), all six requested corrections have been implemented, automated, and verified:

1. **Storage Privacy Boundary (Zero URLs / Query / Hash / Tab IDs in Storage):** Eliminated raw URL, query parameter, fragment, and system tab ID storage from active trial state. Ephemeral tab ID mappings and navigation deduplication state now reside strictly in transient in-memory `Map` instances (`_transientTabMap`, `_transientTabNavState`) on `StudyManager`. Standardized projection helper `projectTrialRecord()` across trial completion, finish session, and abandonment so that only approved schema fields are ever saved under `spatial_browser_study_data`. Verified by direct storage inspection during active trials and after session finish in both automated unit tests and live Chrome/Firefox browser runs.
2. **Redirect Destination Counting (HTTP 3xx Server & Client Redirect Collapsing):** Revised navigation handling so that HTTP 3xx server redirect destinations (with `server_redirect` qualifiers) correctly increment qualifying destination page opens. Intermediate client redirects (e.g. meta-refresh) collapse to a single event for the final destination key. Added real local 302 redirect verification endpoints (`/redirect-wrong-302`, `/redirect-target-302`) in the E2E harness.
3. **Signal-Level Deduplication (<600ms Genuine Repeat Opens & Back/Forward Counting):** Replaced the fixed 600ms URL time suppression window with deduplication only by matching `documentId`/`navigationId` or identical event object reference. Timestamp equality is never used to discard a commit, including when a browser omits navigation IDs. Genuine rapid opens in the same tab, including two commits with identical timestamps and no IDs, count as distinct visits. Back/Forward (`forward_back`) destination visits are counted and recorded with proper qualifiers.
4. **Actual Branch Graph Detail View Screenshots:** Updated runner to explicitly activate the tree's **Open Tree Detail View** control (`.tree-open-btn`), asserted detail canvas visibility (`#detail-view`), confirmed rendered nodes (`>= 6`) and edges (`>= 4`), executed `#zoom-reset`, and captured actual tree graphs at desktop (1280&times;800) and narrow reflow (480&times;800) in both Google Chrome and Mozilla Firefox. Visually inspected all four resulting PNGs.
5. **Firefox Asynchronous In-Flight Target Timing:** Converted Firefox target navigation to asynchronous evaluation (`window.location.href = ...`) through `/redirect-target-302` to a delayed response endpoint. The runner inspects extension storage via Marionette while the request is in flight, logging `hasActiveTrial: true, completedTrialCount: 0`, and confirms completion (`outcome: 'success'`) only after document load completes.
6. **Tightened Participant Validation & Protocol Clarifications:** Updated participant code validation regex to `/^P([1-9]\d{1,2}|0[1-9])$/`, strictly rejecting `P00`, `P000`, `P001`, `P1`, and `P1000`, while accepting `P01` through `P999`. Added automated test coverage for CSV escaping (commas, double quotes, newlines) and Back/Forward events. Clarified that timeout tests are simulated deadline checks and that Firefox Condition A exercises the shared recording metadata/controller path.

The full automated test suite passes at **80 passed, 0 failed**. Sequential browser runtime checks in **Google Chrome 157.0.8103.80** and **Mozilla Firefox 160.0.1** completed with exit code 0 and 0 console errors pre- and post-test.

---

## 2. Follow-Up Lead Review Correction Matrix

| Review Item | Required Correction | Implementation Resolution | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **1. Storage Privacy Boundary** | Do not persist raw URLs, query strings, fragments, or browser tab IDs in active trial or after session finish. Project only approved schema fields. | Converted `tabMap` and `tabNavState` to transient in-memory Maps (`this._transientTabMap`, `this._transientTabNavState`) on `StudyManager`. Stripped them from `activeTrial`. Implemented `projectTrialRecord()` ensuring only approved schema fields are saved. | `tests/test-study.mjs`: Privacy boundary test inspects active study storage and post-finish storage, asserting zero URLs, query/hash material, or numeric tab IDs. Step 4 in both Chrome & Firefox E2E directly audits `chrome.storage.local.get('spatial_browser_study_data')` during active trial. |
| **2. Redirect Destination Counting** | Count qualifying final destination commits when `server_redirect` is present. Collapse intermediate client redirects. Remove unit test dropping redirect commits. | Updated `handleNavigationCommitted` to process final destination commits with `server_redirect`. Intermediate client redirect steps collapse to one final destination event. | `tests/test-study.mjs`: Server redirect destination and client redirect collapsing tests pass. Chrome & Firefox E2E: HTTP 302 wrong destination increments once; meta-refresh to a second wrong corpus page adds exactly one final `px_grid` event (total count 2); HTTP 302 target succeeds only after the delayed target load completes. |
| **3. Rapid Repeat-Open Deduplication** | Do not suppress fast genuine repeat opens (<600ms) with fixed URL window. Suppress duplicate signals only. Count Back/Forward visits. | Suppress only a repeated `documentId`/`navigationId` or the same event object. Do not use timestamp equality as a duplicate signal, because distinct commits can share a timestamp. | `tests/test-study.mjs`: Fast same-tab opens count separately; two opens with distinct document IDs and two opens without IDs at an identical timestamp each count separately. Repeated navigation ID and same-object redelivery are suppressed. Back/Forward destination visit counting is verified. |
| **4. Actual Branch Graph Screenshots** | Capture actual tree graphs in detail view, not overview cards. Assert detail canvas, nodes, and edges visible. Capture desktop and reflow in Chrome and Firefox. | Updated runner to click `.tree-open-btn`, assert `#detail-view` visible, nodes &ge; 6, edges &ge; 4, click `#zoom-reset`, and capture desktop and reflow screenshots in Chrome and Firefox. | Visually verified 4 screenshots: `chrome-branch-desktop.png` (1280&times;800), `chrome-branch-reflow.png` (480&times;800), `firefox-branch-desktop.png` (1582&times;883 / 1280&times;800 outer), `firefox-branch-reflow.png` (625&times;883 / 514&times;800 outer). |
| **5. Firefox In-Flight Target Check** | Demonstrate Firefox trial remains active during delayed load using asynchronous navigation. Check state before load finishes, then check success after load. | Used `window.location.href = delayed_target_url` asynchronously via `WebDriver:ExecuteScript`. Switched to extension tab to verify `hasActiveTrial: true, completedTrialCount: 0`. Waited for load and verified `outcome: 'success'`. | Firefox E2E log records active trial with zero completed trials during load, then target success after load (`elapsed=4387ms` on the final run). |
| **6. Tighten Participant Code & Claims** | Reject `P00`, `P000`, `P001`. Test boundaries `P01`, `P99`, `P100`, `P999`. Add CSV escaping & Back/Forward tests. Label timeout tests as simulated deadline checks. Clarify Firefox Cond A. | Regex updated to `/^P([1-9]\d{1,2}\|0[1-9])$/`. Added boundary tests in `tests/test-study.mjs`. Added CSV escaping tests for commas/quotes/newlines. Added Back/Forward test. Documented simulated deadline checks and Firefox Cond A controller role. | Automated tests in `test-study.mjs` pass. E2E logs and report explicitly document simulated deadline check (`elapsed=120000ms`) and Firefox Condition A shared controller path. |

---

## 3. Storage Privacy Boundary Architecture

### 3.1 Transient In-Memory State vs. Persistent Storage Schema
Under Task 18, `spatial_browser_study_data` stores strictly aggregated metrics and opaque identifiers. Raw browser URLs, query parameters, URL fragments, and numeric browser tab IDs are never written to extension storage (`chrome.storage.local`).

```
+-----------------------------------------------------------------------------------+
|                           TRANSIENT IN-MEMORY MAPS                                |
|  StudyManager._transientTabMap: Map<number, string>       (e.g., 42 -> "tab_1")   |
|  StudyManager._transientTabNavState: Map<string, object>  (dedup keys, last keys) |
+-----------------------------------------------------------------------------------+
                                         |
                                         | (Projection via projectTrialRecord)
                                         v
+-----------------------------------------------------------------------------------+
|                   PERSISTED STORAGE (spatial_browser_study_data)                  |
|  activeTrial: { trialId, participantId, condition, sequence, period, topicPack,   |
|                 targetKey, startTime, incorrectPageOpens, status }                |
|  trials: [ { trialId, participantId, condition, sequence, period, topicPack,      |
|              startTime, endTime, elapsedMs, outcome, incorrectPageOpens,          |
|              nasaTlxRawScore, nasaTlxSubscales, status, notes } ]                 |
|  events: [ { trialId, timestampUtc, elapsedMs, eventType, pageKey,                |
|              navigationType, qualifiers, tabEphemeralKey } ]                      |
+-----------------------------------------------------------------------------------+
```

### 3.2 Trial Projection Helper (`projectTrialRecord`)
All finalization paths (`completeTrial`, `finishSession`, `abandonTrial`) pass active trial data through `projectTrialRecord()`. This guarantees that internal runtime fields (e.g., intermediate timestamps, transient references) are dropped before saving:

```javascript
function projectTrialRecord(trial) {
  if (!trial) return null;
  return {
    trialId: trial.trialId,
    participantId: trial.participantId,
    condition: trial.condition,
    sequence: trial.sequence,
    period: trial.period,
    topicPack: trial.topicPack,
    startTime: trial.startTime,
    endTime: trial.endTime || new Date().toISOString(),
    elapsedMs: typeof trial.elapsedMs === 'number' ? trial.elapsedMs : 0,
    outcome: trial.outcome || 'abandoned',
    targetRevisitedDelay: Boolean(trial.targetRevisitedDelay),
    protocolDeviation: Boolean(trial.protocolDeviation),
    incorrectPageOpens: typeof trial.incorrectPageOpens === 'number' ? trial.incorrectPageOpens : 0,
    nasaTlxRawScore: typeof trial.nasaTlxRawScore === 'number' ? trial.nasaTlxRawScore : null,
    nasaTlxSubscales: trial.nasaTlxSubscales || null,
    status: trial.status || 'abandoned',
    notes: trial.notes || ''
  };
}
```

### 3.3 Storage Privacy Audit Evidence
During Step 4 of the E2E verification script, `spatial_browser_study_data` is directly inspected via `chrome.storage.local.get()` while a trial is actively navigating. The test verifies:
- `"redirect-wrong"` not in stored JSON string.
- `"efficiency.html"` not in stored JSON string.
- `"http://"` not in stored JSON string.
- `"tabNavState"` not in stored JSON string.
- `"lastCommittedUrl"` not in stored JSON string.
- Sentinels `secret=query`, `#frag`, and numeric tab IDs are absent.

Both Chrome and Firefox passed this direct audit with zero leaks.

---

## 4. Redirect Handling & Signal-Level Deduplication

### 4.1 Server Redirect (3xx) & Client Redirect Collapsing
The tracker counts the final allowlisted destination of an HTTP 301/302 navigation, including commits carrying the `server_redirect` qualifier. Client/meta-refresh redirects are reduced to one event for the final corpus destination. In Chrome and Firefox E2E, `/redirect-wrong-302` produces one incorrect open for `px_efficiency`; `/redirect-client` then produces exactly one additional event for `px_grid` (total count 2). The delayed target is reached through `/redirect-target-302`; the trial remains active until the final target document finishes loading.

### 4.2 Signal-Level Deduplication vs. 600ms Time Window
The former implementation used a blanket 600ms URL time suppression window, which incorrectly discarded genuine rapid reopens. The updated strategy uses signal-level deduplication:

```javascript
const navKey = details.documentId || details.navigationId || null;
const isSameNavKey = Boolean(navKey && tabState && navKey === tabState.lastNavKey);
const isSameObject = Boolean(details && tabState && details === tabState.lastDetails);

if (isSameNavKey || isSameObject) {
  return; // Suppress duplicate signal re-delivery
}
```

- **Genuine Rapid Opens:** Separate commits count even if they arrive within 600ms, share the same timestamp, or omit navigation IDs.
- **Duplicate Signals:** Re-delivery with the same navigation ID or the same event object is filtered. Timestamp-only suppression is intentionally not used.
- **Back/Forward:** Destination visits traversed via `forward_back` transition qualifiers are counted as genuine page opens and recorded in audit events.

---

## 5. Visual Evidence: Actual Branch Graphs in Detail View

The E2E test enters the tree detail view via `.tree-open-btn`, asserts that `#detail-view` is unhidden, verifies that at least 6 nodes (`#nodes-layer .map-node`) and at least 4 connector paths (`#edges-layer path`) are rendered, and executes `#zoom-reset` to center all branches.

### 5.1 Screenshot Artifacts & Measured Dimensions

| Artifact File | Viewport | Target Dimensions | Measured Dimensions | File Size | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [`chrome-branch-desktop.png`](file:///D:/Projects/HCI%20Project/docs/test-results/chrome-branch-desktop.png) | Desktop | 1280&times;800 | 1280&times;800 | 54,059 bytes | Actual branch graph canvas. Research Hub root node displays 4 sibling branches (`Tab 2`, `Tab 3`, `Source A`, `Source B`). `Source A` branches to `Child A` and attributed download node with bezier connector edges. |
| [`chrome-branch-reflow.png`](file:///D:/Projects/HCI%20Project/docs/test-results/chrome-branch-reflow.png) | Narrow Reflow | 480&times;800 | 480&times;800 | 42,229 bytes | Narrow responsive reflow layout. Preserves sibling hierarchy, card bounding boxes, and vertical edge connectors. |
| [`firefox-branch-desktop.png`](file:///D:/Projects/HCI%20Project/docs/test-results/firefox-branch-desktop.png) | Desktop | 1280&times;800 outer | 1582&times;883 | 100,478 bytes | Exact visual parity with Chrome: 4 visible sibling branches from Hub, `Child A`, and download node under `Source A`. |
| [`firefox-branch-reflow.png`](file:///D:/Projects/HCI%20Project/docs/test-results/firefox-branch-reflow.png) | Narrow Reflow | 480&times;800 outer (min 514) | 625&times;883 | 61,328 bytes | Narrow responsive reflow layout in Firefox. Bounded indents and edge connections verified. |

---

## 6. Target Load Timing & Simulated Deadline Verification

### 6.1 Asynchronous In-Flight Target Timing
In both Google Chrome (via CDP `Runtime.evaluate`) and Mozilla Firefox (via Marionette `WebDriver:ExecuteScript`), target navigation is triggered asynchronously:
```javascript
window.location.href = 'http://127.0.0.1:{port}/redirect-target-302';
```
The endpoint responds with HTTP 302 to the allowlisted target with a 1.2-second response delay. The runner switches immediately to the extension tab and inspects storage while the destination is loading.
- **Chrome Step 4:** `active=True, completedTrials=0` in flight; after load, `outcome=success, elapsed=5360ms`.
- **Firefox Step 4:** `active=True, completedTrials=0` in flight; after load, `outcome=success, elapsed=4387ms`.

### 6.2 Simulated Deadline Check (Timeout Outcome)
In Step 5 of the browser E2E runs, timeout behavior is verified via a **simulated deadline check**:
- The trial is initialized with `startTime` set to $T_0$.
- The test harness simulates the passage of the 120-second retrieval deadline by advancing the trial's internal timestamp to $T_0 + 120000\text{ ms}$, rather than performing a blocking 120-second wall-clock sleep.
- `StudyManager.checkTimeout()` verifies that `outcome = 'timeout'`, `elapsedMs = 120000`, and `status = 'completed'` are correctly recorded.

### 6.3 Firefox Condition A Scope Clarification
In the Latin square design, Condition A represents the baseline condition (Chrome History in the planned human study). In the automated Firefox test run (`seq_1`), Condition A exercises the shared trial recording, timing controller, NASA-TLX submission, and export pipeline. It does not evaluate Firefox's native `about:history` interface against Chrome's `chrome://history`.

---

## 7. Participant Code Validation & CSV Escaping

### 7.1 Participant Code Regex Boundary Tests
The participant code input validator enforces `/^P([1-9]\d{1,2}|0[1-9])$/`:
- **Valid Codes (Pass):** `P01`, `P02`, `P15`, `P99`, `P100`, `P999`.
- **Invalid Codes (Fail):** `P00`, `P000`, `P001`, `P1`, `P1000`, `P0001`, `P`, `Participant_1`, `15`.
- **Formula Injection (Fail):** `=SUM(1,2)`, `+P01`, `-P01`, `@P01`.

### 7.2 CSV Cell Escaping
The export generator wraps cells containing commas, double quotes, or newlines in double quotes, with internal quotes escaped as `""` (RFC 4180):
- Input: `Hello, World` &rarr; `"Hello, World"`
- Input: `He said "Hi"` &rarr; `"He said ""Hi"""`
- Input: `Line1\nLine2` &rarr; `"Line1\nLine2"`

---

## 8. Automated Test Suite Results

The full automated test suite was executed sequentially via `npm.cmd run build; npm.cmd test`:

```
=== Running Build & Manifest Verification ===
  ✓ Outputs exist with all required build artifacts
  ✓ Release archives match unpacked builds and contain no extraneous, test, or profile files
  ✓ Every shared source asset is copied identically into both builds
  ✓ Chrome manifest adheres to MV3 specifications and declared permissions
  ✓ Firefox manifest adheres to MV3 specifications and declared permissions
  ✓ index.html complies with Extension MV3 CSP and contains empty state
  ✓ app.js does not execute unescaped innerHTML
  ✓ All referenced icons exist and have valid PNG signatures
  12 passed, 0 failed.

=== Running Task 2 Tracker & Storage Tests (Baseline Suite) ===
  ✓ Same-tab navigation creates sequential parent-child relationships
  ✓ Opening link in new tab connects child to opener tab latest page
  ✓ New tab with unknown or closed opener safely creates a root checkpoint
  ✓ webNavigation.onCreatedNavigationTarget associates child tab with opener and resolves parent node
  ✓ Reloads and rapid identical events do not create duplicate nodes
  ✓ Page title updates in place on tabs.onUpdated without creating new nodes
  ✓ A title for a pending new URL does not overwrite the previous visit title
  ✓ Firefox fragment event handles anchors and pushState; tabs URL updates remain a fallback
  ✓ Chrome History API route updates create a child visit
  ✓ Redirect destination is recorded as a child and does not overwrite the prior visit
  ✓ Concurrent same-tab navigations preserve their sequential parent chain
  ✓ Existing open tabs are registered as checkpoints without earlier path
  ✓ Startup reconciles stale tab IDs and checkpoints a changed restored URL
  ✓ A new storage manager instance rehydrates the saved tab association
  ✓ Rapid concurrent recordVisit calls are strictly serialized without data loss
  ✓ Pruning meets the node target in this case while protecting active heads and repairing links
  16 passed, 0 failed.

=== Running Task 11 V2 Schema, Sibling Branching & Provenance Tests ===
  ✓ V1 -> V2 migration creates verified backup, stable treeIds, and reciprocal links
  ✓ V1 -> V2 migration breaks cycles and repairs dangling parents safely
  ✓ Passive 24-hour backup expiration prunes expired backup on wake without alarms
  ✓ Same-tab Back/Forward traversal branches subsequent navigations as siblings
  ✓ Nested ordinary navigation preserves linear hierarchy
  ✓ Symmetrical duplicate traversal invalidates lineage and recovers safely on next link
  ✓ Unrecorded forward_back resynchronizes cleanly to root checkpoint
  ✓ Multiple child tabs opened from one listing share single treeId as siblings
  ✓ Post-initialization unanchored tab to seen URL creates independent root checkpoint
  ✓ Reused recycled tab ID with matching URL collapses to single-node baseline on restart
  ✓ Browser restart inside 60 seconds triggers fresh initialization without timestamp bypass
  ✓ storage.session.get() rejection fails closed without storage mutations
  ✓ Post-commit marker-write failure performs idempotent recovery without duplicate roots
  ✓ Completed download attributes to initiating source page node without sensitive URLs or file paths
  ✓ Unattributed download without referrer creates independent download node labeled Source unavailable
  ✓ Completed download from a CDN domain attributes strictly to source page domain
  ✓ Download with ambiguous referrer matching multiple pages falls back safely to Source unavailable
  ✓ Safe pruning cleans downloadNodeMap and tabState history stacks consistently
  ✓ Clear Map removes graph, tab state, downloadNodeMap, and V1 backup
  19 passed, 0 failed.

=== Running Task 12 Research Tree Explorer UI Tests ===
  ✓ Two-level Explorer controls, overview/detail landmarks, dialog semantics, and script order are present
  ✓ Extension markup and dynamic rendering keep CSP, XSS safety, and download-reopen restrictions
  ✓ Light and dark text color combinations meet WCAG AA contrast and CSS includes responsive & reduced-motion support
  ✓ Three independent root treeIds produce exactly three overview cards
  ✓ Multiple opener-created product tabs stay in one tree card and align as parallel siblings
  ✓ Back-to-parent same-tab branches remain in one card and render as siblings in detail view
  ✓ Detail scoping isolates one treeId without cross-tree leakage and app restores overview state
  ✓ Attributed downloads appear under verified source page while unattributed downloads stay in separate shelf
  ✓ Global and tree-local filtering search titles/domains/files and preserve ancestry context without false parents
  ✓ Root-pruned trees keep one card and large or cyclic graphs render deterministically
  ✓ Production URL validation allows only HTTP and HTTPS
  ✓ Narrow responsive reflow layout produces readable node bounding boxes and preserves sibling & download hierarchy
  ✓ Large and deep trees in narrow reflow layout maintain bounded horizontal indents and valid navigation coordinates
  ✓ Clear-history message uses the background storage queue and resets graph plus tab links
  14 passed, 0 failed.

=== Running Task 18 Branching & Layout Tests ===
  ✓ Minimal reproducible navigation scenario produces genuine branching hierarchy in storage
  ✓ Research Trees overview groups multi-tab and same-tab siblings into a single tree
  ✓ Desktop horizontal layout assigns equal X to siblings and distinct ascending Y coordinates
  ✓ Narrow reflow layout preserves hierarchical depths and valid edge connections
  4 passed, 0 failed.

=== Running Task 18 User Study & Privacy Tests ===
  ✓ Corpus allowlist strictly requires local loopback origin and exact study paths
  ✓ Data dictionary file and manager export match exact schema and snake_case format
  ✓ CSV escaping: correctly handles commas, double quotes, and newlines
  ✓ Participant ID validation: enforces P01-P999 and rejects formula injection, P00, P000, P001, or free-form names
  ✓ Target completion requires document load completion (status === complete)
  ✓ Study mode is disabled by default and captures zero data when inactive
  ✓ Storage privacy boundary: zero raw URLs, query/hash material, or browser tab IDs in storage during active trial or after session finish
  ✓ Back/Forward navigation: counts destination visits and records forward_back transition qualifiers
  ✓ Fast genuine repeat opens within 600ms vs duplicate signals: counts distinct visits and suppresses exact signal re-deliveries
  ✓ Event-level deduplication: counts across tabs and after off-corpus visits, excludes reloads and hash-only updates
  ✓ Finish session action: audits session, completes active trial as abandoned, and blocks further trials
  ✓ NASA-TLX: enforces step-5 increments, validates boundaries, and computes raw TLX
  ✓ Privacy Audit: CSV and JSON exports contain zero raw URLs, titles, search queries, or off-corpus records
  ✓ Redirect destination handling: counts server redirect destinations and collapses client redirect intermediates
  ✓ Counterbalanced Latin Square: enforces all 8 valid cells and rejects invalid combinations
  15 passed, 0 failed.

Total: 80 passed, 0 failed.
```

---

## 9. Browser Runtime Verification (E2E)

Automated runtime verification was executed via `scripts/e2e-task18-runtime.py`:

| Browser | Version | Automation Protocol | Log File | Pre-Test Errors | Post-Test Errors | Result |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **Google Chrome** | `157.0.8103.80` (x64 Windows) | Chrome DevTools Protocol (CDP) | [`chrome-task18-e2e.log`](file:///D:/Projects/HCI%20Project/docs/test-results/chrome-task18-e2e.log) | 0 | 0 | **PASSED** |
| **Mozilla Firefox** | `160.0.1` (x64 Windows) | Marionette WebDriver | [`firefox-task18-e2e.log`](file:///D:/Projects/HCI%20Project/docs/test-results/firefox-task18-e2e.log) | 0 | 0 | **PASSED** |

### Verified End-to-End Steps
1. **Sibling Branch Scenario:** Research Hub opened, 2 child tabs opened via `target="_blank"`, same-tab Back/Forward traversal with download executed. Storage graph audited: 7 total nodes, Hub has 4 sibling children (`tab2`, `tab3`, `source-a`, `source-b`), `source-a` has 2 children (`child-a`, `download`).
2. **Detail View & Visual Verification:** Activated `.tree-open-btn`, asserted `#detail-view` visibility, verified rendered nodes (&ge; 6) and edges (&ge; 4), executed `#zoom-reset`, and captured desktop and reflow screenshots.
3. **Latin Square Sequence Assignment:** Chrome runs `seq_4` (Period 1: B/pack_x, Period 2: A/pack_y); Firefox runs `seq_1` (Period 1: A/pack_x, Period 2: B/pack_y). Auto-derivation and locked inputs confirmed.
4. **Redirects & Privacy Audit:** `/redirect-wrong-302` increments the destination count once for `px_efficiency`; `/redirect-client` adds one final `px_grid` event and no intermediate event. Verified zero raw URLs, query strings, hashes, or numeric tab IDs in `spatial_browser_study_data`.
5. **Asynchronous In-Flight Check:** Navigated asynchronously through `/redirect-target-302` to a delayed target. Verified `hasActiveTrial: true, completedTrialCount: 0` while the final document was in flight. The trial completed with `outcome: 'success'` only after load completion.
6. **NASA-TLX Scoring:** Live calculation verified (unweighted arithmetic mean = 23.3 / 100).
7. **Simulated Deadline Check:** Simulated 120s timeout on Period 2, verified `outcome: 'timeout'` and `elapsedMs = 120000`.
8. **Finish Session Action:** Audited session, confirmed `status = 'finished'` and `session_finish` audit event logged.
9. **Export Privacy Audit:** CSV and JSON exports verified to contain zero raw URLs, query strings, or off-corpus page titles.
10. **Reset & Clean Delete:** History reset preserves study trials (2 trials); explicit delete removes all study records completely.

---

## 10. Deliverables Index

| Deliverable | Location | Description |
| :--- | :--- | :--- |
| **Study Manager & Privacy Boundary** | `src/shared/study-manager.js` | Latin square matrix, load-complete target detection, transient in-memory tab state, redirect destination counting, signal deduplication, Finish Session, CSV/JSON exports |
| **Tracker Completion Hook** | `src/shared/tracker.js` | Restricted study navigation notifications strictly to `changeInfo.status === 'complete'` |
| **Corpus & Local Allowlist** | `src/shared/study-corpus.js` | Strict loopback origin requirement, exact study path matching, opaque key mapping |
| **UI Controller & Detail View Access** | `src/shared/app.js`, `index.html`, `styles.css` | Detail view delegation, auto-derived assignments, step-5 TLX sliders, Finish Session button, Data Dictionary viewer |
| **Synthetic Topic Packs** | `study/fixtures/pack_x/`, `study/fixtures/pack_y/` | Matched 8-page fixtures with Depth 2 target traversal |
| **Automated Test Suite** | `tests/test-study.mjs` | 15 automated study & privacy tests (80 tests total across project) |
| **Browser Runtime Runner** | `scripts/e2e-task18-runtime.py` | Isolated-profile browser automation for Chrome 157 and Firefox 160 |
| **Browser Runtime Logs** | `docs/test-results/*task18-*.{log,json}` | Full Chrome & Firefox execution logs and 0-error audits |
| **Detail Branch Screenshots** | `docs/test-results/*branch-*.png` | Detail view branch graph screenshots across desktop and reflow viewports |
| **Build Outputs & Checksums** | `outputs/`, `outputs/SHA256SUMS` | Freshly built Chrome & Firefox packages |
| **Task 18 Report** | `task output overview/task-18-output.md` | This document |

---

## 11. Lead Re-Review & Acceptance — 2026-11-21

The lead reproduced the review checks after correcting one remaining deduplication edge case: timestamp-only equality could still suppress two distinct commits when a browser omitted navigation IDs. Timestamp-based suppression was removed, and a regression assertion now proves that two same-page commits with no IDs and identical timestamps both count. A separate-ID/same-timestamp case is covered as well.

Final verification on the accepted source state:
- Source commit verified on `codex/task-18-user-study`: `6ebcdaf` (`test(study): verify client redirect meta-refresh and timestamp collision handling`).
- `npm.cmd run build`: passed; Chrome 2.0.0 (minimum Chrome 109) and Firefox 2.0.0 (minimum Firefox 115.0) packages generated.
- `npm.cmd test`: **80 passed, 0 failed** (12 build/manifest, 35 tracker/storage, 14 UI, 4 branch, 15 study/privacy).
- `python scripts/e2e-task18-runtime.py`: Chrome 157.0.8103.80 and Firefox 160.0.1 both passed. Each run verified the real HTTP 302 wrong-page destination, meta-refresh final-page count, delayed HTTP 302 target load, storage/export privacy, sequence mapping, reset/delete, and branch detail screenshots; pre/post error audits each recorded 0 errors.
- The four browser/viewport screenshots show the actual detail graph with visible sibling branches and Source A descendants.

**Task 18 is accepted as implementation and study-readiness work.** The published v2.0.0 release remains unchanged; the branch has not been merged, tagged, or published. No human participants were recruited and no efficacy result is claimed. Do not begin recruitment or run a human pilot until the supervisor/institution has approved the protocol and the owner explicitly authorizes that next phase.
