# Task 13 — Release Candidate Readiness & Evidence Closeout

**Status:** Accepted — Task 13 complete per Section 7 of [Task 13 output](../task-13-output.md#7-lead-review--task-13-accepted-task-14-assigned-2026-11-13).
**Milestone:** 13 (Quality & Handoff)  
**Prerequisite:** Task 12 accepted in Section 12 of [Task 12 output](../task-12-output.md#12-lead-acceptance--task-12-complete-task-13-assigned-2026-11-13).

## Objective

Preserve the lead-verified Task 12 corrections, then perform a final local quality and packaging audit so the repository and Chrome/Firefox build outputs form a reproducible release candidate. This is a verification and handoff task, not a new feature task.

## Required work

### 1. Integrate the lead-review changes

- Inspect `git status` and review the existing working-tree changes before editing. Do not discard, reset, overwrite, or restore the lead's changes.
- Preserve and include the focus-restoration correction in `src/shared/app.js`, the Chrome and Firefox E2E harness corrections, and the latest logs, error-audit JSON files, and screenshots described in Section 12 of the Task 12 report.
- Resolve any conflict by keeping behavior that passed the lead's final Chrome and Firefox reruns. Do not alter tracking, storage schema, permissions, or manifests.
- Commit the integrated changes locally and report the commit hash. Do not push, tag, publish, or distribute anything.

### 2. Verify reproducible builds and package contents

- Run `npm.cmd test` and `npm.cmd run build` from the project root. Report exact results.
- Inspect the generated Chrome and Firefox packages. Confirm each contains the expected manifest and current shared UI, worker, storage, tracker, and launch files; confirm browser-specific manifest/background configuration remains correct and minimum-version declarations are unchanged.
- Verify archive/checksum consistency if the build produces release archives or checksum files. Identify stale, missing, or unexpected files rather than silently deleting them.
- Confirm no test profile, browser database, downloaded fixture, credential, temporary log, or machine-specific absolute path has entered a distributable package.

### 3. Reconfirm browser behavior and handoff records

- Run the isolated-profile Chrome and Firefox E2E suites against the freshly built packages. Retain Task 12 acceptance scenarios, including narrow reflow readability, branching, download provenance, keyboard/focus restoration, zoom/Fit, and `12 -> 12` restart persistence.
- Capture current browser versions, measured viewport sizes, exact pass/fail counts, errors/warnings, and evidence paths. Clearly mark any scenario that could not be run; do not claim parity based on mocked tests alone.
- Check that README, `docs/TEST_PLAN.md`, task indexes, and the Task 13 output report agree about Task 12 acceptance and Task 13 status. Preserve all earlier task review sections.

## Constraints

- No new user-facing features or schema changes.
- Do not change permissions, manifest behavior, minimum browser versions, or download privacy rules.
- Do not tag, publish, upload, or distribute a release. No release version is assigned by this task.
- Task 14 was held until lead review of this task; it is now assigned in [task-14.md](task-14.md).

## Deliverables

- A local commit containing the lead-verified working-tree corrections and current verification evidence.
- Rebuilt Chrome and Firefox outputs validated against the checked-in sources.
- Updated `docs/TEST_PLAN.md`, README/task indexes if needed, and `../task-13-output.md` with a concise but complete audit record.

## Acceptance criteria

- The lead's focus restoration and E2E harness corrections remain present and are committed; no stale evidence replaces the latest passing evidence.
- `npm.cmd test` and `npm.cmd run build` pass, with exact totals reported.
- Fresh Chrome and Firefox isolated-profile runs pass the required scenarios, or every blocker is clearly documented with remaining acceptance items open.
- Both packaged builds match the checked-in source and manifest requirements; package privacy and checksum/archive checks are reported.
- Documentation and task indexes are consistent, the output report preserves prior history, and no release was published.
