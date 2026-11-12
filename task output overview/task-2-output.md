# Task 2 Output — Navigation Tracking and Local Storage Core

**Status:** Completed & Verified  
**Milestone:** 2 (Tracking & Storage Core)  

---

## 1. Objectives & Scope
- Implement automatic top-level navigation and SPA route capture for HTTP and HTTPS pages.
- Establish sequential parent-child relationships for same-tab browsing and cross-tab parentage via opener tab metadata (`tab.openerTabId`).
- Build versioned local graph storage (Schema V1) in `chrome.storage.local` / `browser.storage.local`.
- Guarantee serial execution of read-modify-write operations via `StorageQueue` to prevent race conditions during rapid concurrent tab events.
- Safely prune old nodes when the node target (default 1,000) is exceeded:
  - Protect active head nodes of currently open tabs from deletion.
  - Promote children of pruned nodes to root checkpoints (`parentNodeId = null`, `isCheckpoint = true`) to prevent dangling links.
- Capture initial startup/restart checkpoints for pre-existing open tabs without inventing earlier history.
- Clean up transient tab mappings on `tabs.onRemoved` without deleting historical visit nodes.

---

## 2. Key Deliverables & Changed Files
- `src/shared/storage.js`:
  - `StorageManager` class with Schema V1 persistence.
  - `StorageQueue` promise-chain write serializer.
  - Safe graph pruning algorithm (`_pruneGraph`).
  - Active tab head mapping (`tabState`).
- `src/shared/tracker.js`:
  - `NavigationTracker` listening to `webNavigation.onCommitted`, `onHistoryStateUpdated`, `onReferenceFragmentUpdated`, `onCreatedNavigationTarget`, `tabs.onCreated`, `tabs.onUpdated`, `tabs.onRemoved`, and `tabs.onReplaced`.
  - Reload deduplication and dynamic in-place title updates.
  - Anchor fragment handling vs. SPA hash routes.
  - Opener tab resolution and initial startup checkpointing (`captureInitialCheckpoints`).
- `tests/test-tracker.mjs`: Complete unit test suite for tracking, serialization, opener relationships, and pruning.

---

## 3. Storage Schema V1
```json
{
  "schemaVersion": 1,
  "nodes": {
    "node_1730000000000_a1b2": {
      "id": "node_1730000000000_a1b2",
      "url": "https://example.com/research",
      "title": "Research Topic",
      "timestamp": 1730000000000,
      "parentNodeId": null,
      "childNodeIds": ["node_1730000010000_c3d4"],
      "isCheckpoint": true,
      "tabId": 12
    }
  },
  "tabState": {
    "12": "node_1730000000000_a1b2"
  },
  "metadata": {
    "createdAt": 1730000000000,
    "lastPrunedAt": null,
    "totalNodesCreated": 1
  }
}
```

---

## 4. Verification & Results
- **Automated Verification:** `node tests/test-tracker.mjs`
  - Same-tab sequential parent-child relationships verified.
  - Opener tab link connection verified.
  - Reload deduplication and rapid duplicate event suppression verified.
  - Title updates in place on `tabs.onUpdated` without duplicate nodes verified.
  - Firefox fragment events & Chrome History API route updates verified.
  - Startup checkpoint reconciliation verified.
  - Rapid concurrent `recordVisit` calls strictly serialized without data loss.
  - Pruning met node target while protecting active heads and repairing links.
- **Result:** 15 passed, 0 failed (later expanded to 16 with `onCreatedNavigationTarget` test).
