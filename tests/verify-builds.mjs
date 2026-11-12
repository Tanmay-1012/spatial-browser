/**
 * Spatial Browser History - Automated Verification Suite
 * Tests manifest validity, security constraints, asset parity, and toolbar launch logic.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const OUTPUTS_DIR = path.join(ROOT_DIR, 'outputs');
const CHROME_OUT = path.join(OUTPUTS_DIR, 'chrome', 'unpacked');
const FIREFOX_OUT = path.join(OUTPUTS_DIR, 'firefox', 'unpacked');
const SHARED_SRC = path.join(ROOT_DIR, 'src', 'shared');

function listFilesRecursive(rootDir, currentDir = rootDir) {
  return fs.readdirSync(currentDir, { withFileTypes: true })
    .filter((entry) => entry.name !== '.gitkeep')
    .flatMap((entry) => {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) return listFilesRecursive(rootDir, absolutePath);
      return [path.relative(rootDir, absolutePath)];
    })
    .sort();
}

// Import launch.js dynamically
await import(pathToFileURL(path.join(ROOT_DIR, 'src', 'shared', 'launch.js')).href);
const { openOrFocusPage } = globalThis;

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    testsFailed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    testsFailed++;
  }
}

console.log('=== Running Build & Manifest Verification ===\n');

// 1. Output directory structure
runTest('Outputs exist with all required build artifacts', () => {
  assert(fs.existsSync(CHROME_OUT), 'Chrome unpacked directory missing');
  assert(fs.existsSync(FIREFOX_OUT), 'Firefox unpacked directory missing');

  const chromeZip = path.join(OUTPUTS_DIR, 'chrome', 'spatial-browser-history-extension.zip');
  const firefoxZip = path.join(OUTPUTS_DIR, 'firefox', 'spatial-browser-history-firefox.zip');
  const firefoxXpi = path.join(OUTPUTS_DIR, 'firefox', 'spatial-browser-history-firefox.xpi');
  const checksumsFile = path.join(OUTPUTS_DIR, 'SHA256SUMS');

  assert(fs.existsSync(chromeZip) && fs.statSync(chromeZip).size > 1000, 'Chrome zip missing or empty');
  assert(fs.existsSync(firefoxZip) && fs.statSync(firefoxZip).size > 1000, 'Firefox zip missing or empty');
  assert(fs.existsSync(firefoxXpi) && fs.statSync(firefoxXpi).size > 1000, 'Firefox xpi missing or empty');
  assert(fs.existsSync(checksumsFile) && fs.statSync(checksumsFile).size > 0, 'SHA256SUMS file missing or empty');

  // Verify SHA256SUMS contents
  const checksumsText = fs.readFileSync(checksumsFile, 'utf8');
  const cHash = crypto.createHash('sha256').update(fs.readFileSync(chromeZip)).digest('hex');
  const fzHash = crypto.createHash('sha256').update(fs.readFileSync(firefoxZip)).digest('hex');
  const fxHash = crypto.createHash('sha256').update(fs.readFileSync(firefoxXpi)).digest('hex');

  assert(checksumsText.includes(`${cHash}  chrome/spatial-browser-history-extension.zip`), 'Chrome zip hash mismatch in SHA256SUMS');
  assert(checksumsText.includes(`${fzHash}  firefox/spatial-browser-history-firefox.zip`), 'Firefox zip hash mismatch in SHA256SUMS');
  assert(checksumsText.includes(`${fxHash}  firefox/spatial-browser-history-firefox.xpi`), 'Firefox xpi hash mismatch in SHA256SUMS');

  // Verify tracker and storage in outputs
  assert(fs.existsSync(path.join(CHROME_OUT, 'storage.js')), 'Chrome storage.js missing');
  assert(fs.existsSync(path.join(CHROME_OUT, 'tracker.js')), 'Chrome tracker.js missing');
  assert(fs.existsSync(path.join(FIREFOX_OUT, 'storage.js')), 'Firefox storage.js missing');
  assert(fs.existsSync(path.join(FIREFOX_OUT, 'tracker.js')), 'Firefox tracker.js missing');
});

runTest('Release archives match unpacked builds and contain no extraneous, test, or profile files', () => {
  const pythonScript = `
import zipfile, os, json, sys

outputs_dir = sys.argv[1]
targets = [
    ('chrome/spatial-browser-history-extension.zip', 'chrome/unpacked', 'chrome'),
    ('firefox/spatial-browser-history-firefox.zip', 'firefox/unpacked', 'firefox'),
    ('firefox/spatial-browser-history-firefox.xpi', 'firefox/unpacked', 'firefox')
]

for arch_name, unp_dir, browser_type in targets:
    arch_path = os.path.join(outputs_dir, arch_name)
    unp_path = os.path.join(outputs_dir, unp_dir)
    assert os.path.exists(arch_path), f'Missing {arch_name}'
    with zipfile.ZipFile(arch_path, 'r') as zf:
        namelist = zf.namelist()
        for item in namelist:
            assert not item.startswith('.') and not item.endswith('.tmp'), f'Suspicious entry: {item}'
            assert not any(p in item for p in ['test', 'tests', 'script', 'profile', 'node_modules']), f'Unwanted file: {item}'
            arch_bytes = zf.read(item)
            local_file = os.path.join(unp_path, item.replace('/', os.sep))
            assert os.path.exists(local_file), f'File {item} not found in unpacked {unp_dir}'
            with open(local_file, 'rb') as f:
                unp_bytes = f.read()
            assert arch_bytes == unp_bytes, f'Byte mismatch for {item} in {arch_name}'
        
        manifest_data = json.loads(zf.read('manifest.json').decode('utf-8'))
        assert manifest_data['manifest_version'] == 3
        if browser_type == 'chrome':
            assert manifest_data['background']['service_worker'] == 'background.js'
            assert manifest_data.get('browser_specific_settings') is None
        elif browser_type == 'firefox':
            assert manifest_data['browser_specific_settings']['gecko']['id'] == 'spatial-browser-history@term-project.local'
            assert 'background.js' in manifest_data['background']['scripts']
`;

  execFileSync('python', ['-c', pythonScript, path.join(ROOT_DIR, 'outputs')]);
});

runTest('Every shared source asset is copied identically into both builds', () => {
  const files = listFilesRecursive(SHARED_SRC);
  assert(files.length > 0, 'Shared source directory is empty');
  for (const file of files) {
    const source = fs.readFileSync(path.join(SHARED_SRC, file));
    const chrome = fs.readFileSync(path.join(CHROME_OUT, file));
    const firefox = fs.readFileSync(path.join(FIREFOX_OUT, file));
    assert(source.equals(chrome), `Chrome build differs from shared source: ${file}`);
    assert(source.equals(firefox), `Firefox build differs from shared source: ${file}`);
  }
});

// 2. Manifest checks
runTest('Chrome manifest adheres to MV3 specifications and declared permissions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(CHROME_OUT, 'manifest.json'), 'utf8'));
  assert.strictEqual(manifest.manifest_version, 3);
  assert.strictEqual(manifest.minimum_chrome_version, '109');
  assert(manifest.background && manifest.background.service_worker === 'background.js');
  assert(manifest.action && !manifest.action.default_popup, 'Action must not have default_popup to trigger onClicked');
  assert.deepStrictEqual(manifest.permissions, ['tabs', 'storage', 'webNavigation', 'downloads']);
  assert.strictEqual(manifest.browser_specific_settings, undefined);
});

runTest('Firefox manifest adheres to MV3 specifications and declared permissions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX_OUT, 'manifest.json'), 'utf8'));
  assert.strictEqual(manifest.manifest_version, 3);
  assert(manifest.browser_specific_settings && manifest.browser_specific_settings.gecko);
  assert.strictEqual(manifest.browser_specific_settings.gecko.id, 'spatial-browser-history@term-project.local');
  assert.strictEqual(manifest.browser_specific_settings.gecko.strict_min_version, '115.0');
  assert(manifest.background && Array.isArray(manifest.background.scripts));
  assert(manifest.background.scripts.includes('launch.js'));
  assert(manifest.background.scripts.includes('storage.js'));
  assert(manifest.background.scripts.includes('tracker.js'));
  assert(manifest.background.scripts.includes('background.js'));
  assert(manifest.action && !manifest.action.default_popup, 'Action must not have default_popup to trigger onClicked');
  assert.deepStrictEqual(manifest.permissions, ['tabs', 'storage', 'webNavigation', 'downloads']);
});

// 3. Security and CSP checks
runTest('index.html complies with Extension MV3 CSP and contains empty state', () => {
  const html = fs.readFileSync(path.join(CHROME_OUT, 'index.html'), 'utf8');

  // No inline script tags
  const inlineScriptRegex = /<script\b(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
  assert(!inlineScriptRegex.test(html), 'MV3 CSP violation: inline <script> found in index.html');

  // No inline event handlers
  const inlineHandlerRegex = /\son[a-z]+\s*=\s*['"][^'"]*['"]/gi;
  assert(!inlineHandlerRegex.test(html), 'MV3 CSP violation: inline event handler found in index.html');

  // Placeholder and empty state contents
  assert(html.includes('No Browsing Map Yet'), 'index.html missing empty state title');
  assert(html.includes('id="placeholder-heading"'), 'index.html missing accessible placeholder heading');
  assert(html.includes('app.js'), 'index.html must load app.js via external src');
});

runTest('app.js does not execute unescaped innerHTML', () => {
  const appJs = fs.readFileSync(path.join(CHROME_OUT, 'app.js'), 'utf8');
  assert(!appJs.includes('.innerHTML'), 'XSS precaution: app.js should not assign innerHTML');
});

// 4. Icons verification
runTest('All referenced icons exist and have valid PNG signatures', () => {
  const iconSizes = [16, 32, 48, 128];
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  for (const buildDir of [CHROME_OUT, FIREFOX_OUT]) {
    for (const size of iconSizes) {
      const iconPath = path.join(buildDir, 'icons', `icon-${size}.png`);
      assert(fs.existsSync(iconPath), `Missing icon: ${iconPath}`);
      const buf = fs.readFileSync(iconPath);
      assert(buf.subarray(0, 8).equals(pngHeader), `Invalid PNG header in ${iconPath}`);
    }
  }
});

// 5. Simulated Toolbar Launch and Focus Behavior
console.log('\n=== Testing Toolbar Launch and Focus Behavior ===\n');

function createMockExtensionApi(initialTabs = []) {
  let tabs = initialTabs.map((t, idx) => ({ id: idx + 1, windowId: 100, ...t }));
  let windows = [{ id: 100, focused: true }];
  let nextTabId = tabs.length + 1;
  const calls = {
    tabsCreate: [],
    tabsUpdate: [],
    windowsUpdate: []
  };

  return {
    calls,
    runtime: {
      getURL(file) {
        return `chrome-extension://mock-extension-id/${file}`;
      }
    },
    tabs: {
      async query(queryInfo) {
        return tabs.filter(tab => {
          if (queryInfo.url && tab.url !== queryInfo.url) return false;
          return true;
        });
      },
      async create(createProperties) {
        calls.tabsCreate.push(createProperties);
        const newTab = {
          id: nextTabId++,
          windowId: 100,
          url: createProperties.url,
          active: true
        };
        tabs.push(newTab);
        return newTab;
      },
      async update(tabId, updateProperties) {
        calls.tabsUpdate.push({ tabId, updateProperties });
        const tab = tabs.find(t => t.id === tabId);
        if (tab && updateProperties.active !== undefined) {
          tab.active = updateProperties.active;
        }
        return tab;
      }
    },
    windows: {
      async update(windowId, updateProperties) {
        calls.windowsUpdate.push({ windowId, updateProperties });
        const win = windows.find(w => w.id === windowId);
        if (win && updateProperties.focused !== undefined) {
          win.focused = updateProperties.focused;
        }
        return win;
      }
    }
  };
}

await runAsyncTest('Opens new tab when placeholder page is not already open', async () => {
  const mockApi = createMockExtensionApi([
    { url: 'https://example.com/research' },
    { url: 'https://wikipedia.org/wiki/Spatial_memory' }
  ]);

  const result = await openOrFocusPage('index.html', mockApi);
  assert.strictEqual(result.action, 'created');
  assert.strictEqual(mockApi.calls.tabsCreate.length, 1);
  assert.strictEqual(mockApi.calls.tabsCreate[0].url, 'chrome-extension://mock-extension-id/index.html');
  assert.strictEqual(mockApi.calls.tabsUpdate.length, 0);
});

await runAsyncTest('Focuses existing tab when placeholder page is already open', async () => {
  const placeholderUrl = 'chrome-extension://mock-extension-id/index.html';
  const mockApi = createMockExtensionApi([
    { url: 'https://example.com/research' },
    { id: 42, windowId: 200, url: placeholderUrl, active: false }
  ]);

  const result = await openOrFocusPage('index.html', mockApi);
  assert.strictEqual(result.action, 'focused');
  assert.strictEqual(mockApi.calls.tabsCreate.length, 0, 'Must NOT create duplicate tab');
  assert.strictEqual(mockApi.calls.tabsUpdate.length, 1);
  assert.strictEqual(mockApi.calls.tabsUpdate[0].updateProperties.active, true);
  assert.strictEqual(mockApi.calls.windowsUpdate.length, 1);
  assert.strictEqual(mockApi.calls.windowsUpdate[0].updateProperties.focused, true);
});

await runAsyncTest('Repeated clicks: first click opens, second click focuses existing tab', async () => {
  const mockApi = createMockExtensionApi([]);

  // First click
  const first = await openOrFocusPage('index.html', mockApi);
  assert.strictEqual(first.action, 'created');
  assert.strictEqual(mockApi.calls.tabsCreate.length, 1);
  assert.strictEqual(mockApi.calls.tabsUpdate.length, 0);

  // Second click (simulating user clicking toolbar icon again)
  const second = await openOrFocusPage('index.html', mockApi);
  assert.strictEqual(second.action, 'focused');
  assert.strictEqual(mockApi.calls.tabsCreate.length, 1, 'Tabs create must remain 1 after second click');
  assert.strictEqual(mockApi.calls.tabsUpdate.length, 1, 'Tabs update must be called on second click');
  assert.strictEqual(second.tabId, first.tabId);
});

await runAsyncTest('Simultaneous toolbar clicks do not open duplicate tabs', async () => {
  const mockApi = createMockExtensionApi([]);
  const results = await Promise.all([
    openOrFocusPage('index.html', mockApi),
    openOrFocusPage('index.html', mockApi)
  ]);
  assert.strictEqual(mockApi.calls.tabsCreate.length, 1);
  assert.strictEqual(results[0].tabId, results[1].tabId);
});

console.log(`\nVerification complete: ${testsPassed} passed, ${testsFailed} failed.\n`);
if (testsFailed > 0) {
  process.exit(1);
}
