/**
 * Spatial Browser History - Research Tree Explorer UI logic & structure tests.
 * Pure overview grouping, detail-tree scoping, ancestry-preserving filters,
 * download shelf separation, layout, URL safety, and background message helpers
 * are loaded directly from production files. Live browser E2E checks run in
 * Chrome and Firefox via scripts/e2e-*.py and are recorded in docs/TEST_PLAN.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shared = (...parts) => path.join(ROOT_DIR, 'src', 'shared', ...parts);
const HTML_PATH = shared('index.html');
const CSS_PATH = shared('styles.css');
const APP_PATH = shared('app.js');
const UI_LOGIC_PATH = shared('ui-logic.js');
const BACKGROUND_MESSAGES_PATH = shared('background-messages.js');
const STORAGE_PATH = shared('storage.js');

function loadClassicScript(filePath, globals = {}) {
  const context = Object.assign({ console, URL, Map, Set, Array, Object, Number, String, Date, Math, Promise }, globals);
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
  return context;
}

const uiLogic = loadClassicScript(UI_LOGIC_PATH).SpatialUILogic;
const backgroundMessages = loadClassicScript(BACKGROUND_MESSAGES_PATH).SpatialBackgroundMessages;
const storageModule = loadClassicScript(STORAGE_PATH, { module: { exports: {} } }).module.exports;
const html = fs.readFileSync(HTML_PATH, 'utf8');
const appJs = fs.readFileSync(APP_PATH, 'utf8');
const css = fs.readFileSync(CSS_PATH, 'utf8');

let passed = 0;
let failed = 0;
const pendingTests = [];

function test(name, fn) {
  const pending = Promise.resolve().then(fn).then(() => {
    console.log(`  ✓ ${name}`);
    passed++;
  }).catch((err) => {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.stack || err.message}`);
    failed++;
  });
  pendingTests.push(pending);
}

function luminance(hex) {
  const values = hex.replace('#', '').match(/../g).map((part) => parseInt(part, 16) / 255);
  const linear = values.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground, background) {
  const fg = luminance(foreground);
  const bg = luminance(background);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

function blend(foreground, background, alpha) {
  const fg = foreground.replace('#', '').match(/../g).map((part) => parseInt(part, 16));
  const bg = background.replace('#', '').match(/../g).map((part) => parseInt(part, 16));
  return `#${fg.map((value, index) => Math.round(value * alpha + bg[index] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
}

function rootThemeBlock(source, occurrence) {
  const blocks = Array.from(source.matchAll(/:root\s*\{([^}]+)\}/g));
  assert(blocks.length >= occurrence, `Expected theme block ${occurrence}`);
  return blocks[occurrence - 1][1];
}

function cssVariable(block, name) {
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`));
  assert(match, `Missing color ${name}`);
  return match[1];
}

function assertAa(label, foreground, background) {
  const ratio = contrastRatio(foreground, background);
  assert(ratio >= 4.5, `${label} contrast ${ratio.toFixed(2)}:1 is below 4.5:1`);
}

console.log('=== Running Task 12 Research Tree Explorer UI Tests ===\n');

test('Two-level Explorer controls, overview/detail landmarks, dialog semantics, and script order are present', () => {
  for (const id of [
    'overview-brand', 'detail-brand', 'back-to-overview-btn', 'detail-tree-domain', 'detail-tree-title',
    'detail-count-badge', 'search-input', 'search-clear-btn', 'time-filter', 'zoom-controls',
    'zoom-in', 'zoom-out', 'zoom-reset', 'clear-map-btn', 'clear-modal', 'confirm-clear-btn',
    'cancel-clear-btn', 'overview-view', 'trees-grid', 'overview-trees-summary', 'unattributed-section',
    'unattributed-list', 'detail-view', 'map-container', 'map-svg', 'map-viewport', 'edges-layer',
    'nodes-layer', 'detail-context-banner', 'detail-no-results', 'detail-reset-filters-btn',
    'empty-state', 'no-results-state', 'details-panel', 'details-url-field', 'details-source-field',
    'details-source', 'details-actions', 'details-parent', 'details-children', 'reopen-btn', 'details-close-btn'
  ]) assert(html.includes(`id="${id}"`), `Missing ${id}`);
  assert(html.includes('id="details-parent" type="button"'), 'Parent lineage must be a keyboard-operable button');
  assert(html.includes('aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description"'), 'Clear dialog needs an accessible name and description');
  assert(html.indexOf('src="storage.js"') < html.indexOf('src="ui-logic.js"'), 'Storage helper must load first');
  assert(html.indexOf('src="ui-logic.js"') < html.indexOf('src="app.js"'), 'UI logic must load before the app');
  assert(html.indexOf('src="background-messages.js"') < html.indexOf('src="app.js"'), 'Message constant must load before the app');
});

test('Extension markup and dynamic rendering keep CSP, XSS safety, and download-reopen restrictions', () => {
  assert(!/<script\b(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/i.test(html), 'Inline script found');
  assert(!/\son[a-z]+\s*=\s*['"][^'"]*['"]/i.test(html), 'Inline event handler found');
  assert(!appJs.includes('.innerHTML') && !appJs.includes('.outerHTML'), 'Unsafe HTML injection API found');
  assert(appJs.includes("setAttribute('marker-end', 'url(#branch-arrow)')"), 'Rendered connectors must show direction');
  assert(appJs.includes("elClearModal.addEventListener('keydown'"), 'Modal needs keyboard focus containment');
  assert(appJs.includes('api.runtime.sendMessage'), 'Clear operation must be serialized by the background context');
  assert(appJs.includes('if (uiLogic.isDownloadNode(node)) return;'), 'Download nodes must never invoke page reopening');
  assert(appJs.includes('elDetailsActions.hidden = true;'), 'Download details drawer must hide reopen controls');
});

test('Light and dark text color combinations meet WCAG AA contrast and CSS includes responsive & reduced-motion support', () => {
  const dark = rootThemeBlock(css, 1);
  const light = rootThemeBlock(css, 2);
  const darkBg = cssVariable(dark, '--color-bg');
  const lightBg = cssVariable(light, '--color-bg');
  const darkSurface = cssVariable(dark, '--color-surface');
  const lightSurface = cssVariable(light, '--color-surface');
  const darkPrimary = cssVariable(dark, '--color-primary');
  const lightPrimary = cssVariable(light, '--color-primary');
  const darkPrimaryHover = cssVariable(dark, '--color-primary-dark');
  const lightPrimaryHover = cssVariable(light, '--color-primary-dark');

  for (const [label, fg, bg] of [
    ['dark main text', cssVariable(dark, '--color-text-main'), darkBg],
    ['dark muted text', cssVariable(dark, '--color-text-muted'), darkSurface],
    ['dark subtle text', cssVariable(dark, '--color-text-subtle'), darkBg],
    ['dark URL text', darkPrimary, darkBg],
    ['dark button text', '#0F172A', darkPrimary],
    ['dark button hover text', '#FFFFFF', darkPrimaryHover],
    ['dark danger button text', cssVariable(dark, '--color-danger'), blend('#EF4444', darkSurface, 0.12)],
    ['dark danger hover text', '#FFFFFF', cssVariable(dark, '--color-danger-hover')],
    ['dark root badge', cssVariable(dark, '--color-badge-root-text'), blend('#0EA5E9', darkSurface, 0.15)],
    ['dark branch badge', cssVariable(dark, '--color-badge-branch-text'), blend('#6366F1', darkSurface, 0.15)],
    ['dark download badge', cssVariable(dark, '--color-badge-download-text'), blend('#10B981', darkSurface, 0.14)],
    ['dark unattributed badge', cssVariable(dark, '--color-badge-unattributed-text'), blend('#F59E0B', darkSurface, 0.14)],
    ['light main text', cssVariable(light, '--color-text-main'), lightBg],
    ['light muted text', cssVariable(light, '--color-text-muted'), lightSurface],
    ['light subtle text', cssVariable(light, '--color-text-subtle'), lightBg],
    ['light URL text', lightPrimary, lightBg],
    ['light button text', '#FFFFFF', lightPrimary],
    ['light button hover text', '#FFFFFF', lightPrimaryHover],
    ['light danger button text', cssVariable(light, '--color-danger'), blend('#EF4444', lightSurface, 0.12)],
    ['light danger hover text', '#FFFFFF', cssVariable(light, '--color-danger-hover')],
    ['light root badge', cssVariable(light, '--color-badge-root-text'), blend('#0EA5E9', lightSurface, 0.15)],
    ['light branch badge', cssVariable(light, '--color-badge-branch-text'), blend('#6366F1', lightSurface, 0.15)],
    ['light download badge', cssVariable(light, '--color-badge-download-text'), blend('#10B981', lightSurface, 0.14)],
    ['light unattributed badge', cssVariable(light, '--color-badge-unattributed-text'), blend('#F59E0B', lightSurface, 0.14)]
  ]) assertAa(label, fg, bg);
  assertAa('dark map hint', '#F8FAFC', blend('#0F172A', darkBg, 0.85));
  assertAa('light map hint', '#F8FAFC', blend('#0F172A', lightBg, 0.85));
  assert(css.includes(':focus-visible'), 'Keyboard focus styles are required');
  assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'Reduced motion support is required');
  assert(css.includes('@media (max-width: 900px)'), 'Responsive breakpoint for narrow viewports is required');
});

test('Three independent root treeIds produce exactly three overview cards', () => {
  const now = 1730000000000;
  const state = {
    schemaVersion: 2,
    nodes: {
      n1: { id: 'n1', treeId: 'tree_n1', nodeType: 'page', title: 'Quantum Computing', url: 'https://en.wikipedia.org/wiki/Quantum', timestamp: now - 3000, parentNodeId: null, childNodeIds: ['n1_c'] },
      n1_c: { id: 'n1_c', treeId: 'tree_n1', nodeType: 'page', title: 'Qubit', url: 'https://arxiv.org/abs/1', timestamp: now - 2000, parentNodeId: 'n1', childNodeIds: [] },
      n2: { id: 'n2', treeId: 'tree_n2', nodeType: 'page', title: 'GNN Survey', url: 'https://scholar.google.com/gnn', timestamp: now - 2500, parentNodeId: null, childNodeIds: [] },
      n3: { id: 'n3', treeId: 'tree_n3', nodeType: 'page', title: 'CSS Grid Guide', url: 'https://developer.mozilla.org/css-grid', timestamp: now - 1000, parentNodeId: null, childNodeIds: [] }
    },
    tabState: {
      '1': { currentNodeId: 'n1_c', historyStack: ['n1', 'n1_c'], historyIndex: 1 },
      '2': { currentNodeId: 'n3', historyStack: ['n3'], historyIndex: 0 }
    }
  };
  const summary = uiLogic.buildResearchTrees(state, { now });
  assert.strictEqual(summary.allTreesCount, 3);
  assert.strictEqual(summary.trees.length, 3, 'Three roots must produce exactly three overview cards');
  assert.deepStrictEqual(Array.from(summary.trees, (t) => t.treeId), ['tree_n3', 'tree_n1', 'tree_n2'], 'Cards should sort newest activity first');
  assert.strictEqual(summary.trees[1].domain, 'en.wikipedia.org');
  assert.strictEqual(summary.trees[1].visitCount, 2);
  assert.strictEqual(summary.trees[1].openTabCount, 1);
  assert.strictEqual(summary.totalVisitsCount, 4);
});

test('Multiple opener-created product tabs stay in one tree card and align as parallel siblings', () => {
  const now = 1730000100000;
  const state = {
    schemaVersion: 2,
    nodes: {
      search: { id: 'search', treeId: 'tree_search', nodeType: 'page', title: 'Keyboards Listing', url: 'https://www.amazon.com/s?k=keyboards', timestamp: now - 5000, parentNodeId: null, childNodeIds: ['p1', 'p2', 'p3'] },
      p1: { id: 'p1', treeId: 'tree_search', nodeType: 'page', title: 'Keychron Q1', url: 'https://www.amazon.com/dp/B01', timestamp: now - 4000, parentNodeId: 'search', childNodeIds: [] },
      p2: { id: 'p2', treeId: 'tree_search', nodeType: 'page', title: 'HHKB Hybrid', url: 'https://www.amazon.com/dp/B02', timestamp: now - 3000, parentNodeId: 'search', childNodeIds: [] },
      p3: { id: 'p3', treeId: 'tree_search', nodeType: 'page', title: 'Leopold FC660M', url: 'https://www.amazon.com/dp/B03', timestamp: now - 2000, parentNodeId: 'search', childNodeIds: [] }
    },
    tabState: {
      '10': { currentNodeId: 'search' },
      '11': { currentNodeId: 'p1' },
      '12': { currentNodeId: 'p2' },
      '13': { currentNodeId: 'p3' }
    }
  };

  const summary = uiLogic.buildResearchTrees(state, { now });
  assert.strictEqual(summary.trees.length, 1, 'Product tabs sharing one treeId must collapse to one overview card');
  assert.strictEqual(summary.trees[0].visitCount, 4);
  assert.strictEqual(summary.trees[0].branchCount, 3);
  assert.strictEqual(summary.trees[0].openTabCount, 4);
  assert.strictEqual(summary.trees[0].domain, 'amazon.com');

  const detail = uiLogic.buildTreeDetailView(state, 'tree_search', { now });
  const layout = uiLogic.computeGraphLayout(detail.nodesMap);
  const byId = Object.fromEntries(layout.layoutNodes.map((n) => [n.id, n]));
  assert.strictEqual(byId.p1.x, byId.p2.x);
  assert.strictEqual(byId.p2.x, byId.p3.x, 'Product child tabs must align at the same sibling depth');
  assert(byId.p1.y < byId.p2.y && byId.p2.y < byId.p3.y, 'Product siblings must fan vertically');
});

test('Back-to-parent same-tab branches remain in one card and render as siblings in detail view', () => {
  const now = 1730000200000;
  const state = {
    schemaVersion: 2,
    nodes: {
      wiki: { id: 'wiki', treeId: 'tree_wiki', nodeType: 'page', title: 'Wikipedia Portal', url: 'https://en.wikipedia.org/wiki/Main', timestamp: now - 4000, parentNodeId: null, childNodeIds: ['srcA', 'srcB'] },
      srcA: { id: 'srcA', treeId: 'tree_wiki', nodeType: 'page', title: 'Source A', url: 'https://phys.org/a', timestamp: now - 3000, parentNodeId: 'wiki', childNodeIds: [] },
      srcB: { id: 'srcB', treeId: 'tree_wiki', nodeType: 'page', title: 'Source B', url: 'https://nature.com/b', timestamp: now - 1000, parentNodeId: 'wiki', childNodeIds: [] }
    },
    tabState: {}
  };
  const summary = uiLogic.buildResearchTrees(state, { now });
  assert.strictEqual(summary.trees.length, 1);
  assert.strictEqual(summary.trees[0].branchCount, 2);

  const detail = uiLogic.buildTreeDetailView(state, 'tree_wiki', { now });
  const layout = uiLogic.computeGraphLayout(detail.nodesMap);
  const byId = Object.fromEntries(layout.layoutNodes.map((n) => [n.id, n]));
  assert.strictEqual(byId.srcA.x, byId.srcB.x);
  assert.strictEqual(byId.wiki.y, (byId.srcA.y + byId.srcB.y) / 2);
});

test('Detail scoping isolates one treeId without cross-tree leakage and app restores overview state', () => {
  const state = {
    schemaVersion: 2,
    nodes: {
      a1: { id: 'a1', treeId: 'tree_a', nodeType: 'page', title: 'Tree A Root', url: 'https://a.example/1', timestamp: 100, parentNodeId: null, childNodeIds: ['a2'] },
      a2: { id: 'a2', treeId: 'tree_a', nodeType: 'page', title: 'Tree A Leaf', url: 'https://a.example/2', timestamp: 200, parentNodeId: 'a1', childNodeIds: [] },
      b1: { id: 'b1', treeId: 'tree_b', nodeType: 'page', title: 'Tree B Root', url: 'https://b.example/1', timestamp: 300, parentNodeId: null, childNodeIds: [] }
    },
    tabState: {}
  };

  const detailA = uiLogic.buildTreeDetailView(state, 'tree_a');
  assert.deepStrictEqual(Array.from(detailA.nodesMap.keys()).sort(), ['a1', 'a2']);
  assert(!detailA.nodesMap.has('b1'), 'Selected tree detail view must exclude nodes from other treeIds');

  assert(appJs.includes('overviewFilters.scrollTop = elOverviewView.scrollTop;'), 'Must save overview scroll before opening detail');
  assert(appJs.includes('overviewFilters.focusedTreeId = treeId;'), 'Must save focused tree ID before opening detail');
  assert(appJs.includes('elOverviewView.scrollTop = overviewFilters.scrollTop || 0;'), 'Must restore overview scroll when returning');
  assert(appJs.includes('cardBtn.focus({ preventScroll: true });'), 'Must restore keyboard focus to opened tree card button');
});

test('Attributed downloads appear under verified source page while unattributed downloads stay in separate shelf', () => {
  const now = 1730000300000;
  const state = {
    schemaVersion: 2,
    nodes: {
      p1: { id: 'p1', treeId: 'tree_p1', nodeType: 'page', title: 'ArXiv Paper', url: 'https://arxiv.org/abs/2401.08922', timestamp: now - 60000, parentNodeId: null, childNodeIds: ['d1'] },
      d1: { id: 'd1', treeId: 'tree_p1', nodeType: 'download', filename: 'paper_08922.pdf', originDomain: 'arxiv.org', timestamp: now - 5000, parentNodeId: 'p1', childNodeIds: [], downloadId: 101 },
      dUnattr: { id: 'dUnattr', treeId: 'tree_dUnattr', nodeType: 'download', filename: 'dataset_raw.zip', originDomain: 'Source unavailable', timestamp: now - 1000, parentNodeId: null, childNodeIds: [], downloadId: 102 }
    },
    tabState: {}
  };

  const summary = uiLogic.buildResearchTrees(state, { now });
  assert.strictEqual(summary.trees.length, 1, 'Unattributed download must never generate a tree card');
  assert.strictEqual(summary.trees[0].treeId, 'tree_p1');
  assert.strictEqual(summary.trees[0].latestNode.id, 'd1', 'Attributed download newer than page visit must appear as latest activity');
  assert.strictEqual(summary.unattributedDownloads.length, 1);
  assert.strictEqual(summary.unattributedDownloads[0].filename, 'dataset_raw.zip');
  assert.strictEqual(summary.unattributedDownloads[0].originDomain, 'Source unavailable');

  const detail = uiLogic.buildTreeDetailView(state, 'tree_p1', { now });
  assert(detail.nodesMap.has('d1'), 'Attributed download must render inside its tree detail');
  assert(!detail.nodesMap.has('dUnattr'), 'Unattributed download must stay excluded from page trees');
  const layout = uiLogic.computeGraphLayout(detail.nodesMap);
  const dlLayout = layout.layoutNodes.find((n) => n.id === 'd1');
  assert.strictEqual(dlLayout.nodeType, 'download');
  assert.strictEqual(dlLayout.originDomain, 'arxiv.org');
  assert.strictEqual(layout.layoutEdges.some((e) => e.parentId === 'p1' && e.childId === 'd1'), true);
  assert(appJs.includes('Downloaded from ${origin}'), 'Download details drawer must label verified website provenance');
});

test('Global and tree-local filtering search titles/domains/files and preserve ancestry context without false parents', () => {
  const now = 1730000400000;
  const state = {
    schemaVersion: 2,
    nodes: {
      root: { id: 'root', treeId: 'tree_root', nodeType: 'page', title: 'Stanford HCI Group', url: 'https://hci.stanford.edu', timestamp: now - 3 * 60 * 60 * 1000, parentNodeId: null, childNodeIds: ['child', 'other'] },
      child: { id: 'child', treeId: 'tree_root', nodeType: 'page', title: 'ACM Spatial Notes', url: 'https://dl.acm.org/doi/1', timestamp: now - 10 * 60 * 1000, parentNodeId: 'root', childNodeIds: ['dlChild'] },
      dlChild: { id: 'dlChild', treeId: 'tree_root', nodeType: 'download', filename: 'spatial_notes.pdf', originDomain: 'dl.acm.org', timestamp: now - 5 * 60 * 1000, parentNodeId: 'child', childNodeIds: [], downloadId: 5 },
      other: { id: 'other', treeId: 'tree_root', nodeType: 'page', title: 'Unrelated Old Tab', url: 'https://example.org/old', timestamp: now - 5 * 60 * 60 * 1000, parentNodeId: 'root', childNodeIds: [] }
    },
    tabState: {}
  };

  // Global overview search across download filename and domain
  const fileSearch = uiLogic.buildResearchTrees(state, { query: 'spatial_notes.pdf', now });
  assert.strictEqual(fileSearch.trees.length, 1);
  assert.strictEqual(uiLogic.filterNodes(Object.values(state.nodes), 'dl.acm.org', 'all', now).length, 2);

  // Tree-local time filter ('hour') matches child + download; preserves root as context ancestor
  const detailHour = uiLogic.buildTreeDetailView(state, 'tree_root', { timeFilter: 'hour', now });
  assert.deepStrictEqual(Array.from(detailHour.matchedIds).sort(), ['child', 'dlChild']);
  assert.strictEqual(detailHour.contextAncestorIds.has('root'), true, 'Parent outside time filter must remain as context');
  assert.strictEqual(detailHour.nodesMap.has('other'), false, 'Non-matching sibling branch stays excluded');
  assert.strictEqual(detailHour.nodesMap.get('root').isContextAncestor, true);
  assert.strictEqual(detailHour.nodesMap.get('child').isContextAncestor, false);
});

test('Root-pruned trees keep one card and large or cyclic graphs render deterministically', () => {
  const now = 1730000500000;
  // Original root R was pruned; two children C1, C2 now have parentNodeId: null while keeping tree_R
  const prunedState = {
    schemaVersion: 2,
    nodes: {
      c1: { id: 'c1', treeId: 'tree_R', nodeType: 'page', title: 'Surviving Branch 1', url: 'https://example.org/c1', timestamp: now - 4000, parentNodeId: null, childNodeIds: [], isCheckpoint: true },
      c2: { id: 'c2', treeId: 'tree_R', nodeType: 'page', title: 'Surviving Branch 2', url: 'https://example.org/c2', timestamp: now - 2000, parentNodeId: null, childNodeIds: [], isCheckpoint: true }
    },
    tabState: {}
  };
  const summary = uiLogic.buildResearchTrees(prunedState, { now });
  assert.strictEqual(summary.trees.length, 1, 'Root-pruned tree must stay one card, not split into two');
  assert.strictEqual(summary.trees[0].rootPruned, true);
  assert.strictEqual(summary.trees[0].visualRootCount, 2);
  assert.strictEqual(summary.trees[0].visitCount, 2);

  // Large 301-node layout check
  const many = new Map();
  const childIds = Array.from({ length: 300 }, (_, index) => `child-${index}`);
  many.set('root', { id: 'root', timestamp: 0, parentNodeId: null, childNodeIds: childIds });
  childIds.forEach((id, index) => many.set(id, { id, timestamp: index + 1, parentNodeId: 'root', childNodeIds: [] }));
  const large = uiLogic.computeGraphLayout(many);
  assert.strictEqual(large.layoutNodes.length, 301);
  assert.strictEqual(large.layoutEdges.length, 300);

  // Cyclic graph safety
  const cyclic = new Map([
    ['X', { id: 'X', timestamp: 1, parentNodeId: 'Y', childNodeIds: ['Y'] }],
    ['Y', { id: 'Y', timestamp: 2, parentNodeId: 'X', childNodeIds: ['X'] }]
  ]);
  assert.strictEqual(uiLogic.computeGraphLayout(cyclic).layoutNodes.length, 2, 'Corrupt cycles should not produce a blank graph');
});

test('Production URL validation allows only HTTP and HTTPS', () => {
  for (const url of ['https://example.com/research', 'http://example.org/page#section']) {
    assert.strictEqual(uiLogic.isSafeHttpUrl(url), true, `${url} should be accepted`);
  }
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///C:/private', 'chrome://extensions', 'about:config', 'bad-url']) {
    assert.strictEqual(uiLogic.isSafeHttpUrl(url), false, `${url} should be rejected`);
  }
  assert(appJs.includes('uiLogic.isSafeHttpUrl(rawUrl)'), 'App must call production URL validation helper');
});

test('Clear-history message uses the background storage queue and resets graph plus tab links', async () => {
  const backend = storageModule.createMemoryStorage();
  const manager = new storageModule.StorageManager({ storageBackend: backend });
  await manager.recordVisit({ url: 'https://example.org/one', tabId: 5, timestamp: 1 });
  let listener;
  const runtime = { onMessage: { addListener(fn) { listener = fn; } } };
  assert.strictEqual(backgroundMessages.registerClearHistoryListener(runtime, manager), true);
  assert.strictEqual(listener({ type: 'other' }, {}, () => {}), undefined, 'Unrelated messages should be ignored');
  const response = await new Promise((resolve) => {
    assert.strictEqual(listener({ type: backgroundMessages.CLEAR_HISTORY_MESSAGE }, {}, resolve), true);
  });
  assert.strictEqual(response.ok, true);
  const state = await manager.getState();
  assert.deepStrictEqual(Object.keys(state.nodes), []);
  assert.deepStrictEqual(Object.keys(state.tabState), []);
});

test('Narrow responsive reflow layout produces readable node bounding boxes and preserves sibling & download hierarchy', () => {
  const now = 1730000600000;
  const state = {
    schemaVersion: 2,
    nodes: {
      wiki: { id: 'wiki', treeId: 'tree_wiki', nodeType: 'page', title: 'Wikipedia Portal', url: 'http://localhost/wiki', timestamp: now - 5000, parentNodeId: null, childNodeIds: ['srcA', 'srcB'] },
      srcA: { id: 'srcA', treeId: 'tree_wiki', nodeType: 'page', title: 'Source A Document', url: 'http://localhost/source-a', timestamp: now - 4000, parentNodeId: 'wiki', childNodeIds: [] },
      srcB: { id: 'srcB', treeId: 'tree_wiki', nodeType: 'page', title: 'Source B Document', url: 'http://localhost/source-b', timestamp: now - 3000, parentNodeId: 'wiki', childNodeIds: ['dlPortal'] },
      dlPortal: { id: 'dlPortal', treeId: 'tree_wiki', nodeType: 'page', title: 'Download Portal', url: 'http://localhost/download-portal', timestamp: now - 2000, parentNodeId: 'srcB', childNodeIds: ['pdf', 'ambig'] },
      pdf: { id: 'pdf', treeId: 'tree_wiki', nodeType: 'download', filename: 'research_paper.pdf', originDomain: 'localhost', timestamp: now - 1000, parentNodeId: 'dlPortal', childNodeIds: [], downloadId: 201 },
      ambig: { id: 'ambig', treeId: 'tree_wiki', nodeType: 'page', title: 'Ambiguous Page', url: 'http://localhost/ambiguous-page', timestamp: now - 500, parentNodeId: 'dlPortal', childNodeIds: [] }
    },
    tabState: {}
  };

  const detail = uiLogic.buildTreeDetailView(state, 'tree_wiki', { now });
  assert.strictEqual(detail.nodesMap.size, 6);

  const reflow = uiLogic.computeGraphLayout(detail.nodesMap, { layoutMode: 'reflow' });
  assert.strictEqual(reflow.layoutNodes.length, 6, 'Must layout all 6 nodes in reflow mode');
  assert.strictEqual(reflow.layoutEdges.length, 5, 'Must maintain all 5 parent-child edges');

  const byId = Object.fromEntries(reflow.layoutNodes.map((n) => [n.id, n]));
  // Siblings have identical indent and distinct Y positions
  assert.strictEqual(byId.srcA.x, byId.srcB.x, 'Source A and Source B siblings must have identical indentation');
  assert(byId.srcA.x > byId.wiki.x, 'Source A and B must be indented relative to Wikipedia root');
  assert(byId.srcA.y < byId.srcB.y, 'Source A and Source B must occupy distinct vertical rows');
  assert.strictEqual(byId.pdf.x, byId.ambig.x, 'Download and sibling page must share indentation under Download Portal');
  assert(byId.pdf.x > byId.dlPortal.x, 'Download node must be indented relative to Download Portal parent');
  assert(byId.pdf.y < byId.ambig.y, 'Download and sibling must occupy distinct vertical rows');

  // Verify bounding box and legible Fit scale at 420x800 container
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of reflow.layoutNodes) {
    minX = Math.min(minX, n.x - 110);
    maxX = Math.max(maxX, n.x + 110);
    minY = Math.min(minY, n.y - 22);
    maxY = Math.max(maxY, n.y + 22);
  }
  const graphW = maxX - minX + 48;
  const graphH = maxY - minY + 48;
  const containerW = 420;
  const containerH = 640;
  const scale = Math.min(Math.min(containerW / graphW, containerH / graphH), 1.05);

  assert(scale >= 0.95, `Reflow scale at 420x800 must be >= 0.95 for full legibility, got ${scale}`);
  const effectiveTitlePx = 13 * scale;
  const effectiveSubPx = 10.5 * scale;
  assert(effectiveTitlePx >= 12.0, `Effective title font size must be >= 12px, got ${effectiveTitlePx}px`);
  assert(effectiveSubPx >= 9.8, `Effective sub font size must be >= 9.8px, got ${effectiveSubPx}px`);
  assert(maxX <= containerW, `Max X (${maxX}) must not exceed narrow container width (420)`);
});

test('Large and deep trees in narrow reflow layout maintain bounded horizontal indents and valid navigation coordinates', () => {
  const nodesMap = new Map();
  // Build an 8-level deep tree with 14 nodes and branching
  nodesMap.set('r0', { id: 'r0', treeId: 'tree_deep', timestamp: 100, parentNodeId: null, childNodeIds: ['c1_a', 'c1_b'] });
  nodesMap.set('c1_a', { id: 'c1_a', treeId: 'tree_deep', timestamp: 200, parentNodeId: 'r0', childNodeIds: [] });
  nodesMap.set('c1_b', { id: 'c1_b', treeId: 'tree_deep', timestamp: 300, parentNodeId: 'r0', childNodeIds: ['c2'] });
  nodesMap.set('c2', { id: 'c2', treeId: 'tree_deep', timestamp: 400, parentNodeId: 'c1_b', childNodeIds: ['c3_a', 'c3_b'] });
  nodesMap.set('c3_a', { id: 'c3_a', treeId: 'tree_deep', timestamp: 500, parentNodeId: 'c2', childNodeIds: [] });
  nodesMap.set('c3_b', { id: 'c3_b', treeId: 'tree_deep', timestamp: 600, parentNodeId: 'c2', childNodeIds: ['c4'] });
  nodesMap.set('c4', { id: 'c4', treeId: 'tree_deep', timestamp: 700, parentNodeId: 'c3_b', childNodeIds: ['c5'] });
  nodesMap.set('c5', { id: 'c5', treeId: 'tree_deep', timestamp: 800, parentNodeId: 'c4', childNodeIds: ['c6'] });
  nodesMap.set('c6', { id: 'c6', treeId: 'tree_deep', timestamp: 900, parentNodeId: 'c5', childNodeIds: ['c7_a', 'c7_b'] });
  nodesMap.set('c7_a', { id: 'c7_a', treeId: 'tree_deep', timestamp: 1000, parentNodeId: 'c6', childNodeIds: [] });
  nodesMap.set('c7_b', { id: 'c7_b', treeId: 'tree_deep', timestamp: 1100, parentNodeId: 'c6', childNodeIds: ['c8'] });
  nodesMap.set('c8', { id: 'c8', treeId: 'tree_deep', timestamp: 1200, parentNodeId: 'c7_b', childNodeIds: ['c9_dl'] });
  nodesMap.set('c9_dl', { id: 'c9_dl', treeId: 'tree_deep', nodeType: 'download', filename: 'deep_asset.zip', originDomain: 'deep.org', timestamp: 1300, parentNodeId: 'c8', childNodeIds: [], downloadId: 901 });

  const reflow = uiLogic.computeGraphLayout(nodesMap, { layoutMode: 'reflow', maxIndent: 130 });
  assert.strictEqual(reflow.layoutNodes.length, 13);
  assert.strictEqual(reflow.layoutEdges.length, 12);

  // Assert maximum horizontal indent bound is enforced
  for (const n of reflow.layoutNodes) {
    const rightEdge = n.x + 110;
    assert(rightEdge <= 400, `Right edge ${rightEdge} must not exceed bounded width (400px)`);
    assert(Number.isFinite(n.x) && Number.isFinite(n.y), 'Coordinates must be finite numbers');
  }

  // Row Y coordinates strictly increase
  for (let i = 1; i < reflow.layoutNodes.length; i++) {
    assert(reflow.layoutNodes[i].y > reflow.layoutNodes[i - 1].y, 'Reflow layout nodes must be vertically ordered');
  }
});

await Promise.all(pendingTests);
console.log(`\nUI Test Verification Complete: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
