# Task 18 Lead Review — Required Corrections

**Status:** Changes requested; Task 18 is not accepted.  
**Branch:** `codex/task-18-user-study`  
**Scope:** Correct the Task 18 implementation, tests, protocol, and report. Do not start a new feature task, recruit participants, merge to `main`, tag, or publish a release.

The lead reviewed the submitted Task 18 report, current source, tests, browser logs, and screenshots. The branching screenshots show a genuine tree, and the current build and automated suites pass. The submission still has study-validity and acceptance gaps. Fix every item below, rerun the required checks, and update `task-18-output.md` with accurate evidence before requesting review again.

## Required fixes

### 1. Enforce the four counterbalanced sequences

The controller currently lets the researcher select sequence, period, condition, and topic independently. The submitted Chrome run records `seq_1 / period 1 / B / pack_x`, and the Firefox run records `seq_2 / period 1 / B / pack_x`; both conflict with the protocol table.

Enforce this mapping in both the UI and `StudyManager.startTrial()` (the manager must reject invalid combinations even if called outside the UI):

| Sequence | Period 1 | Period 2 |
| :--- | :--- | :--- |
| `seq_1` | A / Pack X | B / Pack Y |
| `seq_2` | B / Pack Y | A / Pack X |
| `seq_3` | A / Pack Y | B / Pack X |
| `seq_4` | B / Pack X | A / Pack Y |

Prefer deriving condition and pack from sequence + period, or disable invalid choices and show the assigned combination clearly. Add tests for all eight valid cells and representative invalid combinations. Correct the E2E configurations, sample CSV, and report so every recorded row agrees with its sequence.

### 2. Stop retrieval timing only after the exact target finishes loading

`StudyManager.handleNavigation()` currently completes success whenever the target key is seen, without requiring `details.status === 'complete'`. The tracker calls it from `webNavigation.onCommitted`, where no completed status is supplied. This can stop a trial before the target document finishes loading.

Require an exact allowlisted target **and** completed top-level tab load before recording success. Keep committed navigation data as needed for page-open events, but do not finalize on commit. Add a delayed-response browser test proving the trial stays active while the target is loading and completes only when the matching tab reaches `complete`.

### 3. Restrict corpus matching to the local study origin

`matchCorpusPage()` currently matches only a pathname suffix. A non-local URL such as `https://example.com/pack_x/materials.html` can therefore be treated as an allowlisted target. Require the intended local loopback origin (and expected study path) before returning any page key. Add privacy/correctness tests showing that arbitrary domains, non-HTTP schemes, and lookalike paths are ignored and cannot trigger success or enter exports.

### 4. Count qualifying page opens without cross-tab false deduplication

The current `lastSeenCorpusKey` check is global to the trial. It can suppress a real second open of the same wrong page in another tab, or after an off-corpus visit. Replace it with event-level duplicate suppression that distinguishes duplicate browser signals for one navigation from separate qualifying opens. Collapse redirect chains onto the final destination, exclude reloads and same-document/hash changes, and retain Back/Forward destinations as required.

Add tests for: duplicate committed/completed signals for one load; two genuine opens of the same wrong page in separate tabs; reopening a page after an off-corpus visit; redirects; reload; hash change; and Back/Forward.

### 5. Complete the study-session controls

The task requires a **Finish Session** action, but the controller only has start, stop, export, and delete controls. Add a visible finish action that ends the researcher session without deleting trial data, records an auditable finish timestamp/event, and prevents accidental extra trials until a new session is started. Define the behavior if a timed trial is still active, and test both choices. Keep delete as a separate confirmed action.

Also restrict participant codes to the documented pseudonymous format (for example `P01`–`P99`) in the UI and manager. Reject personal-looking/free-form values so they cannot become exported participant identifiers or form spreadsheet formulas.

### 6. Align NASA-TLX controls, exports, and dictionary

- The report says ratings are in increments of 5, but the range inputs currently default to step 1. Set and validate the intended step, then test boundaries and increments.
- The JSON implementation exports camelCase keys (`trialId`, `timestampUtc`, `eventType`), while `STUDY_DATA_DICTIONARY.md` documents snake_case keys. Choose one format and make the exported JSON, dictionary, report examples, and tests agree exactly.
- The dictionary's sample trial ID format does not match the generated `trial_{participant}_p{period}_{condition}` format. Correct all such examples and valid-value descriptions.
- Make the data dictionary accessible from the installed controller or include a README/dictionary with the export. A source-repository-only document is not enough for a researcher using the extension package.

### 7. Correct protocol and verification claims

- The report says both target pages are depth 2 (`Hub → Sibling Listing → Target`), but each fixture links directly from its hub/index to its target. Either make the fixture path genuinely depth 2 in both packs or correct the report/protocol and verify that the actual paths remain matched.
- Browser logs currently show invalid sequence assignments. Rerun Chrome and Firefox with valid assignments and inspect the exported rows.
- The submitted runtime evidence does not demonstrate timeout behavior in the browser, and the Firefox log does not show the stored sibling graph assertion. Exercise the required trial outcomes and verify the stored branch relationships in both browsers.
- Verify the branch at desktop and narrow widths in both browsers. Save clearly named screenshots/evidence by browser and viewport; the current two screenshots do not identify browser and show only two viewport artifacts.
- Ensure claims such as “zero off-corpus records,” redirect handling, sequence mapping, and finished-session behavior have direct tests/evidence rather than being inferred from a generic pass count.

## Re-submission checklist

1. Run `npm.cmd run build`, then run `npm.cmd test` sequentially after the build completes. Report the exact result.
2. Run isolated-profile E2E checks in current Chrome and Firefox with valid sequence assignments. Verify successful target completion only after load, timeout/abandon paths, valid exported trials/events, privacy filtering, reset survival, and deletion.
3. Review the generated CSV and JSON against the data dictionary; include corrected, synthetic sample rows only.
4. Update `task-18-output.md`, the README, and task indexes to say “submitted for lead review” only after every item above passes. Keep the stable v2.0.0 release and participant-recruitment restriction unchanged.
5. Report any genuinely unavailable check as open; do not claim Task 18 complete until the lead reviews the corrected evidence.

## Review baseline

- Branch head reviewed: `5267c1e` (`Implement Task 18: Repair visible branching and add private study export`).
- Local build: passed.
- Sequential automated suite after build: **73 passed, 0 failed**.
- Visual check: desktop and narrow screenshots show real sibling branches and Source A descendants.
- Acceptance remains blocked by the specific correctness, sequence, UI, privacy-boundary, documentation, and runtime-evidence gaps above.
