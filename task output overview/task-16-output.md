# Task 16 Output — Continuous Integration Build and Test Gate

**Status:** Accepted with limitation — local validation passed; hosted run pending owner-approved push (see Section 8).
**Milestone:** 16 (Quality Automation)  
**Prerequisite:** Task 15 accepted with its open Chrome 109 evidence limitation in Section 10 of [`task output overview/task-15-output.md`](task-15-output.md#10-lead-review--task-15-accepted-with-limitation-task-16-assigned).  
**Execution Date:** 2026-11-15  

---

## 1. Executive Summary & Objective

Task 16 implements an automated continuous integration (CI) build and test quality gate for changes proposed to `main`. This establishes a repeatable automated check that compiles extension distribution packages and executes the project's deterministic test suite on GitHub-hosted infrastructure before code integration.

### Core Outcomes:
1. **GitHub Actions Workflow Created:** Added [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) configured with automatic triggers for `push` to `main`, `pull_request` targeting `main`, and manual execution via `workflow_dispatch`.
2. **Windows Runner Environment:** Configured to run on `windows-latest` with official `actions/setup-node@v7` targeting Node.js 22 LTS, matching the project's local Windows development environment.
3. **Least-Privilege Security Boundary:** Restricted workflow permissions strictly to `contents: read`. It requires no user-provided secrets, does not persist checkout credentials, and includes no publishing, release-generation, or artifact-upload steps.
4. **Execution Pipeline:** Executes `npm.cmd run build` before `npm.cmd test` so that the manifest and packaging verification suite checks freshly compiled builds and matches `outputs/SHA256SUMS`. Failures at any stage halt the workflow.
5. **Clear Scope Boundary:** Documented in [`docs/DEVELOPMENT.md`](../docs/DEVELOPMENT.md) and [`README.md`](../README.md) that CI covers deterministic build parity, manifest validity, and logic tests. End-to-end browser runtime tests (profile isolation, live tab tracking, browser restarts, and visual screenshots) remain separate manual procedures. CI does not download, install, or run legacy browsers (Chrome 109 / Firefox 115).
6. **No Remote Push:** In accordance with Task 16 constraints, no branches have been pushed to remote, no tags created, and no releases published. The first remote GitHub Actions run will trigger upon owner-approved push or pull request.

---

## 2. CI Workflow Specification & Architecture

The workflow is defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

```yaml
name: CI Build and Test Gate

'on':
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build-and-test:
    name: Build & Test (Windows)
    runs-on: windows-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v7
        with:
          persist-credentials: false

      - name: Set up Node.js
        uses: actions/setup-node@v7
        with:
          node-version: '22'
          package-manager-cache: false

      - name: Build extension packages
        run: npm.cmd run build

      - name: Run verification test suite
        run: npm.cmd test
```

### Key Design Decisions:
- **Quoted `'on':` Key:** Quoting `'on':` ensures compatibility across YAML 1.1 parsers (e.g., PyYAML) which would otherwise treat bare `on` as boolean `True`.
- **`windows-latest` Runner:** Mirrors the project's primary development environment and PowerShell command line.
- **Node.js 22 LTS:** Uses a supported Node.js Long Term Support (LTS) release, compatible with ECMAScript module imports used across `scripts/build.mjs` and `tests/*.mjs`.
- **Zero Package-Lock / Zero Dependencies:** Preserves the project's zero external npm dependency model. Does not run `npm ci` or `npm install`, and introduces no new dependencies.
- **Execution Order:** `npm.cmd run build` runs first to produce outputs, followed by `npm.cmd test` which validates those outputs and tests logic.

---

## 3. Local Syntax & Parser Validation

The workflow file was validated using the local Python `yaml` (PyYAML 6.0.3) parser:

```
Parsed YAML successfully:
Name: CI Build and Test Gate
On: {'push': {'branches': ['main']}, 'pull_request': {'branches': ['main']}, 'workflow_dispatch': None}
Permissions: {'contents': 'read'}
Jobs: ['build-and-test']
Runs-on: windows-latest
Steps count: 4
  Step 1: Checkout repository -> uses: actions/checkout@v7 | run: None
  Step 2: Set up Node.js -> uses: actions/setup-node@v7 | run: None
  Step 3: Build extension packages -> uses: None | run: npm.cmd run build
  Step 4: Run verification test suite -> uses: None | run: npm.cmd test
```

- Verified syntax validity: 0 parser errors or warnings.
- Verified trigger paths: `push` (`main`), `pull_request` (`main`), `workflow_dispatch`.
- Verified least-privilege permissions: `{'contents': 'read'}` only.
- Verified no user-provided secrets or upload actions. Checkout uses the automatically provided `GITHUB_TOKEN` under `contents: read`, and `persist-credentials: false` prevents saving it in the repository configuration.

---

## 4. Automated CI vs. Manual Browser Runtime Testing

To prevent ambiguity regarding quality coverage, the boundary between automated CI and manual runtime verification has been documented in [`docs/DEVELOPMENT.md`](../docs/DEVELOPMENT.md#continuous-integration--verification-pipeline-milestone-16):

| Dimension | Automated CI Pipeline (`ci.yml`) | Manual Browser Runtime Testing |
| :--- | :--- | :--- |
| **Execution Trigger** | Push to `main`, PR targeting `main`, `workflow_dispatch` | Pre-release milestones, support floor audits, manual developer sign-off |
| **Environment** | GitHub-hosted `windows-latest` virtual runner | Dedicated developer machine or isolated disposable VM |
| **Node.js Environment** | Node.js 22 LTS via `actions/setup-node@v7` | Local Node.js runtime |
| **Packaging & Manifests** | Full validation via `scripts/build.mjs` & `tests/verify-builds.mjs` | Verified as input artifact prior to browser launch |
| **Unit & Integration Logic** | Full 61-test deterministic test suite (`verify-builds`, `test-tracker`, `test-ui`) | Relies on unit suite baseline pass |
| **Browser Execution** | **None** (headless Node.js environment only) | **Real browser instances** (Chrome via CDP, Firefox via Marionette) |
| **Tab Tracking & Restart** | Simulated via storage mock & event sequence tests | Real browser tabs, process restarts, SQLite profile persistence |
| **Responsive UI & Visuals** | Computed layout geometry tests (indents, bounds, contrast) | Real browser rendering, narrow viewport ($420\times 800$), visual screenshots |
| **Legacy Runtimes** | **Does not download or run** legacy Chrome 109 or Firefox 115 | Manual isolated profile runs on target runtimes |

---

## 5. Build Health & Checksum Verification

Local build and automated test suites were executed to verify complete repository health:

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

- **[`docs/DEVELOPMENT.md`](../docs/DEVELOPMENT.md):** Added Section "Continuous Integration & Verification Pipeline (Milestone 16)" detailing workflow triggers, runner environment, security boundaries, pipeline stages, and the distinction between automated CI and manual browser runtime testing.
- **[`README.md`](../README.md):** Updated Active Branch Status and Project Status roadmap to record Task 16's CI gate.
- **Task indexes:** At submission, Task 16 was marked completed and submitted for lead review; final acceptance and the hosted-run limitation are recorded in Section 8.

---

## 7. Developer Submission Checklist

- [x] Workflow added under `.github/workflows/ci.yml`.
- [x] Configured with triggers: `push` (`main`), `pull_request` (`main`), and `workflow_dispatch`.
- [x] Configured on `windows-latest` runner using current official `actions/checkout@v7` and `actions/setup-node@v7` with Node.js 22 LTS.
- [x] Workflow permissions restricted to read-only (`contents: read`).
- [x] No user-provided secrets, persisted checkout credentials, package-publishing, or artifact-upload steps.
- [x] Pipeline executes `npm.cmd run build` before `npm.cmd test`, failing on any error.
- [x] No dependencies or `package-lock.json` added.
- [x] No application runtime, manifest, storage, tracking, or compatibility floor changes introduced.
- [x] Workflow syntax validated locally via PyYAML parser.
- [x] Distinction between CI automated tests and manual browser runtime tests documented in `docs/DEVELOPMENT.md`.
- [x] `npm.cmd test` passes cleanly (**61 passed, 0 failed**) and `npm.cmd run build` produces verified checksums.
- [x] No remote branches pushed, no tags created, and no releases published.

## 8. Lead Review — Task 16 Accepted with Remote-Run Limitation

**Review date:** 2026-11-15. **Decision:** Task 16 is accepted with local validation complete; its first GitHub-hosted run is pending an owner-approved push or pull request.

### Review findings and corrections

- The workflow has the requested triggers, Windows runner, read-only `contents` permission, and build-before-test order. It does not publish or upload artifacts.
- The submitted workflow used older action majors. I updated it to the current official `actions/checkout@v7` and `actions/setup-node@v7` releases. I also disabled checkout credential persistence and setup-node package-manager caching, which this dependency-free project does not need. See the [official checkout releases](https://github.com/actions/checkout/releases) and [setup-node releases](https://github.com/actions/setup-node/releases).
- I independently reran `npm.cmd test` (**61 passed, 0 failed**) and `npm.cmd run build` successfully. The workflow YAML parses, and the generated checksums match `outputs/SHA256SUMS`.
- No branch was pushed, so no GitHub-hosted execution result exists yet. No push or remote trigger was performed during this review.

### Acceptance status

Task 16 is accepted. Its local workflow and documentation are ready; the only remaining confirmation is the first hosted run after the owner authorizes a push or pull request. No further developer task is assigned until that run can be observed.
