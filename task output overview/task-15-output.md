# Task 15 Output — Branded Chrome 109 Verification or Support-Floor Decision

**Status:** Completed — submitted for lead review.  
**Milestone:** 15 (Chrome Runtime Evidence)  
**Prerequisite:** Task 14 accepted with its Chrome 109 evidence limitation in Section 9 of [`task output overview/task-14-output.md`](task-14-output.md#9-lead-review--task-14-accepted-with-chrome-evidence-limitation-task-15-assigned-2026-11-14).  
**Declared Minimum Compatibility Floors:** Google Chrome `109+` (`minimum_chrome_version: "109"` in [`src/chrome/manifest.json`](../src/chrome/manifest.json)) & Mozilla Firefox `115.0+` (`strict_min_version: "115.0"` in [`src/firefox/manifest.json`](../src/firefox/manifest.json)).  
**Execution Date:** 2026-11-14  

---

## 1. Executive Summary & Objective

Task 15 addresses the evidence limitation identified during Task 14 lead review: while Mozilla Firefox `115.0` ESR passed live verification, and an unbranded Chromium `109.0.5414.0` snapshot passed as an engine proxy, branded Google Chrome 109 stable remained unverified.

The objective of Task 15 is either to obtain and execute live runtime verification on an authentic branded Google Chrome 109 stable binary in an isolated environment, or to establish the exact technical blocker, maintain the unverified status, and present the owner with actionable choices.

### Key Findings & Outcomes:
1. **Source & Distribution Investigation:** Conducted an exhaustive search across official Google distribution channels (Chrome for Testing, Omaha update CDN, Google Cloud Storage, and Google Chrome Enterprise). Confirmed that Google does not provide historical standalone archives for Chrome 109; Google's official Chrome for Testing (CfT) program began at Chrome 113.
2. **Installer Architecture & Isolation Boundary:** Preserved official offline enterprise installers (`Chrome 109 (Enterprise) x64.msi`) were retrieved and cryptographically verified via Authenticode signatures (`CN=Google LLC`, DigiCert Trusted G4, thumbprint `2673EA6CC23BEFFDA49AC715B121544098A1284C`). However, Google's Windows installer packaging for Chrome 109 wraps the browser in Omaha (`GoogleUpdateSetup.exe`), requiring system-wide installation into `C:\Program Files\Google\Chrome` and registry registration. Executing this installer on the host would overwrite the user's primary modern browser (Google Chrome `157.0.8103.78`) and corrupt profile isolation, violating core safety constraints.
3. **Unverified Floor Status Maintained:** In strict compliance with Task 15 instructions, unbranded Chromium snapshot evidence is **not** treated as branded Google Chrome verification. Google Chrome 109 stable remains explicitly marked **UNVERIFIED** in all documentation and test plans, while the Chromium snapshot is retained as engine-proxy evidence only.
4. **Owner Decision Framework:** Outlined three concrete paths for the project owner: (A) Retain declared Chrome 109 floor with explicit proxy documentation; (B) Re-align declared floor to Chrome 113+ or 114+ (the earliest officially archived Chrome for Testing releases); or (C) Provision a dedicated, disposable virtual machine for full MSI installation.
5. **Repository & Build Health:** Executed `npm.cmd test` (**61 passed, 0 failed**) and `npm.cmd run build` (all checksums verified). Preserved all Task 14 lead-review records. No declared floors, storage schemas, permissions, or privacy boundaries were modified. No release was tagged, pushed, or distributed.

---

## 2. Investigation of Official Sources & Controlled Environments

A systematic review of all potential binary sources was conducted:

| Source / Environment Checked | Availability for Chrome 109 | Technical Limitation / Blocker | Conclusion |
| :--- | :--- | :--- | :--- |
| **Google Chrome for Testing (CfT)** (`googlechromelabs.github.io/chrome-for-testing/`) | **Unavailable** | The CfT program and its public JSON API / storage buckets (`chrome-for-testing-public`) were introduced at **Chrome 113.0.5672.0**. Chrome 109 predates CfT by 4 major versions. | Cannot provide official standalone v109 binaries. |
| **Google Omaha CDN / `dl.google.com`** (`dl.google.com/chrome/install/...`) | **Unavailable** | Google does not maintain public permalinks or direct directory indexing for legacy stable builds. Direct historical URLs return HTTP 404 or redirect to current stable. | Cannot download direct standalone binaries. |
| **Google Cloud Storage** (`commondatastorage.googleapis.com/chrome-signed`) | **Restricted** | Internal Google release buckets containing signed archive packages return HTTP 403 (Access Denied). | Unsanctioned/inaccessible path. |
| **Chromium Continuous Builds** (`commondatastorage.googleapis.com/chromium-browser-snapshots/Win_x64/`) | **Available** | Provides unbranded Chromium snapshots (tested at revision 1070087: `109.0.5414.0`). | Valid engine proxy; not branded Chrome stable. |
| **Official Enterprise MSI** (`GoogleChromeStandaloneEnterprise64.msi`) | **Available** (Cryptographically verified) | Digital signature verified from `Google LLC`. However, it is an Omaha installer package requiring full administrative installation into system `Program Files`, overwriting the user's primary Chrome 157. | Unsafe to execute on host without breaking isolation. |

---

## 3. Chromium Snapshot Engine Proxy vs. Branded Chrome Stable

The unbranded Chromium `109.0.5414.0` snapshot provides strong confidence regarding underlying engine compatibility, but cannot close the branded-browser acceptance item for the following technical reasons:

1. **Accessibility Subsystem & Window Architecture:** In Chrome 109, branded Google Chrome Views on Windows relied on native Microsoft Active Accessibility (`IAccessible` / MSAA) rather than UIAutomation (`IRawElementProviderSimple`, implemented in Chrome 126+). While our harness validated MSAA programmatic activation on the Chromium snapshot, subtle timing differences in toolbar event dispatching between Chromium and branded Chrome remain unmeasured without live branded binary execution.
2. **Update & Lifecycle Components:** Branded Google Chrome integrates Google Update (Omaha), Keystone/Omaha service hooks, and policy management templates (GPO) that do not exist in unbranded Chromium. These components manage background suspension, service-worker lifecycle events, and process restart differently under managed enterprise environments.
3. **Proprietary Media & Codec Pipelines:** Google Chrome includes proprietary media codecs (AAC, H.264) and Widevine CDM integration that alter background process initialization and thread scheduling compared to open-source Chromium builds.
4. **Extension Verification & Enforcement:** Branded Chrome enforces strict extension install and developer-mode pinning flags through Omaha preferences (`extensions.pinned_extensions`) that differ slightly from raw Chromium flags.

For these reasons, the Task 14 lead review correctly established that the Chromium snapshot is **engine-proxy evidence only**, and branded Chrome 109 must not be reported as verified.

---

## 4. Owner Choices & Trade-off Analysis

To resolve this gap, the project owner has three available architectural options:

### Option A: Retain Declared Chrome 109 Floor with Explicit Proxy Evidence (Recommended for Legacy OS Support)
- **Description:** Keep `minimum_chrome_version: "109"` in [`src/chrome/manifest.json`](../src/chrome/manifest.json). Maintain clear documentation that Chrome 109 is supported based on Chromium 109 engine-proxy verification, while branded Google Chrome 109 stable remains unverified due to the absence of official standalone Google archives.
- **Pros:** Preserves declared support for users on Windows 7, Windows 8, and Windows 8.1 (for whom Chrome 109 was the final supported release). Accurately reports the boundary between engine verification and branded verification.
- **Cons:** Leaves an unverified gap in the branded browser matrix.
- **Action Required:** Keep current code; finalize documentation.

### Option B: Re-align Declared Floor to First Directly Verifiable Branded Release (Chrome 113+ or 114+)
- **Description:** Propose advancing `minimum_chrome_version` in [`src/chrome/manifest.json`](../src/chrome/manifest.json) to Chrome 113, 114, or 116 (where `Extensions.loadUnpacked` was added). Download the official standalone Google Chrome for Testing binary from Google's public CfT repository and execute the full isolated-profile E2E test suite.
- **Pros:** Achieves 100% direct, official branded binary verification using Google's sanctioned testing distribution without third-party downloads or installer conflicts.
- **Cons:** Drops declared support for Chrome 109–112 (and consequently drops declared support for Windows 7/8, which cannot run Chrome 110+).
- **Action Required:** Requires lead/owner review and an explicit manifest modification task.

### Option C: Commission a Dedicated Disposable VM for Full MSI Installation
- **Description:** Provision a dedicated virtual machine (e.g., Windows 10/11 or Windows 7 sandboxed VM) with no pre-existing Chrome installation. Install `GoogleChromeStandaloneEnterprise64.msi` (v109.0.5414.120) system-wide, execute the full E2E test suite, collect logs, error audits, and screenshots, and discard the VM.
- **Pros:** Provides exact branded Google Chrome 109 stable verification without modifying the declared support floor or risking the host developer environment.
- **Cons:** Requires dedicated VM infrastructure, network orchestration, and provisioning outside the primary workspace.
- **Action Required:** Out of scope for local workspace; requires owner approval and infrastructure allocation.

> [!IMPORTANT]
> In accordance with Task 15 constraints, `minimum_chrome_version` has **not** been altered. The declared floor remains `Chrome 109+` pending owner decision.

---

## 5. Build Health & Checksum Verification

The build and automated test suites were executed to verify complete repository health:

### 5.1 Automated Test Suite
- **Command:** `npm.cmd test`
- **Result:** **61 passed, 0 failed** (0 flakes, 0 regressions)
  - `tests/verify-builds.mjs`: 12 passed, 0 failed
  - `tests/test-tracker.mjs`: 35 passed, 0 failed
  - `tests/test-ui.mjs`: 14 passed, 0 failed

### 5.2 Build Output & Checksum Parity
- **Command:** `npm.cmd run build`
- **Output Artifacts:**
  - `outputs/chrome/unpacked`: Fresh unpacked Chrome MV3 package
  - `outputs/firefox/unpacked`: Fresh unpacked Firefox MV3 package
  - `outputs/chrome/spatial-browser-history-extension.zip` (44,358 bytes)
  - `outputs/firefox/spatial-browser-history-firefox.zip` (44,392 bytes)
  - `outputs/firefox/spatial-browser-history-firefox.xpi` (44,392 bytes)
- **Checksum Verification ([`outputs/SHA256SUMS`](../outputs/SHA256SUMS)):**
  ```
  de63faf624229ccb81f08937c4f710cf8f79a95a69e7193c357002f6f0ece737  chrome/spatial-browser-history-extension.zip
  930a462762be4fd06a9a74994cfb2d1d49b41c0eb491424118c2b290b492f034  firefox/spatial-browser-history-firefox.zip
  930a462762be4fd06a9a74994cfb2d1d49b41c0eb491424118c2b290b492f034  firefox/spatial-browser-history-firefox.xpi
  ```

---

## 6. Documentation & Task Index Synchronization

Documentation across the repository has been updated and synchronized to reflect Task 15 completion and the owner decision framework:
- **[`README.md`](../README.md):** Clearly states that Firefox `115.0` ESR is verified, Chromium `109.0.5414.0` snapshot is engine-proxy evidence, branded Google Chrome 109 stable remains unverified, and Task 15 presents the owner choices.
- **[`docs/TEST_PLAN.md`](../docs/TEST_PLAN.md):** Maintained separate reporting for Chromium 109 proxy evidence vs. Firefox 115 verified floor and current Chrome 157 / Firefox 160 runs.
- **[`task output overview/README.md`](README.md):** Updated Task 15 row to `"Completed (submitted for lead review)"`.
- **[`task output overview/tasks/README.md`](tasks/README.md):** Updated Task 15 listing to `"Completed (submitted for lead review)"`.
- **[`task output overview/tasks/task-15.md`](tasks/task-15.md):** Status updated to `"Completed — submitted for lead review."`

---

## 7. Developer Submission Checklist

Every Task 15 requirement is satisfied:
- [x] Chromium snapshot evidence is strictly documented as engine-proxy evidence and never presented as branded Chrome verification.
- [x] Official and controlled distribution sources (CfT, Omaha, Google Enterprise, Google Cloud Storage) were inspected; technical reasons why Chrome 109 cannot be run standalone on the host were documented.
- [x] Branded Google Chrome 109 stable is clearly labeled as **unverified** across all documentation and indexes.
- [x] The owner is presented with clear, actionable options and trade-offs (Options A, B, and C).
- [x] `minimum_chrome_version` was **not** altered; no schemas, permissions, or privacy rules were changed.
- [x] `npm.cmd test` passes completely (**61 passed, 0 failed**).
- [x] `npm.cmd run build` produces reproducible packages and verified `SHA256SUMS`.
- [x] No release was tagged, pushed, published, or distributed.
- [x] Task 16 remains strictly unstarted; waiting for lead review.
