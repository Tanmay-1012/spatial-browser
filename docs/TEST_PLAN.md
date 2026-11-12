# Cross-browser Test Plan

This record separates automated source-level checks from manual browser behavior. Automated mocks and pure logic tests do not prove that an installed extension works end to end.

## Task 11 & Task 12 status (2026-11-12)

Task 11 core backend implementation, unit tests, and distinct-host browser provenance verification were accepted by lead review on 2026-11-12 (Section 57). **Task 12** (two-level Research Tree Explorer Overview & Detail UI per Task 10 v15 Sections 51–52) is now implemented and submitted for lead review (`task output overview/task-12-output.md`). The **59-test automated suite** passes (`12` build, `35` tracker, `12` UI), and fresh isolated-profile Chrome 156.0.8078.48 and Firefox 158.0.1 runs verify Overview tree-card grouping, Unattributed Downloads shelf (`Source unavailable`), single-tree Detail scoping, sibling SVG geometry, context-ancestor filtering, Back-to-Overview focus/filter restoration, download provenance drawer restrictions, and multi-node restart UI reconciliation with zero extension errors or warnings.
## Test record

- **Declared support floors:** Chrome 109+, Firefox 115.0+ (selected project targets; Firefox ESR 115 baseline).
- **Firefox:** Runtime checks passed in **Mozilla Firefox 158.0.1 (x64 Windows)** on 2026-11-12. The harness drives browser clicks, pointer/keyboard actions, and text input, and verifies two-level Explorer Overview/Detail UI, navigation, opener relationships, sibling branching, distinct-host download provenance (`localhost` source vs `127.0.0.1` file host), unattributed/ambiguous downloads (`Source unavailable` shelf), multi-node restart baseline recovery & UI reconciliation, persistence, context-ancestor filtering, and zero extension errors/warnings. Full log: [`docs/test-results/firefox-e2e.log`](test-results/firefox-e2e.log); audit artifacts: [`docs/test-results/firefox-errors-pre-restart.json`](test-results/firefox-errors-pre-restart.json) and [`docs/test-results/firefox-errors-post-restart.json`](test-results/firefox-errors-post-restart.json).
- **Chrome:** Runtime checks passed in **Google Chrome 156.0.8078.48 (x64 Windows)** on 2026-11-12. The harness verified real toolbar clicks, two-level Explorer Overview/Detail UI, navigation, opener relationships, sibling branching, distinct-host download provenance (`localhost` source vs `127.0.0.1` file host), unattributed/ambiguous downloads (`Source unavailable` shelf), multi-node restart baseline recovery & UI reconciliation, persistence, context-ancestor filtering, and zero extension errors/warnings. Full log: [`docs/test-results/chrome-e2e.log`](test-results/chrome-e2e.log); audit artifacts: [`docs/test-results/chrome-errors-pre-restart.json`](test-results/chrome-errors-pre-restart.json) and [`docs/test-results/chrome-errors-post-restart.json`](test-results/chrome-errors-post-restart.json).
- **Date of this review:** 2026-11-12.
- **Automated results:** `npm test` passed 12 build/launch/archive, 35 tracker/storage/provenance/lifecycle, and 12 Research Tree Explorer UI/contrast/security checks (**59 total passed, 0 failed**) on 2026-11-12.
- **Harness notes:** The Chrome test pins the unpacked extension ID in its isolated profile, and the Firefox test enables Marionette system access through its child-process environment. Both browser suites passed after these compatibility fixes.

## Automated checks

These are repeatable checks of build outputs, mocked browser APIs, pure production helpers, and static page structure. They do not count as browser smoke tests.

- [x] Build, manifest, source parity, CSP, toolbar simulation, and release archive integrity: **12 passed** (`tests/verify-builds.mjs`).
- [x] Navigation and storage rules with mocked APIs and in-memory storage: **35 passed** (`tests/test-tracker.mjs`). Includes dedicated tests for sequential same-tab links, known openers, unknown/closed opener fallbacks, `webNavigation.onCreatedNavigationTarget` opener association, reload and rapid event deduplication, title update in place, fragment vs SPA routes, startup checkpoints, reconciliation, rehydration, serialized concurrency, safe graph pruning, Schema V1->V2 crash-safe migration, passive 24h backup expiry, Back/Forward sibling branching, symmetrical lineage invalidation, unrecorded forward_back resynchronization, website-created child tabs, post-initialization root isolation, reused tab ID single-node collapse, 60s restart marker check, storage read failure fail-closed gate, post-commit marker write failure idempotent worker recovery, completed download provenance attribution with privacy boundaries, unattributed downloads with empty referrers, cross-domain CDN downloads, ambiguous referrers, and Clear Map complete wipe.
- [x] UI structure/CSP, Research Tree Explorer Overview/Detail grouping, sibling alignment, download provenance rendering, context-ancestor filtering, WCAG AA contrast/responsive CSS, and background clear-message queue: **12 passed** (`tests/test-ui.mjs`).
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
- [x] **Explicit visit-count audit & reopening closed child URL (Two-Level Explorer):**
  - Pre-reopen audit: Overview rendered `2 Research Trees · 7 Visits`; opening the main tree Detail View showed strictly `6` scoped SVG `.map-node` elements (excluding the unknown-opener root card).
  - Closed the `/child` tab specifically, selected its SVG node via browser pointer action, verified `#details-panel` showed its saved URL, and clicked `#reopen-btn` via `WebDriver:ElementClick`.
  - Verified the opened tab loaded the exact saved child URL (`8` visits in storage). Because the reopened tab had no browser opener, Overview updated to `3 Research Trees · 8 Visits` while main Detail View stayed strictly isolated at `6` nodes.
- [x] **Prove Overview & Detail search and non-distorting context-ancestor time filtering:**
  - Overview search & restoration: Typing `'target'` filtered Overview cards from `3` to `1`. Opening the card and clicking `#back-to-overview-btn` restored `query === 'target'` and keyboard focus on the opened card button; clearing search restored all `3` cards.
  - Detail search: Typing `'target'` in Detail View showed `2 of 6 matching (+2 context)` with `2` `.map-node.is-search-match` nodes, `2` dimmed `.map-node.is-context-ancestor` parent nodes, and `#detail-context-banner` visible. Clicking `#search-clear-btn` restored all `6` nodes.
  - Time filter selection: Aged `node_page1` by 2 hours. Selecting `'hour'` showed `5 of 6 matching (+1 context)` retaining Page 1 as a dimmed context ancestor so child branches never detach (`!isMatch && isContext`); selecting `'all'` and `'day'` restored all `6` full-match nodes.
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
- [x] **Task 11 & Task 12 UI Explorer Verification & Multi-Node Restart Recovery:**
  - Verified Task 12 Explorer UI live against Firefox storage: Overview separated `dataset.zip` & `ambiguous.bin` into `#unattributed-section` (`Source unavailable`, zero tree cards); `/wiki` Detail View aligned Source A (`x=350, y=80`) and Source B (`x=350, y=182`) as parallel vertical siblings under Wikipedia (`x=80, y=131`); attributed `research_paper.pdf` rendered `Downloaded from localhost` without leaking `127.0.0.1` and selecting it opened `#details-panel` (`#details-source: 'Downloaded from localhost'`, `#details-url-field.hidden === true`, `#details-actions.hidden === true`).
  - Linear 3-step navigation (`/restart-step1` $\to$ `/restart-step2` $\to$ `/restart-step3`) accumulated a 3-node history stack in the live content tab. Process terminated and Firefox relaunched with persistent profile and live tab. Verified all 12 stored graph nodes persisted intact in SQLite (`9` visits, `1` attributed download, `2` unattributed downloads), and the live tab's history stack collapsed to the approved single-node baseline `[step3_node.id]` ($i=0$, `baselineEstablished: true`, `lineageInvalidated: false`). Post-restart Overview showed `3 cards (3 Research Trees · 9 Visits)` and opening the session tree rendered `3` `.map-node`s.
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
- [x] **Explicit visit-count audit & reopening closed child URL (Two-Level Explorer):**
  - Pre-reopen audit: Overview rendered `2 Research Trees · 7 Visits`; opening the main tree Detail View showed strictly `6` scoped SVG nodes (excluding the unknown-opener root card).
  - Closed `/child` tab specifically, selected its SVG map node, verified `#details-panel` displayed its title and URL, and clicked `#reopen-btn`. Verified opened tab loaded safe `http://` child URL (`8` visits in storage).
  - Overview updated to `3 Research Trees · 8 Visits` while main Detail View remained strictly isolated at `6` nodes.
- [x] **Prove Overview & Detail search and non-distorting context-ancestor time filtering:**
  - Overview search & restoration: Typing `'target'` filtered Overview cards from `3` to `1`. Opening the card and pressing `#back-to-overview-btn` restored `query === 'target'` and keyboard focus on the opened card button; clearing search restored all `3` cards.
  - Detail search: Typing `'target'` inside Detail View showed `2 of 6 matching (+2 context)` (`2` `.map-node.is-search-match`, `2` `.map-node.is-context-ancestor`, `#detail-context-banner` visible). Clicking `#search-clear-btn` restored all `6` nodes.
  - Time filter selection: Set `node_page1` timestamp to 2 hours ago. Selecting `'hour'` showed `5 of 6 matching (+1 context)` retaining Page 1 dimmed (`!isMatch && isContext`); selecting `'all'` and `'day'` restored all `6` full-match nodes.
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
- [x] **Task 11 & Task 12 UI Explorer Verification & Multi-Node Restart Recovery:**
  - Verified Task 12 Explorer UI live against Chrome storage: Overview separated `dataset.zip` & `ambiguous.bin` into `#unattributed-section` (`Source unavailable`, zero tree cards); `/wiki` Detail View aligned Source A (`x=350, y=80`) and Source B (`x=350, y=182`) as parallel vertical siblings under Wikipedia (`x=80, y=131`); attributed `research_paper.pdf` rendered `Downloaded from localhost` without leaking `127.0.0.1` and selecting it opened `#details-panel` (`#details-source: 'Downloaded from localhost'`, `#details-url-field.hidden === true`, `#details-actions.hidden === true`).
  - Linear 3-step navigation (`/restart-step1` $\to$ `/restart-step2` $\to$ `/restart-step3`) accumulated a 3-node history stack in the live content tab. Process terminated and Chrome relaunched with persistent profile and live tab. Verified all 12 stored graph nodes persisted intact in `chrome.storage.local` (`9` visits, `1` attributed download, `2` unattributed downloads), and the live tab's history stack collapsed to the approved single-node baseline `[step3_node.id]` ($i=0$, `baselineEstablished: true`, `lineageInvalidated: false`). Post-restart Overview showed `3 cards (3 Research Trees · 9 Visits)` and opening the session tree rendered `3` `.map-node`s.
- [x] **Background service worker suspension & browser process restart persistence:**
  - Tested MV3 background service worker suspension via CDP `Target.closeTarget`; verified service worker re-awakens on demand with storage intact.
  - Terminated Chrome process. Relaunched Chrome with persistent profile; reconnected via CDP, reopened extension map, and verified visits persisted and reconciled in Overview & Detail views.
- [x] **Capture & audit browser/extension errors across phases:**
  - **Pre-restart phase evaluated 254 CDP event records:** 0 extension errors, 0 warnings ([`docs/test-results/chrome-errors-pre-restart.json`](test-results/chrome-errors-pre-restart.json)).
  - **Post-restart phase evaluated 16 CDP event records:** 0 extension errors, 0 warnings ([`docs/test-results/chrome-errors-post-restart.json`](test-results/chrome-errors-post-restart.json)).

## Privacy and permissions review

- [x] Confirmed the manifests request only `tabs`, `storage`, `webNavigation`, and `downloads`.
- [x] Confirmed `downloads` captures strictly non-sensitive fields: filename basename, originDomain, completion timestamp, and unique `downloadId` for deduplication. Never inspects downloaded file contents, filesystem paths, full URLs, or query parameters.
- [x] Confirmed page titles and URLs are rendered as text, not executable markup (`textContent` / `replaceChildren`, zero `innerHTML`).
- [x] Source audit found no page-content scripts, sensitive-input collection, network collection, or device-sync code.

## Current acceptance status

- **Firefox:** Logged checks passed on 2026-11-12 for baseline navigation, Task 12 Explorer UI, sibling branching, distinct-host download provenance (`localhost` source vs `127.0.0.1` CDN), missing/ambiguous referrers, and multi-node restart recovery (0 errors, 0 warnings).
- **Chrome:** Logged checks passed on 2026-11-12 for baseline navigation, Task 12 Explorer UI, sibling branching, distinct-host download provenance (`localhost` source vs `127.0.0.1` CDN), missing/ambiguous referrers, and multi-node restart recovery (0 errors, 0 warnings).
- **Task 11 & Task 12 Status:** Task 11 accepted per Section 57 of `task output overview/task-11-output.md`. Task 12 implemented and verified across unit and cross-browser E2E suites; submitted in `task output overview/task-12-output.md` for lead review.









