# Task 14 — Minimum-Supported Browser Compatibility Audit

**Status:** Accepted with limitation — Firefox 115 is verified; branded Google Chrome 109 stable remains unverified per Section 9 of [`task output overview/task-14-output.md`](../task-14-output.md#9-lead-review--task-14-accepted-with-chrome-evidence-limitation-task-15-assigned-2026-11-14).
**Milestone:** 14 (Compatibility Floor)  
**Prerequisites:** Tasks 11, 12, and 13 are accepted. The current build declares Chrome `109+` and Firefox `115.0+` support.

## Objective

Establish whether the current extension actually runs at its declared minimum browser versions. Latest-version success does not prove compatibility with Chrome 109 or Firefox 115. Keep the validation isolated from the user's regular browser profiles and clearly separate observed results from assumptions.

## Required work

### 1. Inspect compatibility-sensitive code

- Review browser-specific manifests, background startup code, storage APIs, webNavigation/download listeners, extension action behavior, and UI APIs for use of features newer than the declared floors.
- Identify each compatibility-sensitive API or manifest field, the browser/version requirement, and its concrete use in the extension.
- Do not change the declared minimum versions based on source inspection alone.

### 2. Run real minimum-version checks

- Use isolated temporary browser installations or other controlled test environments for Chrome `109` and Firefox `115.0`/the closest available 115 ESR build. Never reuse the user's regular profile or browsing data.
- Build fresh unpacked packages from the checked-in sources and attempt to install/load each extension in its minimum-version browser.
- Verify startup and toolbar open-or-focus, same-tab navigation capture, opener-created child tabs, the tree overview/detail UI, download provenance and unattributed-download fallback, keyboard focus restoration, narrow responsive reflow, and persistence after browser restart.
- Capture exact browser versions, OS/environment, package commit, actual viewport sizes, test outcomes, logs, and error/warning audits.
- Run the automated suite and build as supporting checks, but do not use them as a substitute for live runtime verification.

### 3. Resolve findings and update compatibility records

- If a minimum-version runtime exposes a reproducible compatibility defect, fix it within the existing behavior and data model, add regression coverage where practical, and rerun affected checks in both the floor and current browsers.
- Do not change the storage schema, permissions, privacy rules, or supported-version declarations without documenting the concrete reason and waiting for lead review.
- If an exact minimum browser cannot be installed or run, state the blocker, provide the closest real version actually tested, leave the affected floor unverified, and list the exact evidence still needed. Do not claim minimum-version support from latest-version tests or mocks.
- Update `README.md`, `docs/TEST_PLAN.md`, and the Task 14 output report so compatibility claims match the evidence.

## Constraints

- Use local synthetic pages and downloads only; do not use real accounts or personal browsing profiles.
- Do not publish, push, tag, upload, or distribute a release.
- Do not lower or raise the declared browser floors without lead review.
- The Chromium 109 snapshot is proxy evidence only. Task 15 is assigned to close the branded Chrome 109 evidence gap; do not treat the proxy run as a Google Chrome stable verification.

## Deliverables

- A compatibility matrix mapping each declared floor to exact live-runtime results and unresolved blockers.
- Updated compatibility-sensitive source/tests if a reproducible defect is found, with a local commit and commit hash.
- Fresh build, automated test results, browser logs, error audits, and relevant screenshots.
- Updated `docs/TEST_PLAN.md`, `README.md`, and `../task-14-output.md`, preserving earlier task review records.

## Acceptance criteria

- The floor-version compatibility claim is supported by live browser evidence, or the unverified portion is clearly labeled with an actionable blocker.
- Chrome 109 and Firefox 115 behavior is reported separately from the latest tested versions.
- Required install, startup, navigation, tree UI, download, keyboard, narrow-layout, and restart checks are accounted for in both browsers.
- Any fix is regression-tested without unreviewed changes to schemas, permissions, privacy rules, or version declarations.
- Documentation and task indexes agree, evidence paths are present, and no external release action occurred.
