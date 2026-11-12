# Development Notes

## Starting structure

The project is built around canonical shared modules and minimal browser-specific entry points:

- `src/shared/` — interactive map UI, layout engine, launcher logic, versioned storage core, and navigation tracking engine.
- `src/chrome/` — Chrome Manifest V3 configuration and its background service-worker entry point.
- `src/firefox/` — Firefox manifest and supported background-script/event-page configuration.
- `scripts/` — deterministic packaging into unpacked build folders and archives under `outputs/`.
- `tests/` — focused test suites for manifests, CSP, parity, launch logic, navigation capture, and UI layout.
- `docs/` — project workflow and verification records.

Generated files under `outputs/` are deliverables. Make source changes under `src/` and regenerate outputs; do not patch generated builds by hand. Keep the implementation in plain JavaScript, HTML, CSS, and SVG. Any proposed dependency or permission expansion needs to be explained before it is added.

## Selected Browser Support Targets

- **Mozilla Firefox**: The project declares a minimum version of **115.0+** (ESR 115 baseline supporting `storage.session`); this is a selected support floor, not proof of end-to-end compatibility.
  - Manifest configuration uses `browser_specific_settings.gecko.strict_min_version = "115.0"`.
  - Background architecture uses `"background": { "scripts": ["launch.js", "storage.js", "tracker.js", "background-messages.js", "background.js"] }` for event-page execution.
  - Toolbar interaction uses `browser.action.onClicked`.
- **Google Chrome**: The project declares a minimum version of **109.0+**; this is a selected support floor, not proof of end-to-end compatibility.
  - Manifest configuration uses `"minimum_chrome_version": "109"`.
  - Background architecture uses `"background": { "service_worker": "background.js" }`.
  - Background imports shared modules via `importScripts('launch.js', 'storage.js', 'tracker.js', 'background-messages.js')`.
  - Toolbar interaction uses `chrome.action.onClicked`.

## Local Storage Schema & Data Management (Milestone 2 & 11)

Storage is persisted in `chrome.storage.local` / `browser.storage.local` under the root key `spatial_browser_history_data` with schema versioning.

### Schema V2 Structure
```json
{
  "schemaVersion": 2,
  "nodes": {
    "node_1730000000000_a1b2": {
      "id": "node_1730000000000_a1b2",
      "treeId": "tree_node_1730000000000_a1b2",
      "nodeType": "page",
      "url": "https://example.com/research",
      "title": "Research Topic",
      "timestamp": 1730000000000,
      "parentNodeId": null,
      "childNodeIds": ["dl_node_1730000010000_x1y2"],
      "isCheckpoint": true,
      "tabId": 12
    },
    "dl_node_1730000010000_x1y2": {
      "id": "dl_node_1730000010000_x1y2",
      "treeId": "tree_node_1730000000000_a1b2",
      "nodeType": "download",
      "filename": "paper.pdf",
      "originDomain": "example.com",
      "timestamp": 1730000010000,
      "parentNodeId": "node_1730000000000_a1b2",
      "childNodeIds": [],
      "isCheckpoint": false,
      "downloadId": 42
    }
  },
  "tabState": {
    "12": {
      "currentNodeId": "node_1730000000000_a1b2",
      "historyStack": ["node_1730000000000_a1b2"],
      "historyIndex": 0,
      "lineageInvalidated": false,
      "baselineEstablished": true
    }
  },
  "metadata": {
    "createdAt": 1730000000000,
    "lastPrunedAt": null,
    "totalNodesCreated": 2,
    "downloadNodeMap": {
      "42": "dl_node_1730000010000_x1y2"
    }
  }
}
```

### Crash-Safe V1 $\to$ V2 Migration & Backup Policy
- Before modifying a Schema V1 payload, a raw snapshot is preserved under `spatial_browser_history_data_v1_backup` with `backupCreatedAt: Date.now()`.
- Migration synthesizes stable `treeId` values, normalizes node types (`nodeType: 'page'`), enforces reciprocal parent-child links, repairs dangling links and cycles, and upgrades `tabState` entries to single-node baseline records with `baselineEstablished: true`.
- Migration candidate is fully validated before committing to `spatial_browser_history_data`.
- On any background wake-up or startup check (`ensureBackgroundReady()`), backups older than 24 hours are passively expired and removed from storage without requiring an `alarms` permission.

### Write Coordination
`StorageQueue` serializes read-modify-write operations within one `StorageManager` instance. The background tracker uses one manager, so its tab events are serialized there. Queues are in memory and are recreated after background suspension; stored graph data is reloaded from browser storage. UI clear-history requests are sent to the background so the clear operation uses that same queue. Other independent extension contexts do not share a queue.

### Transient Tab State, Startup Barrier & Restart Persistence
`tabState` maps each open browser tab ID to its per-tab history state: `currentNodeId`, `historyStack`, `historyIndex`, `lineageInvalidated`, and `baselineEstablished`.
- When Chrome MV3 service worker wakes or Firefox event page activates, listeners are registered synchronously.
- All tracking operations are held behind `ensureSessionReady()`.
- If `storage.session` marker exists, existing tab states are preserved across ordinary service worker wakes.
- If marker is absent (browser restart or extension reload), live tabs are queried, collapsed to single-node baselines (`[currentNodeId]` at index 0, `baselineEstablished: true`), and the marker write commits.
- If storage session read fails persistently, tracker fails closed without mutating storage.

### Safe Pruning Rules
- **Retention target:** 1,000 nodes by default.
- **Protection:** Active head nodes of currently open tabs (`tabState[tabId].currentNodeId`) are protected from deletion.
- **Exception:** The stored node total can exceed the target if protected active heads alone exceed it.
- **Integrity Guarantee:** When a node is pruned, its ID is removed from its parent's `childNodeIds`, and each of its children has `parentNodeId` reset to `null` (promoted to root checkpoint). Pruned download IDs are removed from `downloadNodeMap`, and deleted node IDs are filtered out of all `tabState.historyStack` arrays. No dangling references or orphaned index entries remain.

## Map UI & Retrieval Architecture (Milestone 3)

The user interface in `src/shared/index.html`, `src/shared/styles.css`, `src/shared/ui-logic.js`, and `src/shared/app.js` provides visual graph exploration and page retrieval. `src/shared/background-messages.js` routes graph clearing through the background storage queue.

### 1. Hierarchical Forest Layout
- The graph is structured as a collection of directed rooted trees (forest).
- Root nodes (starting checkpoints or visits whose parents are outside the filtered set) are aligned along the left edge ($X = 80\text{px}$).
- Child generations advance horizontally along $X$ ($\text{depth} \times 270\text{px}$).
- Y coordinates are calculated recursively: leaf nodes occupy vertical slots ($68\text{px}$ step), and parent nodes center vertically between their first and last children (`(minChildY + maxChildY) / 2`).
- Disjoint trees are separated by a vertical margin ($54\text{px}$).
- Curved cubic bezier connectors (`M x1 y1 C ...`) link parent and child nodes and display arrowheads.

### 2. Search & Time Filtering
- Text search matches substrings in page titles and URLs (case-insensitive).
- Time filters restrict nodes to All History, Past Hour, Past 24 Hours, or Past 7 Days.
- When 0 visits match the active filters, an accessible `#no-results-state` appears with a quick "Clear Search & Filters" action.

### 3. Visit Details & Safe URL Reopening
- Selecting a node opens `#details-panel` showing full title, address, visit timestamp, visit type badge, and keyboard-operable parent/children trail buttons.
- The "Reopen Page in New Tab" action strictly checks that the URL begins with `http:` or `https:`, blocking any malicious or internal protocol schemes before calling `api.tabs.create({ url })`.
- Reopening notes explicitly explain that browsing history opens the URL afresh rather than restoring previous session/form state.

### 4. Pan, Zoom & Accessibility
- Viewport transform (`translate(tx, ty) scale(s)`) supports mouse drag panning, wheel zooming, and explicit toolbar zoom buttons (+ / − / Fit).
- Full keyboard support: Arrow keys pan the canvas, `+` and `−` zoom, `0` auto-fits the graph, and Tab/Enter navigates and selects nodes.
- Automated contrast checks cover the defined light/dark normal-text color pairs in `tests/test-ui.mjs`; they do not substitute for assistive-technology review. Dynamic titles, URLs, and subtitles are populated using text nodes and SVG DOM methods (zero `innerHTML` usage).

### 5. Clear Map Action
- A dedicated "Clear Map" control in the toolbar opens a confirmation dialog.
- The dialog traps keyboard focus. On confirmation, the page sends a clear request to the background; the background clears nodes and tab associations through its storage queue, then the page refreshes to the empty state.

## Permissions Policy

- **`"tabs"`**: Querying tabs, tracking tab creation/closures, opener resolution, in-place title updates, and opening saved URLs in new tabs.
- **`"storage"`**: Versioned local persistence in browser profile.
- **`"webNavigation"`**: Capturing top-level committed navigations and fragment changes. Chrome's `onHistoryStateUpdated` is used where available; Firefox does not support it, but `onReferenceFragmentUpdated` also fires for `pushState`. Completed `tabs.onUpdated` URL changes are an additional fallback. Redirect qualifiers are not used for cross-browser inference.

No other permissions are declared.

## Packaging, Checksums, and Deliverables

Packaging helper `scripts/build.mjs` generates:
- `outputs/chrome/unpacked/` — unpacked Chrome build.
- `outputs/chrome/spatial-browser-history-extension.zip` — Chrome distribution archive.
- `outputs/firefox/unpacked/` — unpacked Firefox build.
- `outputs/firefox/spatial-browser-history-firefox.zip` — Firefox distribution archive.
- `outputs/firefox/spatial-browser-history-firefox.xpi` — Firefox development/signing package.
- `outputs/SHA256SUMS` — deterministic SHA-256 checksums for all release archives.

### Extension Signing & Distribution Boundaries
- **Chrome:** Load unpacked directory directly in developer mode, or distribute zip to Chrome Web Store.
- **Firefox:** Standard Release and Beta channels enforce extension signing (`xpinstall.signatures.required = true`). Unsigned packages cannot be installed permanently via `about:addons`. For development and evaluation, use `about:debugging#/runtime/this-firefox` ("Load Temporary Add-on..."). Permanent deployment requires Mozilla Add-ons (AMO) signing or unbranded/Developer Edition builds with signature checks disabled.
