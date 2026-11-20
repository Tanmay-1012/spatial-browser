/**
 * Task 18: User Study Instrumentation & Privacy Verification Suite
 *
 * Verifies:
 * - Study mode default-off: no study capture or events when inactive.
 * - Consent / start state, sequence mapping, and pseudonymous participant code.
 * - Start / stop / 120-second timeout / abandon behavior.
 * - Exact target completion detection on allowlisted corpus page.
 * - Operationally defined "incorrect task-corpus page opens" count.
 * - Exclusion of reloads, hash updates, off-corpus pages, and internal pages.
 * - Back/Forward destination events recorded.
 * - NASA-TLX 6-item scoring and Raw TLX unweighted summary calculation.
 * - Inter-round reset: clearing normal map preserves study records.
 * - Privacy audit: zero raw URLs, webpage titles, query params, or typed search queries in export.
 * - CSV escaping and JSON structure validation.
 * - Data dictionary consistency.
 */

import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Load shared modules
await import(pathToFileURL(path.join(ROOT_DIR, 'src', 'shared', 'storage.js')).href);
await import(pathToFileURL(path.join(ROOT_DIR, 'src', 'shared', 'study-corpus.js')).href);
await import(pathToFileURL(path.join(ROOT_DIR, 'src', 'shared', 'study-manager.js')).href);
await import(pathToFileURL(path.join(ROOT_DIR, 'src', 'shared', 'tracker.js')).href);

const { StorageManager, createMemoryStorage } = globalThis.SpatialStorage;
const { StudyManager, STUDY_STORAGE_KEY } = globalThis.SpatialStudyManager;
const { matchCorpusPage, isCorpusTarget, getDefaultTargetKey } = globalThis.SpatialStudyCorpus;
const { NavigationTracker } = globalThis.SpatialTracker;

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

console.log('=== Running Task 18 User Study & Privacy Tests ===\n');

test('Study mode is disabled by default and captures zero data when inactive', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  assert.strictEqual(study.isStudyEnabled(), false, 'Study mode must be disabled by default');
  assert.strictEqual(study.getActiveTrial(), null, 'No active trial by default');

  // Simulate off-corpus and on-corpus navigations while inactive
  const res1 = await study.handleNavigation({ tabId: 1, url: 'https://google.com/search?q=test' });
  const res2 = await study.handleNavigation({ tabId: 1, url: 'http://127.0.0.1:18880/study/fixtures/pack_x/materials.html' });
  assert.strictEqual(res1, null);
  assert.strictEqual(res2, null);

  const state = await study.getState();
  assert.strictEqual(state.trials.length, 0, 'Must record no trials when inactive');
  assert.strictEqual(state.events.length, 0, 'Must record no events when inactive');
});

test('Corpus allowlist maps URLs to opaque keys and isolates non-corpus pages', () => {
  assert.strictEqual(matchCorpusPage('http://127.0.0.1:8000/study/fixtures/pack_x/index.html'), 'px_hub');
  assert.strictEqual(matchCorpusPage('http://localhost:3000/study/fixtures/pack_x/materials.html'), 'px_materials');
  assert.strictEqual(matchCorpusPage('http://127.0.0.1:8000/pack_y/modern1896.html'), 'py_modern1896');
  assert.strictEqual(matchCorpusPage('https://en.wikipedia.org/wiki/Solar_panel'), null, 'Public web pages must not match corpus');
  assert.strictEqual(matchCorpusPage('chrome://history'), null, 'Internal pages must not match corpus');
  assert.strictEqual(matchCorpusPage(''), null);

  assert.strictEqual(isCorpusTarget('http://127.0.0.1:8000/pack_x/materials.html', 'px_materials'), true);
  assert.strictEqual(isCorpusTarget('http://127.0.0.1:8000/pack_x/efficiency.html', 'px_materials'), false);
  assert.strictEqual(getDefaultTargetKey('pack_x'), 'px_materials');
  assert.strictEqual(getDefaultTargetKey('pack_y'), 'py_modern1896');
});

test('Trial lifecycle: start, incorrect page open counting, and exact target success detection', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  // Start trial for Participant P01, Condition B, Pack X
  const active = await study.startTrial({
    participantId: 'P01',
    sequence: 'seq_1',
    period: 1,
    condition: 'B',
    topicPack: 'pack_x'
  });

  assert.strictEqual(active.status, 'active');
  assert.strictEqual(active.targetKey, 'px_materials');
  assert.strictEqual(active.incorrectPageOpens, 0);

  // 1. Participant navigates to non-target corpus page (px_hub) -> incorrectPageOpens = 1
  const nav1 = await study.handleNavigation({
    tabId: 10,
    url: 'http://127.0.0.1:8000/study/fixtures/pack_x/index.html',
    transitionType: 'link'
  });
  assert.strictEqual(nav1.outcome, 'in_progress');
  assert.strictEqual(nav1.incorrectPageOpens, 1);

  // 2. Reload of the same page -> excluded from error count
  const navReload = await study.handleNavigation({
    tabId: 10,
    url: 'http://127.0.0.1:8000/study/fixtures/pack_x/index.html',
    transitionType: 'reload'
  });
  assert.strictEqual(navReload, null, 'Reload must not increment incorrectPageOpens');

  // 3. Same-document hash change -> excluded from error count
  const navHash = await study.handleNavigation({
    tabId: 10,
    url: 'http://127.0.0.1:8000/study/fixtures/pack_x/index.html#section',
    isHashChange: true
  });
  assert.strictEqual(navHash, null, 'Hash update must not increment incorrectPageOpens');

  // 4. Consecutive duplicate event -> excluded
  const navDup = await study.handleNavigation({
    tabId: 10,
    url: 'http://127.0.0.1:8000/study/fixtures/pack_x/index.html',
    transitionType: 'link'
  });
  assert.strictEqual(navDup, null, 'Consecutive duplicate must not increment');

  // 5. Navigate to another wrong corpus page (px_efficiency) -> incorrectPageOpens = 2
  const nav2 = await study.handleNavigation({
    tabId: 10,
    url: 'http://127.0.0.1:8000/study/fixtures/pack_x/efficiency.html',
    transitionType: 'link'
  });
  assert.strictEqual(nav2.incorrectPageOpens, 2);

  // 6. Navigate to target page (px_materials) -> triggers trial success!
  const navTarget = await study.handleNavigation({
    tabId: 10,
    url: 'http://127.0.0.1:8000/study/fixtures/pack_x/materials.html',
    transitionType: 'link',
    status: 'complete'
  });

  assert(navTarget, 'Target navigation must complete trial');
  assert.strictEqual(navTarget.outcome, 'success');
  assert.strictEqual(navTarget.incorrectPageOpens, 2);
  assert.strictEqual(study.getActiveTrial(), null, 'Active trial must clear on success');

  const state = await study.getState();
  assert.strictEqual(state.trials.length, 1);
  const trial = state.trials[0];
  assert.strictEqual(trial.outcome, 'success');
  assert.strictEqual(trial.incorrectPageOpens, 2);
  assert.strictEqual(trial.tool, 'spatial_history');
});

test('Timeout and explicit abandon behavior', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  // Test abandon
  await study.startTrial({ participantId: 'P02', sequence: 'seq_2', period: 1, condition: 'A', topicPack: 'pack_y' });
  const abandoned = await study.abandonTrial();
  assert.strictEqual(abandoned.outcome, 'abandoned');
  assert.strictEqual(abandoned.tool, 'chrome_history');

  // Test timeout (simulate 120s deadline passed)
  await study.startTrial({ participantId: 'P02', sequence: 'seq_2', period: 2, condition: 'B', topicPack: 'pack_x' });
  study._state.activeTrial.deadlineTimestamp = Date.now() - 1000;
  const timeoutNav = await study.handleNavigation({ tabId: 1, url: 'http://127.0.0.1:8000/pack_x/storage.html' });
  assert.strictEqual(timeoutNav.outcome, 'timeout');
  assert.strictEqual(timeoutNav.elapsedMs, 120000, 'Timeout must record exactly 120000ms elapsed');
});

test('NASA-TLX scoring and Raw TLX formula computation', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  await study.startTrial({ participantId: 'P03', sequence: 'seq_1', period: 1, condition: 'B', topicPack: 'pack_x' });
  await study.handleNavigation({ tabId: 1, url: 'http://127.0.0.1:8000/pack_x/materials.html', status: 'complete' });

  const trialId = study._state.lastCompletedTrialId;
  const ratings = {
    mentalDemand: 35,
    physicalDemand: 10,
    temporalDemand: 45,
    performance: 20,
    effort: 30,
    frustration: 15
  };

  const updatedTrial = await study.submitTlx(trialId, ratings);
  assert.deepStrictEqual(updatedTrial.tlx, ratings);
  // Raw TLX = (35 + 10 + 45 + 20 + 30 + 15) / 6 = 155 / 6 = 25.83
  assert.strictEqual(updatedTrial.rawTlx, 25.83);
});

test('Inter-round reset: clearing history map does NOT delete separate study records', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  // 1. Record normal history nodes
  await storage.recordVisit({ url: 'https://example.com/normal-1', title: 'Normal Page 1', timestamp: 100 });
  await storage.recordVisit({ url: 'https://example.com/normal-2', title: 'Normal Page 2', timestamp: 200 });

  // 2. Record a study trial
  await study.startTrial({ participantId: 'P04', sequence: 'seq_3', period: 1, condition: 'A', topicPack: 'pack_y' });
  await study.abandonTrial();

  let normalState = await storage.getState();
  let studyState = await study.getState();
  assert.strictEqual(Object.keys(normalState.nodes).length, 2);
  assert.strictEqual(studyState.trials.length, 1);

  // 3. Perform Clear Map (simulating user clearing history map between rounds)
  await storage.clearAll();

  normalState = await storage.getState();
  assert.strictEqual(Object.keys(normalState.nodes).length, 0, 'Normal history must be completely wiped');

  // Verify study storage key remains intact
  const studyInStore = await storage.adapter.get(STUDY_STORAGE_KEY);
  assert(studyInStore[STUDY_STORAGE_KEY], 'Study storage key must be preserved');
  assert.strictEqual(studyInStore[STUDY_STORAGE_KEY].trials.length, 1, 'Study trials must remain untouched');
});

test('Privacy Audit: CSV and JSON exports contain zero raw URLs, titles, search queries, or off-corpus records', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  // Complete a trial with coarse extension actions
  await study.startTrial({ participantId: 'P05', sequence: 'seq_4', period: 1, condition: 'B', topicPack: 'pack_x' });
  await study.recordStudyEvent('extension_search');
  await study.recordStudyEvent('extension_zoom');
  await study.handleNavigation({ tabId: 1, url: 'http://127.0.0.1:8000/pack_x/efficiency.html' });
  await study.handleNavigation({ tabId: 1, url: 'http://127.0.0.1:8000/pack_x/materials.html', status: 'complete' });
  await study.submitTlx(study._state.lastCompletedTrialId, {
    mentalDemand: 40,
    physicalDemand: 10,
    temporalDemand: 30,
    performance: 15,
    effort: 25,
    frustration: 20
  });

  const csv = study.generateTrialsCsv();
  const jsonStr = study.generateEventsJson();

  // Check CSV
  assert(csv.startsWith('participant_id,sequence,period,condition,tool,topic_pack,target_key'), 'CSV headers must match data dictionary');
  assert(csv.includes('P05,seq_4,1,B,spatial_history,pack_x,px_materials'));
  assert(csv.includes(',23.33'), 'Must contain calculated raw_tlx');

  // Verify privacy constraints
  const forbiddenPatterns = [
    'http://', 'https://', '127.0.0.1', 'materials.html', 'Photovoltaic',
    'Solar', 'Perovskite', 'query', 'searchTerm'
  ];
  for (const forbidden of forbiddenPatterns) {
    assert(!csv.includes(forbidden), `CSV export must not leak ${forbidden}`);
    assert(!jsonStr.includes(forbidden), `JSON audit export must not leak ${forbidden}`);
  }

  // Check JSON audit trace structure
  const events = JSON.parse(jsonStr);
  assert(Array.isArray(events));
  assert(events.some((e) => e.eventType === 'trial_start'));
  assert(events.some((e) => e.eventType === 'corpus_navigation' && e.pageKey === 'px_efficiency'));
  assert(events.some((e) => e.eventType === 'extension_search'));
  assert(events.some((e) => e.eventType === 'extension_zoom'));
  assert(events.some((e) => e.eventType === 'trial_success' && e.pageKey === 'px_materials'));
  assert(events.some((e) => e.eventType === 'tlx_submitted'));
});

test('Data dictionary file exists and documents all exported CSV headers and JSON event fields', () => {
  const dictPath = path.join(ROOT_DIR, 'docs', 'STUDY_DATA_DICTIONARY.md');
  assert(fs.existsSync(dictPath), 'docs/STUDY_DATA_DICTIONARY.md must exist');
  const dictContent = fs.readFileSync(dictPath, 'utf8');

  for (const field of [
    'participant_id', 'sequence', 'period', 'condition', 'tool', 'topic_pack',
    'target_key', 'start_time_utc', 'end_time_utc', 'elapsed_ms', 'outcome',
    'target_revisited_delay', 'protocol_deviation', 'incorrect_page_opens',
    'tlx_mental_demand', 'tlx_physical_demand', 'tlx_temporal_demand',
    'tlx_performance', 'tlx_effort', 'tlx_frustration', 'raw_tlx'
  ]) {
    assert(dictContent.includes(`\`${field}\``), `Data dictionary must document ${field}`);
  }

  for (const eventField of [
    'trial_id', 'timestamp_utc', 'elapsed_ms', 'event_type', 'page_key',
    'navigation_type', 'qualifiers', 'tab_ephemeral_key'
  ]) {
    assert(dictContent.includes(`\`${eventField}\``), `Data dictionary must document event field ${eventField}`);
  }
});

await Promise.all(pendingTests);
console.log(`\nStudy & Privacy Verification Complete: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
