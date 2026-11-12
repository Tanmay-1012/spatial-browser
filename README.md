# Spatial Browser History

A local-first browser extension for Google Chrome and Mozilla Firefox that helps students and researchers retrace a best-effort path through pages they visited and reopen useful URLs.

> **Current Stable Release:** [`v0.1.0`](https://github.com/Tanmay-1012/spatial-browser/releases/tag/v0.1.0) — Cross-browser Manifest V3 build verified at tag time in Chrome 156 and Firefox 158 ([Release Notes](RELEASE_NOTES.md) · [Changelog](CHANGELOG.md))  
> **Active Branch Status (main):** Task 11 is accepted (Section 57). Task 12 Section 6 revisions (Chrome toolbar UIA click + focus check, dynamic version reporting, real Chrome CDP keyboard input, and desktop/narrow responsive screenshots across Google Chrome `157.0.8103.78` and Mozilla Firefox `160.0`) pass build, 59 unit checks, and both sequential E2E runs (**0 failures, 0 errors, 0 warnings**) — pending lead acceptance ([Task 12 report](task%20output%20overview/task-12-output.md#7-revision-summary--fresh-verification-evidence-2026-11-12)).

## Project Status & Roadmap Toward `v2.0`

- **Stable Release (`v0.1.0` — Tagged & Published):**
  - Cross-browser MV3 packages for Chrome 109+ and Firefox 115.0+ verified (`55 passed, 0 failed` at tag time; isolated-profile Chrome 156.0.8078.48 & Firefox 158.0.1 E2E runs: 0 failures, 0 errors, 0 warnings).
  - Prebuilt `.zip` / `.xpi` archives and `SHA256SUMS` checksums are published under [GitHub Releases (`v0.1.0`)](https://github.com/Tanmay-1012/spatial-browser/releases/tag/v0.1.0).
- **Working Towards `v2.0` (Active Development on `main`):**
  - **Accepted Milestone (Milestone 11 / Task 11):** Schema V2, crash-safe migration, sibling branching, startup safety, and distinct-host download provenance are accepted after the Section 56 Chrome/Firefox checks and Section 57 lead review.
  - **Pending Lead Acceptance (Milestone 12 / Task 12):** The Explorer UI, 59 automated checks, and fresh isolated-profile E2E suites (dynamically querying runtime **Google Chrome `157.0.8103.78`** via CDP and **Mozilla Firefox `160.0`** via Marionette, real keyboard input parity, and desktop/narrow responsive screenshots) pass with **0 failures, 0 errors, and 0 warnings**. See [task-12.md](task%20output%20overview/tasks/task-12.md) and [task-12-output.md](task%20output%20overview/task-12-output.md).

- **Milestone 1 (Foundation):** Cross-browser extension skeleton with valid MV3 manifests, shared interface shell, single-tab focus behavior, and zero-dependency packaging.
- **Milestone 2 & 11 (V2 Storage, Tracking, Session Safety & Download Capture):**
  - **Schema V2 & Crash-Safe Migration:** Stable `treeId`, reciprocal parent/child links, download nodes, and candidate validation. Automatic migration from V1 with raw backup under `spatial_browser_history_data_v1_backup` and passive 24-hour wake-up expiry.
  - **Branch-Aware Navigation Tracking:** Same-tab Back/Forward traversal resolution preserves sibling branching (`Wikipedia -> Source A -> Back -> Wikipedia -> Source B` places Source A and Source B as siblings under Wikipedia). Ambiguous traversal severs active lineage cleanly to independent root checkpoints.
  - **Session Safety & Startup Barrier:** Synchronous listener registration with gated event buffer (up to 20 events). `storage.session` marker checks with bounded retries; fail-closed behavior on storage rejection. Zero-trust single-node baseline collapse for live tabs discovered during initialization.
  - **Download Capture & Provenance Attribution:** Completed-download capture with strict source-domain attribution derived only from a uniquely resolved source page/referrer ($|M|=1$), defaulting safely to `"Source unavailable"` without guessing. Sensitive URLs, filesystem paths, and query tokens are strictly omitted.
  - **Safe Pruning & Wipe:** 1,000-node cap protecting active heads and maintaining edge/stack integrity. Clear Map action wipes graph, tab state, download index, and V1 backup.
- **Milestone 3 & 12 (Research Tree Explorer Overview & Detail UI):** Two-level Research Tree Explorer organizing browsing sessions into strict per-`treeId` Overview cards (`#overview-view`), separating unattributed/ambiguous downloads into a dedicated `"Source unavailable"` shelf, scoping Detail View (`#detail-view`) per research tree with sibling fan geometry, non-distorting context-ancestor filtering, download provenance drawer (hiding URLs/reopen), Back-to-Overview state/focus restoration, WCAG AA contrast, and Clear Map dialog focus trapping. See [the cross-browser test plan](docs/TEST_PLAN.md), [the Task 11 report](task%20output%20overview/task-11-output.md), and [the Task 12 report](task%20output%20overview/task-12-output.md).

## Minimum Supported Browser Versions

| Browser | Minimum Version | Justification |
| :--- | :--- | :--- |
| **Mozilla Firefox** | **115.0+** | Declared project compatibility floor in `browser_specific_settings.gecko.strict_min_version` (ESR 115 baseline supporting `storage.session`); current `main` verified at runtime in Firefox `160.0` (and `v0.1.0` in `158.0.1`). |
| **Google Chrome** | **109.0+** | Declared project compatibility floor in `minimum_chrome_version`; current `main` verified at runtime in Chrome `157.0.8103.78` (and `v0.1.0` in `156.0.8078.48`). |

## Declared Permissions and Reasons

To adhere strictly to least-privilege principles, permissions are limited to the minimum set required for navigation capture, local storage, and download provenance:

- **`"tabs"`**: Required to query open browser tabs, track tab creation (`tabs.onCreated`) and closures (`tabs.onRemoved`), inspect `tab.openerTabId` for cross-tab parentage, update node titles in place when `tabs.onUpdated` fires with `changeInfo.title`, and open saved URLs in new tabs (`tabs.create`).
- **`"storage"`**: Required to persist graph nodes, relationships, and transient `tabState` locally in `chrome.storage.local` / `browser.storage.local`, ensuring data survives background service-worker termination and browser restarts without transmitting data over the network.
- **`"webNavigation"`**: Required to capture committed top-level navigation, SPA History API routes, and fragment events, along with opener associations via `webNavigation.onCreatedNavigationTarget`.
- **`"downloads"`**: Required to capture completed download events (`downloads.onCreated`, `downloads.onChanged`) and attribute provenance to initiating research pages via referrer metadata. Strictly restricted to non-sensitive fields: filename basename, originating domain, completion timestamp, and unique `downloadId` for deduplication. Never inspects downloaded file contents, filesystem paths, full URLs, or query parameters.

*No host permissions (`<all_urls>`), `debugger`, `alarms`, cookie permissions, or external network permissions are requested.*

## Project Layout

```
.
├── src/
│   ├── shared/                # Canonical UI and browser-independent modules
│   │   ├── index.html         # Interactive history map interface & details drawer
│   │   ├── styles.css         # Accessible layout, dark/light themes, graph & drawer styling
│   │   ├── app.js             # SVG graph rendering, pan/zoom, search/filter, and details UI
│   │   ├── ui-logic.js        # Shared layout, filter, and URL safety helpers
│   │   ├── background-messages.js # Background-serialized clear-history action
│   │   ├── launch.js          # Shared tab open-or-focus behavior
│   │   ├── storage.js         # Versioned storage manager, write queue, and safe pruning
│   │   ├── tracker.js         # Canonical navigation tracking and relationship engine
│   │   └── icons/             # 16, 32, 48, 128px PNGs and SVG master icon
│   ├── chrome/                # Chrome-specific entry points
│   │   ├── manifest.json      # MV3 manifest with service_worker and permissions
│   │   └── background.js      # Service worker entry point importing shared modules
│   └── firefox/               # Firefox-specific entry points
│       ├── manifest.json      # MV3 manifest with background.scripts & gecko ID
│       └── background.js      # Event page entry point initializing tracker & storage
├── scripts/
│   ├── build.mjs                      # Deterministic zero-dependency packaging helper
│   ├── generate-icons.py              # Standard library PNG & SVG icon generator
│   ├── e2e-chrome-verification.py     # Chrome CDP E2E acceptance & error-audit runner
│   └── e2e-firefox-verification.py    # Firefox Marionette E2E acceptance & error-audit runner
├── tests/
│   ├── verify-builds.mjs      # Build output, manifest, CSP, and launch tests
│   ├── test-tracker.mjs       # Navigation capture, relationships, queue, and pruning tests
│   └── test-ui.mjs            # UI layout, controls, search/filter, and security tests
├── docs/
│   ├── DEVELOPMENT.md         # Architecture notes, layout algorithms, schema, and rules
│   ├── TEST_PLAN.md           # Cross-browser verification checklist and test records
│   ├── TASK_10.md             # Pointer to the canonical assignment folder
│   ├── RELEASE_NOTES.md       # Version 0.1.0 release notes, compatibility, and evidence
│   └── test-results/          # Real browser E2E execution logs and console error audits
├── outputs/                   # Generated build deliverables (do not edit manually)
│   ├── chrome/
│   │   ├── unpacked/                         # Unpacked Chrome MV3 build
│   │   └── spatial-browser-history-extension.zip
│   ├── firefox/
│   │   ├── unpacked/                         # Unpacked Firefox MV3 build
│   │   ├── spatial-browser-history-firefox.zip
│   │   └── spatial-browser-history-firefox.xpi
│   └── SHA256SUMS                            # Checksums for release archives
├── task output overview/
│   ├── tasks/                  # Canonical developer assignments (Task 10 onward)
│   ├── task-1-output.md        # Completed task reports and verification evidence
│   └── README.md               # Assignment/report index and review status
├── CHANGELOG.md               # Release history (v0.1.0) and roadmap toward v2.0
├── RELEASE_NOTES.md           # Root release notes, deliverables, and verification summary
└── README.md
```

## Packaging and Build Instructions

The build system requires Node.js (v18+ or v24+) and Python 3. No third-party npm packages or dependencies are required.

To build both unpacked extensions and all release archives:

```bash
# Using Node directly:
node scripts/build.mjs

# Or using npm:
npm run build
```

To run the complete automated test suite:

```bash
# Using Node directly:
node tests/verify-builds.mjs
node tests/test-tracker.mjs
node tests/test-ui.mjs

# Or using npm:
npm test
```

## Development Install Instructions

### Google Chrome & Chromium Browsers

1. Build the project using `node scripts/build.mjs`.
2. Open Chrome and navigate to `chrome://extensions`.
3. Toggle the **Developer mode** switch in the top-right corner to **ON**.
4. Click **Load unpacked** in the top-left menu.
5. In the file picker, select the generated unpacked folder:
   `<project_directory>/outputs/chrome/unpacked`
6. Verify that "Spatial Browser History" appears in your extensions list without errors.
7. Click the extension toolbar icon (pin it to the toolbar if hidden) to open the history map.
8. Click the icon a second time to verify that the existing tab is brought into focus instead of opening a duplicate.

### Mozilla Firefox

> **Firefox Unsigned Extension Limitation:**  
> Standard Release and Beta channels of Mozilla Firefox enforce strict extension signing (`xpinstall.signatures.required = true`, locked in release channels). Installing an unsigned `.xpi` via `about:addons` or drag-and-drop will fail with: *"This add-on could not be installed because it has not been verified."*  
> 
> For evaluation, grading, and development, Firefox provides the **Temporary Extensions** interface via `about:debugging`, which does not enforce signature checks. For permanent deployment, Mozilla Firefox Developer Edition or Nightly allow disabling signature requirements in `about:config`, or the extension package can be submitted to Mozilla Add-ons (AMO) for signing.

1. Build the project using `node scripts/build.mjs` (or use prebuilt deliverables in `outputs/`).
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Under the **Temporary Extensions** section, click **Load Temporary Add-on...**.
4. In the file picker, select any of the following:
   - The manifest file: `<project_directory>/outputs/firefox/unpacked/manifest.json`, OR
   - The generated package: `<project_directory>/outputs/firefox/spatial-browser-history-firefox.xpi`, OR
   - The generated archive: `<project_directory>/outputs/firefox/spatial-browser-history-firefox.zip`
5. Verify that "Spatial Browser History" appears under Temporary Extensions with ID `spatial-browser-history@term-project.local` and no errors.
6. Click the extension toolbar icon to open the history map.
7. Switch to another tab and click the toolbar icon again to verify that the map tab is immediately refocused without opening a duplicate.

## Data and Privacy Boundaries

- All browsing metadata remains strictly local to the active browser profile in `chrome.storage.local` / `browser.storage.local`.
- No page content, form inputs, credentials, keystrokes, or remote telemetry are collected.
- Reopening a saved page opens its HTTP/HTTPS URL in a new tab without restoring private session state.





