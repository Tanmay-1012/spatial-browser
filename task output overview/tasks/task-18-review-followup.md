# Task 18 Follow-up Lead Review — Additional Corrections

**Status:** Accepted after lead re-review on 2026-11-21; historical review findings and corrections are preserved below.

**Reviewed commit:** `95f15cb` (`Address Task 18 review corrections...`)  
**Active branch:** `codex/task-18-user-study`

The first review checklist was addressed in substantial part: the fresh build passes, all 75 automated tests pass, and a fresh Chrome 157 / Firefox 160 E2E run exits successfully. The graph data checks show the expected siblings in both browsers. The study changes still have the blocking gaps below. Correct them and resubmit the report; do not recruit participants, merge to `main`, tag, publish, or start another feature task.

## Required corrections

### 1. Do not persist URLs or browser tab IDs in study records

The active trial stores `tabNavState[tabId].lastCommittedUrl` and `tabMap[tabId]` in `spatial_browser_study_data`. A direct reproduction stored `http://127.0.0.1:8000/pack_x/efficiency.html?secret=query#frag` and the numeric tab ID (`42`) in that study key. This violates Task 18's instruction not to capture URLs, query strings, fragments, or system tab identifiers. `finishSession()` also copies the active trial object into `trials`, so finishing during a trial can retain those internal fields in the saved trial row.

Keep deduplication and the raw tab-ID-to-ephemeral-key mapping in transient memory only, or otherwise persist only opaque page keys and ephemeral tab keys. Do not persist raw URLs, query/hash material, or browser tab IDs anywhere under the study storage key. Ensure all trial-finalization paths project only the approved trial fields. Add a privacy test that inspects the actual study storage value while a trial is active and after an active-trial session finish; assert that a supplied sentinel URL/query/hash and tab ID are absent. Keep the exported CSV/JSON privacy checks as well.

### 2. Count redirect destinations rather than dropping redirect-qualified commits

`handleNavigationCommitted()` returns early whenever `transitionQualifiers` contains `client_redirect` or `server_redirect`. In Chrome's `webNavigation` API, the qualifier describes redirects that happened during the navigation; for server redirects, the API reports repeated `onBeforeNavigate` / `onErrorOccurred` events until the **final** `onCommitted` event. The current early return can therefore discard the final destination itself. See the [Chrome `webNavigation` reference](https://developer.chrome.com/docs/extensions/reference/api/webNavigation#event-onCommitted).

Revise the event strategy so redirect intermediates collapse to one qualifying final destination event. Add a real local 3xx redirect scenario (and a client/meta-refresh scenario if supported by the test harness) in Chrome and Firefox. Assert that a redirect to a wrong corpus page increments once for the final key, redirects to the target succeed only after its load completes, and intermediate redirects do not create extra errors. Replace the current unit assertion that a lone event with a redirect qualifier should be ignored; that assertion encodes the bug.

### 3. Do not suppress fast, genuine repeat opens with a fixed 600 ms URL window

The current duplicate check drops another navigation in the same tab when it reaches the same raw URL within 600 ms. A user can open the same wrong page twice quickly, and those are two qualifying page opens. Suppress only duplicate signals that are demonstrably the same navigation; do not use a time window that also discards distinct visits. Add a test for two separate same-tab opens of the same page within 600 ms, alongside duplicate-signal and multi-tab cases. Confirm Back/Forward destination visits are counted and represented in event evidence.

### 4. Capture actual branch graphs in the browser screenshots

The fresh browser-named `*-branch-desktop.png` and `*-branch-reflow.png` artifacts show the Research Trees **overview card** only. They do not show the tree map, sibling edges, or Source A descendant. Although the runner attempts a `.tree-card` click, it does not enter detail view before capture.

Update the runner to activate the tree's **Open Tree Detail View** control, assert that the detail canvas and expected nodes/edges are present, then capture the map at desktop and narrow viewport widths in both browsers. Visually inspect all four screenshots and keep clear browser/viewport names. Do not describe the overview card as proof that the tree is visually branched.

### 5. Demonstrate Firefox's target remains active during a delayed load

The Firefox runner uses a blocking `WebDriver:Navigate` and only inspects the state after navigation returns. The log therefore does not prove that the trial stayed active while the target response was in flight. Make navigation asynchronous or use a second control channel so the runner checks the extension state before the delayed response completes, then checks success after load completion. Record both observations in the Firefox log.

### 6. Tighten participant-code validation and study evidence claims

The current `/^P\d{2,3}$/` also accepts `P000`; the stated range is `P01` through `P999`. Reject `P000` and `P00`, and test boundary codes `P01`, `P99`, `P100`, and `P999`.

Add automated coverage for CSV escaping and Back/Forward events if not already present. Update the report to clearly label browser-timeout tests that advance the stored deadline as simulated deadline checks, not a full 120-second wait. The Firefox condition-A run validates the shared recording metadata/controller path; it is not a comparison against Chrome's built-in History page. Keep any user-study claims limited accordingly.

## Verification and resubmission

1. Run the build, then the full automated suite sequentially.
2. Run isolated-profile browser checks in Chrome and Firefox for local redirect behavior, target-load timing, correct error counts, valid sequence mapping, reset/delete, and privacy assertions.
3. Inspect the actual study storage object during an active trial and after finishing an active trial; prove it contains no full URLs, query strings, fragments, or browser tab IDs.
4. Verify and visually inspect four detail-map screenshots (two browsers × two viewport sizes).
5. Update `task-18-output.md`, README, and indexes to reflect the evidence accurately. Do not mark the task complete or accepted; resubmit for lead review.

## Initial lead verification baseline (before follow-up corrections)

- `npm.cmd run build`: passed.
- `npm.cmd test`: **75 passed, 0 failed**.
- Fresh `python scripts/e2e-task18-runtime.py`: Chrome and Firefox scripted runs completed with 0 reported console errors.
- Stored graph assertions: 7 nodes; hub has 4 sibling children in each browser.
- Direct privacy inspection reproduced a raw URL with query/hash and numeric tab ID in active study storage.
- Visual screenshot inspection found the four named branch images capture overview cards rather than the detail graph.
- At that review point, Task 18 remained **not accepted** until the corrections above were evidenced. The final decision is recorded in the closeout section below.

## Lead re-review closeout — accepted 2026-11-21

Before acceptance, the lead removed timestamp-only duplicate suppression, which could discard distinct same-page commits if navigation IDs were unavailable and timestamps collided. Regression cases prove distinct commits count in both ID-present and ID-absent collisions. The lead also fixed title corruption found in the regenerated Firefox screenshot: an extension-page title could overwrite the last web visit's title. Title updates now require a matching HTTP/HTTPS URL, and the browser runner asserts the Source B title remains correct and no extension URL is recorded.

Final checks on the corrected workspace passed:

- `npm.cmd run build`: passed.
- `npm.cmd test`: 80 passed, 0 failed.
- `python scripts/e2e-task18-runtime.py`: Chrome 157.0.8103.80 and Firefox 160.0.1 both passed; 0 pre-test and post-test console errors in each browser.
- Real HTTP 302 wrong-page destination and meta-refresh client redirect were exercised in both browsers. A 302 redirect to the delayed target remained active during load and completed only after the target loaded.
- Four actual detail-view branch screenshots were captured and visually inspected; both Firefox screenshots show Source B correctly.

Task 18 is accepted for implementation/study readiness. No human study or recruitment is authorized by this acceptance. Supervisor/institution approval and explicit owner authorization are still required before a pilot.
