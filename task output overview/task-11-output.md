# Task 11 Output — V2 Storage, Branch Tracking, Session Safety, and Download Capture

**Status:** Accepted — Task 11 Complete (Section 57)
**Milestone:** 11 (Core Backend V2 Architecture)  
**Browser Targets:** Google Chrome 156.0.8078.48 (min 109+) & Mozilla Firefox 158.0.1 (strict_min_version: 115.0)  
**Execution Date:** 2026-11-12  

---

## 1. Executive Summary & Scope Alignment

Task 11 implements the approved core backend. Section 54 records the updated provenance implementation and unit tests, and Section 56 records the 2026-11-12 isolated-profile browser E2E runs verifying distinct-host download provenance (`http://localhost` source vs `http://127.0.0.1` file host) in both Chrome and Firefox per Section 55.

In accordance with explicit task boundaries:
- **Core backend only:** Graph/Storage V2, branch-aware tracking, session safety/startup barrier, and distinct-host download provenance are implemented and verified in automated and browser suites.
- **UI redesign preserved for Task 12:** The existing single-tree forest layout and toolbar/drawer interactions are preserved without layout regressions; the multi-card Research Tree Explorer overview and pan/zoom detail-view redesign will follow in Task 12 after lead review.
- **Strict permissions:** Added strictly `"downloads"`. Zero `"debugger"` and zero `"alarms"` permissions requested.
- **Browser compatibility:** Chrome minimum maintained at 109; Firefox `strict_min_version` raised to `115.0` (ESR 115 baseline supporting `storage.session`).

---

## 2. Changed Files & Deliverables Summary

| File | Change Scope & Purpose |
| :--- | :--- |
| [`src/chrome/manifest.json`](file:///d:/Projects/HCI%20Project/src/chrome/manifest.json) | Added `"downloads"` permission to declared permissions list. |
| [`src/firefox/manifest.json`](file:///d:/Projects/HCI%20Project/src/firefox/manifest.json) | Added `"downloads"` permission; raised `strict_min_version` from `"109.0"` to `"115.0"`. |
| [`src/shared/storage.js`](file:///d:/Projects/HCI%20Project/src/shared/storage.js) | Implemented Schema V2: `treeId`, `nodeType: 'page'\|'download'`, `downloadNodeMap`, `baselineEstablished`, reciprocal parent/child link maintenance, crash-safe V1 $\to$ V2 migration with raw backup (`spatial_browser_history_data_v1_backup`) and candidate validation, passive 24-hour backup expiration on wake (`expireBackupIfOld()`), download deduplication index, safe pruning with active head protection and reciprocal/stack/downloadNodeMap cleanup, and complete wipe in Clear Map. |
| [`src/shared/tracker.js`](file:///d:/Projects/HCI%20Project/src/shared/tracker.js) | Implemented Navigation Tracker V2: synchronous event listener registration, startup barrier (`ensureSessionReady()`) holding up to 20 events, `storage.session` marker checks with bounded retries and fail-closed storage protection, single-node baseline collapse for live tabs discovered during initialization (`baselineEstablished: true`), same-tab Back/Forward traversal direction resolution and sibling branching (`Wikipedia -> A -> Back -> B`), symmetrical traversal lineage invalidation (`lineageInvalidated: true, currentNodeId: null`), unrecorded `forward_back` resynchronization with fresh single-node stack, download event listeners (`downloads.onCreated`, `downloads.onChanged`), referrer-based page attribution (source-domain fallback issue documented in Section 53), privacy boundary enforcement, and `destroy()` listener cleanup. |
| [`scripts/build.mjs`](file:///d:/Projects/HCI%20Project/scripts/build.mjs) | Added `'downloads'` to `expectedPermissions` in build-time manifest verification. |
| [`tests/verify-builds.mjs`](file:///d:/Projects/HCI%20Project/tests/verify-builds.mjs) | Updated manifest permission expectations to `['tabs', 'storage', 'webNavigation', 'downloads']` and Firefox min version to `'115.0'`. |
| [`tests/test-tracker.mjs`](file:///d:/Projects/HCI%20Project/tests/test-tracker.mjs) | Added 17 unit and failure-injection tests covering Schema V2 migration, cycle/dangling link repair, passive 24h backup expiry, Back/Forward sibling branching, nested linear navigation, symmetrical traversal ambiguity invalidation, unrecorded forward_back resynchronization, website-created child tabs, post-initialization root isolation, reused recycled tab ID single-node collapse (Scenario 8A), 60s restart marker check (Scenario 8B), storage read failure fail-closed gate (Scenario 8C), post-commit marker write rejection with idempotent worker recreation and 3-node stack collapse (Scenario 8D), download provenance attribution with privacy boundaries, unattributed downloads, safe pruning across active heads and stacks, and Clear Map complete wipe. |
| [`scripts/e2e-firefox-verification.py`](file:///d:/Projects/HCI%20Project/scripts/e2e-firefox-verification.py) | Hardened `MarionetteClient.connect` to catch `(ConnectionRefusedError, ConnectionResetError, OSError)` during Firefox restart, and added a 1.0s OS socket teardown delay. |
| [`README.md`](file:///d:/Projects/HCI%20Project/README.md) & [`docs/DEVELOPMENT.md`](file:///d:/Projects/HCI%20Project/docs/DEVELOPMENT.md) | Updated project status, Firefox 115.0+ floor, `"downloads"` permission rationale with privacy boundaries, Schema V2 specification, and startup barrier / migration details. |
| [`docs/TEST_PLAN.md`](file:///d:/Projects/HCI%20Project/docs/TEST_PLAN.md) & [`RELEASE_NOTES.md`](file:///d:/Projects/HCI%20Project/RELEASE_NOTES.md) | Documented 53 passing automated tests and successful Chrome/Firefox isolated-profile verification runs with 0 errors and 0 warnings. |
| [`task output overview/README.md`](file:///d:/Projects/HCI%20Project/task%20output%20overview/README.md) & [`task output overview/tasks/README.md`](file:///d:/Projects/HCI%20Project/task%20output%20overview/tasks/README.md) | Updated task status index to reflect Task 11 implementation completed and submitted for review. |

---

## 3. Schema V2, Migration & Data Integrity Architecture

### 3.1 Schema V2 Structure
Persisted under `spatial_browser_history_data` in `chrome.storage.local` / `browser.storage.local`:
```json
{
  "schemaVersion": 2,
  "nodes": {
    "node_1730000000000_a1b2": {
      "id": "node_1730000000000_a1b2",
      "treeId": "tree_node_1730000000000_a1b2",
      "nodeType": "page",
      "url": "https://arxiv.org/abs/2401.08922",
      "title": "Quantum Computing Survey",
      "timestamp": 1730000000000,
      "parentNodeId": null,
      "childNodeIds": ["dl_node_1730000010000_x1y2"],
      "isCheckpoint": true,
      "tabId": 14
    },
    "dl_node_1730000010000_x1y2": {
      "id": "dl_node_1730000010000_x1y2",
      "treeId": "tree_node_1730000000000_a1b2",
      "nodeType": "download",
      "filename": "quantum_survey.pdf",
      "originDomain": "arxiv.org",
      "timestamp": 1730000010000,
      "parentNodeId": "node_1730000000000_a1b2",
      "childNodeIds": [],
      "isCheckpoint": false,
      "downloadId": 42
    }
  },
  "tabState": {
    "14": {
      "currentNodeId": "node_1730000000000_a1b2",
      "historyStack": ["node_1730000000000_a1b2"],
      "historyIndex": 0,
      "lineageInvalidated": false,
      "baselineEstablished": true
    }
  },
  "metadata": {
    "createdAt": 1730000000000,
    "lastPrunedAt": null,
    "totalNodesCreated": 2,
    "downloadNodeMap": {
      "42": "dl_node_1730000010000_x1y2"
    }
  }
}
```

### 3.2 Crash-Safe V1 $\to$ V2 Migration Protocol
1. **Raw Backup Preservation:** Before modifying an existing V1 graph, `_migrateV1ToV2` writes the raw V1 payload to `spatial_browser_history_data_v1_backup` with `backupCreatedAt: Date.now()`.
2. **Structural Normalization:**
   - Enforces `nodeType = 'page'` for all existing nodes.
   - Enforces reciprocal parent/child relationships: $C \in P.\text{childNodeIds} \iff C.\text{parentNodeId} === P$.
   - Breaks cycles via DFS traversal; any backward edge is severed and promoted to a root checkpoint (`parentNodeId: null, isCheckpoint: true`).
   - Repairs dangling parents: if $P \notin \text{nodes}$, $C.\text{parentNodeId} \leftarrow \text{null}, C.\text{isCheckpoint} \leftarrow \text{true}$.
   - Synthesizes stable `treeId`: computed via root-tracing so all nodes in a tree share `'tree_' + rootNode.id`.
   - Normalizes legacy string `tabState[tabId]` to `{ currentNodeId: id, historyStack: [id], historyIndex: 0, lineageInvalidated: false, baselineEstablished: true }`.
3. **Candidate Validation Before Commit:**
   - Validates that `candidate.nodes` is an object, every node has `id` and `treeId`, no dangling parent references exist, and reciprocal links hold. If validation fails, an error is thrown and the raw V1 data remains untouched.
4. **Passive 24-Hour Backup Expiration:**
   - On background wake/initialization (`expireBackupIfOld()`), if `Date.now() - backupCreatedAt > 24 * 60 * 60 * 1000`, the backup key is removed. Zero `alarms` permission required.
5. **Clear Map Action:**
   - Completely removes `spatial_browser_history_data` and removes `spatial_browser_history_data_v1_backup`, resetting nodes, `tabState`, and `downloadNodeMap`.

---

## 4. Branch-Aware Navigation Tracking & Session Safety

### 4.1 Same-Tab Back/Forward Traversal & Sibling Branching
- Per-tab history is tracked in `tabState[tabId].historyStack` and `historyIndex`.
- When an ordinary link is clicked:
  - If `historyIndex < historyStack.length - 1`, forward entries beyond `historyIndex` are truncated.
  - The new node is attached to the current active head ($S[i]$).
  - The new node is pushed to `historyStack`, and $i$ increments.
- When `webNavigation.onCommitted` arrives with `transitionQualifiers: ['forward_back']`:
  - **Unambiguous Back:** Target URL matches $S[i-1] \implies i \leftarrow i-1$, `currentNodeId` updated to $S[i-1]$, zero graph mutations.
  - **Unambiguous Forward:** Target URL matches $S[i+1] \implies i \leftarrow i+1$, `currentNodeId` updated to $S[i+1]$, zero graph mutations.
  - **Sibling Branching Result:** Sequence `Wikipedia -> Source A -> Back -> Wikipedia -> Source B` creates Source A and Source B as siblings under Wikipedia without creating duplicate Wikipedia nodes.
  - **Symmetrical Traversal Ambiguity:** If matching indices in `historyStack` $> 1$, or immediate backward and forward neighbors both match identical URLs ($A \to B \to A$), the active lineage is severed:
    ```javascript
    tabState[tabId].currentNodeId = null;
    tabState[tabId].lineageInvalidated = true;
    ```
    Subsequent ordinary navigation safely recovers to an independent root checkpoint in a new research tree.
  - **Unrecorded `forward_back` Target:** If the URL matches zero entries in `historyStack`, the tracker does NOT attach it under $S[i]$; it creates an independent root checkpoint and resets the tab state to a fresh 1-node stack `[resyncNode.id]`, $i=0$.

### 4.2 Website Opener Child Tab Branching
- Website-created child tabs (`tabs.onCreated` with `openerTabId` or `webNavigation.onCreatedNavigationTarget`) attach to the opener's active head node and join the opener's `treeId`.
- Unknown or closed openers (`about:blank` closed prior to commit, or missing opener metadata) fall back safely to an independent root checkpoint (`parentNodeId: null, isCheckpoint: true, treeId: 'tree_' + id`).

### 4.3 Startup Barrier & Session Lifecycle (Scenarios 8A–8D)
- **Synchronous Listener Registration:** Event listeners are registered synchronously at script load; tracking execution is gated behind `ensureSessionReady()`.
- **Ordinary Worker Wakes:** Verified `storage.session.get('sessionInitialized') === true` immediately opens the barrier and preserves existing tab stacks.
- **Discovered Live Tabs at Startup (Scenario 8A):**
  - Triggered exclusively when `sessionInitialized` is absent.
  - Discovers open tabs via `tabs.query({})`.
  - Stale prior-session multi-node stacks are unconditionally collapsed to single-node baselines `[currentNodeId]` at $i=0$ with `baselineEstablished: true`. Matching recycled tab ID and URL alone is zero-trust.
  - Tabs with changed URLs or unanchored tabs re-anchor if $|M| == 1$ or create independent root checkpoints.
  - Stale closed tab IDs are pruned from `tabState`.
- **Browser Restart Within 60 Seconds (Scenario 8B):**
  - No heuristic timestamp bypass exists; absent session marker unconditionally triggers fresh baseline establishment.
- **Fail-Closed Storage Read Failure (Scenario 8C):**
  - If `storage.session.get()` rejects persistently across bounded retries ([50, 100, 200] ms), the tracker fails closed: executes zero writes to `storage.local`, holds up to 20 events in `sessionPendingQueue`, drops excess events with logged warnings, and recovers cleanly on the next healthy worker wake.
- **Post-Commit Marker-Write Failure & Idempotent Worker Recreation (Scenario 8D):**
  - If `storage.session.set({ sessionInitialized: true })` fails after local reconciliation commits, the barrier remains closed. Run 1's transient queue is dropped when the worker terminates. Fresh Worker Run 2 discovers `baselineEstablished: true`, preserves the collapsed single-node baseline without restoring stale 3-node stacks, creates no duplicate root nodes, successfully writes the marker, and drains Run 2's queued events cleanly.

---

## 5. Download Provenance Attribution & Privacy Guarantees

### 5.1 Completed Download Capture
- Listens to `downloads.onCreated` and `downloads.onChanged` (`state.current === 'complete'`).
- In-progress, interrupted, or cancelled downloads are ignored.

### 5.2 Attribution Rules
- Uses browser-provided `referrer` metadata:
  - If `normalizeUrl(referrer)` unambiguously matches exactly one page visit in `state.nodes` ($|M| == 1$), the download node is created as a child of that page node (`parentNodeId = page.id`, `treeId = page.treeId`). The source page adds the download ID to its `childNodeIds`.
  - If `referrer` is missing, unparseable, or matches zero or multiple nodes, the download is recorded as an unattributed node (`parentNodeId: null, isCheckpoint: true, originDomain: extractDomain(item.url || item.referrer)`). Never guesses from the active tab or a domain alone.

### 5.3 Privacy Boundary Guarantees
- **Never stored:** Downloaded file contents, local filesystem paths, full download URLs, auth tokens, or query strings.
- **Stored metadata:**
  - `id`: Unique download node ID (`dl_node_...`)
  - `treeId`: Inherited tree ID or independent tree ID
  - `nodeType`: `'download'`
  - `filename`: Basename only (e.g. `quantum_survey.pdf`)
  - `originDomain`: Hostname only (e.g. `arxiv.org`)
  - `timestamp`: Completion timestamp
  - `downloadId`: WebExtensions numeric download ID
  - `parentNodeId`: Resolved source page node ID or `null`
- **Deduplication:** Persistent index `metadata.downloadNodeMap[downloadId] = nodeId` prevents duplicate nodes when both `onCreated` and `onChanged` fire.
- **Pruning & Cleanup:** Pruning a download node removes its key from `downloadNodeMap`. Clear Map purges `downloadNodeMap`.

---

## 6. Verification Results

### 6.1 Automated Test Suite (`npm.cmd test`)
Run Command: `npm.cmd test`  
Result: **53 passed, 0 failed** across all test suites.

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

=== Testing Toolbar Launch and Focus Behavior ===

  ✓ Opens new tab when placeholder page is not already open
  ✓ Focuses existing tab when placeholder page is already open
  ✓ Repeated clicks: first click opens, second click focuses existing tab
  ✓ Simultaneous toolbar clicks do not open duplicate tabs

Verification complete: 12 passed, 0 failed.

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
  ✓ Unattributed download without referrer creates independent download node
  ✓ Safe pruning cleans downloadNodeMap and tabState history stacks consistently
  ✓ Clear Map removes graph, tab state, downloadNodeMap, and V1 backup

Verification Complete: 33 passed, 0 failed.

=== Running Task 3 UI Logic & Structure Tests ===

  ✓ Map controls, dialog semantics, lineage buttons, and script ordering are present
  ✓ Extension markup and dynamic rendering keep CSP and text safety
  ✓ Light and dark text color combinations meet WCAG AA normal-text contrast
  ✓ Production URL validation allows only HTTP and HTTPS
  ✓ Production forest layout keeps branches separated and renders large and cyclic graphs
  ✓ Production filtering searches title/address and applies time ranges
  ✓ App implements first-render fitting, filter selection cleanup, dialog focus handling, and button lineage
  ✓ Clear-history message uses the background storage queue and resets graph plus tab links

UI Test Verification Complete: 8 passed, 0 failed.
```

### 6.2 Submitted Browser Runtime Runs (Baseline Smoke; Task 11 Acceptance Pending)

Both target browsers were executed in real temporary profiles with local test endpoints and live extension loading:

#### 1. Google Chrome 156.0.8078.48 (x64 Windows)
- **Harness:** `scripts/e2e-chrome-verification.py` via Chrome DevTools Protocol (CDP).
- **Execution Log:** [`docs/test-results/chrome-e2e.log`](file:///d:/Projects/HCI%20Project/docs/test-results/chrome-e2e.log)
- **Audit Artifacts:**
  - Pre-Restart Phase: [`docs/test-results/chrome-errors-pre-restart.json`](file:///d:/Projects/HCI%20Project/docs/test-results/chrome-errors-pre-restart.json) — **0 errors, 0 warnings** (117 CDP events evaluated).
  - Post-Restart Phase: [`docs/test-results/chrome-errors-post-restart.json`](file:///d:/Projects/HCI%20Project/docs/test-results/chrome-errors-post-restart.json) — **0 errors, 0 warnings** (15 CDP events evaluated).
- **Steps Verified:**
  - Step 1: Unpacked MV3 extension loaded via `Extensions.loadUnpacked`, background service worker discovered and attached (`hasStorage: true, hasTracker: true`).
  - Step 2: Native toolbar action click 1 opened map tab; click 2 focused existing tab without duplicate creation.
  - Step 3: Same-tab linking (`/page1` $\to$ `/page2`), HTTP 302 redirect, reload deduplication (1 node stored), dynamic title update, anchor fragment update, SPA route `pushState`, opener child tab relationship (`/child` parent is `/opener`), and unknown/closed opener safe fallback (`/unknown-parent` is root checkpoint with `parentNodeId: null`).
  - Step 4: Closed child node selection, `#reopen-btn` click, and visit count delta verification (7 visits $\to$ 8 visits).
  - Step 5: Search typing and debounce (reduced to 2 visits), search clear (restored to 8 visits), 1-hour time filter boundary (excluded 2hr-old visit), and 'all'/'day' restoration.
  - Step 6: Viewport pan, keyboard arrow pan, zoom in/out/reset, Enter key node selection, Clear Modal Tab/Shift+Tab focus trap, cancel preservation, and confirm storage wipe (0 visits, empty state).
  - Step 7: Pre-restart error audit: 0 errors, 0 warnings.
  - Step 8: Background service worker suspension via CDP `Target.closeTarget`, on-demand re-awakening with storage intact, browser process termination, relaunch with persistent profile, and storage rehydration.
  - Step 9: Post-restart error audit: 0 errors, 0 warnings.
  - Step 10: Cross-browser parity evaluation confirmed.
- **Outcome:** **ALL EXECUTED BASELINE CHROME SMOKE CHECKS PASSED (0 FAILURES); TASK 11 ACCEPTANCE SCENARIOS REMAIN OPEN.**

#### 2. Mozilla Firefox 158.0.1 (x64 Windows)
- **Harness:** `scripts/e2e-firefox-verification.py` via Marionette protocol.
- **Execution Log:** [`docs/test-results/firefox-e2e.log`](file:///d:/Projects/HCI%20Project/docs/test-results/firefox-e2e.log)
- **Audit Artifacts:**
  - Pre-Restart Phase: [`docs/test-results/firefox-errors-pre-restart.json`](file:///d:/Projects/HCI%20Project/docs/test-results/firefox-errors-pre-restart.json) — **0 errors, 0 warnings** (5 Gecko console records evaluated).
  - Post-Restart Phase: [`docs/test-results/firefox-errors-post-restart.json`](file:///d:/Projects/HCI%20Project/docs/test-results/firefox-errors-post-restart.json) — **0 errors, 0 warnings** (24 Gecko console records evaluated).
- **Steps Verified:**
  - Step 1: Temporary unpacked extension installed (`Addon:Install`, ID: `spatial-browser-history@term-project.local`), toolbar button pinned.
  - Step 2: Browser action click 1 opened map tab (`totalTabs=2`); click 2 refocused existing tab (`totalTabs=2`).
  - Step 3: Navigation sequence, reload deduplication, title update, fragment update, SPA pushState, opener child relationship, and unknown/closed opener root checkpoint fallback.
  - Step 4: Closed child node selection, `#reopen-btn` click, visit count delta (7 $\to$ 8 visits).
  - Step 5: Search input via `WebDriver:ElementSendKeys`, 1-hour time boundary filter, 'all'/'day' restore.
  - Step 6: Pointer pan, keyboard arrow pan, zoom controls, Enter key node selection, Clear modal Tab/Shift+Tab focus trap, cancel preservation, confirm wipe.
  - Step 7: Pre-restart error audit: 0 errors, 0 warnings.
  - Step 8: Process termination, persistent profile relaunch, Marionette reconnection with socket-retry resilience, storage rehydration.
  - Step 9: Post-restart error audit: 0 errors, 0 warnings.
  - Step 10: Gecko `Services.console` ring buffer lifecycle evaluated and documented.
- **Outcome:** **ALL EXECUTED BASELINE FIREFOX SMOKE CHECKS PASSED (0 FAILURES); TASK 11 ACCEPTANCE SCENARIOS REMAIN OPEN.**

---

## 7. Known Limits & Deferred Scope

1. **Overview & Detail Multi-Tree UI Redesign Deferred to Task 12:**
   - Task 11 is accepted per Section 57. The UI redesign specified in Task 10 v15 is now assigned as Task 12.
   - The UI redesign specified in Task 10 v15 (Research Tree Explorer overview card grid, detail pan/zoom canvas, and downloads drawer) is planned for Task 12 after Task 11 is accepted.
2. **Gecko Console Lifecycle Constraint:**
   - Mozilla Firefox's `Services.console` is an in-process ring buffer that resets upon process termination. Comprehensive telemetry auditing requires per-phase captures (pre-restart and post-restart), which are fully captured and preserved.

---

## 8. Completion Checklist & Next Actions

- [x] Schema V2 core, stable `treeId`, download nodes, and `downloadNodeMap` index implemented.
- [x] Crash-safe V1 $\to$ V2 migration with raw backup and candidate validation implemented and unit tested.
- [x] Passive 24-hour backup expiration on wake implemented without `alarms` permission.
- [x] Branch-aware Back/Forward activation and sibling branching implemented and unit tested.
- [x] Symmetrical traversal ambiguity lineage invalidation and root recovery implemented and unit tested.
- [x] Unrecorded `forward_back` resynchronization with fresh single-node stack implemented and unit tested.
- [x] Startup readiness barrier with bounded retry, fail-closed handling, and live tab baseline collapse implemented.
- [x] Post-commit session marker write failure with idempotent worker recreation and stale stack collapse implemented and tested (Scenario 8D).
- [x] Download provenance attribution corrected: source domain derived strictly from unique source page/referrer ($|M|=1$); missing or ambiguous referrers set to "Source unavailable" (unit tests 25, 25b, 25c pass).
- [x] Chrome minimum kept at 109; Firefox `strict_min_version` raised to `115.0`.
- [x] Both extension packages rebuilt (`outputs/`); all build checks pass.
- [x] `npm.cmd test` passes 55/55 tests across all 3 suites.
- [x] Task 11 runtime acceptance: sibling branching, distinct-host download provenance (`originDomain === "localhost"` vs `127.0.0.1` file host), unattributed/ambiguous downloads (`Source unavailable`), and multi-node restart checks pass in both Chrome 156.0.8078.48 and Firefox 158.0.1 (Section 56).
- [x] All index files updated (`task output overview/README.md`, `task output overview/tasks/README.md`, `task output overview/tasks/task-11.md`).
- [x] Lead acceptance: Task 11 accepted per Section 57; Task 12 assigned in tasks/task-12.md.

## 53. Lead Review — Task 11 Revision Required

I reviewed the implementation report, source, automated test results, browser scripts, and execution logs against [`tasks/task-11.md`](tasks/task-11.md). I reran `npm.cmd test`: **53 passed, 0 failed**. The V2 implementation and packaging are substantial, but Task 11 is not accepted yet because download source attribution can report the file host as the source and required browser scenarios are absent from the submitted runtime evidence.

### Required corrections before acceptance

1. **Store the source website as the download origin, never the final file host.** In `src/shared/tracker.js`, `_processCompletedDownload()` currently sets `originDomain` from `item.url || item.referrer`. `item.url` is the final download URL and may be a CDN or unrelated file host. The current unattributed-download test supplies an empty referrer and asserts `datasets.org` from the final file URL, even though the approved rule requires “Source unavailable.” When one referrer uniquely matches a captured page, derive the displayed source domain from that matched page/referrer. When no unique source page is resolved, store/render `Source unavailable`; do not use the final download URL as provenance. Add unit cases for a source page on one domain downloading from a different CDN domain, an empty referrer, and an ambiguous referrer. Keep raw URLs and query strings out of storage.
2. **Run and attach the missing Task 11 runtime scenarios in both browsers.** The current Chrome and Firefox logs demonstrate the existing sequential navigation, opener child, unknown-opener, UI, and restart smoke flows. They do not exercise actual Back-to-parent sibling branching, any completed or unattributed download, or a multi-node tab baseline after restart. The Chrome harness contains no download scenario, and the Firefox script change only adjusts Marionette reconnect handling. Extend the local test flows and capture new Chrome 156 and Firefox 158 logs in isolated profiles to verify:
   - `Wikipedia → Source A → Back → Source B` produces Source A and Source B as siblings under one parent;
   - a completed local download with a different file-host domain records the source page/domain, and a missing/ambiguous referrer stays “Source unavailable”;
   - a multi-node session is reduced to the approved single-node baseline after browser restart, without losing the stored graph.
   Known-opener child branching is present in the current logs; retain that check. Do not describe the legacy smoke log as evidence for the missing scenarios.
3. **Refresh the report and test-plan claims.** Update `task-11-output.md`, `docs/TEST_PLAN.md`, and relevant README/release notes to distinguish the existing smoke checks from the newly executed Task 11 checks. Keep the count of 53 automated tests only if it still matches after adding the required unit cases. Rebuild both packages, rerun `npm.cmd test`, and record exact browser versions, scenario results, and log paths.

Keep Task 11 as the active assignment. Do not start Task 12 until these corrections and runtime checks are reviewed and accepted. Preserve this review section when updating the report.

## 54. Revision Submitted for Lead Review — Addressing Section 53

This section provides the implementation details, automated test coverage, and isolated-profile runtime evidence addressing all items in Section 53.

### 54.1 Item 1: Download Provenance Correction & Unit Test Expansion

#### 1. Architecture & Code Modification in `src/shared/tracker.js`
In `_processCompletedDownload(item)` ([`src/shared/tracker.js`](file:///d:/Projects/HCI%20Project/src/shared/tracker.js#L675-L715)), all derivation of `originDomain` from the final download URL (`item.url`) has been completely removed:
- **Default State:** `originDomain` initializes strictly to `'Source unavailable'` and `parentNodeId` to `null`.
- **Unique Source Attribution ($|M| = 1$):** If `item.referrer` is present and trackable (`isTrackableUrl(referrer)`), the graph is queried for page visits matching the normalized referrer. Only when exactly one page match is resolved (`matches.length === 1`), `parentNodeId = matches[0].id` and `originDomain = extractDomain(matches[0].url)`.
- **Missing or Ambiguous Fallback ($|M| \ne 1$):** If the referrer is missing, empty, invalid, untracked, or ambiguous ($|M| > 1$ matching multiple captured pages), `parentNodeId` remains `null`, `originDomain` remains `'Source unavailable'`, and the download node is registered as an independent root checkpoint (`isCheckpoint: true`).
- **Privacy Boundary Enforcement:** Raw URLs, query strings, and absolute filesystem paths are strictly excluded from storage; only the sanitized filename basename, originating domain (or `'Source unavailable'`), completion timestamp, stable `downloadId`, and reciprocal relationship IDs are persisted.

#### 2. Unit Suite Expansion in `tests/test-tracker.mjs`
The unit suite was updated and expanded to cover all edge cases (suite increased from 33 to 35 tests, total automated suite from 53 to 55 tests):
- **Corrected Test 25:** Unattributed download with empty referrer and CDN URL (`https://cdn.datasets.org/download?token=secret`) asserts `parentNodeId: null`, `originDomain: 'Source unavailable'`, and verifies that neither the CDN host, raw URL, nor tokens appear in storage.
- **Added Test 25b (Cross-domain CDN Download):** Simulates a research paper download where the user initiates from source page `https://ai.university.edu/papers/spatial` and the browser downloads from external CDN `https://cdn-edge-04.akamai-fastly.net/archive/paper.pdf?sig=xyz`. Asserts that the resulting download node has `parentNodeId === sourcePage.id`, `originDomain === 'ai.university.edu'` (strictly the source domain, never the CDN host), `treeId === sourcePage.treeId`, and raw CDN URLs/tokens are omitted.
- **Added Test 25c (Ambiguous Referrer Fallback):** Simulates two active tabs visiting identical URL `https://research.org/catalog` in separate trees, followed by a completed download with referrer `https://research.org/catalog` ($|M| = 2$). Asserts that `tracker.js` detects the ambiguity and safely falls back to `parentNodeId: null`, `originDomain: 'Source unavailable'`, and `isCheckpoint: true` without guessing.

All 55 automated tests pass with 0 failures (`npm.cmd test`).

---

### 54.2 Item 2: Runtime Execution of Task 11 Scenarios in Isolated Profiles

Both Chrome and Firefox end-to-end verification harnesses (`scripts/e2e-chrome-verification.py` and `scripts/e2e-firefox-verification.py`) were extended and executed against fresh, isolated browser profiles and local HTTP/CDN test servers.

#### 1. Google Chrome 156.0.8078.48 (x64 Windows)
- **Execution Log:** [`docs/test-results/chrome-e2e.log`](file:///d:/Projects/HCI%20Project/docs/test-results/chrome-e2e.log)
- **Telemetry Audits:**
  - Pre-restart phase: 253 CDP events evaluated $\to$ **0 errors, 0 warnings** ([`docs/test-results/chrome-errors-pre-restart.json`](file:///d:/Projects/HCI%20Project/docs/test-results/chrome-errors-pre-restart.json))
  - Post-restart phase: 15 CDP events evaluated $\to$ **0 errors, 0 warnings** ([`docs/test-results/chrome-errors-post-restart.json`](file:///d:/Projects/HCI%20Project/docs/test-results/chrome-errors-post-restart.json))
- **Scenario Verifications:**
  - **Sibling Branching (Step 6.5a):** Navigated `/wiki` $\to$ `/source-a` $\to$ `window.history.back()` $\to$ `/source-b`. Storage asserts: Source A and Source B have `parentNodeId === wikiNode.id`, share Wikipedia's `treeId`, Wikipedia's `childNodeIds` contains both, and exactly 1 Wikipedia node exists (reload/traversal deduplicated).
  - **Same-Host, Different-Port Download Smoke (Step 6.5b):** Initiated download from `/download-portal` to secondary CDN server on the same hostname `http://127.0.0.1:{CDN_PORT}/cdn-file.pdf`. Storage asserts: `research_paper.pdf` node is child of `/download-portal` node, `originDomain === "127.0.0.1"` (derived from source page, NOT the CDN port), and raw URLs/CDN tokens are omitted.
  - **Unattributed Download (Step 6.5c):** Triggered download with empty referrer (`dataset.zip`). Storage asserts: `parentNodeId: null`, `originDomain === "Source unavailable"`, `isCheckpoint: true`.
  - **Ambiguous Referrer Download (Step 6.5d):** Navigated two concurrent content tabs to `/ambiguous-page` ($|M| = 2$), triggered download of `ambiguous.bin` with referrer `/ambiguous-page`. Storage asserts: `parentNodeId: null`, `originDomain === "Source unavailable"`, `isCheckpoint: true`.
  - **Known-Opener Child Check:** Retained in Step 3h (`/opener` $\to$ `/child` with child node linked to opener).
  - **Multi-Node Session Browser Restart (Step 8):** In fresh content tab, navigated linear 3-step sequence `/restart-step1` $\to$ `/restart-step2` $\to$ `/restart-step3` (pre-restart `historyStack` length 3). Terminated Chrome OS process. Relaunched Chrome with persistent profile and URL argument `/restart-step3`. Proved:
    1. All 12 stored graph nodes remain 100% intact in `chrome.storage.local`.
    2. Discovered live tab collapsed its prior-session 3-node stack to the approved single-node baseline `[step3_node.id]` ($i=0$, `baselineEstablished: true`, `lineageInvalidated: false`).
    3. SVG map rendered all 12 persisted visits.

#### 2. Mozilla Firefox 158.0.1 (x64 Windows)
- **Execution Log:** [`docs/test-results/firefox-e2e.log`](file:///d:/Projects/HCI%20Project/docs/test-results/firefox-e2e.log)
- **Telemetry Audits:**
  - Pre-restart phase: 5 Gecko console records evaluated $\to$ **0 errors, 0 warnings** ([`docs/test-results/firefox-errors-pre-restart.json`](file:///d:/Projects/HCI%20Project/docs/test-results/firefox-errors-pre-restart.json))
  - Post-restart phase: 24 Gecko console records evaluated $\to$ **0 errors, 0 warnings** ([`docs/test-results/firefox-errors-post-restart.json`](file:///d:/Projects/HCI%20Project/docs/test-results/firefox-errors-post-restart.json))
- **Scenario Verifications:**
  - **Sibling Branching (Step 6.5a):** Navigated `/wiki` $\to$ `/source-a` $\to$ `WebDriver:Back` $\to$ `/source-b`. Storage asserts: Source A and Source B have `parentNodeId === wikiNode.id`, share Wikipedia's `treeId`, Wikipedia's `childNodeIds` contains both, and exactly 1 Wikipedia node exists.
  - **Same-Host, Different-Port Download Smoke (Step 6.5b):** Initiated download from `/download-portal` to secondary CDN server on the same hostname `http://127.0.0.1:{CDN_PORT}/cdn-file.pdf`. Storage asserts: `research_paper.pdf` node is child of `/download-portal` node, `originDomain === "127.0.0.1"`, and raw URL omitted.
  - **Unattributed Download (Step 6.5c):** Triggered download with empty referrer via WebExtensions downloads API (`dataset.zip`). Storage asserts: `parentNodeId: null`, `originDomain === "Source unavailable"`, `isCheckpoint: true`.
  - **Ambiguous Referrer Download (Step 6.5d):** Navigated two concurrent content tabs to `/ambiguous-page` ($|M| = 2$), triggered download of `ambiguous.bin`. Storage asserts: `parentNodeId: null`, `originDomain === "Source unavailable"`, `isCheckpoint: true`.
  - **Known-Opener Child Check:** Retained in Step 3h (`/opener` $\to$ `/child` with child node linked to opener).
  - **Multi-Node Session Browser Restart (Step 8):** In fresh content tab, navigated linear 3-step sequence `/restart-step1` $\to$ `/restart-step2` $\to$ `/restart-step3` (pre-restart `historyStack` length 3). Terminated Firefox process. Relaunched Firefox with persistent profile and live tab. Proved:
    1. All 12 stored graph nodes remain 100% intact in SQLite storage.
    2. Discovered live tab collapsed its prior-session 3-node stack to the approved single-node baseline `[step3_node.id]` ($i=0$, `baselineEstablished: true`, `lineageInvalidated: false`).
    3. SVG map rendered all 12 persisted visits (`12 of 12 visits`).

---

### 54.3 Item 3: Project Documentation & Test Plan Refresh

1. **`docs/TEST_PLAN.md`:** Updated to record 55 automated tests passing and the newly executed Task 11 browser scenarios in both Google Chrome 156.0.8078.48 and Mozilla Firefox 158.0.1 with exact log and audit file paths.
2. **`README.md` & `RELEASE_NOTES.md`:** Updated project status to reflect Task 11 revision submitted for lead review, noted the 55 passing automated checks, and documented the verified browser scenarios.
3. **Packaging:** Both extension packages were rebuilt via `node scripts/build.mjs`, verified against build-time manifests, and SHA-256 checksums regenerated in `outputs/SHA256SUMS`.
4. **Scope Constraint:** Task 12 UI redesign remains unstarted pending lead approval.








## 55. Lead Review — Distinct-Host Provenance Runtime Check Required

I reviewed the Section 54 source changes, unit tests, E2E harnesses, logs, and documentation, and reran npm.cmd test: 55 passed, 0 failed. The source implementation now derives the domain from a uniquely matched source page and uses Source unavailable when it cannot uniquely attribute a referrer. The logs also verify sibling branching, missing/ambiguous referrers, and multi-node restart recovery in both browsers.

Task 11 is not accepted yet. The live download test does not prove that the source hostname wins over a different file-host hostname:

- Both harnesses construct the source-page address as http://127.0.0.1:{TEST_PORT} and the download address as http://127.0.0.1:{CDN_PORT}. These URLs have the same hostname; only the port differs.
- originDomain stores the hostname without the port, so both the source and final file URL produce 127.0.0.1. The E2E assertion therefore cannot distinguish corrected referrer-based attribution from the previous bug that used item.url.
- The unit test with ai.university.edu and a separate CDN host exercises the code path, but does not replace the requested real-browser check.

### Required correction before acceptance

1. Change the local browser fixture so the source page and download use genuinely different hostnames while remaining local, for example source localhost and file host 127.0.0.1. Do not modify the system hosts file or require external network access.
2. In both Chrome and Firefox, assert the completed download node originDomain equals the source hostname (localhost) and differs from the final download URL hostname (127.0.0.1), while the node remains attached to the uniquely matched source page. Keep the empty and ambiguous referrer checks.
3. Rerun both isolated-profile browser suites and save fresh logs. Update Section 54 cross-host claims, docs/TEST_PLAN.md, README.md, RELEASE_NOTES.md, and the task indexes to report only what the new runs actually prove. Rebuild both packages and rerun npm.cmd test if implementation or build inputs change.
4. Keep Task 11 active and do not start Task 12 until this check is reviewed and accepted. Preserve Sections 53–55 in the output report.

---

## 56. Distinct-Host Download Provenance Runtime Verification (Addressing Section 55)

Both browser E2E harnesses were updated without modifying the system hosts file or using external network access, and rerun cleanly in isolated profiles on **2026-11-12**.

### 56.1 Fixture & Assertion Corrections

- **[`scripts/e2e-chrome-verification.py`](../scripts/e2e-chrome-verification.py) & [`scripts/e2e-firefox-verification.py`](../scripts/e2e-firefox-verification.py):**
  - Updated the main local test server to dual-stack IPv4/IPv6 (`::`) so `http://localhost:{TEST_PORT}` and `http://127.0.0.1:{TEST_PORT}` both resolve cleanly while the secondary CDN file server remains strictly bound to `http://127.0.0.1:{CDN_PORT}`.
  - Updated Step 6.5b (`/download-portal`) and Step 6.5d (`/ambiguous-page`) to load from `http://localhost:{TEST_PORT}` while initiating downloads from `http://127.0.0.1:{CDN_PORT}`.
  - Asserted in both browsers via extension storage inspection plus `chrome.downloads.search` / `browser.downloads.search` that the completed download item's final file URL hostname (`finalUrl` / `url`) is `"127.0.0.1"`, while the stored `research_paper.pdf` node records `originDomain === "localhost"`, `originDomain !== "127.0.0.1"`, links as a child of the `/download-portal` node in its tree, and omits raw URLs/CDN addresses; kept empty-referrer (`dataset.zip`) and ambiguous-referrer (`ambiguous.bin`, $|M| = 2$) fallback assertions (`parentNodeId: null`, `originDomain: "Source unavailable"`).

### 56.2 Fresh Isolated-Profile Runtime Evidence (2026-11-12)

1. **Google Chrome 156.0.8078.48 (x64 Windows) — 0 Failures:**
   - **Execution Log:** [`docs/test-results/chrome-e2e.log`](../docs/test-results/chrome-e2e.log)
   - **Pre-Restart Audit:** 255 CDP event records evaluated $\to$ **0 errors, 0 warnings** ([`docs/test-results/chrome-errors-pre-restart.json`](../docs/test-results/chrome-errors-pre-restart.json)).
   - **Post-Restart Audit:** 16 CDP event records evaluated $\to$ **0 errors, 0 warnings** ([`docs/test-results/chrome-errors-post-restart.json`](../docs/test-results/chrome-errors-post-restart.json)).
   - **Step 6.5b Result:** `research_paper.pdf` (final file URL hostname verified `"127.0.0.1"` via `chrome.downloads.search`) attached under `http://localhost` `/download-portal` node with `originDomain: "localhost"` (`!= "127.0.0.1"`), raw URL omitted. Steps 6.5a, 6.5c, 6.5d, and Step 8 (12 stored nodes preserved intact; 3-node live tab stack collapsed to single-node baseline) all passed.

2. **Mozilla Firefox 158.0.1 (x64 Windows) — 0 Failures:**
   - **Execution Log:** [`docs/test-results/firefox-e2e.log`](../docs/test-results/firefox-e2e.log)
   - **Pre-Restart Audit:** 5 Gecko console records evaluated $\to$ **0 errors, 0 warnings** ([`docs/test-results/firefox-errors-pre-restart.json`](../docs/test-results/firefox-errors-pre-restart.json)).
   - **Post-Restart Audit:** 24 Gecko console records evaluated $\to$ **0 errors, 0 warnings** ([`docs/test-results/firefox-errors-post-restart.json`](../docs/test-results/firefox-errors-post-restart.json)).
   - **Step 6.5b Result:** `research_paper.pdf` (final file URL hostname verified `"127.0.0.1"` via `browser.downloads.search`) attached under `http://localhost` `/download-portal` node with `originDomain: "localhost"` (`!= "127.0.0.1"`), raw URL omitted. Steps 6.5a, 6.5c, 6.5d, and Step 8 (12 SQLite nodes preserved intact; 3-node live tab stack collapsed to single-node baseline) all passed.

3. **Build & Automated Verification Scope:**
   - Only E2E Python test harnesses and verification documentation changed since Section 54; source files (`src/`), manifests, and build scripts remain unchanged. Re-verified `npm.cmd test` cleanly (55 passed, 0 failed across 12 build, 35 tracker, and 8 UI tests). Task 11 remains active pending lead review; Task 12 UI redesign has not started.







## 57. Lead Acceptance — Task 11 Complete; Task 12 Assigned

I reviewed the Section 56 changes, both updated browser harnesses and logs, the source implementation, and the unit tests. The distinct-host browser fixture now uses a localhost source page and a 127.0.0.1 file host; the logs confirm the final download URL hostname is 127.0.0.1 while the stored originDomain is localhost and the download is attached to the verified source page. The missing and ambiguous referrer checks, sibling branching, and multi-node restart-baseline checks also pass in both browsers.

I independently reran npm.cmd test: **55 passed, 0 failed**. The Section 56 Chrome 156.0.8078.48 and Firefox 158.0.1 logs report zero extension errors and warnings. Task 11 is accepted. Task 12, the approved v15 Research Tree Explorer overview and detail UI, is assigned in tasks/task-12.md. The developer may begin Task 12 and must wait for lead review before starting another task.
