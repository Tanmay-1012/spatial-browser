# Task 17 — Branded Chrome 109 Runtime Verification in a Disposable Hosted VM

**Status:** Closed with an environment limitation — branded Chrome 109 remains unverified. See the lead closeout in [`task-17-output.md`](../task-17-output.md).
**Prerequisite:** Task 15 accepted with the Chrome 109 runtime evidence limitation; Task 16 CI gate accepted and verified.

## Objective

Close the remaining gap between the declared `minimum_chrome_version: "109"` and the collected browser evidence by running the existing Chrome end-to-end suite against a genuine, Google-signed Chrome 109 package inside a disposable GitHub-hosted Windows VM. Preserve the support floor and the ordinary build/test gate.

## Required work

1. Keep the dedicated Windows runtime-verification workflow scoped to this task branch. Leave the regular Task 16 workflow unchanged.
2. Verify the exact Chrome Enterprise MSI mirror package from Task 15 by pinned SHA-256 (`0adace05d1cff3bf24feff3f79efd111798bd7ba32e2acd8d0494ffd6e166b8e`), Authenticode status, and Google LLC signer/thumbprint. The MSI's authenticated Google Update manifest identifies the exact standalone Chrome 109 package as SHA-256 `a1e8be08baf5ea4e6cb8a33158481132ecb3f2ffb0a9bb33a172395eba1379cb`, 93,128,752 bytes, version `109.0.5414.165`.
3. Download that exact standalone package from its Google-hosted `dl.google.com/release2` URL. Verify its size, pinned hash, Google LLC Authenticode signer/thumbprint, and product version before extraction.
4. Extract the `CHROME.PACKED.7Z` resource from the signed installer and unpack its nested `chrome.7z` payload inside the one-job GitHub-hosted Windows VM. Do not execute either installer or modify the runner's preinstalled browser. Verify the extracted `chrome.exe` reports product `Google Chrome`, exact version `109.0.5414.165`, and a valid Google LLC signature.
5. Build the unpacked extension, run `npm.cmd test`, and execute `scripts/e2e-chrome-verification.py` against that exact binary. Use a throwaway profile, the harness's local synthetic pages, a clear branded-browser label, and an assertion that Chrome DevTools reports major version 109 on initial launch and after restart. Preserve the complete acceptance coverage, including tracking, branching, downloads, responsive UI, error audits, and restart persistence. The hosted Windows job may have no interactive desktop: in that case it must log the limitation, wake the MV3 worker with a non-mutating message, and verify the same shared open/focus handler creates then focuses the map tab. Physical toolbar clicks remain separately evidenced in the existing Chrome 157 and Firefox runs.
6. Upload only the synthetic E2E log, error-audit JSON files, and screenshots as a short-lived GitHub Actions artifact (7-day retention). Never upload the MSI, installer, browser profile, downloaded test files, extension package, or user data.
7. Record the exact product version, both package provenances and validations, workflow run URL, test totals, screenshots, and error results in `task-17-output.md`. Update `README.md`, `docs/TEST_PLAN.md`, `docs/DEVELOPMENT.md`, the Task 15 review status, and both task indexes so the compatibility claim is precise and consistent.

## Constraints

- Do not run the legacy browser or install the MSI or standalone installer on the owner's host; do not change Windows features, privileges, or group membership. The browser test runs from an extracted payload in the one-job GitHub-hosted disposable VM, without installing/uninstalling Chrome there.
- Do not treat Chromium proxy results as branded Chrome evidence. Both the MSI and the standalone Chrome installer must pass their pinned hash and Authenticode checks before extraction.
- Do not change `minimum_chrome_version`, Firefox's minimum, extension behavior, permissions, storage, or privacy rules.
- Do not modify the standard Task 16 CI gate to download or install legacy browsers. The dedicated job must remain branch-scoped and read-only for repository contents.
- Do not push directly to `main`, tag, publish, or distribute a release before lead review of the complete evidence.

## Acceptance criteria

- E2E log identifies Google Chrome (not Chromium) and exact version `109.0.5414.165`; the extracted executable identity, MSI provenance, and standalone package provenance are independently recorded.
- The full Chrome E2E suite completes successfully with zero extension errors/warnings, including the open/focus behavior and browser restart checks. The log must state whether the hosted run used a physical toolbar click or the no-desktop CDP fallback; do not present fallback coverage as a physical click test.
- `npm.cmd run build`, `npm.cmd test`, and checksum verification pass.
- The short-lived artifact contains only the stated synthetic evidence files; no MSI or profile data is included.
- Project documentation consistently marks branded Chrome 109 as verified only for the exact tested version, without implying later 109 patch releases were tested.
- Task 15 is closed with direct evidence, Task 17 is accepted, and no support-floor or release change is made.

## Lead Closeout

**Review date:** 2026-11-16. **Decision:** Close Task 17 administratively with a documented environment limitation. The direct Chrome 109 compatibility acceptance criteria above were not met, so this closeout is not a Chrome 109 support claim. The exact package was authenticated and extracted, but the available disposable hosted runner could not execute the extension runtime checks. Chrome 109 remains declared and explicitly **UNVERIFIED**. No support-floor, permission, product behavior, or release change was made. The project has no active developer task; see [`task-17-output.md`](../task-17-output.md) for evidence and the remaining owner option.
