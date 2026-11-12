/**
 * Spatial Browser History - UI logic and structure tests.
 * Pure layout, filtering, URL, and background message helpers are loaded from
 * the same production files used by the extension. DOM interactions still need
 * the browser smoke checks recorded in docs/TEST_PLAN.md.
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

console.log('=== Running Task 3 UI Logic & Structure Tests ===\n');

test('Map controls, dialog semantics, lineage buttons, and script ordering are present', () => {
  for (const id of [
    'search-input', 'search-clear-btn', 'time-filter', 'zoom-in', 'zoom-out', 'zoom-reset',
    'clear-map-btn', 'clear-modal', 'confirm-clear-btn', 'cancel-clear-btn', 'map-svg',
    'map-viewport', 'edges-layer', 'nodes-layer', 'empty-state', 'no-results-state',
    'details-panel', 'details-parent', 'details-children', 'reopen-btn', 'details-close-btn'
  ]) assert(html.includes(`id="${id}"`), `Missing ${id}`);
  assert(html.includes('id="details-parent" type="button"'), 'Parent lineage must be a keyboard-operable button');
  assert(html.includes('aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description"'), 'Clear dialog needs an accessible name and description');
  assert(html.indexOf('src="storage.js"') < html.indexOf('src="ui-logic.js"'), 'Storage helper must load first');
  assert(html.indexOf('src="ui-logic.js"') < html.indexOf('src="app.js"'), 'UI logic must load before the app');
  assert(html.indexOf('src="background-messages.js"') < html.indexOf('src="app.js"'), 'Message constant must load before the app');
});

test('Extension markup and dynamic rendering keep CSP and text safety', () => {
  assert(!/<script\b(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/i.test(html), 'Inline script found');
  assert(!/\son[a-z]+\s*=\s*['"][^'"]*['"]/i.test(html), 'Inline event handler found');
  assert(!appJs.includes('.innerHTML') && !appJs.includes('.outerHTML'), 'Unsafe HTML injection API found');
  assert(appJs.includes("setAttribute('marker-end', 'url(#branch-arrow)')"), 'Rendered connectors must show direction');
  assert(appJs.includes('elClearModal.addEventListener(\'keydown\''), 'Modal needs keyboard focus containment');
  assert(appJs.includes('api.runtime.sendMessage'), 'Clear operation must be serialized by the background context');
});

test('Light and dark text color combinations meet WCAG AA normal-text contrast', () => {
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
    ['light main text', cssVariable(light, '--color-text-main'), lightBg],
    ['light muted text', cssVariable(light, '--color-text-muted'), lightSurface],
    ['light subtle text', cssVariable(light, '--color-text-subtle'), lightBg],
    ['light URL text', lightPrimary, lightBg],
    ['light button text', '#FFFFFF', lightPrimary],
    ['light button hover text', '#FFFFFF', lightPrimaryHover],
    ['light danger button text', cssVariable(light, '--color-danger'), blend('#EF4444', lightSurface, 0.12)],
    ['light danger hover text', '#FFFFFF', cssVariable(light, '--color-danger-hover')],
    ['light root badge', cssVariable(light, '--color-badge-root-text'), blend('#0EA5E9', lightSurface, 0.15)],
    ['light branch badge', cssVariable(light, '--color-badge-branch-text'), blend('#6366F1', lightSurface, 0.15)]
  ]) assertAa(label, fg, bg);
  assertAa('dark map hint', '#F8FAFC', blend('#0F172A', darkBg, 0.85));
  assertAa('light map hint', '#F8FAFC', blend('#0F172A', lightBg, 0.85));
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

test('Production forest layout keeps branches separated and renders large and cyclic graphs', () => {
  const graph = new Map([
    ['A', { id: 'A', timestamp: 100, parentNodeId: null, childNodeIds: ['B', 'C'] }],
    ['B', { id: 'B', timestamp: 200, parentNodeId: 'A', childNodeIds: [] }],
    ['C', { id: 'C', timestamp: 300, parentNodeId: 'A', childNodeIds: ['D'] }],
    ['D', { id: 'D', timestamp: 400, parentNodeId: 'C', childNodeIds: [] }],
    ['E', { id: 'E', timestamp: 500, parentNodeId: null, childNodeIds: [] }]
  ]);
  const result = uiLogic.computeGraphLayout(graph);
  const byId = Object.fromEntries(result.layoutNodes.map((node) => [node.id, node]));
  assert.strictEqual(byId.A.x, 80);
  assert.strictEqual(byId.B.x, 350);
  assert.strictEqual(byId.D.x, 620);
  assert.strictEqual(byId.A.y, (byId.B.y + byId.C.y) / 2);
  assert(byId.E.y > byId.C.y, 'Independent tree should be spaced below the first');
  assert.strictEqual(result.layoutEdges.length, 3);
  assert.strictEqual(result.layoutNodes[0].id, 'B', 'Keyboard order should follow map reading order');

  const many = new Map();
  const childIds = Array.from({ length: 300 }, (_, index) => `child-${index}`);
  many.set('root', { id: 'root', timestamp: 0, parentNodeId: null, childNodeIds: childIds });
  childIds.forEach((id, index) => many.set(id, { id, timestamp: index + 1, parentNodeId: 'root', childNodeIds: [] }));
  const large = uiLogic.computeGraphLayout(many);
  assert.strictEqual(large.layoutNodes.length, 301);
  assert.strictEqual(large.layoutEdges.length, 300);

  const cyclic = new Map([
    ['X', { id: 'X', timestamp: 1, parentNodeId: 'Y', childNodeIds: ['Y'] }],
    ['Y', { id: 'Y', timestamp: 2, parentNodeId: 'X', childNodeIds: ['X'] }]
  ]);
  assert.strictEqual(uiLogic.computeGraphLayout(cyclic).layoutNodes.length, 2, 'Corrupt cycles should not produce a blank graph');
});

test('Production filtering searches title/address and applies time ranges', () => {
  const now = 1700000000000;
  const nodes = [
    { id: '1', title: 'Stanford HCI Group', url: 'https://hci.stanford.edu', timestamp: now - 10 * 60 * 1000 },
    { id: '2', title: 'ACM Digital Library', url: 'https://dl.acm.org/doi/10.1145', timestamp: now - 120 * 60 * 1000 },
    { id: '3', title: 'Wikipedia Spatial Memory', url: 'https://en.wikipedia.org/wiki/Spatial_memory', timestamp: now - 48 * 60 * 60 * 1000 }
  ];
  assert.strictEqual(uiLogic.filterNodes(nodes, '', 'all', now).length, 3);
  assert.deepStrictEqual(Array.from(uiLogic.filterNodes(nodes, 'stanford', 'all', now), (node) => node.id), ['1']);
  assert.deepStrictEqual(Array.from(uiLogic.filterNodes(nodes, 'wikipedia.org', 'all', now), (node) => node.id), ['3']);
  assert.strictEqual(uiLogic.filterNodes(nodes, '', 'hour', now).length, 1);
  assert.strictEqual(uiLogic.filterNodes(nodes, '', 'day', now).length, 2);
  assert.strictEqual(uiLogic.filterNodes(nodes, '', 'week', now).length, 3);
  assert.strictEqual(uiLogic.filterNodes(nodes, 'missing', 'all', now).length, 0);
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

test('App implements first-render fitting, filter selection cleanup, dialog focus handling, and button lineage', () => {
  assert(appJs.includes('if (needsInitialFit)'), 'Initial history should be fit to the visible map');
  assert(appJs.includes('Math.max(0.003, Math.min(scaleX, scaleY))'), 'Large graphs need a small fit-scale floor');
  assert(appJs.includes('if (selectedNodeId && !activeNodesMap.has(selectedNodeId))'), 'Filtered-out selection should close');
  assert(appJs.includes('childPill.type = \'button\''), 'Child lineage controls need keyboard semantics');
  assert(appJs.includes("closeDetailsPanel(true)"), 'Closing details should return focus to the selected node');
  assert(appJs.includes('elCancelClearBtn.disabled = true'), 'Dialog actions should not escape focus during clear');
  assert(css.includes(':focus-visible'), 'Keyboard focus styles are required');
});

await Promise.all(pendingTests);
console.log(`\nUI Test Verification Complete: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
