# Task 10 — Research Tree Explorer, Branching, and Download Provenance

**Status:** Design approved; implementation assigned as Task 11.

> **Developer next action:** Follow [`task-11.md`](task-11.md) for the approved first implementation phase. Keep Task 11 within its scope and report results in `../task-11-output.md`.

## Goal

Replace the default all-visits canvas with an overview of research trees that the user can open one at a time. Within a tree, show meaningful sibling branches for pages opened from the same research parent, preserve the source relationship when websites open product pages in new tabs, and show completed downloads as items attributed to the page/site that initiated them. Make the UI more polished and reduce the large unused canvas area shown in the user's screenshot.

## Current behavior and terminology

The current SVG layout can render a tree, but same-tab navigation is stored as a sequential parent-child chain. The screenshot shows a long row because the recorded lineage is linear, with a large amount of unused canvas space. Changing node spacing alone will not create branches.

For this task, a **research tree** is a durable connected graph rooted at a checkpoint or first captured page. Related browser tabs are branches inside that tree. A browser tab ID is transient and must not be used as a durable tree identity. The overview should show one card per independent research tree, with its open/current tabs summarized on the card.

## Required first deliverable: design proposal

Before changing persistent graph structure or manifest permissions, send the lead a concise proposal containing:

1. Overview and tree-detail wireframes, including the back-to-overview path and where search/filters live.
2. A branch model for same-tab Back/Forward and new navigations. Explain how the current active page changes when the user returns to an earlier captured page, and how the next navigation becomes a sibling branch without adding a duplicate parent or cycle.
3. How `tabs.onCreated`, opener metadata, and navigation-target events keep website-created tabs inside the opener's existing research tree.
4. A download-capture plan: browser APIs/events in Chrome and Firefox, the minimum permission required, how the initiating website is resolved, and exactly which metadata is stored. Do not capture file contents or local filesystem paths.
5. Whether the schema can remain version 1. If a migration is required, specify how existing history is preserved and how rollback/invalid data are handled.
6. A test matrix covering the acceptance scenarios below.

Wait for lead review before changing the storage schema or adding permissions. UI work that uses the existing graph contract can proceed after the wireframe/model proposal is approved.

## Functional requirements

### A. Research-tree overview

- Make the first screen a compact, responsive grid/list of research-tree cards, not a canvas containing every visit.
- Each card should summarize the root page (title and domain), most recent page/activity, visit count, branch count, number of currently open related tabs, and a small readable branch preview where practical.
- Clicking a card opens that tree's detail view. A visible, keyboard-accessible breadcrumb/back control returns to the overview and preserves the user's overview scroll and filters.
- A new unrelated root/checkpoint gets its own card. A child tab with a known opener joins the opener's tree; do not create a separate card or “tab slot” for every physical browser tab.
- Keep global search and time filters useful from the overview. In detail view, filtering must not silently break parent-child context; show the matching node's ancestors or clearly label when context is filtered.

### B. Branch-aware history

- Pages opened from the same source page must be siblings under that source, including multiple tabs opened from one page.
- Required same-tab scenario: `Wikipedia → Source A → Back to Wikipedia → Source B` produces one Wikipedia parent with Source A and Source B as sibling children. Back/Forward traversal should reactivate the correct captured node; it must not create duplicate copies of Wikipedia or a false linear chain.
- Required nested scenario: `Wikipedia → Source A → Source C` remains a nested path, with Source C under Source A.
- Required Amazon-style scenario: opening several product pages in new tabs from one results/listing page keeps all product nodes as branches under that listing page, inside the same research tree. The site/domain must not be hard-coded; the same rule applies to any site that opens links in new tabs or windows.
- A new navigation from a different current parent branches beneath that parent. Unknown openers continue to become safe independent root/checkpoints; never guess a parent from a similar title or URL.
- Reload, duplicate browser events, title changes, fragment changes, and SPA routes must retain their existing deduplication and lineage behavior.

### C. Download provenance

- Add a distinct download item/node for a **completed** download initiated by a trackable web page. Show a clear label such as `Downloaded: filename.pdf` and the originating site, for example `Downloaded from wikipedia.org`.
- Attach the download item beneath the page node that initiated it, so it stays inside that page's research tree and does not create a new tree/card.
- Attribute the source to the initiating page/referrer, not merely the CDN or final file-host URL. Use the active tab's captured page and browser-provided download metadata where available. If the source cannot be resolved reliably, label it “Source unavailable”; do not invent one.
- Store only the minimum metadata needed for the UI: filename (basename only), source page/domain, completion time, and a stable download reference if required for deduplication. Do not read/store downloaded file contents, expose local file paths, or transmit browsing/download data remotely.
- Failed/cancelled transfers must not appear as completed downloads. Avoid duplicate download nodes when multiple browser events report the same item.
- In the proposal, document the exact Chrome/Firefox API support and user-visible permission impact (likely requiring the WebExtensions `downloads` permission). Add only the permission needed and update both manifests, permission tests, and privacy documentation after approval.

### D. Visual and interaction design

- Detail view should fit the selected tree to the viewport and distribute siblings vertically under their parent, with clear connectors and enough space for readable page cards. A one-child path may naturally appear linear; real branch relationships must visibly fan out.
- Reduce the current tiny-node/large-empty-canvas feel. Use a deliberate hierarchy, compact overview cards, clear branch accents, distinct styling for page/download/root/current nodes, and subtle hover/selection transitions.
- Keep the existing dark style direction but refine it; preserve the light theme, readable contrast, visible keyboard focus, keyboard navigation, and reduced-motion preferences.
- Preserve pan, zoom, fit, search, time filtering, details, safe page reopening, clear-history confirmation, and local-only storage. Do not add a large framework or graph dependency for appearance alone.

## Acceptance scenarios

1. Three independent roots appear as three overview cards; opening one shows only its tree and returning restores the overview.
2. Two links opened in new tabs from one Wikipedia/source page are sibling nodes in one tree.
3. Back to a previously captured same-tab page followed by a new navigation creates a sibling branch under the revisited parent without a duplicate parent node.
4. A normal nested same-tab path remains nested.
5. Several Amazon-style product tabs opened from one listing page stay within that listing page's tree and appear as siblings; no extra tree card is created per product tab.
6. A completed download appears under its source page with the filename and correct originating domain. A failed/cancelled or unattributable download is not falsely attributed.
7. Unknown opener/root fallback, pruning, clear-history, background suspension, browser restart, and existing schema-V1 history remain safe.
8. Chrome and Firefox have equivalent user-facing behavior, with no extension errors during the tested flows.

## Verification and report

- Add focused unit tests for active-node Back/Forward handling, sibling/ancestor relationships, tree grouping, download attribution/deduplication, and filtering/layout.
- Extend Chrome and Firefox runtime harnesses for overview-to-detail navigation, Amazon-style sibling tabs, Back-to-parent branching, and a completed download from a local test page. Use local test files/pages only; do not download real user files or browse real shopping accounts.
- Run `npm test`, rebuild both packages, and run the updated browser checks in isolated temporary profiles.
- Update `README.md`, `docs/DEVELOPMENT.md`, `docs/TEST_PLAN.md`, release notes, and permission/privacy documentation to match actual behavior and evidence.
- Report changed files, any schema/permission changes, migration behavior, test results, and before/after screenshots. Keep unrelated optional ideas out of this task unless the lead approves them.
