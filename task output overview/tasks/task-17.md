# Task 17 — Branded Chrome 109 Runtime Verification in a Disposable Hosted VM

**Status:** Assigned — final browser-floor acceptance evidence.
**Prerequisite:** Task 15 accepted with the Chrome 109 runtime evidence limitation; Task 16 CI gate accepted and verified.

## Objective

Close the remaining gap between the declared `minimum_chrome_version: "109"` and the collected browser evidence by running the existing Chrome end-to-end suite against a genuine, Google-signed Chrome 109 package inside a disposable GitHub-hosted Windows VM. Preserve the support floor and the ordinary build/test gate.

## Required work

1. Create a dedicated Windows runtime-verification workflow scoped to this task branch. Keep the regular Task 16 workflow unchanged.
2. Download only the documented Chrome Enterprise MSI from the exact Internet Archive mirror URL in Task 15. Before extracting it, verify the pinned SHA-256 (`0adace05d1cff3bf24feff3f79efd111798bd7ba32e2acd8d0494ffd6e166b8e`), Authenticode status, and Google LLC signer/thumbprint recorded in Task 15.
3. Use the GitHub-hosted runner as a disposable VM. If the runner image includes a newer Chrome, uninstall it only inside that disposable VM, then install the pinned MSI there. Do not install anything on the owner's machine or use a personal browser profile. Verify the installed executable reports `Google Chrome` and major version `109` before starting the test; disable or block browser updates for the short test window so the tested version cannot change.
4. Build the unpacked extension, run `npm.cmd test`, and execute `scripts/e2e-chrome-verification.py` against that exact browser. Use a throwaway profile, the harness's local synthetic pages, a clear branded-browser label, and an assertion that Chrome DevTools reports major version 109 on initial launch and after restart. Preserve the complete existing acceptance coverage, including the toolbar action, tracking, branching, downloads, responsive UI, error audits, and restart persistence.
5. Upload only the synthetic E2E log, error-audit JSON files, and screenshots as a short-lived GitHub Actions artifact (7-day retention). Never upload the MSI, browser profile, downloaded test files, extension package, or user data.
6. Record the exact product version, MSI provenance and validation, workflow run URL, test totals, screenshots, and error results in `task-17-output.md`. Update `README.md`, `docs/TEST_PLAN.md`, `docs/DEVELOPMENT.md`, the Task 15 review status, and both task indexes so the compatibility claim is precise and consistent.

## Constraints

- Do not run the legacy browser or install the MSI on the owner's host; do not change Windows features, privileges, or group membership. Installation and uninstallation are allowed only inside the one-job GitHub-hosted disposable VM.
- Do not treat Chromium proxy results as branded Chrome evidence. The MSI must pass the pinned hash and Authenticode checks before extraction.
- Do not change `minimum_chrome_version`, Firefox's minimum, extension behavior, permissions, storage, or privacy rules.
- Do not modify the standard Task 16 CI gate to download or install legacy browsers. The dedicated job must remain branch-scoped and read-only for repository contents.
- Do not push directly to `main`, tag, publish, or distribute a release before lead review of the complete evidence.

## Acceptance criteria

- E2E log identifies Google Chrome (not Chromium) and the exact 109.x version; the extracted executable identity and MSI provenance are independently recorded.
- The full Chrome E2E suite completes successfully with zero extension errors/warnings, including the toolbar action and browser restart checks.
- `npm.cmd run build`, `npm.cmd test`, and checksum verification pass.
- The short-lived artifact contains only the stated synthetic evidence files; no MSI or profile data is included.
- Project documentation consistently marks branded Chrome 109 as verified only for the exact tested version, without implying later 109 patch releases were tested.
- Task 15 is closed with direct evidence, Task 17 is accepted, and no support-floor or release change is made.
