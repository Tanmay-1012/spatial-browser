/**
 * Task 18 Part A: Sibling Branching & Graph Layout Verification Suite
 * 
 * Verifies that real browser navigation produces genuine branching relationships
 * (not linear graphs) across same-tab Back/Forward traversal, opener-tab child links,
 * deeper child paths, and download provenance, and that both horizontal and reflow
 * layouts render visible trees rather than flat lines.
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
await import(pathToFileURL(path.join(ROOT_DIR, 'src', 'shared', 'ui-logic.js')).href);

const { StorageManager, createMemoryStorage } = globalThis.SpatialStorage;
const { NavigationTracker } = globalThis.SpatialTracker;
const uiLogic = globalThis.SpatialUILogic;

let passed = 0;
let failed = 0;

const pendingTests = [];

function test(name, fn) {
  const p = Promise.resolve().then(fn).then(() => {
    console.log(`  ✓ ${name}`);
    passed++;
  }).catch((err) => {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.stack || err.message}`);
    failed++;
  });
  pendingTests.push(p);
}

console.log('=== Running Task 18 Branching & Layout Tests ===\n');

async function createScenario() {
  const memStore = createMemoryStorage();
  const memSession = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore, sessionBackend: memSession });
  await storage.init();

  const mockApi = {
    tabs: {
      get: async (tabId) => ({ id: tabId, openerTabId: tabId === 2 || tabId === 3 ? 1 : undefined })
    },
    webNavigation: {
      onCommitted: { addListener: () => {} },
      onHistoryStateUpdated: { addListener: () => {} },
      onReferenceFragmentUpdated: { addListener: () => {} },
      onCreatedNavigationTarget: { addListener: () => {} }
    },
    downloads: {
      onCreated: { addListener: () => {} },
      onChanged: { addListener: () => {} }
    }
  };

  const tracker = new NavigationTracker(storage, mockApi, { sessionStorage: memSession });
  await tracker.ensureSessionReady();

  // 1. Tab 1 opens Hub
  const hubNode = await tracker.handleNavigationCommitted({
    tabId: 1,
    frameId: 0,
    url: 'https://research.org/hub',
    timeStamp: 1000
  });

  // 2. Open two source pages in separate tabs from that same hub (Tabs 2 & 3)
  tracker.handleTabCreated({ id: 2, openerTabId: 1 });
  const tab2Node = await tracker.handleNavigationCommitted({
    tabId: 2,
    frameId: 0,
    url: 'https://research.org/product-1',
    timeStamp: 1100
  });

  tracker.handleTabCreated({ id: 3, openerTabId: 1 });
  const tab3Node = await tracker.handleNavigationCommitted({
    tabId: 3,
    frameId: 0,
    url: 'https://research.org/product-2',
    timeStamp: 1200
  });

  // 3. In Tab 1: Hub -> Source A -> Child A -> Back to Source A -> Back to Hub -> Source B
  const srcANode = await tracker.handleNavigationCommitted({
    tabId: 1,
    frameId: 0,
    url: 'https://research.org/source-a',
    timeStamp: 1300
  });

  const childANode = await tracker.handleNavigationCommitted({
    tabId: 1,
    frameId: 0,
    url: 'https://research.org/source-a/child',
    timeStamp: 1400
  });

  // Back to Source A
  const backToA = await tracker.handleNavigationCommitted({
    tabId: 1,
    frameId: 0,
    url: 'https://research.org/source-a',
    transitionQualifiers: ['forward_back'],
    timeStamp: 1500
  });

  // Synthetic download attributed to Source A
  const dlNode = await tracker.handleDownloadCreated({
    id: 501,
    url: 'https://cdn.research.org/paper.pdf',
    filename: 'paper.pdf',
    referrer: 'https://research.org/source-a',
    state: 'complete'
  });

  // Back to Hub
  const backToHub = await tracker.handleNavigationCommitted({
    tabId: 1,
    frameId: 0,
    url: 'https://research.org/hub',
    transitionQualifiers: ['forward_back'],
    timeStamp: 1600
  });

  // Navigate to Source B
  const srcBNode = await tracker.handleNavigationCommitted({
    tabId: 1,
    frameId: 0,
    url: 'https://research.org/source-b',
    timeStamp: 1700
  });

  const state = await storage.getState();
  return {
    state,
    nodes: { hubNode, tab2Node, tab3Node, srcANode, childANode, srcBNode, dlNode, backToA, backToHub }
  };
}

test('Minimal reproducible navigation scenario produces genuine branching hierarchy in storage', async () => {
  const { state, nodes } = await createScenario();
  const { hubNode, tab2Node, tab3Node, srcANode, childANode, srcBNode, dlNode, backToA, backToHub } = nodes;

  assert(hubNode, 'Hub visit must be recorded');
  assert.strictEqual(hubNode.parentNodeId, null, 'Hub must be root checkpoint');
  assert.strictEqual(hubNode.isCheckpoint, true);
  assert.strictEqual(backToA, null, 'Back traversal should not create duplicate node');
  assert(dlNode, 'Download node must be created');
  assert.strictEqual(backToHub, null, 'Back to hub should resolve existing checkpoint in stack');

  const storedHub = state.nodes[hubNode.id];
  const storedTab2 = state.nodes[tab2Node.id];
  const storedTab3 = state.nodes[tab3Node.id];
  const storedSrcA = state.nodes[srcANode.id];
  const storedChildA = state.nodes[childANode.id];
  const storedSrcB = state.nodes[srcBNode.id];
  const storedDl = state.nodes[dlNode.id];

  assert.strictEqual(storedHub.treeId, hubNode.treeId);
  assert.strictEqual(storedTab2.parentNodeId, hubNode.id, 'Tab 2 must have Hub as parent');
  assert.strictEqual(storedTab3.parentNodeId, hubNode.id, 'Tab 3 must have Hub as parent');
  assert.strictEqual(storedSrcA.parentNodeId, hubNode.id, 'Source A must have Hub as parent');
  assert.strictEqual(storedSrcB.parentNodeId, hubNode.id, 'Source B must have Hub as parent');

  assert.strictEqual(storedTab2.treeId, hubNode.treeId);
  assert.strictEqual(storedTab3.treeId, hubNode.treeId);
  assert.strictEqual(storedSrcA.treeId, hubNode.treeId);
  assert.strictEqual(storedSrcB.treeId, hubNode.treeId);

  // Hub childNodeIds must contain all 4 siblings
  assert(storedHub.childNodeIds.includes(tab2Node.id));
  assert(storedHub.childNodeIds.includes(tab3Node.id));
  assert(storedHub.childNodeIds.includes(srcANode.id));
  assert(storedHub.childNodeIds.includes(srcBNode.id));
  assert.strictEqual(storedHub.childNodeIds.length, 4, 'Hub must have exactly 4 sibling children');

  // Source A must have Child A and download
  assert.strictEqual(storedChildA.parentNodeId, srcANode.id);
  assert.strictEqual(storedDl.parentNodeId, srcANode.id);
  assert(storedSrcA.childNodeIds.includes(childANode.id));
  assert(storedSrcA.childNodeIds.includes(dlNode.id));
});

test('Research Trees overview groups multi-tab and same-tab siblings into a single tree', async () => {
  const { state } = await createScenario();
  const summary = uiLogic.buildResearchTrees(state, { now: 2000 });
  assert.strictEqual(summary.trees.length, 1, 'All siblings must group into exactly 1 Research Tree');
  assert.strictEqual(summary.trees[0].branchCount, 5, 'Must have 5 distinct leaf branches');
  assert.strictEqual(summary.trees[0].visitCount, 6, 'Must count 6 web visits');
  assert.strictEqual(summary.trees[0].downloadCount, 1, 'Must count 1 attributed download');
});

test('Desktop horizontal layout assigns equal X to siblings and distinct ascending Y coordinates', async () => {
  const { state, nodes } = await createScenario();
  const { hubNode, tab2Node, tab3Node, srcANode, childANode, srcBNode, dlNode } = nodes;

  const detail = uiLogic.buildTreeDetailView(state, hubNode.treeId, { now: 2000 });
  const hLayout = uiLogic.computeGraphLayout(detail.nodesMap, { layoutMode: 'horizontal' });
  const hById = Object.fromEntries(hLayout.layoutNodes.map((n) => [n.id, n]));

  // Depth-1 siblings must have equal X
  assert.strictEqual(hById[tab2Node.id].x, hById[tab3Node.id].x);
  assert.strictEqual(hById[tab3Node.id].x, hById[srcANode.id].x);
  assert.strictEqual(hById[srcANode.id].x, hById[srcBNode.id].x);
  assert(hById[srcANode.id].x > hById[hubNode.id].x, 'Children X must exceed Hub X');

  // Depth-1 siblings must have distinct, ascending Y coordinates (vertical fan)
  const depth1Y = [hById[tab2Node.id].y, hById[tab3Node.id].y, hById[srcANode.id].y, hById[srcBNode.id].y];
  for (let i = 0; i < depth1Y.length - 1; i++) {
    assert(depth1Y[i] < depth1Y[i + 1], `Sibling ${i} Y (${depth1Y[i]}) must be less than sibling ${i+1} Y (${depth1Y[i+1]})`);
  }

  // Depth-2 nodes (childA, dl) must have greater X than Source A
  assert(hById[childANode.id].x > hById[srcANode.id].x);
  assert(hById[dlNode.id].x > hById[srcANode.id].x);
  assert.notStrictEqual(hById[childANode.id].y, hById[dlNode.id].y, 'Source A children must occupy distinct Y rows');

  // Hub Y must be centered between outermost child subtrees
  assert.strictEqual(hById[hubNode.id].y, (depth1Y[0] + depth1Y[depth1Y.length - 1]) / 2);
});

test('Narrow reflow layout preserves hierarchical depths and valid edge connections', async () => {
  const { state, nodes } = await createScenario();
  const { hubNode, tab2Node, tab3Node, srcANode, childANode, srcBNode, dlNode } = nodes;

  const detail = uiLogic.buildTreeDetailView(state, hubNode.treeId, { now: 2000 });
  const rLayout = uiLogic.computeGraphLayout(detail.nodesMap, { layoutMode: 'reflow' });
  assert.strictEqual(rLayout.layoutNodes.length, 7);
  assert.strictEqual(rLayout.layoutEdges.length, 6);
  const rById = Object.fromEntries(rLayout.layoutNodes.map((n) => [n.id, n]));

  // Hub depth 0, siblings depth 1, leaf grandchildren depth 2
  assert.strictEqual(rById[hubNode.id].depth, 0);
  assert.strictEqual(rById[tab2Node.id].depth, 1);
  assert.strictEqual(rById[tab3Node.id].depth, 1);
  assert.strictEqual(rById[srcANode.id].depth, 1);
  assert.strictEqual(rById[childANode.id].depth, 2);
  assert.strictEqual(rById[dlNode.id].depth, 2);
  assert.strictEqual(rById[srcBNode.id].depth, 1);
});

await Promise.all(pendingTests);
console.log(`\nBranching Verification Complete: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
