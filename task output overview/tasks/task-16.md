# Task 16 — Continuous Integration Build and Test Gate

**Status:** Completed — submitted for lead review (see [`task output overview/task-16-output.md`](../task-16-output.md)).  
**Milestone:** 16 (Quality Automation)  
**Prerequisite:** Task 15 is accepted with its branded Chrome 109 evidence limitation in [Task 15 output](../task-15-output.md#10-lead-review--task-15-accepted-with-limitation-task-16-assigned).

## Objective

Add a small GitHub Actions workflow that automatically builds the extension packages and runs the existing deterministic test suite for changes proposed to `main`. This adds a repeatable quality gate without publishing or distributing packages.

## Repository facts

- There is currently no `.github` workflow directory.
- The project has no `package-lock.json` or runtime dependencies; do not create a lockfile or add a package solely for CI.
- The existing scripts are `npm.cmd run build` and `npm.cmd test`. The test suite checks build outputs, tracker/storage behavior, and UI behavior.
- Browser runtime E2E verification remains a separate manual task. Do not download or install Chrome 109 in CI.

## Required work

1. Add a workflow under `.github/workflows/` that runs on:
   - pushes to `main`;
   - pull requests targeting `main`; and
   - manual `workflow_dispatch` runs.
2. Run the job on a Windows GitHub-hosted runner to match the project's Windows development environment. Use a currently supported Node.js LTS release and maintained official GitHub Actions for checkout and Node setup.
3. Grant only the permissions needed to read the repository. The workflow must not require secrets, publish packages, create releases, upload build artifacts, or modify the repository.
4. Run `npm.cmd run build` before `npm.cmd test` so the verification suite checks freshly generated packages and checksums. Let failures fail the workflow.
5. Keep the workflow focused on existing scripts. Do not change app behavior, browser support floors, permissions, storage, privacy rules, or add tests/dependencies as part of this task.
6. Document the workflow triggers and the distinction between automated checks and manual browser runtime tests in `docs/DEVELOPMENT.md` or an equally appropriate existing project document.

## Validation

- Validate the workflow syntax with an available local validator or parser; do not add a dependency solely for linting.
- Run `npm.cmd run build` and `npm.cmd test` locally and report exact results and generated checksums.
- Do not push a branch or trigger a remote workflow. State clearly that the first GitHub-hosted run will occur after an owner-approved push or pull request.

## Acceptance criteria

- The workflow has the requested triggers and runs the build followed by all existing tests on Windows.
- Workflow permissions are read-only and it has no publish, release, artifact-upload, or secret-dependent steps.
- Existing local tests and build pass; checksums are recorded.
- Project documentation explains what CI covers and that browser runtime checks remain manual.
- No unrelated product behavior or compatibility floor changes are included.

## Deliverables

- `.github/workflows/ci.yml` (or a clearly named equivalent workflow).
- Updated project documentation.
- `../task-16-output.md` with validation evidence and a local commit reference; no remote push.
