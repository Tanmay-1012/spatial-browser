# Task 12 — Research Tree Explorer Overview & Detail UI

**Status:** Submitted for Lead Review — Narrow Detail Map Legibility & Navigability Verified (see Task 12 output, Section 11). Do not start another task until lead acceptance.
**Milestone:** 12 (Research Tree Explorer UI)  
**Design authority:** Approved v15 proposal and acceptance matrix in Section 51 of [Task 10 output](../task-10-output.md); approval recorded in Section 52. Task 11 is accepted in Section 57 of [Task 11 output](../task-11-output.md).

## Objective

Replace the current single-forest map landing screen with a polished two-level Research Tree Explorer:

1. An overview that summarizes each independent research tree as one navigable card.
2. A detail view that opens one selected tree and shows its full branching history, including attributed downloads.

Keep the existing graph data and tracking behavior. The UI must make separate trees easy to scan, prevent sibling tabs from appearing as duplicate tree cards, and make download provenance clear.

## Scope

### A. Research-tree overview

- Group cards strictly by stable treeId. A browser tab is not a card; several tabs and same-tab branches that share one treeId belong to the same card.
- Show a clear page title and domain for each tree, visit and branch counts, active/open tab count, latest activity, and last-updated time. Display an attributed download as the latest activity when it is newer than the latest page visit.
- Provide a distinct card action to open that tree’s detail view. Selecting a card must not mix nodes from other treeIds into the detail map.
- Retain useful global controls: search across page titles, addresses/domains, and download filenames; the approved time filters; visible result counts; and Clear Map with its existing confirmation behavior.
- When a tree’s original root has been pruned, preserve its stable treeId and card. Use the oldest surviving nodes as visual roots; do not split one tree into multiple cards.
- Keep the overview compact and visually polished, with a responsive card grid and a useful empty state. Avoid the current oversized blank map area on the landing screen.

### B. Tree detail view

- Render all nodes belonging to the selected treeId and their valid parent-child relationships in a readable branch-fan / tree layout. Sibling research paths must be visibly parallel branches under their shared parent.
- Include a breadcrumb or Back to Overview control. Returning must restore the prior overview scroll position, search text, time filter, and keyboard focus when practical.
- Add tree-local search and time filtering. If a matching node has ancestors outside the filter, keep the necessary lineage visible or clearly identify the filtered context; do not make a child appear to have a false parent.
- Retain and verify pan, zoom, and fit controls in detail view. Fit should include all visible nodes in the selected tree and handle large or deep trees.
- Keep page-node selection, details, safe HTTP/HTTPS reopening, keyboard interaction, and clear-history behavior working.

### C. Download presentation and provenance

- Render a uniquely attributed download as a distinct download node beneath its verified source page in the same tree. Make the card/node label and details explicit, for example: “Downloaded from arxiv.org,” plus the sanitized filename and completion time.
- Render downloads whose source is missing or ambiguous in a separate Unattributed Downloads shelf in the overview, labeled “Source unavailable.” Never create a tree card for an unattributed download or place it in a guessed tree.
- Do not treat a download node as a web page: do not offer page URL reopening for it. Do not expose file contents, absolute paths, raw download URLs, or query tokens.
- Keep the UI aligned with the existing storage contract. Do not change source attribution rules or schema in this task.

### D. Visual quality, accessibility, and browser behavior

- Follow the approved v15 wireframes and acceptance matrix. Use a consistent, polished visual hierarchy for overview cards, branches, page nodes, download badges, and the details drawer.
- Keep the extension responsive at typical desktop and narrow viewport widths, with no clipped cards or unusable map controls.
- Preserve visible keyboard focus, logical tab order, accessible names and landmarks, contrast requirements, and reduced-motion support. All overview cards, breadcrumbs, map controls, and details actions must be keyboard usable.
- Maintain Chrome and Firefox parity and the existing minimum versions: Chrome 109+, Firefox 115.0+.

## Constraints

- Do not alter navigation tracking, storage schema, migrations, permissions, or browser manifests. If the UI requires a data-model change, stop and document the concrete mismatch for lead review before changing it.
- Do not add remote services or use real shopping accounts. Use local fixtures with synthetic pages and downloads.
- Keep changes in the existing shared UI where practical so the Chrome and Firefox packages remain in parity.
- Do not start another task before this one is reviewed and accepted.

## Required verification

1. Add or update UI tests for:
   - Three independent root treeIds producing exactly three cards.
   - Multiple opener-created product-like child tabs remaining in one tree/card, with siblings under the listing page.
   - Back-to-parent same-tab branches rendering as siblings.
   - Selecting one card rendering only its tree; Back restoring overview scroll/search/filter state.
   - Attributed download node text/source, plus unattributed-download shelf placement with no tree association.
   - Global and tree-local search/time filtering with correct ancestry context and counts.
   - Root-pruned tree identity, empty state, large/deep tree layout, and safe Clear Map behavior.
   - Keyboard navigation, focus restoration, contrast, and reduced motion.
2. Run updated isolated-profile end-to-end scenarios in Chrome (`157.0.8103.78` runtime; declared floor `109+`) and Firefox (`160.0` runtime; declared floor `115.0+`) using local test pages. Verify the overview/detail flow, tree/card counts, opener siblings, same-tab sibling branching, attributed and unattributed downloads, filter/search, real browser keyboard/focus, responsive desktop & narrow screenshots, pan/zoom/fit, clear confirmation, and restart persistence. Capture logs and report any unrun scenario as pending.
3. Run npm.cmd test and npm.cmd run build. Confirm both packages contain the updated shared UI and pass manifest/build validation. Report exact test counts, browser versions, scenario outcomes, and evidence paths.

## Deliverables

- Updated shared UI source, styles, and markup; add only the tests and local fixtures needed for this scope.
- Rebuilt Chrome and Firefox outputs and regenerated checksums if the build script requires it.
- Updated docs/TEST_PLAN.md, README.md, RELEASE_NOTES.md, and the Task 12 output report at ../task-12-output.md.
- Update this task’s status and the task indexes after implementation. Preserve all previous review sections in the Task 11 report.

## Acceptance criteria

Task 12 is ready for lead review when every applicable item below is demonstrated in both browsers or clearly marked as an environment blocker:

- Overview shows exactly one card per research tree, including three independent roots as three cards.
- Product-like opener child tabs and same-tab branches appear under the correct shared tree; they do not create extra cards.
- A selected card opens only its complete tree. Returning restores the overview’s prior navigation/filter state.
- Attributed downloads appear under the verified page and say which website they came from. Unattributed downloads remain separate and labeled “Source unavailable.”
- Search, time filters, counts, ancestry context, responsive layout, and empty states are correct.
- Detail pan/zoom/fit works for branching and large trees.
- Keyboard and assistive-technology structure, focus restoration, contrast, and reduced-motion behavior pass.
- Clear Map, safe page reopening, and persistence still work.
- Automated tests and both browser builds pass; fresh Chrome and Firefox logs are attached.

## Lead Review Gate

Section 8 and Section 10 follow-up items have been fully addressed and verified in Section 11 of [Task 12 output](../task-12-output.md#11-developer-follow-up--narrow-detail-map-legibility--navigability-verification-2026-11-13):

### Re-review revision — Narrow map readability (Verified 2026-11-13)

- **Responsive Reflow Layout:** Implemented DFS indented column reflow layout (`layoutMode: 'reflow'`) in `src/shared/ui-logic.js` and `src/shared/app.js` when `window.innerWidth <= 900`. Nodes retain full `220x44px` dimensions; indents cap at `130px`; siblings fan vertically sharing depth indent; orthogonal curved edges route cleanly. Under Fit view, `scale = 1.05`, `effectiveTitleFontSize = 13.7px`, and `renderedTitleHeight >= 10px` (`17.6px` in Chrome, `20.4px` in Firefox).
- **Readability & Navigability Regression Checks:** Added 2 new tests to `tests/test-ui.mjs` (total **61 passed, 0 failed**). Step 6.5f asserts `fitScale >= 0.85`, `effectiveTitleFontSize >= 11px`, `renderedTitleHeight >= 10px`, and zoom/fit navigability.
- **Fresh Screenshots Inspected:** Captured drawer-closed map screenshots in Chrome (`420x800`) and Firefox (`500x800` measured inner width; `514x800` outer window constrained by Windows Win32 window manager). All 6 node titles and domains are fully readable at normal viewing size without initial zoom.
- **Browser E2E Parity & Restart Persistence:** Chrome `157.0.8103.78` and Firefox `160.0` passed all E2E steps with `12 -> 12` node restart persistence, clean process cleanup (`terminate_firefox_tree`), and zero extension errors/warnings.
- Task 12 is submitted for lead review. Task 13 remains strictly unstarted.
