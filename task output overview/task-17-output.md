# Task 17 Closeout — Branded Chrome 109 Runtime Evidence

**Review date:** 2026-11-16

**Outcome:** Closed with an environment limitation. Branded Chrome 109 remains **UNVERIFIED** as an extension runtime.

**Lead decision:** This closes the investigation and the project task list; it does not satisfy the planned Chrome 109 runtime acceptance criteria or claim compatibility.

## 1. Closeout Summary

The exact Google-signed Chrome `109.0.5414.165` package was verified and extracted in disposable GitHub-hosted Windows runners without running an installer or changing the runner's preinstalled browser. The build and automated suite passed. The runtime suite could not reach extension behavior in the available runner: the headed attempt had no usable interactive desktop and Chrome's extension execution target stopped responding to DevTools commands; the Chrome 109 headless attempt did not load the unpacked extension.

No navigation, branching, download, UI, error-audit, or restart-persistence result was obtained for branded Chrome 109. These attempts do not distinguish a Chrome 109 behavior issue from a limitation in the hosted runner or the test harness. They are not evidence that the extension passes or fails its compatibility floor.

## 2. Browser Package Provenance

All package checks and extraction ran inside the one-job `windows-latest` runner. The MSI and standalone installer were never executed.

| Item | Verified result |
| :--- | :--- |
| Chrome Enterprise MSI mirror | SHA-256 `0adace05d1cff3bf24feff3f79efd111798bd7ba32e2acd8d0494ffd6e166b8e`; Authenticode `Valid`; signer `Google LLC`; thumbprint `2673EA6CC23BEFFDA49AC715B121544098A1284C` |
| Google-hosted standalone installer | `109.0.5414.165`, 93,128,752 bytes; SHA-256 `a1e8be08baf5ea4e6cb8a33158481132ecb3f2ffb0a9bb33a172395eba1379cb`; Authenticode `Valid`; signer `Google LLC`; same thumbprint |
| Extracted browser executable | Product `Google Chrome`; exact version `109.0.5414.165`; Authenticode `Valid`, signer `Google LLC` |
| Install state | No MSI or standalone installer was run; the browser payload was extracted only in the disposable runner |

The standalone package was downloaded from Google's `dl.google.com/release2` endpoint. Its size and hash matched the values authenticated through the MSI manifest. This establishes package identity and provenance only; it does not establish extension compatibility.

## 3. Hosted Runtime Attempts

### Run 1 — headed Chrome 109

[GitHub Actions run #43744325678](https://github.com/Tanmay-1012/spatial-browser/actions/runs/43744325678) verified the extracted product as Google Chrome `109.0.5414.165`, loaded the unpacked extension, and relaunched the browser with the extension ID preserved. The hosted Windows runner had no interactive Chrome window. When the fallback attached to the extension service worker, `Runtime.enable` timed out and the DevTools WebSocket was reset. The E2E suite stopped before navigation and UI scenarios.

### Run 2 — Chrome 109 Chrome-based headless mode

[GitHub Actions run #43744717992](https://github.com/Tanmay-1012/spatial-browser/actions/runs/43744717992) reported `HeadlessChrome/109.0.5414.165`, but the unpacked extension was not loaded. Chrome 109 did not expose the later `Extensions.loadUnpacked` DevTools command, and the harness stopped at extension discovery. No extension runtime scenario ran.

Both runs uploaded only the synthetic runner log as a seven-day artifact. Error-audit JSON and screenshots were not produced because the harness stopped before the acceptance scenarios. The artifacts contain no browser profile, installer, extension archive, downloaded test file, or user data.

## 4. Build and Automated Verification

The task workflow completed `npm.cmd run build` and `npm.cmd test` before both runtime attempts. The automated suite reported **61 passed, 0 failed** (12 build/manifest checks, 35 tracker/storage/provenance checks, and 14 UI checks). These deterministic tests verify project logic and packaging; they do not substitute for a live Chrome 109 extension run.

The local workspace build also completed successfully and generated refreshed checksums. No production source, manifest permission, storage behavior, privacy rule, or declared browser floor was changed for this task.

## 5. Lead Review and Project Status

Task 17 is closed as an environment-limited investigation, not accepted as direct Chrome 109 compatibility verification. Task 15's limitation remains: the declared `minimum_chrome_version: "109"` is unchanged, while branded Chrome 109 remains **UNVERIFIED**. Chromium 109 proxy evidence and the authenticated Chrome package are not runtime proof. The result does not imply that later Chrome 109 patch releases were tested.

The project task list is complete, with no next developer task assigned. The existing Chrome and Firefox runtime evidence and the passing Task 16 hosted CI gate remain valid for the versions they tested. No release was tagged, published, or changed as part of this closeout.

The reviewed closeout was fast-forwarded to `main` at commit `fbefbf0`. The standard GitHub Actions build/test gate passed on that commit in [run #43745955194](https://github.com/Tanmay-1012/spatial-browser/actions/runs/43745955194), including package generation and all 61 automated checks. This confirms the closeout did not break the regular project gate; it does not change the Chrome 109 runtime result.

The task-specific Chrome 109 workflow is now manual-only and its job is restricted to the Task 17 branch. This preserves the investigation path without rerunning the known environment-blocked attempt on documentation or main-branch updates.

If the owner later needs direct evidence for the declared Chrome 109 floor, the remaining action is to provide an authorized GUI-capable isolated Windows environment where Chrome 109's extension runtime can be exercised. Until then, keep the README and compatibility table explicit that branded Chrome 109 is unverified.
