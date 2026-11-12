# Cross-browser Test Plan

This record separates automated source-level checks from manual browser behavior. Automated mocks and pure logic tests do not prove that an installed extension works end to end.

## Task 11 acceptance status (2026-11-12)

Task 11 core backend implementation, unit tests, and distinct-host browser provenance verification are complete and passing as of 2026-11-12 (awaiting final lead review before Task 12). The provenance implementation derives the source domain strictly from a uniquely matched source page/referrer, defaults to `Source unavailable` for missing or ambiguous referrers, and passes 55 automated tests (`0` failures). Fresh isolated-profile Chrome 156.0.8078.48 and Firefox 158.0.1 runs verify sibling branching, distinct-host download provenance (`http://localhost` source portal vs `http://127.0.0.1` file host, storing `originDomain: "localhost"`), missing/ambiguous referrers, and multi-node restart baseline collapse with zero extension errors or warnings. See Section 56 of `task output overview/task-11-output.md`.
## Test record

- **Declared support floors:** Chrome 109+, Firefox 115.0+ (selected project targets; Firefox ESR 115 baseline).
- **Firefox:** Runtime checks passed in **Mozilla Firefox 158.0.1 (x64 Windows)** on 2026-11-12. The harness drives browser clicks, pointer/keyboard actions, and text input, and verifies navigation, opener relationships, sibling branching, distinct-host download provenance (`localhost` source vs `127.0.0.1` file host), unattributed/ambiguous downloads, multi-node restart baseline recovery, persistence, filtering, and zero extension errors/warnings. Full log: [`docs/test-results/firefox-e2e.log`](test-results/firefox-e2e.log); audit artifacts: [`docs/test-results/firefox-errors-pre-restart.json`](test-results/firefox-errors-pre-restart.json) and [`docs/test-results/firefox-errors-post-restart.json`](test-results/firefox-errors-post-restart.json).
- **Chrome:** Runtime checks passed in **Google Chrome 156.0.8078.48 (x64 Windows)** on 2026-11-12. The harness verified real toolbar clicks, navigation, opener relationships, sibling branching, distinct-host download provenance (`localhost` source vs `127.0.0.1` file host), unattributed/ambiguous downloads, multi-node restart baseline recovery, persistence, filtering, and zero extension errors/warnings. Full log: [`docs/test-results/chrome-e2e.log`](test-results/chrome-e2e.log); audit artifacts: [`docs/test-results/chrome-errors-pre-restart.json`](test-results/chrome-errors-pre-restart.json) and [`docs/test-results/chrome-errors-post-restart.json`](test-results/chrome-errors-post-restart.json).
- **Date of this review:** 2026-11-12.
- **Automated results:** `npm test` passed 12 build/launch/archive, 35 tracker/storage/provenance/lifecycle, and 8 UI logic/structure checks (55 total passed, 0 failed) on 2026-11-12.
- **Harness notes:** The Chrome test pins the unpacked extension ID in its isolated profile, and the Firefox test enables Marionette system access through its child-process environment. Both browser suites passed after these compatibility fixes.

## Automated checks

These are repeatable checks of build outputs, mocked browser APIs, pure production helpers, and static page structure. They do not count as browser smoke tests.

- [x] Build, manifest, source parity, CSP, toolbar simulation, and release archive integrity: **12 passed** (`tests/verify-builds.mjs`).
- [x] Navigation and storage rules with mocked APIs and in-memory storage: **35 passed** (`tests/test-tracker.mjs`). Includes dedicated tests for sequential same-tab links, known openers, unknown/closed opener fallbacks, `webNavigation.onCreatedNavigationTarget` opener association, reload and rapid event deduplication, title update in place, fragment vs SPA routes, startup checkpoints, reconciliation, rehydration, serialized concurrency, safe graph pruning, Schema V1->V2 crash-safe migration, passive 24h backup expiry, Back/Forward sibling branching, symmetrical lineage invalidation, unrecorded forward_back resynchronization, website-created child tabs, post-initialization root isolation, reused tab ID single-node collapse, 60s restart marker check, storage read failure fail-closed gate, post-commit marker write failure idempotent worker recovery, completed download provenance attribution with privacy boundaries, unattributed downloads with empty referrers, cross-domain CDN downloads, ambiguous referrers, and Clear Map complete wipe.
- [x] UI structure/security, production layout/filter/URL helpers, contrast pairs, and background clear-message queue: **8 passed** (`tests/test-ui.mjs`).
- [x] Rebuilt both browser packages; shared source assets are present and identical in both outputs.

## Browser Smoke Checks

Separate records are maintained for each target browser. No check is marked verified unless executed directly in that browser.

### Mozilla Firefox (Version: 158.0.1 x64 Windows)

Fresh corrected-harness run: [`docs/test-results/firefox-e2e.log`](test-results/firefox-e2e.log). The harness used a unique temporary profile and dynamic server/Marionette ports, cleaned up browser processes, counted raw storage nodes for reload deduplication, and completed the W3C wheel action without a synthetic fallback.

- [x] **Trigger actual extension toolbar action with browser clicks & verify open-or-focus:** Pinned `spatial-browser-history_term-project_local-browser-action` to nav-bar and activated via `WebDriver:ElementClick` on `spatial-browser-history_term-project_local-BAP`. First browser click opened the map tab (`totalTabs=2`); second browser click after switching to `about:home` focused the existing map tab without increasing tab count (`totalTabs=2`).
- [x] **Assert stored visits & parent relationships for complete navigation sequence:**
  - Same-tab navigation (`/page1` $\to$ `/page2`): `node_page1` is a root checkpoint (`parentNodeId: null`, `isCheckpoint: true`). `node_page2` has `parentNodeId === node_page1.id`, and `node_page1.childNodeIds` contains `node_page2.id`.
  - Redirect (HTTP 302 `/redirect` $\to$ `/target`): `/target` destination recorded as child of `/page2`.
  - [x] Reload deduplication: The corrected harness counts target-path visits directly from raw stored nodes; exactly one `/target` node remained after reload and fragment update.
  - Title changes: Dynamic `document.title = 'Updated Target Title'` updated the node title in place to `'Updated Target Title'`.
  - Anchor fragment: Location hash `#section1` updated the current node URL without creating a duplicate visit node.
  - SPA routes: `history.pushState` to `/target/spa-route` recorded as child of `/target`.
  - Opener tabs: Button click in `/opener` opened `/child` in a new tab; `/child` stored with `parentNodeId === node_opener.id`, and `node_opener.childNodeIds` contains child ID.
  - Unknown/closed opener fallback: Navigated a child tab to `/unknown-parent` from an untracked `about:blank` opener tab closed prior to commit; verified `/unknown-parent` was recorded as a root checkpoint (`parentNodeId: null`, `isCheckpoint: true`, `childNodeIds: []`) with no dangling parent link.
- [x] **Explicit visit-count audit & reopening closed child URL:**
  - Pre-reopen visit count explicitly asserted: exactly 7 stored visits in SQLite and 7 rendered SVG map nodes.
  - Closed the `/child` tab specifically, selected its SVG node via browser pointer action, verified the details panel showed its saved URL, and clicked `#reopen-btn` via `WebDriver:ElementClick`.
  - Verified the opened tab loaded the exact saved child URL.
  - Post-reopen visit count explicitly asserted: exactly 8 stored visits (the original 7 plus 1 new visit for the reopened `/child` tab) and 8 rendered SVG nodes.
- [x] **Prove search and time filtering across real boundaries with browser input:**
  - Search query typing: Driven by typing `'target'` directly into `#search-input` via `WebDriver:ElementSendKeys`, firing native `input` events and testing the 150ms debounce before rendering. Reduced matching nodes from 8 to 2 (`2 of 8 visits` badge).
  - Clearing search: Clicked `#search-clear-btn` via `WebDriver:ElementClick`, clearing input value to `""` and restoring all 8 visits (`8 of 8 visits`).
  - Time filter selection: Driven by selecting options via `WebDriver:ElementClick` on `#time-filter option[value='...']`, firing native `change` events. Set `node_page1` timestamp to 2 hours ago. Clicking option `'hour'` reduced matching nodes from 8 to 7 with `node_page1` excluded. Clicking option `'all'` or `'day'` restored `node_page1` and all 8 visits.
- [x] **Exercise pointer pan, zoom buttons/fit, keyboard navigation, and Tab/Shift+Tab focus trap via browser input:**
  - Real browser pointer drag on `#map-container` updated viewport translation. Real browser keyboard arrow keys (`ArrowRight`, `ArrowDown`) panned viewport.
  - Zoom in (`#zoom-in`), zoom out (`#zoom-out`), and fit button (`#zoom-reset`) clicked via `WebDriver:ElementClick`.
  - Mouse wheel zoom completed via the W3C wheel action; the corrected harness has no synthetic fallback.
  - Focused first node and dispatched browser `Enter` key: node gained `.is-selected` and details drawer opened.
  - Clear modal focus trap exercised via real browser keyboard actions: Initial focus defaulted to `#cancel-clear-btn`. Sending browser `Tab` key wrapped focus forward to `#confirm-clear-btn`. Sending browser `Shift+Tab` key wrapped focus backward to `#cancel-clear-btn`.
  - Modal cancel via `WebDriver:ElementClick` closed dialog and preserved all 8 stored visits; modal confirm cleared storage, updated badge to `0 visits`, and rendered `#empty-state`.
- [x] **Task 11 Sibling Branching (`Wikipedia -> Source A -> Back -> Source B`):** Navigated `/wiki` $\to$ `/source-a` $\to$ `WebDriver:Back` $\to$ `/source-b`. Verified Source A and Source B are siblings with `parentNodeId === wikiNode.id`, sharing Wikipedia's `treeId`, with both listed in Wikipedia's `childNodeIds`, and exactly 1 Wikipedia node stored.
- [x] **Task 11 Distinct-Host Download Provenance (`http://localhost` source $\to$ `http://127.0.0.1` file host):** Navigated to `http://localhost:{TEST_PORT}/download-portal` and downloaded `research_paper.pdf` served from `http://127.0.0.1:{CDN_PORT}/cdn-file.pdf`. Verified via `browser.downloads.search` and extension storage that the final download URL hostname is `"127.0.0.1"`, while the completed download node attaches under `/download-portal`, stores `originDomain: "localhost"`, and omits raw URLs.
- [x] Both Chrome 156.0.8078.48 and Firefox 158.0.1 isolated-profile suites verified `originDomain === "localhost"` (`!= "127.0.0.1"`) on 2026-11-12 with 0 failures, 0 errors, and 0 warnings.
- [x] **Task 11 Unattributed & Ambiguous Downloads:** Completed download without referrer recorded `parentNodeId: null` and `originDomain: "Source unavailable"`. Download with ambiguous referrer matching 2 candidate pages ($|M| = 2$) safely fell back to `parentNodeId: null` and `originDomain: "Source unavailable"`.
- [x] **Task 11 Multi-Node Tab Session Baseline Recovery on Browser Restart:** Linear 3-step navigation (`/restart-step1` $\to$ `/restart-step2` $\to$ `/restart-step3`) accumulated a 3-node history stack in the live content tab. Process terminated and Firefox relaunched with persistent profile and live tab. Verified all 12 stored graph nodes persisted intact in SQLite, and the live tab's history stack collapsed to the approved single-node baseline `[step3_node.id]` ($i=0$, `baselineEstablished: true`, `lineageInvalidated: false`). SVG map rendered all 12 visits.
- [x] **Capture & audit browser/extension errors (Demonstrated across phases):** Evaluated Gecko `Services.console` across both pre-restart (5 Gecko messages) and post-restart (24 Gecko messages) phases, filtered by extension UUID (`d14e130f-9ddc-4a9b-8f3e-spatial000001`), extension ID (`spatial-browser-history@term-project.local`), and extension script sources (`tracker.js`, `storage.js`, `app.js`, `ui-logic.js`, `launch.js`, `background.js`, `background-messages.js`). Both phases passed with 0 errors and 0 warnings, and detailed records are persisted to [`docs/test-results/firefox-errors-pre-restart.json`](test-results/firefox-errors-pre-restart.json) and [`docs/test-results/firefox-errors-post-restart.json`](test-results/firefox-errors-post-restart.json). Documented architectural limit: Gecko `Services.console` is an in-memory per-process ring buffer that resets on process restart, requiring per-phase capture before process termination rather than unified post-mortem analysis. Telemetry during OS process teardown after Marionette disconnect cannot be observed via `Services.console`.

### Google Chrome (Version: 156.0.8078.48 x64 Windows)

Full verification run output preserved in [`docs/test-results/chrome-e2e.log`](test-results/chrome-e2e.log). Error audit artifacts preserved in [`docs/test-results/chrome-errors-pre-restart.json`](test-results/chrome-errors-pre-restart.json) and [`docs/test-results/chrome-errors-post-restart.json`](test-results/chrome-errors-post-restart.json).

- [x] **Load unpacked extension without errors:** Loaded unpacked MV3 build from `outputs/chrome/unpacked` via CDP `Extensions.loadUnpacked`. Background service worker discovered and attached (`background.js`). All modules (`SpatialStorage`, `SpatialTracker`, `openOrFocusPage`) initialized with 0 startup errors.
- [x] **Trigger the actual Chrome toolbar action & verify open-or-focus:** Pinned extension action button in Chrome toolbar (`Default/Preferences`) and activated via native Windows UI Automation + AccessibleObjectFromPoint (`accDoDefaultAction`). First browser click opened the map tab (`total pages=2`, was 1); second browser click after switching focus to a blank content tab focused the existing map tab without opening a duplicate tab (`map_tabs_count == 1`, total pages unchanged at 3).
- [x] **Assert stored visits & parent relationships for the tested navigation sequence:**
  - Same-tab navigation (`/page1` $\to$ `/page2`): `node_page1` is a root checkpoint (`parentNodeId: null`, `isCheckpoint: true`). `node_page2` has `parentNodeId === node_page1.id`, and `node_page1.childNodeIds` includes `node_page2.id`.
  - Redirect (HTTP 302 `/redirect` $\to$ `/target`): `/target` destination recorded as child of `/page2`.
  - Reload deduplication: Exactly one `/target` node remained after reload and fragment update.
  - Title changes: Dynamic `document.title = 'Updated Target Title'` updated the node title in place to `'Updated Target Title'`.
  - Anchor fragment: Location hash `#section1` updated current node URL without creating an extra visit node.
  - SPA routes: `history.pushState` to `/target/spa-route` recorded as child of `/target`.
  - Opener tabs: Button click in `/opener` opened `/child` in a new tab; `/child` recorded with `parentNodeId === node_opener.id`, and `node_opener.childNodeIds` includes child ID.
  - Unknown/closed opener fallback: Navigated a child tab to `/unknown-parent` whose opener tab was an untracked temporary tab that closed prior to commit; verified `/unknown-parent` visit was recorded as a root checkpoint (`parentNodeId: null`, `isCheckpoint: true`, `childNodeIds: []`) with no dangling parent link.
- [x] **Explicit visit-count audit & reopening closed child URL:**
  - Pre-reopen visit count explicitly asserted: exactly 7 stored visits in `chrome.storage.local` and 7 rendered SVG map nodes.
  - Closed `/child` tab specifically, selected its SVG map node, verified the details panel displayed its title and URL, and clicked `#reopen-btn`.
  - Verified opened tab loaded safe `http://` child URL.
  - Post-reopen visit count explicitly asserted: exactly 8 stored visits (the original 7 plus 1 new visit for the reopened `/child` tab) and 8 rendered SVG nodes.
- [x] **Prove search and time filtering across real boundaries with browser input:**
  - Search query typing: Driven by typing `'target'` into `#search-input`, firing native input events and testing 150ms debounce. Reduced matching nodes from 8 to 2 (`2 of 8 visits` badge).
  - Clearing search: Clicked `#search-clear-btn`, resetting input value and restoring all 8 visits (`8 of 8 visits`).
  - Time filter selection: Set `node_page1` timestamp to 2 hours ago. Selecting option `'hour'` reduced matching nodes from 8 to 7 with `node_page1` excluded. Selecting option `'all'` or `'day'` restored `node_page1` and all 8 visits.
- [x] **Exercise pointer pan, zoom buttons/fit, keyboard navigation, and Tab/Shift+Tab focus trap:**
  - Pointer drag on `#map-container` updated viewport translation. Keyboard arrow keys (`ArrowRight`, `ArrowDown`) panned viewport.
  - Zoom in (`#zoom-in`), zoom out (`#zoom-out`), and fit button (`#zoom-reset`) updated viewport scale and translation.
  - Focused node and sent keyboard `Enter` key: node gained `.is-selected` and details drawer opened.
  - Clear modal focus trap exercised via keyboard input: Initial focus defaulted to `#cancel-clear-btn`. Sending `Tab` key wrapped focus to `#confirm-clear-btn`. Sending `Shift+Tab` wrapped focus backward to `#cancel-clear-btn`.
  - Modal cancel closed dialog and preserved all 8 visits; modal confirm cleared storage, updated badge to `0 visits`, and rendered `#empty-state`.
- [x] **Task 11 Sibling Branching (`Wikipedia -> Source A -> Back -> Source B`):** Navigated `/wiki` $\to$ `/source-a` $\to$ `window.history.back()` $\to$ `/source-b`. Verified Source A and Source B are siblings with `parentNodeId === wikiNode.id`, sharing Wikipedia's `treeId`, with both listed in Wikipedia's `childNodeIds`, and exactly 1 Wikipedia node stored.
- [x] **Task 11 Distinct-Host Download Provenance (`http://localhost` source $\to$ `http://127.0.0.1` file host):** Navigated to `http://localhost:{TEST_PORT}/download-portal` and downloaded `research_paper.pdf` served from `http://127.0.0.1:{CDN_PORT}/cdn-file.pdf`. Verified via `chrome.downloads.search` and extension storage that the final download URL hostname is `"127.0.0.1"`, while the completed download node attaches under `/download-portal`, stores `originDomain: "localhost"`, and omits raw URLs.
- [x] Both Chrome 156.0.8078.48 and Firefox 158.0.1 isolated-profile suites verified `originDomain === "localhost"` (`!= "127.0.0.1"`) on 2026-11-12 with 0 failures, 0 errors, and 0 warnings.
- [x] **Task 11 Unattributed & Ambiguous Downloads:** Completed download without referrer recorded `parentNodeId: null` and `originDomain: "Source unavailable"`. Download with ambiguous referrer matching 2 candidate pages ($|M| = 2$) safely fell back to `parentNodeId: null` and `originDomain: "Source unavailable"`.
- [x] **Task 11 Multi-Node Tab Session Baseline Recovery on Browser Restart:** Linear 3-step navigation (`/restart-step1` $\to$ `/restart-step2` $\to$ `/restart-step3`) accumulated a 3-node history stack in the live content tab. Process terminated and Chrome relaunched with persistent profile and live tab. Verified all 12 stored graph nodes persisted intact in `chrome.storage.local`, and the live tab's history stack collapsed to the approved single-node baseline `[step3_node.id]` ($i=0$, `baselineEstablished: true`, `lineageInvalidated: false`). SVG map rendered all 12 visits.
- [x] **Background service worker suspension & browser process restart persistence:**
  - Tested MV3 background service worker suspension via CDP `Target.closeTarget`; verified service worker re-awakens on demand with storage intact.
  - Terminated Chrome process. Relaunched Chrome with persistent profile; reconnected via CDP, reopened extension map, and verified visits persisted and reconciled in map.
- [x] **Capture & audit browser/extension errors across phases:**
  - **Pre-restart phase evaluated 255 CDP event records:** 0 extension errors, 0 warnings ([`docs/test-results/chrome-errors-pre-restart.json`](test-results/chrome-errors-pre-restart.json)).
  - **Post-restart phase evaluated 16 CDP event records:** 0 extension errors, 0 warnings ([`docs/test-results/chrome-errors-post-restart.json`](test-results/chrome-errors-post-restart.json)).

## Privacy and permissions review

- [x] Confirmed the manifests request only `tabs`, `storage`, `webNavigation`, and `downloads`.
- [x] Confirmed `downloads` captures strictly non-sensitive fields: filename basename, originDomain, completion timestamp, and unique `downloadId` for deduplication. Never inspects downloaded file contents, filesystem paths, full URLs, or query parameters.
- [x] Confirmed page titles and URLs are rendered as text, not executable markup (`textContent` / `replaceChildren`, zero `innerHTML`).
- [x] Source audit found no page-content scripts, sensitive-input collection, network collection, or device-sync code.

## Current acceptance status

- **Firefox:** Logged checks passed on 2026-11-12 for baseline navigation/UI, sibling branching, distinct-host download provenance (`localhost` source vs `127.0.0.1` CDN), missing/ambiguous referrers, and multi-node restart recovery (0 errors, 0 warnings).
- **Chrome:** Logged checks passed on 2026-11-12 for baseline navigation/UI, sibling branching, distinct-host download provenance (`localhost` source vs `127.0.0.1` CDN), missing/ambiguous referrers, and multi-node restart recovery (0 errors, 0 warnings).
- **Task 11 Acceptance Status:** Section 56 verification submitted for lead review (`task output overview/task-11-output.md`). Task 12 UI redesign remains unstarted pending lead approval.








