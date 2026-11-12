/**
 * Spatial Browser History - Navigation Tracker & Storage Test Suite (V2)
 * 
 * Verifies:
 * - Schema V1 -> V2 migration, tree hierarchy, cycle breaking, and dangling link repair
 * - Migration error safety, raw backup preservation, and passive 24-hour expiration
 * - Same-tab Back/Forward sibling branching vs nested navigation
 * - Traversal direction resolution, symmetrical lineage invalidation, and unrecorded forward_back
 * - Opener tab linkage and unknown opener root checkpoint fallback
 * - Post-initialization unanchored tab safe root isolation
 * - Reused tab ID & URL zero-trust single-node baseline (Scenario 8A)
 * - Browser restart within 60-second interval (Scenario 8B)
 * - Storage session read failure fail-closed behavior (Scenario 8C)
 * - Stale stack marker-write failure & idempotent worker recreation (Scenario 8D)
 * - Download provenance attribution, unattributed downloads, deduplication, and privacy
 * - Safe graph pruning protecting active heads, repairing reciprocal links, and updating stacks
 * - Clear Map complete wipe (graph, tabState, download index, and V1 backup)
 */

import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Load shared modules
await import(pathToFileURL(path.join(ROOT_DIR, 'src', 'shared', 'storage.js')).href);
await import(pathToFileURL(path.join(ROOT_DIR, 'src', 'shared', 'tracker.js')).href);

const { StorageManager, createMemoryStorage, STORAGE_KEY, BACKUP_KEY, BACKUP_EXPIRY_MS } = globalThis.SpatialStorage;
const { NavigationTracker, isTrackableUrl, normalizeUrl, getBaseUrl, getBasename, extractDomain } = globalThis.SpatialTracker;

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.stack || err.message}`);
    failed++;
  }
}

/**
 * Helper to get the active head node ID for a tab in Schema V1 or V2
 */
function getTabHeadId(state, tabId) {
  const entry = state.tabState[String(tabId)];
  if (!entry) return undefined;
  return typeof entry === 'string' ? entry : entry.currentNodeId;
}

/**
 * Creates a mock WebExtensions environment
 */
function createMockBrowserEnv(initialTabs = [], options = {}) {
  const tabs = new Map();
  initialTabs.forEach(t => tabs.set(t.id, Object.assign({ id: t.id, url: '', title: '' }, t)));

  const listeners = {
    webNavCommitted: [],
    webNavHistoryUpdated: [],
    webNavFragmentUpdated: [],
    webNavCreatedTarget: [],
    tabsCreated: [],
    tabsUpdated: [],
    tabsRemoved: [],
    tabsReplaced: [],
    downloadsCreated: [],
    downloadsChanged: []
  };

  const downloadsStore = new Map();

  return {
    tabsMap: tabs,
    downloadsStore,
    webNavigation: {
      onCommitted: {
        addListener(fn) { listeners.webNavCommitted.push(fn); },
        removeListener(fn) {
          const idx = listeners.webNavCommitted.indexOf(fn);
          if (idx !== -1) listeners.webNavCommitted.splice(idx, 1);
        }
      },
      onReferenceFragmentUpdated: {
        addListener(fn) { listeners.webNavFragmentUpdated.push(fn); },
        removeListener(fn) {
          const idx = listeners.webNavFragmentUpdated.indexOf(fn);
          if (idx !== -1) listeners.webNavFragmentUpdated.splice(idx, 1);
        }
      },
      onCreatedNavigationTarget: {
        addListener(fn) { listeners.webNavCreatedTarget.push(fn); },
        removeListener(fn) {
          const idx = listeners.webNavCreatedTarget.indexOf(fn);
          if (idx !== -1) listeners.webNavCreatedTarget.splice(idx, 1);
        }
      },
      ...(options.historyState === false ? {} : {
        onHistoryStateUpdated: {
          addListener(fn) { listeners.webNavHistoryUpdated.push(fn); },
          removeListener(fn) {
            const idx = listeners.webNavHistoryUpdated.indexOf(fn);
            if (idx !== -1) listeners.webNavHistoryUpdated.splice(idx, 1);
          }
        }
      })
    },
    tabs: {
      onCreated: {
        addListener(fn) { listeners.tabsCreated.push(fn); },
        removeListener(fn) {
          const idx = listeners.tabsCreated.indexOf(fn);
          if (idx !== -1) listeners.tabsCreated.splice(idx, 1);
        }
      },
      onUpdated: {
        addListener(fn) { listeners.tabsUpdated.push(fn); },
        removeListener(fn) {
          const idx = listeners.tabsUpdated.indexOf(fn);
          if (idx !== -1) listeners.tabsUpdated.splice(idx, 1);
        }
      },
      onRemoved: {
        addListener(fn) { listeners.tabsRemoved.push(fn); },
        removeListener(fn) {
          const idx = listeners.tabsRemoved.indexOf(fn);
          if (idx !== -1) listeners.tabsRemoved.splice(idx, 1);
        }
      },
      onReplaced: {
        addListener(fn) { listeners.tabsReplaced.push(fn); },
        removeListener(fn) {
          const idx = listeners.tabsReplaced.indexOf(fn);
          if (idx !== -1) listeners.tabsReplaced.splice(idx, 1);
        }
      },
      async get(tabId) {
        return tabs.get(tabId) || null;
      },
      async query() {
        return Array.from(tabs.values());
      }
    },
    downloads: {
      onCreated: {
        addListener(fn) { listeners.downloadsCreated.push(fn); },
        removeListener(fn) {
          const idx = listeners.downloadsCreated.indexOf(fn);
          if (idx !== -1) listeners.downloadsCreated.splice(idx, 1);
        }
      },
      onChanged: {
        addListener(fn) { listeners.downloadsChanged.push(fn); },
        removeListener(fn) {
          const idx = listeners.downloadsChanged.indexOf(fn);
          if (idx !== -1) listeners.downloadsChanged.splice(idx, 1);
        }
      },
      async search(query) {
        if (query && query.id) {
          const item = downloadsStore.get(query.id);
          return item ? [item] : [];
        }
        return Array.from(downloadsStore.values());
      }
    },
    // Trigger helpers for test assertions
    async emitCommitted(details) {
      for (const fn of listeners.webNavCommitted) {
        await fn(details);
      }
    },
    async emitHistoryUpdated(details) {
      for (const fn of listeners.webNavHistoryUpdated) {
        await fn(details);
      }
    },
    async emitReferenceFragmentUpdated(details) {
      for (const fn of listeners.webNavFragmentUpdated) {
        await fn(details);
      }
    },
    async emitCreatedNavigationTarget(details) {
      for (const fn of listeners.webNavCreatedTarget) {
        await fn(details);
      }
    },
    async emitTabCreated(tab) {
      tabs.set(tab.id, tab);
      for (const fn of listeners.tabsCreated) {
        await fn(tab);
      }
    },
    async emitTabUpdated(tabId, changeInfo, tab) {
      const mergedTab = Object.assign(tabs.get(tabId) || { id: tabId }, tab, changeInfo);
      tabs.set(tabId, mergedTab);
      for (const fn of listeners.tabsUpdated) {
        await fn(tabId, changeInfo, mergedTab);
      }
    },
    async emitTabRemoved(tabId) {
      tabs.delete(tabId);
      for (const fn of listeners.tabsRemoved) {
        await fn(tabId);
      }
    },
    async emitTabReplaced(addedTabId, removedTabId) {
      const old = tabs.get(removedTabId);
      if (old) {
        tabs.delete(removedTabId);
        tabs.set(addedTabId, Object.assign({}, old, { id: addedTabId }));
      }
      for (const fn of listeners.tabsReplaced) {
        await fn(addedTabId, removedTabId);
      }
    },
    async emitDownloadCreated(item) {
      downloadsStore.set(item.id, item);
      for (const fn of listeners.downloadsCreated) {
        await fn(item);
      }
    },
    async emitDownloadChanged(delta) {
      const existing = downloadsStore.get(delta.id) || { id: delta.id };
      if (delta.state) existing.state = delta.state.current;
      if (delta.filename) existing.filename = delta.filename.current;
      if (delta.url) existing.url = delta.url.current;
      if (delta.endTime) existing.endTime = delta.endTime.current;
      downloadsStore.set(delta.id, existing);

      for (const fn of listeners.downloadsChanged) {
        await fn(delta);
      }
    }
  };
}

console.log('=== Running Task 2 Tracker & Storage Tests (Baseline Suite) ===\n');

// 1. Same-tab navigation parent-child linkage
await test('Same-tab navigation creates sequential parent-child relationships', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  // Tab 1 navigates to Page A
  await mockEnv.emitCommitted({
    tabId: 1,
    frameId: 0,
    url: 'https://example.com/topic-a',
    transitionType: 'typed',
    timeStamp: 1000
  });

  let state = await storage.getState();
  const nodeAId = getTabHeadId(state, 1);
  assert(nodeAId, 'Tab 1 should have an active node');
  const nodeA = state.nodes[nodeAId];
  assert.strictEqual(nodeA.url, 'https://example.com/topic-a');
  assert.strictEqual(nodeA.parentNodeId, null, 'First visit in tab should be a root checkpoint');
  assert.strictEqual(nodeA.childNodeIds.length, 0);

  // Tab 1 navigates to Page B
  await mockEnv.emitCommitted({
    tabId: 1,
    frameId: 0,
    url: 'https://example.com/topic-b',
    transitionType: 'link',
    timeStamp: 2000
  });

  state = await storage.getState();
  const nodeBId = getTabHeadId(state, 1);
  const nodeB = state.nodes[nodeBId];
  assert.strictEqual(nodeB.url, 'https://example.com/topic-b');
  assert.strictEqual(nodeB.parentNodeId, nodeAId, 'Page B parent must be Page A');
  assert(state.nodes[nodeAId].childNodeIds.includes(nodeBId), 'Page A must list Page B in childNodeIds');

  // Tab 1 navigates to Page C
  await mockEnv.emitCommitted({
    tabId: 1,
    frameId: 0,
    url: 'https://example.com/topic-c',
    transitionType: 'link',
    timeStamp: 3000
  });

  state = await storage.getState();
  const nodeCId = getTabHeadId(state, 1);
  const nodeC = state.nodes[nodeCId];
  assert.strictEqual(nodeC.url, 'https://example.com/topic-c');
  assert.strictEqual(nodeC.parentNodeId, nodeBId, 'Page C parent must be Page B');
  assert(state.nodes[nodeBId].childNodeIds.includes(nodeCId), 'Page B must list Page C in childNodeIds');
});

// 2. Opener-linked child tab parentage
await test('Opening link in new tab connects child to opener tab latest page', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  // Tab 1 (opener) visits parent page
  await mockEnv.emitCommitted({
    tabId: 1,
    frameId: 0,
    url: 'https://parent-source.org/index',
    transitionType: 'typed',
    timeStamp: 1000
  });

  const state1 = await storage.getState();
  const parentNodeId = getTabHeadId(state1, 1);

  // User middle-clicks link: tab 2 created with openerTabId = 1
  await mockEnv.emitTabCreated({
    id: 2,
    openerTabId: 1,
    url: 'about:blank'
  });

  // Tab 2 loads child page
  await mockEnv.emitCommitted({
    tabId: 2,
    frameId: 0,
    url: 'https://child-destination.org/article',
    transitionType: 'link',
    timeStamp: 1500
  });

  const state2 = await storage.getState();
  const childNodeId = getTabHeadId(state2, 2);
  const childNode = state2.nodes[childNodeId];

  assert.strictEqual(childNode.parentNodeId, parentNodeId, 'Child page parent must be opener latest page');
  assert.strictEqual(childNode.isCheckpoint, false, 'Opener-linked child should not be marked checkpoint');
  assert(state2.nodes[parentNodeId].childNodeIds.includes(childNodeId), 'Parent node must include child node in childNodeIds');
});

// 3. Fallback when opener is unknown or closed
await test('New tab with unknown or closed opener safely creates a root checkpoint', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  // Tab 30 opened with invalid/closed openerTabId 999
  await mockEnv.emitTabCreated({
    id: 30,
    openerTabId: 999,
    url: ''
  });

  await mockEnv.emitCommitted({
    tabId: 30,
    frameId: 0,
    url: 'https://independent-search.com/query',
    transitionType: 'typed',
    timeStamp: 1000
  });

  const state = await storage.getState();
  const node = state.nodes[getTabHeadId(state, 30)];
  assert.strictEqual(node.parentNodeId, null, 'Must fallback to null parentNodeId when opener is unknown');
  assert.strictEqual(node.isCheckpoint, true, 'Unanchored tab must be registered as a checkpoint');
});

// 4. webNavigation.onCreatedNavigationTarget opener resolution
await test('webNavigation.onCreatedNavigationTarget associates child tab with opener and resolves parent node', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  // Tab 10 navigates to Source Page
  await mockEnv.emitCommitted({
    tabId: 10,
    frameId: 0,
    url: 'https://source.example.org/docs',
    transitionType: 'typed',
    timeStamp: 1000
  });

  const state1 = await storage.getState();
  const sourceNodeId = getTabHeadId(state1, 10);
  assert(sourceNodeId, 'Source node must exist');

  await mockEnv.emitCreatedNavigationTarget({
    sourceTabId: 10,
    tabId: 25,
    url: 'https://target.example.org/child',
    timeStamp: 2000
  });

  await mockEnv.emitCommitted({
    tabId: 25,
    frameId: 0,
    url: 'https://target.example.org/child',
    transitionType: 'link',
    timeStamp: 2100
  });

  const state2 = await storage.getState();
  const childNodeId = getTabHeadId(state2, 25);
  const childNode = state2.nodes[childNodeId];

  assert(childNode, 'Child node must exist');
  assert.strictEqual(childNode.parentNodeId, sourceNodeId, 'Child visit must branch from sourceTabId opener node');
  assert(state2.nodes[sourceNodeId].childNodeIds.includes(childNodeId), 'Source node must list child in childNodeIds');
});

// 5. Reload and rapid identical event suppression
await test('Reloads and rapid identical events do not create duplicate nodes', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  await mockEnv.emitCommitted({
    tabId: 5,
    frameId: 0,
    url: 'https://news.org/today',
    transitionType: 'typed',
    timeStamp: 1000
  });

  let state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 1);

  // User hits Reload (F5)
  await mockEnv.emitCommitted({
    tabId: 5,
    frameId: 0,
    url: 'https://news.org/today',
    transitionType: 'reload',
    timeStamp: 2000
  });

  state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 1, 'Reload must not add a new node');

  // Simulated rapid identical event within debounce window
  await mockEnv.emitHistoryUpdated({
    tabId: 5,
    frameId: 0,
    url: 'https://news.org/today',
    transitionType: 'link',
    timeStamp: 2200
  });

  state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 1, 'Rapid identical URL change must be suppressed');
});

// 6. Title updates in place
await test('Page title updates in place on tabs.onUpdated without creating new nodes', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  await mockEnv.emitCommitted({
    tabId: 7,
    frameId: 0,
    url: 'https://example.org/article',
    transitionType: 'link',
    timeStamp: 1000
  });

  let state = await storage.getState();
  const nodeId = getTabHeadId(state, 7);
  assert.strictEqual(state.nodes[nodeId].title, 'https://example.org/article');

  // DOM finishes loading and sets document.title
  await mockEnv.emitTabUpdated(7, { title: 'Human Readable Title' });

  state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 1, 'Must not create extra node for title update');
  assert.strictEqual(state.nodes[nodeId].title, 'Human Readable Title', 'Title should be updated in place');
});

await test('A title for a pending new URL does not overwrite the previous visit title', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  await mockEnv.emitCommitted({ tabId: 12, frameId: 0, url: 'https://example.org/prev', timeStamp: 1000 });
  await mockEnv.emitTabUpdated(12, { title: 'Prev title' }, { url: 'https://example.org/prev', status: 'complete' });

  const state1 = await storage.getState();
  const prevNode = state1.nodes[getTabHeadId(state1, 12)];
  assert.strictEqual(prevNode.title, 'Prev title');

  // Title update arrives for a pending URL before its commit event
  await mockEnv.emitTabUpdated(12, { title: 'Next title' }, { url: 'https://example.org/next', status: 'loading' });
  const state2 = await storage.getState();
  assert.strictEqual(state2.nodes[prevNode.id].title, 'Prev title');

  // Subsequent commit completes navigation
  await mockEnv.emitCommitted({ tabId: 12, frameId: 0, url: 'https://example.org/next', timeStamp: 2000 });
  await mockEnv.emitTabUpdated(12, { title: 'New page' }, { url: 'https://example.org/next', status: 'complete' });
  const state3 = await storage.getState();
  const newNode = state3.nodes[getTabHeadId(state3, 12)];
  assert.strictEqual(newNode.title, 'New page');
});

// 7. Fragment vs SPA routing
await test('Firefox fragment event handles anchors and pushState; tabs URL updates remain a fallback', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv([], { historyState: false });
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  await mockEnv.emitCommitted({
    tabId: 8,
    frameId: 0,
    url: 'https://en.wikipedia.org/wiki/Browser',
    timeStamp: 1000
  });

  const state1 = await storage.getState();
  const wikiNodeId = getTabHeadId(state1, 8);

  // In-page anchor click
  await mockEnv.emitReferenceFragmentUpdated({
    tabId: 8,
    frameId: 0,
    url: 'https://en.wikipedia.org/wiki/Browser#History',
    timeStamp: 1500
  });

  const state2 = await storage.getState();
  assert.strictEqual(Object.keys(state2.nodes).length, 1, 'Anchor scroll must not add new visit node');
  assert.strictEqual(state2.nodes[wikiNodeId].url, 'https://en.wikipedia.org/wiki/Browser#History');

  // SPA hash-based route
  await mockEnv.emitReferenceFragmentUpdated({
    tabId: 8,
    frameId: 0,
    url: 'https://spa.example.org/#/dashboard',
    timeStamp: 2000
  });

  const state3 = await storage.getState();
  assert.strictEqual(Object.keys(state3.nodes).length, 2, 'SPA hash route #/ must be recorded as child visit');
  const spaNode = state3.nodes[getTabHeadId(state3, 8)];
  assert.strictEqual(spaNode.parentNodeId, wikiNodeId);

  // Fallback tab URL update
  await mockEnv.emitTabUpdated(8, { url: 'https://spa.example.org/#/settings' }, { status: 'complete' });
  const state4 = await storage.getState();
  assert.strictEqual(Object.keys(state4.nodes).length, 3);
  const fallbackNode = state4.nodes[getTabHeadId(state4, 8)];
  assert.strictEqual(fallbackNode.parentNodeId, spaNode.id);
});

await test('Chrome History API route updates create a child visit', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  await mockEnv.emitCommitted({
    tabId: 18,
    frameId: 0,
    url: 'https://spa.example/app',
    timeStamp: 1000
  });

  await mockEnv.emitHistoryUpdated({
    tabId: 18,
    frameId: 0,
    url: 'https://spa.example/next',
    timeStamp: 2000
  });

  const state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 2);
  const child = state.nodes[getTabHeadId(state, 18)];
  assert.strictEqual(child.url, 'https://spa.example/next');
});

await test('Redirect destination is recorded as a child and does not overwrite the prior visit', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  await mockEnv.emitCommitted({
    tabId: 21,
    frameId: 0,
    url: 'https://site.org/start',
    timeStamp: 1000
  });

  await mockEnv.emitCommitted({
    tabId: 21,
    frameId: 0,
    url: 'https://site.org/final',
    transitionQualifiers: ['server_redirect'],
    timeStamp: 2000
  });

  const state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 2);
  const startNode = Object.values(state.nodes).find(n => n.url === 'https://site.org/start');
  const finalNode = state.nodes[getTabHeadId(state, 21)];
  assert.strictEqual(finalNode.url, 'https://site.org/final');
  assert.strictEqual(finalNode.parentNodeId, startNode.id);
});

await test('Concurrent same-tab navigations preserve their sequential parent chain', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  const events = [
    mockEnv.emitCommitted({ tabId: 1, frameId: 0, url: 'https://chain.org/a', timeStamp: 100 }),
    mockEnv.emitCommitted({ tabId: 1, frameId: 0, url: 'https://chain.org/b', timeStamp: 200 }),
    mockEnv.emitCommitted({ tabId: 1, frameId: 0, url: 'https://chain.org/c', timeStamp: 300 }),
    mockEnv.emitCommitted({ tabId: 1, frameId: 0, url: 'https://chain.org/d', timeStamp: 400 })
  ];

  await Promise.all(events);

  const state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 4);
  const nodeA = Object.values(state.nodes).find(n => n.url === 'https://chain.org/a');
  const nodeB = Object.values(state.nodes).find(n => n.url === 'https://chain.org/b');
  const nodeC = Object.values(state.nodes).find(n => n.url === 'https://chain.org/c');
  const nodeD = Object.values(state.nodes).find(n => n.url === 'https://chain.org/d');

  assert.strictEqual(nodeB.parentNodeId, nodeA.id);
  assert.strictEqual(nodeC.parentNodeId, nodeB.id);
  assert.strictEqual(nodeD.parentNodeId, nodeC.id);
  assert.strictEqual(getTabHeadId(state, 1), nodeD.id);
});

await test('Existing open tabs are registered as checkpoints without earlier path', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv([
    { id: 101, url: 'https://work.com/doc', title: 'Work Doc' },
    { id: 102, url: 'https://study.edu/lecture', title: 'Lecture Notes' },
    { id: 103, url: 'about:blank', title: 'New Tab' }
  ]);

  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  const state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 2, 'Should only track valid HTTP/HTTPS tabs');

  const node101 = state.nodes[getTabHeadId(state, 101)];
  const node102 = state.nodes[getTabHeadId(state, 102)];

  assert(node101 && node101.isCheckpoint && node101.parentNodeId === null);
  assert(node102 && node102.isCheckpoint && node102.parentNodeId === null);
  assert.strictEqual(node101.title, 'Work Doc');
});

await test('Startup reconciles stale tab IDs and checkpoints a changed restored URL', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const oldVisit = await storage.recordVisit({ url: 'https://old.example/page', tabId: 101, timestamp: 100 });
  await storage.recordVisit({ url: 'https://closed.example/page', tabId: 202, timestamp: 200 });
  const mockEnv = createMockBrowserEnv([
    { id: 101, url: 'https://restored.example/page', title: 'Restored' }
  ]);
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  const state = await storage.getState();
  const current = state.nodes[getTabHeadId(state, 101)];
  assert.notStrictEqual(current.id, oldVisit.id);
  assert.strictEqual(current.parentNodeId, null);
  assert.strictEqual(current.isCheckpoint, true);
  assert.strictEqual(current.url, 'https://restored.example/page');
  assert.strictEqual(state.tabState['202'], undefined, 'Closed/stale tab association should be removed');
  assert(state.nodes[oldVisit.id], 'Old history node should remain stored');
});

await test('A new storage manager instance rehydrates the saved tab association', async () => {
  const sharedBackend = createMemoryStorage({}, { sessionInitialized: true });

  const storageSession1 = new StorageManager({ storageBackend: sharedBackend });
  const mockEnv1 = createMockBrowserEnv();
  const tracker1 = new NavigationTracker(storageSession1, mockEnv1);
  tracker1.init();
  await tracker1.ensureSessionReady();

  await mockEnv1.emitCommitted({
    tabId: 50,
    frameId: 0,
    url: 'https://research.edu/paper-1',
    transitionType: 'typed',
    timeStamp: 1000
  });

  const state1 = await storageSession1.getState();
  const firstNodeId = getTabHeadId(state1, 50);
  assert(firstNodeId);

  const storageSession2 = new StorageManager({ storageBackend: sharedBackend });
  const mockEnv2 = createMockBrowserEnv();
  const tracker2 = new NavigationTracker(storageSession2, mockEnv2);
  tracker2.init();
  await tracker2.ensureSessionReady();

  await mockEnv2.emitCommitted({
    tabId: 50,
    frameId: 0,
    url: 'https://research.edu/paper-2',
    transitionType: 'link',
    timeStamp: 5000
  });

  const state2 = await storageSession2.getState();
  const secondNodeId = getTabHeadId(state2, 50);
  assert.notStrictEqual(secondNodeId, firstNodeId);
  assert.strictEqual(state2.nodes[secondNodeId].parentNodeId, firstNodeId, 'Must preserve parentage across background restart');
});

await test('Rapid concurrent recordVisit calls are strictly serialized without data loss', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });

  const promises = [];
  for (let i = 0; i < 25; i++) {
    promises.push(storage.recordVisit({
      url: `https://example.com/page-${i}`,
      title: `Page ${i}`,
      tabId: i % 5,
      timestamp: 1000 + i
    }));
  }

  await Promise.all(promises);

  const state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 25, 'All 25 concurrent writes must be safely preserved');
  assert.strictEqual(state.metadata.totalNodesCreated, 25);
});

await test('Pruning meets the node target in this case while protecting active heads and repairing links', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore, maxNodes: 4 });

  const n1 = await storage.recordVisit({ url: 'https://site.com/1', tabId: 1, timestamp: 100 });
  const n2 = await storage.recordVisit({ url: 'https://site.com/2', parentNodeId: n1.id, tabId: 1, timestamp: 200 });
  const n3 = await storage.recordVisit({ url: 'https://site.com/3', parentNodeId: n2.id, tabId: 1, timestamp: 300 });
  const n4 = await storage.recordVisit({ url: 'https://site.com/4', tabId: 2, timestamp: 400 });

  let state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 4);

  await storage.removeTabState(1);

  const n5 = await storage.recordVisit({ url: 'https://site.com/5', parentNodeId: n4.id, tabId: 2, timestamp: 500 });

  state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 4, 'Node count must be constrained to maxNodes (4)');
  assert(!state.nodes[n1.id], 'Node 1 (oldest) must have been pruned');
  assert(state.nodes[n2.id], 'Node 2 must remain in graph');
  assert.strictEqual(state.nodes[n2.id].parentNodeId, null, 'Child of pruned node must have parentNodeId reset to null');
  assert.strictEqual(state.nodes[n2.id].isCheckpoint, true, 'Child of pruned node must be promoted to checkpoint');
});

console.log('\n=== Running Task 11 V2 Schema, Sibling Branching & Provenance Tests ===\n');

// 11. Schema V1 -> V2 Migration & Backup Verification
await test('V1 -> V2 migration creates verified backup, stable treeIds, and reciprocal links', async () => {
  const memoryStore = createMemoryStorage();
  // Setup V1 data in storage
  const v1Data = {
    schemaVersion: 1,
    nodes: {
      'node_1': { id: 'node_1', url: 'https://a.org', title: 'A', timestamp: 100, parentNodeId: null, childNodeIds: ['node_2'], isCheckpoint: true, tabId: 1 },
      'node_2': { id: 'node_2', url: 'https://b.org', title: 'B', timestamp: 200, parentNodeId: 'node_1', childNodeIds: [], isCheckpoint: false, tabId: 1 }
    },
    tabState: {
      '1': 'node_2'
    },
    metadata: { createdAt: 100, totalNodesCreated: 2, lastPrunedAt: null }
  };
  await memoryStore.set({ [STORAGE_KEY]: v1Data });

  const storage = new StorageManager({ storageBackend: memoryStore });
  const state = await storage.init();

  assert.strictEqual(state.schemaVersion, 2, 'Must migrate to Schema V2');
  assert.strictEqual(state.nodes['node_1'].treeId, 'tree_node_1');
  assert.strictEqual(state.nodes['node_2'].treeId, 'tree_node_1', 'Child must inherit parent treeId');
  assert.deepStrictEqual(state.nodes['node_1'].childNodeIds, ['node_2']);
  assert.strictEqual(state.nodes['node_2'].parentNodeId, 'node_1');

  // Verify tabState migrated to single-node baseline
  const tab1 = state.tabState['1'];
  assert(tab1 && typeof tab1 === 'object');
  assert.strictEqual(tab1.currentNodeId, 'node_2');
  assert.deepStrictEqual(tab1.historyStack, ['node_2']);
  assert.strictEqual(tab1.historyIndex, 0);
  assert.strictEqual(tab1.baselineEstablished, true);

  // Verify backup exists
  const rawDump = memoryStore._dump();
  assert(rawDump[BACKUP_KEY], 'V1 backup must be stored under BACKUP_KEY');
  assert.strictEqual(rawDump[BACKUP_KEY].data.schemaVersion, 1);
  assert(rawDump[BACKUP_KEY].backupCreatedAt > 0);
});

// 12. V1 -> V2 Cycle Breaking & Dangling Link Repair
await test('V1 -> V2 migration breaks cycles and repairs dangling parents safely', async () => {
  const memoryStore = createMemoryStorage();
  const cyclicV1 = {
    schemaVersion: 1,
    nodes: {
      'n_a': { id: 'n_a', url: 'https://a.com', parentNodeId: 'n_b', childNodeIds: ['n_b'], timestamp: 100 },
      'n_b': { id: 'n_b', url: 'https://b.com', parentNodeId: 'n_a', childNodeIds: ['n_a'], timestamp: 200 },
      'n_c': { id: 'n_c', url: 'https://c.com', parentNodeId: 'n_nonexistent', childNodeIds: [], timestamp: 300 }
    },
    tabState: {},
    metadata: { createdAt: 100, totalNodesCreated: 3 }
  };
  await memoryStore.set({ [STORAGE_KEY]: cyclicV1 });

  const storage = new StorageManager({ storageBackend: memoryStore });
  const state = await storage.init();

  // Dangling parent repaired
  assert.strictEqual(state.nodes['n_c'].parentNodeId, null);
  assert.strictEqual(state.nodes['n_c'].isCheckpoint, true);

  // Cycle broken: one node promoted to checkpoint
  const a = state.nodes['n_a'];
  const b = state.nodes['n_b'];
  assert(a.parentNodeId === null || b.parentNodeId === null, 'Cycle must be broken');
  assert(a.treeId && b.treeId);
});

// 13. Passive 24-Hour Backup Expiration
await test('Passive 24-hour backup expiration prunes expired backup on wake without alarms', async () => {
  const memoryStore = createMemoryStorage();
  const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
  await memoryStore.set({
    [BACKUP_KEY]: { backupCreatedAt: oldTimestamp, data: { sample: 1 } },
    [STORAGE_KEY]: { schemaVersion: 2, nodes: {}, tabState: {}, metadata: { createdAt: 100, downloadNodeMap: {} } }
  });

  const storage = new StorageManager({ storageBackend: memoryStore });
  await storage.init();

  const dump = memoryStore._dump();
  assert.strictEqual(dump[BACKUP_KEY], undefined, 'Backup older than 24h must be removed on wake');
});

// 14. Same-Tab Back/Forward Sibling Branching (Scenario 3)
await test('Same-tab Back/Forward traversal branches subsequent navigations as siblings', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  // 1. Visit Wikipedia
  await mockEnv.emitCommitted({
    tabId: 10,
    frameId: 0,
    url: 'https://en.wikipedia.org/wiki/Quantum',
    transitionType: 'typed',
    timeStamp: 1000
  });

  let state = await storage.getState();
  const wikiNodeId = getTabHeadId(state, 10);
  assert(wikiNodeId);

  // 2. Link to Source A
  await mockEnv.emitCommitted({
    tabId: 10,
    frameId: 0,
    url: 'https://phys.org/article-1',
    transitionType: 'link',
    timeStamp: 2000
  });

  state = await storage.getState();
  const sourceANodeId = getTabHeadId(state, 10);
  assert.strictEqual(state.nodes[sourceANodeId].parentNodeId, wikiNodeId);

  // 3. User clicks Back -> Returns to Wikipedia
  await mockEnv.emitCommitted({
    tabId: 10,
    frameId: 0,
    url: 'https://en.wikipedia.org/wiki/Quantum',
    transitionQualifiers: ['forward_back'],
    timeStamp: 3000
  });

  state = await storage.getState();
  assert.strictEqual(getTabHeadId(state, 10), wikiNodeId, 'Back navigation must reactivate Wikipedia head');
  assert.strictEqual(Object.keys(state.nodes).length, 2, 'Back navigation must make zero graph mutations');

  // 4. From Wikipedia, navigate to Source B
  await mockEnv.emitCommitted({
    tabId: 10,
    frameId: 0,
    url: 'https://arxiv.org/abs/quantum-2',
    transitionType: 'link',
    timeStamp: 4000
  });

  state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 3, 'Source B must be recorded');
  const sourceBNodeId = getTabHeadId(state, 10);
  const sourceB = state.nodes[sourceBNodeId];

  // Sibling branching verification
  assert.strictEqual(sourceB.parentNodeId, wikiNodeId, 'Source B parent must be Wikipedia');
  assert(state.nodes[wikiNodeId].childNodeIds.includes(sourceANodeId), 'Wikipedia must have Source A as child');
  assert(state.nodes[wikiNodeId].childNodeIds.includes(sourceBNodeId), 'Wikipedia must have Source B as child');
  assert.strictEqual(sourceB.treeId, state.nodes[wikiNodeId].treeId, 'Siblings must share same treeId');
});

// 15. Nested Navigation Path Preservation (Scenario 4)
await test('Nested ordinary navigation preserves linear hierarchy', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  // Wikipedia -> Source A -> Source C (without Back)
  await mockEnv.emitCommitted({ tabId: 1, frameId: 0, url: 'https://wiki.org/q', timeStamp: 100 });
  const state1 = await storage.getState();
  const nWiki = getTabHeadId(state1, 1);

  await mockEnv.emitCommitted({ tabId: 1, frameId: 0, url: 'https://source-a.org', timeStamp: 200 });
  const state2 = await storage.getState();
  const nA = getTabHeadId(state2, 1);

  await mockEnv.emitCommitted({ tabId: 1, frameId: 0, url: 'https://source-c.org', timeStamp: 300 });
  const state3 = await storage.getState();
  const nC = getTabHeadId(state3, 1);

  assert.strictEqual(state3.nodes[nA].parentNodeId, nWiki);
  assert.strictEqual(state3.nodes[nC].parentNodeId, nA, 'Source C must be nested under Source A');
});

// 16. Symmetrical Ambiguity & Lineage Invalidation
await test('Symmetrical duplicate traversal invalidates lineage and recovers safely on next link', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  // Tab visits A -> B -> A
  await mockEnv.emitCommitted({ tabId: 3, frameId: 0, url: 'https://example.com/A', timeStamp: 100 });
  await mockEnv.emitCommitted({ tabId: 3, frameId: 0, url: 'https://example.com/B', timeStamp: 200 });
  await mockEnv.emitCommitted({ tabId: 3, frameId: 0, url: 'https://example.com/A', timeStamp: 300 });

  // History stack has [A, B, A] at index 2
  // Back traversal to A matches both index 0 (Back) and index 2 (current) - ambiguous target
  await mockEnv.emitCommitted({
    tabId: 3,
    frameId: 0,
    url: 'https://example.com/A',
    transitionQualifiers: ['forward_back'],
    timeStamp: 400
  });

  let tabState = await storage.getTabState(3);
  assert.strictEqual(tabState.lineageInvalidated, true, 'Lineage must be invalidated on ambiguous traversal');
  assert.strictEqual(tabState.currentNodeId, null);

  // Subsequent ordinary link click recovers safely to independent root checkpoint
  await mockEnv.emitCommitted({ tabId: 3, frameId: 0, url: 'https://example.com/D', timeStamp: 500 });
  const state = await storage.getState();
  const nodeD = state.nodes[getTabHeadId(state, 3)];

  assert(nodeD && nodeD.isCheckpoint && nodeD.parentNodeId === null, 'Must safely checkpoint to independent root');
  assert.notStrictEqual(nodeD.treeId, state.nodes[tabState.historyStack[0]].treeId, 'Must create a new research tree');
});

// 17. Unrecorded forward_back Resynchronization
await test('Unrecorded forward_back resynchronizes cleanly to root checkpoint', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  await mockEnv.emitCommitted({ tabId: 4, frameId: 0, url: 'https://page1.com', timeStamp: 100 });

  // forward_back arrives for a URL never recorded in this tab
  await mockEnv.emitCommitted({
    tabId: 4,
    frameId: 0,
    url: 'https://external-unrecorded.com',
    transitionQualifiers: ['forward_back'],
    timeStamp: 200
  });

  const state = await storage.getState();
  const resyncNode = state.nodes[getTabHeadId(state, 4)];
  assert.strictEqual(resyncNode.url, 'https://external-unrecorded.com');
  assert.strictEqual(resyncNode.parentNodeId, null);
  assert.strictEqual(resyncNode.isCheckpoint, true);

  const tabState = await storage.getTabState(4);
  assert.deepStrictEqual(tabState.historyStack, [resyncNode.id]);
  assert.strictEqual(tabState.historyIndex, 0);
});

// 18. Website Opener Child Tab Branching (Scenario 5)
await test('Multiple child tabs opened from one listing share single treeId as siblings', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  // Listing page on Tab 1
  await mockEnv.emitCommitted({ tabId: 1, frameId: 0, url: 'https://store.com/listing', timeStamp: 100 });
  const state1 = await storage.getState();
  const listingNodeId = getTabHeadId(state1, 1);
  const listingTreeId = state1.nodes[listingNodeId].treeId;

  // Tab 2 opened from Tab 1 (Product 1)
  await mockEnv.emitTabCreated({ id: 2, openerTabId: 1 });
  await mockEnv.emitCommitted({ tabId: 2, frameId: 0, url: 'https://store.com/product/1', timeStamp: 200 });

  // Tab 3 opened from Tab 1 (Product 2)
  await mockEnv.emitTabCreated({ id: 3, openerTabId: 1 });
  await mockEnv.emitCommitted({ tabId: 3, frameId: 0, url: 'https://store.com/product/2', timeStamp: 300 });

  const state2 = await storage.getState();
  const p1 = state2.nodes[getTabHeadId(state2, 2)];
  const p2 = state2.nodes[getTabHeadId(state2, 3)];

  assert.strictEqual(p1.parentNodeId, listingNodeId);
  assert.strictEqual(p2.parentNodeId, listingNodeId);
  assert.strictEqual(p1.treeId, listingTreeId, 'Product 1 must share listing treeId');
  assert.strictEqual(p2.treeId, listingTreeId, 'Product 2 must share listing treeId');
});

// 19. Post-Initialization Unanchored Tab Safe Root Fallback
await test('Post-initialization unanchored tab to seen URL creates independent root checkpoint', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  // Earlier visit to arxiv
  await mockEnv.emitCommitted({ tabId: 1, frameId: 0, url: 'https://arxiv.org/abs/1', timeStamp: 100 });
  const state1 = await storage.getState();
  const oldNode = state1.nodes[getTabHeadId(state1, 1)];

  // User later opens Ctrl+T (Tab 99) and types the exact same URL
  await mockEnv.emitCommitted({
    tabId: 99,
    frameId: 0,
    url: 'https://arxiv.org/abs/1',
    transitionType: 'typed',
    timeStamp: 5000
  });

  const state2 = await storage.getState();
  const newNode = state2.nodes[getTabHeadId(state2, 99)];

  assert.notStrictEqual(newNode.id, oldNode.id, 'Must create a new node, not reattach by URL alone');
  assert.strictEqual(newNode.parentNodeId, null);
  assert.strictEqual(newNode.isCheckpoint, true);
  assert.notStrictEqual(newNode.treeId, oldNode.treeId, 'Must create an independent research tree');
});

// 20. Reused Tab ID & URL Conservative Single-Node Baseline (Scenario 8A)
await test('Reused recycled tab ID with matching URL collapses to single-node baseline on restart', async () => {
  const sharedBackend = createMemoryStorage({
    [STORAGE_KEY]: {
      schemaVersion: 2,
      nodes: {
        'n1': { id: 'n1', treeId: 'tree_n1', nodeType: 'page', url: 'https://arxiv.org/1', title: '1', parentNodeId: null, childNodeIds: ['n2'] },
        'n2': { id: 'n2', treeId: 'tree_n1', nodeType: 'page', url: 'https://arxiv.org/2', title: '2', parentNodeId: 'n1', childNodeIds: ['n3'] },
        'n3': { id: 'n3', treeId: 'tree_n1', nodeType: 'page', url: 'https://arxiv.org/3', title: '3', parentNodeId: 'n2', childNodeIds: [] }
      },
      tabState: {
        '14': { currentNodeId: 'n3', historyStack: ['n1', 'n2', 'n3'], historyIndex: 2, lineageInvalidated: false, baselineEstablished: false }
      },
      metadata: { createdAt: 100, downloadNodeMap: {} }
    }
  }, {}); // Empty sessionStore simulates browser restart

  const storage = new StorageManager({ storageBackend: sharedBackend });
  const mockEnv = createMockBrowserEnv([
    { id: 14, url: 'https://arxiv.org/3', title: '3' }
  ]);
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  const tabState = await storage.getTabState(14);
  assert.strictEqual(tabState.currentNodeId, 'n3');
  assert.deepStrictEqual(tabState.historyStack, ['n3'], 'Must collapse stale 3-node stack to single-node baseline');
  assert.strictEqual(tabState.historyIndex, 0);
  assert.strictEqual(tabState.baselineEstablished, true);

  // Subsequent link navigation forks cleanly from n3
  await mockEnv.emitCommitted({ tabId: 14, frameId: 0, url: 'https://arxiv.org/child', timeStamp: 2000 });
  const state = await storage.getState();
  const child = state.nodes[getTabHeadId(state, 14)];
  assert.strictEqual(child.parentNodeId, 'n3');
  assert.strictEqual(child.treeId, 'tree_n1');
});

// 21. Browser Restart Inside 60-Second Window (Scenario 8B)
await test('Browser restart inside 60 seconds triggers fresh initialization without timestamp bypass', async () => {
  const sharedBackend = createMemoryStorage({
    [STORAGE_KEY]: {
      schemaVersion: 2,
      nodes: {
        'n_base': { id: 'n_base', treeId: 'tree_base', nodeType: 'page', url: 'https://base.org', title: 'Base', parentNodeId: null, childNodeIds: [] }
      },
      tabState: {
        '14': { currentNodeId: 'n_base', historyStack: ['n_base', 'stale_node'], historyIndex: 1, lineageInvalidated: false, baselineEstablished: false }
      },
      metadata: { createdAt: Date.now() - 5000, downloadNodeMap: {} } // 5 seconds ago
    }
  }, {});

  const storage = new StorageManager({ storageBackend: sharedBackend });
  const mockEnv = createMockBrowserEnv([{ id: 14, url: 'https://base.org', title: 'Base' }]);
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  const tabState = await storage.getTabState(14);
  assert.deepStrictEqual(tabState.historyStack, ['n_base'], 'Must collapse stack despite recent timestamp');
  assert.strictEqual(tabState.baselineEstablished, true);
});

// 22. Fail-Closed Storage-Read Failure Path (Scenario 8C)
await test('storage.session.get() rejection fails closed without storage mutations', async () => {
  const memoryStore = createMemoryStorage();
  const rejectingSessionStorage = {
    async get() { throw new Error('Simulated persistent storage read lock'); },
    async set() {},
    async remove() {}
  };

  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv, { sessionStorage: rejectingSessionStorage });
  tracker.init();
  await tracker.ensureSessionReady();

  // Navigation arrives while storage.session is broken
  const commitPromise = mockEnv.emitCommitted({
    tabId: 55,
    frameId: 0,
    url: 'https://failclosed.org/page',
    timeStamp: 1000
  });

  // Verify tracker has not mutated storage.local
  const state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 0, 'Zero writes must occur to storage.local while session identity is unknown');
  assert.strictEqual(Object.keys(state.tabState).length, 0);

  // Recovery simulation: healthy storage session wakes
  tracker.destroy();
  const healthySession = {
    _data: {},
    async get(k) { return { [k]: this._data[k] }; },
    async set(items) { Object.assign(this._data, items); },
    async remove(k) { delete this._data[k]; }
  };
  const trackerRecovered = new NavigationTracker(storage, mockEnv, { sessionStorage: healthySession });
  trackerRecovered.init();
  await trackerRecovered.ensureSessionReady();

  // New navigation now processes cleanly
  await mockEnv.emitCommitted({
    tabId: 55,
    frameId: 0,
    url: 'https://failclosed.org/recovered',
    timeStamp: 2000
  });

  const stateRecovered = await storage.getState();
  assert.strictEqual(Object.keys(stateRecovered.nodes).length, 1);
  assert.strictEqual(stateRecovered.nodes[getTabHeadId(stateRecovered, 55)].url, 'https://failclosed.org/recovered');
});

// 23. Stale Stack Marker-Write Failure & Idempotent Worker Recreation (Scenario 8D)
await test('Post-commit marker-write failure performs idempotent recovery without duplicate roots', async () => {
  const sharedLocal = createMemoryStorage({
    [STORAGE_KEY]: {
      schemaVersion: 2,
      nodes: {
        'n1': { id: 'n1', treeId: 'tree_n', nodeType: 'page', url: 'https://arxiv.org/paper', title: '1', parentNodeId: null, childNodeIds: ['n2'] },
        'n2': { id: 'n2', treeId: 'tree_n', nodeType: 'page', url: 'https://arxiv.org/paper', title: '2', parentNodeId: 'n1', childNodeIds: ['n3'] },
        'n3': { id: 'n3', treeId: 'tree_n', nodeType: 'page', url: 'https://arxiv.org/paper', title: '3', parentNodeId: 'n2', childNodeIds: [] }
      },
      tabState: {
        '14': { currentNodeId: 'n3', historyStack: ['n1', 'n2', 'n3'], historyIndex: 2, lineageInvalidated: false, baselineEstablished: false }
      },
      metadata: { createdAt: 100, downloadNodeMap: {} }
    }
  });

  // Failing session storage on write
  const failingSession = {
    _store: {},
    async get(k) { return { [k]: this._store[k] }; },
    async set() { throw new Error('Quota exceeded on session storage'); },
    async remove(k) { delete this._store[k]; }
  };

  const storage1 = new StorageManager({ storageBackend: sharedLocal });
  const mockEnv1 = createMockBrowserEnv([{ id: 14, url: 'https://arxiv.org/paper', title: 'Paper' }]);
  const tracker1 = new NavigationTracker(storage1, mockEnv1, { sessionStorage: failingSession });
  tracker1.init();
  await tracker1.ensureSessionReady();

  // Run 1: local reconciliation committed single-node baseline, but session marker write failed
  let stateRun1 = await storage1.getState();
  assert.deepStrictEqual(stateRun1.tabState['14'].historyStack, ['n3'], 'Run 1 must collapse stack to single-node baseline');
  assert.strictEqual(stateRun1.tabState['14'].baselineEstablished, true);
  assert.strictEqual(tracker1.sessionInitialized, false, 'Barrier must remain closed when marker write fails');

  // Event E1 in Run 1 arrives and is held in Run 1's transient queue
  mockEnv1.emitCommitted({ tabId: 14, frameId: 0, url: 'https://arxiv.org/e1', timeStamp: 1500 });
  assert.strictEqual(tracker1.sessionPendingQueue.length, 1);

  // Worker 1 is destroyed: memory scope and transient queue dropped
  // Worker 2 (recreation) wakes with healthy session storage
  const healthySession2 = {
    _store: {},
    async get(k) { return { [k]: this._store[k] }; },
    async set(items) { Object.assign(this._store, items); },
    async remove(k) { delete this._store[k]; }
  };

  const storage2 = new StorageManager({ storageBackend: sharedLocal });
  const mockEnv2 = createMockBrowserEnv([{ id: 14, url: 'https://arxiv.org/paper', title: 'Paper' }]);
  const tracker2 = new NavigationTracker(storage2, mockEnv2, { sessionStorage: healthySession2 });
  tracker2.init();

  // New event E2 arrives in Run 2
  const e2Promise = mockEnv2.emitCommitted({ tabId: 14, frameId: 0, url: 'https://arxiv.org/e2', timeStamp: 2500 });
  await tracker2.ensureSessionReady();
  await e2Promise;

  const stateRun2 = await storage2.getState();
  // Idempotent recovery assertions:
  // Node count for https://arxiv.org/paper must remain exactly 3 (no duplicate root created!)
  const paperNodes = Object.values(stateRun2.nodes).filter(n => n.url === 'https://arxiv.org/paper');
  assert.strictEqual(paperNodes.length, 3, 'Must NOT create duplicate root node during idempotent retry');

  // E2 was processed cleanly
  const e2Node = stateRun2.nodes[getTabHeadId(stateRun2, 14)];
  assert.strictEqual(e2Node.url, 'https://arxiv.org/e2');
  assert.strictEqual(e2Node.parentNodeId, 'n3');
});

// 24. Completed Download Provenance Attribution
await test('Completed download attributes to initiating source page node without sensitive URLs or file paths', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  // 1. Visit ArXiv paper page
  await mockEnv.emitCommitted({ tabId: 1, frameId: 0, url: 'https://arxiv.org/abs/2401.08922', timeStamp: 1000 });
  const state1 = await storage.getState();
  const pageNodeId = getTabHeadId(state1, 1);

  // 2. Download completes with referrer pointing to ArXiv page
  await mockEnv.emitDownloadCreated({
    id: 1001,
    url: 'https://arxiv.org/pdf/2401.08922.pdf?token=secret123',
    referrer: 'https://arxiv.org/abs/2401.08922',
    filename: 'C:\\Users\\User\\Downloads\\quantum_survey.pdf',
    state: 'complete',
    endTime: '2026-10-29T20:30:15.000Z'
  });

  const state2 = await storage.getState();
  const dlNode = Object.values(state2.nodes).find(n => n.nodeType === 'download');

  assert(dlNode, 'Download node must be created');
  assert.strictEqual(dlNode.parentNodeId, pageNodeId, 'Download node must be child of source page');
  assert.strictEqual(dlNode.treeId, state2.nodes[pageNodeId].treeId, 'Download must inherit source treeId');
  assert.strictEqual(dlNode.filename, 'quantum_survey.pdf', 'Must store only basename, not full filesystem path');
  assert.strictEqual(dlNode.originDomain, 'arxiv.org', 'Must store originating domain');
  assert.strictEqual(dlNode.downloadId, 1001);
  assert.strictEqual(dlNode.url, undefined, 'Must NOT persist raw download URL with sensitive tokens');
  assert(state2.nodes[pageNodeId].childNodeIds.includes(dlNode.id), 'Source page must link download node in childNodeIds');

  // Verify deduplication
  await mockEnv.emitDownloadCreated({
    id: 1001,
    url: 'https://arxiv.org/pdf/2401.08922.pdf?token=secret123',
    referrer: 'https://arxiv.org/abs/2401.08922',
    filename: 'quantum_survey.pdf',
    state: 'complete'
  });

  const state3 = await storage.getState();
  const allDownloads = Object.values(state3.nodes).filter(n => n.nodeType === 'download');
  assert.strictEqual(allDownloads.length, 1, 'Duplicate download event must be deduplicated via downloadId index');
});

// 25. Unattributed Download ("Source unavailable")
await test('Unattributed download without referrer creates independent download node labeled Source unavailable', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  // Completed download without trackable referrer (even if final file URL has a domain/CDN)
  await mockEnv.emitDownloadCreated({
    id: 2002,
    url: 'https://datasets.org/data.zip?token=secret123',
    referrer: '',
    filename: '/home/user/downloads/data.zip',
    state: 'complete'
  });

  const state = await storage.getState();
  const dlNode = Object.values(state.nodes).find(n => n.downloadId === 2002);
  assert(dlNode);
  assert.strictEqual(dlNode.parentNodeId, null, 'Unattributed download must have parentNodeId: null');
  assert.strictEqual(dlNode.isCheckpoint, true);
  assert.strictEqual(dlNode.filename, 'data.zip');
  assert.strictEqual(dlNode.originDomain, 'Source unavailable', 'Must report Source unavailable when referrer is empty, never CDN host');
  assert.strictEqual(dlNode.url, undefined, 'Must not store raw URL or token');
});

// 25b. Cross-Domain CDN Download Provenance
await test('Completed download from a CDN domain attributes strictly to source page domain', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  // 1. Visit University research portal
  await mockEnv.emitCommitted({ tabId: 1, frameId: 0, url: 'https://ai.university.edu/papers/llm-study', timeStamp: 1000 });
  const state1 = await storage.getState();
  const sourceNodeId = getTabHeadId(state1, 1);

  // 2. Download served from completely different external CDN host with auth tokens
  await mockEnv.emitDownloadCreated({
    id: 3003,
    url: 'https://cdn-edge-04.akamai-fastly.net/blobs/2026/study.pdf?sig=deadbeef&expires=1730000000',
    referrer: 'https://ai.university.edu/papers/llm-study',
    filename: 'C:\\Downloads\\study.pdf',
    state: 'complete',
    endTime: '2026-10-29T21:00:00.000Z'
  });

  const state2 = await storage.getState();
  const dlNode = Object.values(state2.nodes).find(n => n.downloadId === 3003);
  assert(dlNode, 'Download node must exist');
  assert.strictEqual(dlNode.parentNodeId, sourceNodeId, 'Download node must attach under source page');
  assert.strictEqual(dlNode.originDomain, 'ai.university.edu', 'Must record source page domain, NEVER CDN domain');
  assert.strictEqual(dlNode.filename, 'study.pdf');
  assert.strictEqual(dlNode.url, undefined, 'Must not persist CDN URL or auth tokens');
  assert(state2.nodes[sourceNodeId].childNodeIds.includes(dlNode.id));
});

// 25c. Ambiguous Referrer Download Safe Fallback
await test('Download with ambiguous referrer matching multiple pages falls back safely to Source unavailable', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore });
  const mockEnv = createMockBrowserEnv();
  const tracker = new NavigationTracker(storage, mockEnv);
  tracker.init();
  await tracker.ensureSessionReady();

  // Tab 1 and Tab 2 both have visited https://common-news.com/article independently
  await mockEnv.emitCommitted({ tabId: 1, frameId: 0, url: 'https://common-news.com/article', timeStamp: 1000 });
  await mockEnv.emitCommitted({ tabId: 2, frameId: 0, url: 'https://common-news.com/article', timeStamp: 2000 });

  const state1 = await storage.getState();
  const matchingPages = Object.values(state1.nodes).filter(n => n.nodeType === 'page' && n.url === 'https://common-news.com/article');
  assert.strictEqual(matchingPages.length, 2, 'Two independent page nodes exist for same URL');

  // Download arrives with referrer matching both page visits
  await mockEnv.emitDownloadCreated({
    id: 4004,
    url: 'https://cdn.common-news.com/video.mp4?key=abc',
    referrer: 'https://common-news.com/article',
    filename: 'video.mp4',
    state: 'complete'
  });

  const state2 = await storage.getState();
  const dlNode = Object.values(state2.nodes).find(n => n.downloadId === 4004);
  assert(dlNode, 'Download node must exist');
  assert.strictEqual(dlNode.parentNodeId, null, 'Ambiguous referrer must NOT guess a parent node');
  assert.strictEqual(dlNode.isCheckpoint, true);
  assert.strictEqual(dlNode.originDomain, 'Source unavailable', 'Must record Source unavailable on ambiguous match');
  assert.strictEqual(dlNode.url, undefined);
});

// 26. Pruning with Active Heads, Reciprocal Links, and Download Index
await test('Safe pruning cleans downloadNodeMap and tabState history stacks consistently', async () => {
  const memoryStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memoryStore, maxNodes: 3 });

  // 1. Root page on tab 1
  const p1 = await storage.recordVisit({ url: 'https://a.org', tabId: 1, timestamp: 100 });
  // 2. Download under p1
  const dl1 = await storage.recordVisit({ nodeType: 'download', downloadId: 42, filename: 'doc.pdf', parentNodeId: p1.id, timestamp: 200 });
  // 3. Child page under p1 on tab 1
  const p2 = await storage.recordVisit({ url: 'https://b.org', parentNodeId: p1.id, tabId: 1, timestamp: 300 });

  let state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 3);
  assert.strictEqual(state.metadata.downloadNodeMap['42'], dl1.id);

  // Tab 1 closes -> p2 is no longer protected head
  await storage.removeTabState(1);

  // 4. Page on tab 2 (active head)
  const p3 = await storage.recordVisit({ url: 'https://c.org', tabId: 2, timestamp: 400 });
  // 5. Page on tab 2 -> triggers pruning of oldest non-head (p1, then dl1)
  const p4 = await storage.recordVisit({ url: 'https://d.org', parentNodeId: p3.id, tabId: 2, timestamp: 500 });

  state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 3, 'Must maintain maxNodes = 3');
  assert(!state.nodes[p1.id], 'p1 must be pruned');
  assert(!state.nodes[dl1.id], 'dl1 must be pruned');
  assert.strictEqual(state.metadata.downloadNodeMap['42'], undefined, 'Pruned download must be removed from downloadNodeMap');
});

// 27. Clear Map Complete Wipe
await test('Clear Map removes graph, tab state, downloadNodeMap, and V1 backup', async () => {
  const memoryStore = createMemoryStorage();
  await memoryStore.set({
    [BACKUP_KEY]: { backupCreatedAt: Date.now(), data: { sample: 'old' } }
  });
  const storage = new StorageManager({ storageBackend: memoryStore });
  await storage.recordVisit({ url: 'https://sample.org', tabId: 1, timestamp: 100 });
  await storage.recordVisit({ nodeType: 'download', downloadId: 77, filename: 'sample.zip', timestamp: 200 });

  let state = await storage.getState();
  assert.strictEqual(Object.keys(state.nodes).length, 2);
  assert(memoryStore._dump()[BACKUP_KEY]);

  await storage.clearAll();

  state = await storage.getState();
  assert.deepStrictEqual(state.nodes, {});
  assert.deepStrictEqual(state.tabState, {});
  assert.deepStrictEqual(state.metadata.downloadNodeMap, {});
  assert.strictEqual(memoryStore._dump()[BACKUP_KEY], undefined, 'Clear Map must remove V1 backup');
});

console.log(`\nVerification Complete: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
