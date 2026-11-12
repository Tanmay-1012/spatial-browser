# Task 11 — V2 Storage, Branch Tracking, Session Safety, and Download Capture

**Status:** Accepted — Task 11 complete per Section 57 of the Task 11 output.

> **Developer status:** Task 11 is accepted per Section 57. The active assignment is Task 12 in task-12.md.

## Approved design

Follow the approved Task 10 v15 proposal in [`../task-10-output.md`](../task-10-output.md), especially the consolidated design and acceptance matrix in Section 51 and the approval record in Section 52. If implementation reveals a contradiction or a browser API cannot meet the design, stop at that specific boundary, document the evidence, and report for lead review before changing the approved behavior.

## Goal

Implement the V2 graph/storage core, branch-aware navigation tracking, startup/session safety, and completed-download provenance for Chrome and Firefox. Preserve the current UI for this phase; it may consume the revised graph in a later task.

## Scope and requirements

### A. Schema V2 and migration

- Implement the approved V2 node fields and metadata, including stable `treeId`, page/download node type, reciprocal parent/child links, download ID index, and the `baselineEstablished` tab-state field.
- Migrate V1 history without discarding valid nodes, titles, timestamps, or relationships. Repair dangling links/cycles as specified in the approved proposal; validate the candidate before committing it.
- Keep a verified V1 backup under the approved backup key and make retries safe across failures before and after commit. Do not replace malformed source data with an empty graph; preserve the original record and report recoverable errors.
- Expire the backup after 24 hours on a normal background wake without adding `alarms`. Clear Map must remove the graph, tab state, download index, and backup.
- Preserve the 1,000-node cap, protect active heads, and keep pruning consistent across edges, history stacks, and `downloadNodeMap`.

### B. Branch-aware tracking

- Preserve top-frame committed navigation, supported SPA route capture, title updates, and existing reload/hash/duplicate-event behavior.
- Implement same-tab Back/Forward activation using the approved per-tab history state. `Wikipedia → Source A → Back → Wikipedia → Source B` must leave Source A and Source B as siblings under the same Wikipedia node; ordinary nested navigation remains nested.
- Use opener and navigation-target metadata to attach website-created child tabs to the opener's current node and tree. Unknown or unavailable openers create independent root checkpoints; do not infer an opener from URL similarity.
- On session-marker absence, discover live tabs and establish the approved single-node baseline. A stale multi-node stack must be collapsed even when a recycled numeric tab ID and current URL match. `baselineEstablished` may make a retry idempotent only after a baseline was committed; matching ID and URL alone is insufficient.
- Any post-initialization unanchored tab creates an independent root checkpoint. Do not reattach it by URL alone.

### C. Startup barrier and failure recovery

- Register extension listeners synchronously, then hold tracking work behind the startup/session readiness barrier.
- A verified `storage.session` marker preserves tab state on ordinary Chrome worker wakes. An absent marker triggers live-tab initialization and the approved baseline behavior.
- If `storage.session.get()` continues to fail after the approved bounded retries, fail closed: make no graph or `tabState` writes, hold at most 20 events, and drop excess events according to the approved queue policy. Log a clear warning. Recovery in a new worker must re-read state before tracking resumes.
- If `storage.session.set({ sessionInitialized: true })` fails after local reconciliation commits, keep the barrier closed and retry up to three times with the approved delays. If the worker is destroyed, its transient queue is lost. A fresh worker must re-run initialization idempotently, preserve the committed single-node baseline, avoid duplicate roots, and only process new events after the marker write succeeds.
- Do not add `debugger` or `alarms` permissions.

### D. Download provenance

- Capture completed downloads using the WebExtensions downloads events and add only the required `downloads` permission to both manifests.
- Attribute a download only when browser-provided referrer metadata resolves unambiguously to a captured source page. Attach an attributed download node beneath that page in its existing tree. Otherwise show it as an unattributed item with “Source unavailable”; never guess from the active tab or a domain alone.
- Persist only a basename, originating domain/source-node relationship when known, completion time, and stable `downloadId` for deduplication. Never persist downloaded file contents, absolute local paths, full download URLs, or sensitive query strings.
- Ignore failed and cancelled downloads. Keep deduplication consistent with pruning, restart, and Clear Map.

### E. Browser support, packaging, and documentation

- Keep Chrome minimum at 109. Raise Firefox `strict_min_version` to 115 as approved in the proposal, and update build checks and documentation to match.
- Rebuild both extension packages. Update the project README, development instructions, test plan, permission/privacy notes, and release notes to describe only implemented behavior; label later UI and full acceptance work as pending.
- Use local test pages and a local attachment endpoint only. Run Chrome and Firefox in isolated temporary profiles; do not use real shopping accounts or real user downloads.

## Required tests and browser verification

- Extend unit tests for V1→V2 migration success/failure boundaries, graph invariants, pruning, Back/Forward sibling branching, known/unknown opener behavior, URL ambiguity, download attribution/deduplication/privacy, and clear-history cleanup.
- Add failure-injection coverage for session read rejection and post-commit session marker write rejection. The latter must start with a stale three-node stack and identical reused tab ID/URL, collapse it on the first pass, destroy the worker, then verify idempotent recovery with a new event in the recreated worker and no duplicate roots.
- Add Chrome and Firefox runtime checks for same-tab branching, opener-linked child tabs, a local completed download with provenance, an unattributed download, and restart/reload baseline behavior. Record browser versions and logs; screenshots are not needed for this core-only phase.
- Run `npm.cmd test`, build both packages, and run the updated isolated-profile browser checks. Report exact pass/fail counts. Do not mark an unrun browser scenario as passed.

## Completion criteria

- Task 11 acceptance criteria are implemented and documented without changing the current UI layout.
- Existing and new automated tests pass; both builds validate; required Chrome and Firefox runtime evidence is attached or any environmental blocker is reported precisely.
- `task output overview/task-11-output.md` is submitted and the overview/index files are updated. Wait for lead review before starting the next task.




