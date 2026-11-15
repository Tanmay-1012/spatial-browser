# Task 15 Output — Branded Chrome 109 Verification or Support-Floor Decision

**Status:** Completed — resubmitted for lead review (see Section 9).  
**Milestone:** 15 (Chrome Runtime Evidence)  
**Prerequisite:** Task 14 accepted with its Chrome 109 evidence limitation in Section 9 of [`task output overview/task-14-output.md`](task-14-output.md#9-lead-review--task-14-accepted-with-chrome-evidence-limitation-task-15-assigned-2026-11-14).  
**Declared Minimum Compatibility Floors:** Google Chrome `109+` (`minimum_chrome_version: "109"` in [`src/chrome/manifest.json`](../src/chrome/manifest.json)) & Mozilla Firefox `115.0+` (`strict_min_version: "115.0"` in [`src/firefox/manifest.json`](../src/firefox/manifest.json)).  
**Original Execution Date:** 2026-11-14  
**Revision Resubmission Date:** 2026-11-15  

---

## 1. Executive Summary & Objective

Task 15 resolves the remaining verification gap between the declared `minimum_chrome_version: "109"` and the evidence collected in Task 14: while Mozilla Firefox `115.0` ESR passed live isolated-profile verification, and an unbranded Chromium `109.0.5414.0` snapshot passed as an engine proxy, branded Google Chrome 109 stable remained unverified.

The objective of Task 15 is either to obtain and execute live runtime verification on an authentic branded Google Chrome 109 stable binary in an isolated environment, or to establish the exact technical blocker, maintain the unverified status, and present the owner with actionable choices.

### Key Findings & Outcomes:
1. **Source & Distribution Investigation:** First-party Google sources were probed:
   - Google's [Chrome for Testing (CfT)](https://developer.chrome.com/docs/automation-and-testing/chrome-for-testing) program launched at Chrome 113 (`113.0.5672.0`). Chrome 109 predates CfT by four major versions; Google hosts no versioned CfT packages for v109.
   - Google's Omaha CDN endpoints (`dl.google.com/chrome/install/...` and `dl.google.com/release2/...`) maintain zero public directory indexing or permalinks for legacy stable builds, returning HTTP 404 or redirecting to current stable.
   - Google Cloud Storage signed release buckets (`commondatastorage.googleapis.com/chrome-signed`) returned HTTP 403 Forbidden.
   - Google's [Enterprise browser FAQ](https://new.chromium.org/administrators/frequently-asked-questions/) explicitly notes older MSI versions are not provided by Google.
2. **Windows Sandbox Check & Exact Blocker:**
   - The launcher `C:\Windows\System32\WindowsSandbox.exe` exists on disk (1,088,872 bytes).
   - Component Based Servicing (CBS) registry check (`HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\PackageIndex\*Containers-DisposableClientVM*`) confirms the optional feature is **disabled/uninstalled** (state value `0`).
   - Querying the Host Compute Service (`hcsdiag.exe list`) failed with code 1 (`Insufficient privileges. Only administrators or users that are members of the Hyper-V Administrators user group are permitted to access virtual machines or containers...`).
   - Session group token check (`whoami /groups`) confirms the process runs at `Medium Mandatory Level` with `BUILTIN\Administrators` used for deny-only, and the account is not a member of `BUILTIN\Hyper-V Administrators`.
   - A non-elevated launch test spawned `WindowsSandbox.exe` (PID 3408), which created 0 windows, 0 guest containers, and consumed 0% CPU before being cleanly terminated.
   - Windows Sandbox cannot be opened or used without enabling system optional features and elevating. Per Task 15 constraints ("Do not enable it, elevate, or install Chrome 109 on the host"), it was not enabled.
3. **Mirrored Installer Provenance, Hashes & Authenticode Verification:**
   - A legacy Google Chrome 109 Enterprise 64-bit MSI was obtained from a third-party archive mirror at `https://archive.org/download/chrome-109-Win7-8/Chrome%20109%20%28Enterprise%29%20x64.msi`.
   - File size: `96,067,584` bytes.
   - Hashes:
     - MD5: `fac133e49ad711ed42d6efe91183f8e9`
     - SHA-1: `fda3e5385667febb2d00125c54cbec66eb1e7c53`
     - SHA-256: `0adace05d1cff3bf24feff3f79efd111798bd7ba32e2acd8d0494ffd6e166b8e`
   - Authenticode signature:
     - Status: `Valid` (`Signature verified`)
     - Signer: `CN=Google LLC, O=Google LLC, L=Mountain View, S=California, C=US`
     - Issuer: `CN=DigiCert Trusted G4 Code Signing RSA4096 SHA384 2021 CA1, O="DigiCert, Inc.", C=US`
     - Thumbprint: `2673EA6CC23BEFFDA49AC715B121544098A1284C`
     - Validity: `02-07-2021 09:00:00` to `11-07-2024 08:59:59`
   - Attribution: Described as a Google-signed MSI obtained from a third-party archive mirror, not a Google-hosted download. While Authenticode authenticates Google LLC as the author, the host is an archive mirror.
   - Installer architecture: The MSI embeds `GoogleChromeInstaller.exe` (`GoogleUpdateSetup.exe` with Omaha wrapper and `mini_installer.exe`), which performs system-wide installation into `C:\Program Files\Google\Chrome\Application`. Running it on the host would overwrite the user's Google Chrome `157.0.8103.78` and break profile isolation, so it was not installed on the host.
4. **Unverified Floor Status Maintained:** Unbranded Chromium snapshot evidence is **not** treated as branded Google Chrome verification. Google Chrome 109 stable remains explicitly marked **UNVERIFIED** in the documentation and test plan, while the Chromium snapshot is retained as engine-proxy evidence only.
5. **Owner Decision Framework:** Outlined three concrete paths for the project owner: (A) Retain declared Chrome 109 floor with explicit unverified status and proxy documentation; (B) Propose a new support floor that can be directly verified (such as a versioned Chrome for Testing release starting at Chrome 113+); or (C) Owner provisions dedicated isolation (enables Windows Sandbox or provisions a disposable VM).
6. **Repository & Build Health:** Executed `npm.cmd test` (**61 passed, 0 failed**) and `npm.cmd run build` (all checksums verified). Preserved all Task 14 lead-review records. No declared floors, storage schemas, permissions, or privacy boundaries were modified. No release was tagged, pushed, or distributed.

---

## 2. Sources, Windows Sandbox Check, and Installer Mirror Provenance

### 2.1 Distribution Sources Checked

| Source / Environment Checked | Availability for Chrome 109 | Technical Limitation / Blocker | Conclusion |
| :--- | :--- | :--- | :--- |
| **Google Chrome for Testing (CfT)** ([availability dashboard](https://googlechromelabs.github.io/chrome-for-testing/)) | **Unavailable for v109** | CfT was introduced in Chrome 113 (`113.0.5672.0`). Probed `googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json`; no packages exist for v109. | First-party standalone test binaries begin at Chrome 113. |
| **Google Omaha CDN / `dl.google.com`** (`dl.google.com/chrome/install/...`) | **Unavailable** | Google maintains zero public permalinks or directory indexing for historical stable builds. Probed URLs return HTTP 404 or redirect to current stable. | Cannot download direct standalone binaries from Google CDN. |
| **Google Cloud Storage** (`commondatastorage.googleapis.com/chrome-signed`) | **Restricted** | Internal Google release buckets containing signed archive packages return HTTP 403 Forbidden. | Inaccessible / non-public path. |
| **Chromium Continuous Builds** (`commondatastorage.googleapis.com/chromium-browser-snapshots/Win_x64/`) | **Available** | Provides unbranded Chromium snapshots (tested at revision 1070087: `109.0.5414.0`). | Valid engine proxy; not branded Chrome stable. |
| **Third-Party Archive Mirror** (`archive.org/download/chrome-109-Win7-8/`) | **Available** (Google-signed MSI) | Obtained Google-signed MSI. System-level installer requires elevated execution and mutates host `C:\Program Files\Google\Chrome\Application`. | File verified as Google-signed, but requires host system installation; cannot run isolated on host without sandbox/VM. |

### 2.2 Windows Sandbox Availability Check
- **Executable Presence:** `C:\Windows\System32\WindowsSandbox.exe` exists on disk (1,088,872 bytes, last modified 2026-10-14).
- **CBS Feature State:** Queried registry `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\PackageIndex\*Containers-DisposableClientVM*`. Packages show value `0`, indicating the Windows Sandbox optional feature is **disabled/uninstalled**.
- **Host Compute Service Privileges:** Executing `hcsdiag.exe list` without elevation failed with exit code 1:
  ```
  Insufficient privileges. Only administrators or users that are members of the Hyper-V Administrators user group are permitted to access virtual machines or containers. To add yourself to the Hyper-V Administrators user group, please see https://aka.ms/hcsadmin for more information.
  ```
- **Session Group Token:** `whoami /groups` confirms the interactive session token is `Medium Mandatory Level`. `BUILTIN\Administrators` is filtered ("Group used for deny only"), and the user account is not a member of `BUILTIN\Hyper-V Administrators`.
- **Non-Elevated Launch Attempt:** Starting `WindowsSandbox.exe` directly spawned a background process (PID 3408, 14 idle threads, 0% CPU, 0 windows, 0 child processes). The process was unable to communicate with the Host Compute Service and was cleanly terminated.
- **Conclusion:** Windows Sandbox is unavailable without enabling Windows optional features and elevating. Per instructions, Windows Sandbox was not enabled and host privileges were not elevated.

### 2.3 Mirrored Installer Provenance, Hashes & Authenticode Verification
- **Exact Mirror URL:** `https://archive.org/download/chrome-109-Win7-8/Chrome%20109%20%28Enterprise%29%20x64.msi`
- **Exact File Size:** `96,067,584` bytes
- **Cryptographic Hashes:**
  - **MD5:** `fac133e49ad711ed42d6efe91183f8e9`
  - **SHA-1:** `fda3e5385667febb2d00125c54cbec66eb1e7c53`
  - **SHA-256:** `0adace05d1cff3bf24feff3f79efd111798bd7ba32e2acd8d0494ffd6e166b8e`
- **Authenticode Digital Signature:**
  ```
  Status                 : Valid
  StatusMessage          : Signature verified.
  SignerCertificate      : [Subject]
                             CN=Google LLC, O=Google LLC, L=Mountain View, S=California, C=US
                           [Issuer]
                             CN=DigiCert Trusted G4 Code Signing RSA4096 SHA384 2021 CA1, O="DigiCert, Inc.", C=US
                           [Serial Number]
                             0E4418E2DEDE36DD2974C3443AFB5CE5
                           [Thumbprint]
                             2673EA6CC23BEFFDA49AC715B121544098A1284C
                           [Not Before]
                             02-07-2021 09:00:00
                           [Not After]
                             11-07-2024 08:59:59
  SignatureType          : Authenticode
  ```
- **Provenance Clarification:** The file is a Google-signed MSI obtained from a third-party archive mirror. The Authenticode signature validates Google LLC as the publisher/signer, but the hosting source is an archive mirror rather than an official Google distribution endpoint.

---

## 3. Chromium Snapshot Engine Proxy vs. Branded Chrome Stable

The unbranded Chromium snapshot at `109.0.5414.0` (revision 1070087) and the reported Google Chrome stable installer at `109.0.5414.120` are different builds and products.
- The Chromium snapshot demonstrates that the Blink rendering engine, V8 JavaScript engine, layout reflow, and CDP automation protocol function correctly at the 109 milestone.
- However, the Chromium snapshot does not execute the branded Google Chrome stable product binary.
- In accordance with lead review guidance, this distinction is maintained purely on verified product and build differences without unsupported claims regarding codecs, accessibility, enterprise policy, or service-worker behavior.
- Consequently, branded Google Chrome 109 stable remains explicitly marked **UNVERIFIED**.

---

## 4. Owner Choices & Trade-off Analysis

To resolve this gap, the project owner has three available architectural options:

### Option A: Retain the Declared Chrome 109 Floor with Explicit Unverified Status
- **Description:** Keep `minimum_chrome_version: "109"` in [`src/chrome/manifest.json`](../src/chrome/manifest.json) as a declared target floor. Describe Chrome 109 as a declared target whose branded stable build is unverified. Retain the Chromium 109 run as engine-proxy evidence only; do not describe Chrome 109 as verified or supported based solely on the Chromium proxy.
- **Pros:** Preserves the project's existing declared target without modifying manifests or build targets.
- **Cons:** Leaves an unverified gap in the branded browser compatibility matrix.
- **Action Required:** Keep current code; finalize documentation.

### Option B: Propose a New Floor That Can Be Directly Verified
- **Description:** Propose a specific new minimum support floor (such as Chrome 113+ or 114+) based on official, standalone Chrome for Testing packages that can be executed in an isolated temporary profile on developer and CI machines. Any manifest change requires explicit owner approval.
- **Pros:** Allows direct, reproducible runtime verification on versioned, standalone Google test binaries without installing over the host browser.
- **Cons:** Drops the declared Chrome 109–112 target range (and legacy Windows 7/8.1 platform compatibility).
- **Action Required:** Requires lead/owner review and an explicit manifest modification task.

### Option C: Use Owner-Provided Isolation for Full MSI Installation
- **Description:** If branded Chrome 109 verification is required, the owner provides an isolated execution environment:
  1. Enables Windows Sandbox via administrative privileges and adds the test user to `BUILTIN\Hyper-V Administrators`; OR
  2. Provisions a dedicated disposable VM with no pre-existing Chrome installation where the Google-signed Chrome 109 Enterprise MSI can be installed system-wide, the E2E test suite executed, and the VM discarded.
- **Pros:** Provides genuine branded Google Chrome 109 runtime evidence without modifying the declared support floor or risking the host developer environment.
- **Cons:** Requires administrative configuration or external VM provisioning outside the local workspace scope.
- **Action Required:** Requires owner action and infrastructure allocation.

> [!IMPORTANT]
> In accordance with Task 15 constraints, `minimum_chrome_version` has **not** been altered. The declared floor remains `Chrome 109+` pending owner decision.

---

## 5. Build Health & Checksum Verification

The build and automated test suites were re-executed to verify complete repository health:

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

Documentation reflects the unverified floor and owner decision framework:
- **[`README.md`](../README.md):** Clearly states that Firefox `115.0` ESR is verified, Chromium `109.0.5414.0` snapshot is engine-proxy evidence, branded Google Chrome 109 stable remains unverified, and Task 15 presents the owner choices.
- **[`docs/TEST_PLAN.md`](../docs/TEST_PLAN.md):** Maintained separate reporting for Chromium 109 proxy evidence vs. Firefox 115 verified floor and current Chrome 157 / Firefox 160 runs.
- **Task indexes:** Task 15 is marked completed and resubmitted for lead review.

---

## 7. Developer Submission Checklist

The submitted evidence confirms the following items:
- [x] Chromium snapshot evidence is labeled as engine-proxy evidence, not branded Chrome verification.
- [x] Branded Google Chrome 109 remains explicitly marked **unverified**.
- [x] `minimum_chrome_version` was not altered, and no release was tagged, pushed, published, or distributed.
- [x] The developer reports `npm.cmd test` passed (**61 passed, 0 failed**) and `npm.cmd run build` completed.
- [x] The local Windows Sandbox availability check was completed: `WindowsSandbox.exe` exists, but the optional feature is disabled in CBS registry, non-elevated launch lacks HCS privileges (`hcsdiag.exe` code 1), and user token lacks `Hyper-V Administrators` membership. Windows Sandbox cannot be opened without elevation or enabling optional features.
- [x] The MSI's exact mirror URL (`https://archive.org/download/chrome-109-Win7-8/Chrome%20109%20%28Enterprise%29%20x64.msi`), exact size (`96,067,584` bytes), MD5, SHA-1, SHA-256 (`0adace05d1cff3bf24feff3f79efd111798bd7ba32e2acd8d0494ffd6e166b8e`), and Authenticode verification output are documented and reproducible.
- [x] All unsupported claims about Chrome/Chromium differences in accessibility, codecs, policies, and extension service-worker lifecycle have been omitted; product and build mismatch is the sole technical distinction.

---

## 8. Lead Review — Revisions Requested

**Review date:** 2026-11-15. **Decision:** Task 15 is not accepted yet. Do not start Task 16.

The investigation is useful, and I independently reran `npm.cmd test` (**61 passed, 0 failed**) and `npm.cmd run build` successfully. The generated `outputs/SHA256SUMS` values match the report. However, the report closes the isolation search too early: this host has `WindowsSandbox.exe`. I could not determine whether the optional feature is enabled because Windows requires elevation for that feature query. No installer was run and no system settings were changed.

Before resubmitting Task 15:

1. Check whether Windows Sandbox is already enabled and can be opened without enabling features or elevating. If available, run the Google-signed Chrome 109 MSI only inside a disposable sandbox, then execute the existing Chrome E2E suite with a throwaway profile. Do not install it on the host. If the feature is unavailable, document that exact blocker and the owner action needed to provide a disposable VM.
2. Identify the exact archive mirror URL and MSI SHA-256, and retain the Authenticode verification output. Describe the file as a Google-signed MSI obtained from the named mirror; a valid signature authenticates the signer but does not make the mirror an official Google source. If those details cannot be recovered, state that limitation rather than describing the source as official.
3. Keep the rationale for proxy-only evidence factual: Chromium `109.0.5414.0` and the reported Chrome stable MSI `109.0.5414.120` are different builds and products. Do not claim untested differences in accessibility, codec, policy, or service-worker behavior.
4. Keep the Chrome 109 floor unchanged and explicitly unverified. Option A may retain the declared target, but must not call Chrome 109 supported based only on the Chromium proxy. No floor change is authorized by this review.

The current task assignment and indexes have been updated to reflect these revisions. Once Task 15 is resubmitted, the lead will review it again before assigning Task 16.

---

## 9. Developer Resubmission — Revisions Completed

**Resubmission Date:** 2026-11-15.  
**Summary of Revisions Completed:**

1. **Windows Sandbox State & Exact Blocker:**
   - Probed `C:\Windows\System32\WindowsSandbox.exe` (exists, 1,088,872 bytes).
   - CBS PackageIndex check confirms `Containers-DisposableClientVM` is uninstalled/disabled (value `0`).
   - Host Compute Service query (`hcsdiag.exe list`) failed with code 1 (`Insufficient privileges...`).
   - User token (`whoami /groups`) runs at `Medium Mandatory Level` and is not in `BUILTIN\Hyper-V Administrators`.
   - Non-elevated launch created zero windows, zero containers, and zero child processes before clean termination.
   - Per instructions, Windows Sandbox was not enabled and no system features or privileges were altered. Documented in Section 2.2 and Option C.
2. **Mirror URL, Hashes & Authenticode Output Recorded:**
   - Exact mirror URL: `https://archive.org/download/chrome-109-Win7-8/Chrome%20109%20%28Enterprise%29%20x64.msi`
   - Exact size: `96,067,584` bytes.
   - Hashes: MD5 `fac133e49ad711ed42d6efe91183f8e9`, SHA-1 `fda3e5385667febb2d00125c54cbec66eb1e7c53`, SHA-256 `0adace05d1cff3bf24feff3f79efd111798bd7ba32e2acd8d0494ffd6e166b8e`.
   - Authenticode signature: Valid, signed by `Google LLC`, thumbprint `2673EA6CC23BEFFDA49AC715B121544098A1284C`.
   - Described as a Google-signed MSI obtained from a third-party archive mirror, not a Google-hosted download. Recorded in Section 2.3.
3. **Factual Proxy-Only Rationale:**
   - Kept strictly to the factual build and product mismatch (`109.0.5414.0` snapshot vs. `109.0.5414.120` stable). All speculative claims about codecs, accessibility, policy, or service-worker behavior have been omitted. Recorded in Section 3.
4. **Declared Minimum Unchanged & Branded Floor Explicitly Unverified:**
   - `minimum_chrome_version: "109"` remains unchanged in `src/chrome/manifest.json`.
   - Branded Chrome 109 remains explicitly marked **UNVERIFIED**.
   - Option A clarifies that retaining the declared floor does not call Chrome 109 supported based on proxy evidence.
5. **Fresh Build & Test Health:**
   - `npm.cmd test`: **61 passed, 0 failed**.
   - `npm.cmd run build`: 5/5 completed cleanly; `outputs/SHA256SUMS` verified.
