# Task 15 — Branded Chrome 109 Verification or Support-Floor Decision

**Status:** Accepted with limitation — the later Task 17 attempt did not close the branded Chrome 109 runtime gap (see Section 11 of [`task-15-output.md`](../task-15-output.md)).

**Milestone:** 15 (Chrome Runtime Evidence)  
**Prerequisite:** Task 14 is accepted with its open Chrome 109 evidence limitation in Section 9 of [Task 14 output](../task-14-output.md#9-lead-review--task-14-accepted-with-chrome-evidence-limitation-task-15-assigned-2026-11-14).

## Objective

Resolve the remaining gap between the declared `minimum_chrome_version: "109"` and the evidence actually collected. The unbranded Chromium `109.0.5414.0` snapshot passed as an engine proxy, but it is not Google Chrome 109 stable. Obtain direct branded Chrome 109 evidence in an isolated environment, or establish a precise blocker and present the options for the owner to decide.

## Required work

### 1. Attempt exact branded Chrome 109 runtime verification

- Look for an official or otherwise controlled source for a branded Google Chrome 109 stable binary suitable for isolated testing. Do not treat Chromium snapshots, current Chrome, or mocks as branded Chrome 109.
- Check whether the host's Windows Sandbox is already enabled and can be launched without changing system features or requiring elevation. Do not enable Windows Sandbox, elevate, install the MSI on the host, or modify the user's existing Chrome installation. If it is already available, use a disposable sandbox with a throwaway profile.
- If available, record the exact product/version and binary provenance, create a throwaway user-data profile, and run the current Chrome E2E suite against the freshly built unpacked extension.
- For any MSI obtained from a mirror, record the exact source URL and file SHA-256, and retain the Authenticode verification result. Describe it as a Google-signed installer obtained from that mirror, not as a Google-hosted download.
- Retain the acceptance scenarios in Task 14: installation/startup, toolbar open-or-focus, navigation and opener relationships, reload/title/fragment behavior, Explorer overview/detail, search/filter context, download provenance and safe fallbacks, keyboard/focus restoration, narrow reflow, and clean `12 -> 12` restart persistence.
- Confirm logs identify the actual branded product and extension load method. Capture pre/post error audits and narrow screenshots. Keep the tested browser restricted to local synthetic pages; do not sign into accounts or use a personal browser profile.

### 2. If branded Chrome 109 cannot be obtained

- Document the official sources and controlled environments checked, the specific failure or limitation, and why the Chromium snapshot cannot close the branded-browser acceptance item.
- Keep the explanation limited to verified product/version differences. Do not attribute extension lifecycle, accessibility, codec, or policy behavior differences to Chrome branding unless the report includes evidence for those claims.
- Keep Google Chrome 109 compatibility clearly marked **unverified** in `README.md`, `docs/TEST_PLAN.md`, and the Task 15 report. Keep the Chromium snapshot labeled as proxy evidence only.
- Present the owner with the choices and trade-offs: retain Chrome 109 as a declared but unverified floor, or propose a new minimum based on a browser version that can be directly verified. Do not alter `minimum_chrome_version` or make that decision yourself.

### 3. Validate the repository and closeout records

- Run `npm.cmd run build` and `npm.cmd test`; report exact results and verify the generated checksums.
- If a branded Chrome 109 run is possible, also rerun the current supported Chrome and Firefox E2E suites after any harness or compatibility changes.
- Update the Task 15 output report and task indexes. Preserve Task 14's lead review and its proxy-versus-branded distinction.

## Constraints

- Do not change `minimum_chrome_version`, Firefox's floor, permissions, storage schema, or download privacy rules without lead/owner review.
- Do not push, tag, publish, upload, or distribute a release.
- Do not begin Task 16 before Task 15 is reviewed and accepted.

## Deliverables

- Either direct isolated-profile evidence from branded Google Chrome 109 stable, or a clear, actionable blocker with owner decision options.
- Current build/test/checksum results and relevant logs, error audits, and screenshots.
- Consistent `README.md`, `docs/TEST_PLAN.md`, task indexes, and `../task-15-output.md`.

## Acceptance criteria

- The report never presents Chromium snapshot evidence as branded Chrome verification.
- Branded Chrome 109 is verified through live runtime evidence, or its support status remains explicitly unverified with the blocker and owner choices documented.
- Required scenarios, exact version, package identity, logs, and error audits are reported if the browser runs.
- No support-floor change or external release action occurs without review.
