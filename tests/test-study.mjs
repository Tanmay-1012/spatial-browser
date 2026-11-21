/**
 * Task 18: User Study Instrumentation & Privacy Verification Suite
 *
 * Verifies:
 * - Study mode default-off: no study capture or events when inactive.
 * - 4-sequence Latin square counterbalanced assignments (all 8 valid cells + rejection of invalid/mismatched).
 * - Participant code format (P01-P999) and rejection of formula injection or free-form names.
 * - Strict local loopback origin matching (rejection of non-local hosts, non-HTTP schemes, lookalikes).
 * - Exact target completion upon document load completion (not on commit).
 * - Event-level duplicate suppression without cross-tab false deduplication.
 * - Exclusion of reloads, hash updates, client/server redirects, and rapid duplicate signals.
 * - Finish session action: completes active trial as abandoned, logs session_finish, blocks extra trials.
 * - NASA-TLX 6-item scoring with step-5 increments and raw TLX mean computation.
 * - Inter-round reset: clearing normal map preserves study records.
 * - Privacy audit: zero raw URLs, webpage titles, query params, or typed search queries in export.
 * - Exported CSV and JSON consistency with data dictionary (snake_case keys).
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
const {
  StudyManager,
  STUDY_STORAGE_KEY,
  LATIN_SQUARE_SEQUENCES,
  isValidParticipantId,
  getSequenceAssignment,
  escapeCsvCell
} = globalThis.SpatialStudyManager;
const { matchCorpusPage, isCorpusTarget, getDefaultTargetKey } = globalThis.SpatialStudyCorpus;

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

test('Counterbalanced Latin Square: enforces all 8 valid cells and rejects invalid combinations', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  const expectedGrid = [
    { seq: 'seq_1', period: 1, condition: 'A', tool: 'chrome_history', pack: 'pack_x' },
    { seq: 'seq_1', period: 2, condition: 'B', tool: 'spatial_history', pack: 'pack_y' },
    { seq: 'seq_2', period: 1, condition: 'B', tool: 'spatial_history', pack: 'pack_y' },
    { seq: 'seq_2', period: 2, condition: 'A', tool: 'chrome_history', pack: 'pack_x' },
    { seq: 'seq_3', period: 1, condition: 'A', tool: 'chrome_history', pack: 'pack_y' },
    { seq: 'seq_3', period: 2, condition: 'B', tool: 'spatial_history', pack: 'pack_x' },
    { seq: 'seq_4', period: 1, condition: 'B', tool: 'spatial_history', pack: 'pack_x' },
    { seq: 'seq_4', period: 2, condition: 'A', tool: 'chrome_history', pack: 'pack_y' }
  ];

  for (const cell of expectedGrid) {
    const assigned = getSequenceAssignment(cell.seq, cell.period);
    assert.deepStrictEqual(assigned, {
      condition: cell.condition,
      tool: cell.tool,
      topicPack: cell.pack
    }, `Mapping mismatch for ${cell.seq} Period ${cell.period}`);

    // Verify startTrial succeeds with valid cell parameters
    const trial = await study.startTrial({
      participantId: 'P01',
      sequence: cell.seq,
      period: cell.period,
      condition: cell.condition,
      topicPack: cell.pack
    });
    assert.strictEqual(trial.condition, cell.condition);
    assert.strictEqual(trial.topicPack, cell.pack);
    assert.strictEqual(trial.tool, cell.tool);
    await study.abandonTrial();
  }

  // Reject invalid sequence
  await assert.rejects(
    study.startTrial({ participantId: 'P01', sequence: 'seq_invalid', period: 1 }),
    /Invalid sequence/
  );

  // Reject invalid period
  await assert.rejects(
    study.startTrial({ participantId: 'P01', sequence: 'seq_1', period: 3 }),
    /Invalid study period/
  );

  // Reject mismatched condition (seq_1 period 1 must be condition A)
  await assert.rejects(
    study.startTrial({ participantId: 'P01', sequence: 'seq_1', period: 1, condition: 'B' }),
    /Condition mismatch/
  );

  // Reject mismatched topic pack (seq_1 period 1 must be pack_x)
  await assert.rejects(
    study.startTrial({ participantId: 'P01', sequence: 'seq_1', period: 1, topicPack: 'pack_y' }),
    /Topic pack mismatch/
  );
});

test('Participant ID validation: enforces P01-P999 and rejects formula injection, P00, P000, P001, or free-form names', async () => {
  // Valid boundary codes P01, P99, P100, P999
  assert.strictEqual(isValidParticipantId('P01'), true);
  assert.strictEqual(isValidParticipantId('P15'), true);
  assert.strictEqual(isValidParticipantId('P99'), true);
  assert.strictEqual(isValidParticipantId('P100'), true);
  assert.strictEqual(isValidParticipantId('P999'), true);

  // Rejections: P00, P000, P001, out of bounds, formula injection, names
  assert.strictEqual(isValidParticipantId('P00'), false, 'Must reject P00');
  assert.strictEqual(isValidParticipantId('P000'), false, 'Must reject P000');
  assert.strictEqual(isValidParticipantId('P001'), false, 'Must reject P001');
  assert.strictEqual(isValidParticipantId(''), false);
  assert.strictEqual(isValidParticipantId('P1'), false, 'Needs 2 or 3 digits (P01-P999)');
  assert.strictEqual(isValidParticipantId('P1000'), false);
  assert.strictEqual(isValidParticipantId('Alice'), false);
  assert.strictEqual(isValidParticipantId('student_123'), false);
  assert.strictEqual(isValidParticipantId('=1+1'), false, 'Must reject formula injection starting with =');
  assert.strictEqual(isValidParticipantId('@SUM(A1:A10)'), false, 'Must reject formula injection starting with @');
  assert.strictEqual(isValidParticipantId('+cmd'), false, 'Must reject formula injection starting with +');
  assert.strictEqual(isValidParticipantId('-cmd'), false, 'Must reject formula injection starting with -');

  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();
  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  await assert.rejects(
    study.startTrial({ participantId: '=1+1', sequence: 'seq_1', period: 1 }),
    /Invalid participant code/
  );
  await assert.rejects(
    study.startTrial({ participantId: 'P000', sequence: 'seq_1', period: 1 }),
    /Invalid participant code/
  );
  await assert.rejects(
    study.startTrial({ participantId: 'P00', sequence: 'seq_1', period: 1 }),
    /Invalid participant code/
  );
});

test('Corpus allowlist strictly requires local loopback origin and exact study paths', () => {
  // Valid local loopback origins
  assert.strictEqual(matchCorpusPage('http://127.0.0.1:8000/study/fixtures/pack_x/index.html'), 'px_hub');
  assert.strictEqual(matchCorpusPage('http://localhost:3000/study/fixtures/pack_x/materials.html'), 'px_materials');
  assert.strictEqual(matchCorpusPage('http://127.0.0.1:8000/pack_y/modern1896.html'), 'py_modern1896');

  // External domains must be rejected
  assert.strictEqual(matchCorpusPage('https://example.com/pack_x/materials.html'), null);
  assert.strictEqual(matchCorpusPage('http://example.com/pack_x/materials.html'), null);
  assert.strictEqual(matchCorpusPage('https://127.0.0.1:8000/pack_x/materials.html'), null, 'HTTPS on loopback rejected');
  assert.strictEqual(matchCorpusPage('http://127.0.0.1.attacker.com/pack_x/materials.html'), null);
  assert.strictEqual(matchCorpusPage('http://localhost.attacker.com/pack_x/materials.html'), null);

  // Non-HTTP schemes must be rejected
  assert.strictEqual(matchCorpusPage('file:///C:/fixtures/pack_x/materials.html'), null);
  assert.strictEqual(matchCorpusPage('chrome://history'), null);
  assert.strictEqual(matchCorpusPage('javascript:void(0)'), null);

  // Lookalike paths must be rejected
  assert.strictEqual(matchCorpusPage('http://127.0.0.1:8000/pack_x/materials.html.bak'), null);
  assert.strictEqual(matchCorpusPage('http://127.0.0.1:8000/pack_x/materials.html/subpath'), null);
});

test('Target completion requires document load completion (status === complete)', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  await study.startTrial({
    participantId: 'P01',
    sequence: 'seq_4',
    period: 1,
    condition: 'B',
    topicPack: 'pack_x'
  });

  // 1. Target URL navigation committed (HTTP response received, but document loading not finished)
  const commitRes = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/study/fixtures/pack_x/materials.html',
    transitionType: 'link'
  });
  assert.strictEqual(commitRes.outcome, 'target_committed');
  assert.notStrictEqual(study.getActiveTrial(), null, 'Trial must remain active on navigation committed');

  // 2. Target URL document load completed (webNavigation.onCompleted / status complete)
  const completeRes = await study.handleNavigationCompleted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/study/fixtures/pack_x/materials.html',
    status: 'complete'
  });
  assert.strictEqual(completeRes.outcome, 'success');
  assert.strictEqual(study.getActiveTrial(), null, 'Trial must conclude after target finishes loading');
});

test('Event-level deduplication: counts across tabs and after off-corpus visits, excludes reloads and redirects', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  await study.startTrial({
    participantId: 'P01',
    sequence: 'seq_4',
    period: 1,
    condition: 'B',
    topicPack: 'pack_x'
  });

  // Tab 10 opens px_efficiency -> incorrectPageOpens = 1
  const t1 = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    transitionType: 'link'
  });
  assert.strictEqual(t1.incorrectPageOpens, 1);

  // Tab 20 opens the same page (px_efficiency) in a separate tab -> genuine second open -> incorrectPageOpens = 2
  const t2 = await study.handleNavigationCommitted({
    tabId: 20,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    transitionType: 'link'
  });
  assert.strictEqual(t2.incorrectPageOpens, 2, 'Separate tab opening same page must increment count');

  // Tab 10 reloads -> reload excluded
  const reload = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    transitionType: 'reload'
  });
  assert.strictEqual(reload, null, 'Reload must be excluded');

  // Tab 10 hash change -> excluded
  const hash = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html#anchor',
    isHashChange: true
  });
  assert.strictEqual(hash, null, 'Hash update must be excluded');

  // Tab 10 navigates off-corpus (e.g. google.com)
  const off = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'https://google.com'
  });
  assert.strictEqual(off, null, 'Off-corpus navigation must be ignored');

  // Tab 10 navigates back to px_efficiency -> genuine revisit -> incorrectPageOpens = 3
  const t3 = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    transitionType: 'link'
  });
  assert.strictEqual(t3.incorrectPageOpens, 3, 'Revisit after off-corpus navigation must increment count');
});

test('Finish session action: audits session, completes active trial as abandoned, and blocks further trials', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  // Start trial
  await study.startTrial({
    participantId: 'P01',
    sequence: 'seq_1',
    period: 1,
    condition: 'A',
    topicPack: 'pack_x'
  });
  assert.notStrictEqual(study.getActiveTrial(), null);

  // Researcher clicks Finish Session while trial is running
  const finishRes = await study.finishSession();
  assert.strictEqual(finishRes.sessionStatus, 'finished');
  assert.strictEqual(study.getActiveTrial(), null, 'Active trial must be cleared');
  assert.strictEqual(study.getSessionStatus(), 'finished');

  const state = await study.getState();
  assert.strictEqual(state.trials.length, 1);
  assert.strictEqual(state.trials[0].outcome, 'abandoned');
  assert.strictEqual(state.trials[0].abandonReason, 'session_finished');

  const finishEvent = state.events.find((e) => e.event_type === 'session_finish');
  assert(finishEvent, 'session_finish event must be logged');

  // Attempting to start another trial while session is finished must throw
  await assert.rejects(
    study.startTrial({ participantId: 'P01', sequence: 'seq_1', period: 2 }),
    /session has been finished/
  );

  // Starting a new session unblocks trials
  await study.startNewSession();
  assert.strictEqual(study.getSessionStatus(), 'active');
  const nextTrial = await study.startTrial({
    participantId: 'P01',
    sequence: 'seq_1',
    period: 2,
    condition: 'B',
    topicPack: 'pack_y'
  });
  assert.strictEqual(nextTrial.status, 'active');
});

test('NASA-TLX: enforces step-5 increments, validates boundaries, and computes raw TLX', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  await study.startTrial({
    participantId: 'P01',
    sequence: 'seq_1',
    period: 1,
    condition: 'A',
    topicPack: 'pack_x'
  });
  await study.completeTrial('success');

  const trialId = study._state.lastCompletedTrialId;

  // Valid step-5 ratings
  const validRatings = {
    mentalDemand: 35,
    physicalDemand: 10,
    temporalDemand: 45,
    performance: 20,
    effort: 30,
    frustration: 15
  };
  const updated = await study.submitTlx(trialId, validRatings);
  assert.deepStrictEqual(updated.tlx, validRatings);
  // Mean = (35 + 10 + 45 + 20 + 30 + 15) / 6 = 155 / 6 = 25.833... -> 25.8 (1 decimal place)
  assert.strictEqual(updated.rawTlx, 25.8);

  // Reject ratings not divisible by 5
  await assert.rejects(
    study.submitTlx(trialId, { ...validRatings, mentalDemand: 37 }),
    /increment of 5/
  );

  // Reject negative ratings
  await assert.rejects(
    study.submitTlx(trialId, { ...validRatings, mentalDemand: -5 }),
    /between 0 and 100/
  );

  // Reject ratings > 100
  await assert.rejects(
    study.submitTlx(trialId, { ...validRatings, mentalDemand: 105 }),
    /between 0 and 100/
  );
});

test('Privacy Audit: CSV and JSON exports contain zero raw URLs, titles, search queries, or off-corpus records', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  await study.startTrial({
    participantId: 'P05',
    sequence: 'seq_4',
    period: 1,
    condition: 'B',
    topicPack: 'pack_x'
  });
  await study.recordStudyEvent('extension_search');
  await study.recordStudyEvent('extension_zoom');
  await study.handleNavigationCommitted({ tabId: 1, url: 'http://127.0.0.1:8000/pack_x/efficiency.html' });
  await study.handleNavigationCompleted({ tabId: 1, url: 'http://127.0.0.1:8000/pack_x/materials.html', status: 'complete' });
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
  assert(csv.includes(',23.3'), 'Must contain calculated raw_tlx');

  // Verify privacy constraints
  const forbiddenPatterns = [
    'http://', 'https://', '127.0.0.1', 'materials.html', 'Photovoltaic',
    'Solar', 'Perovskite', 'query', 'searchTerm'
  ];
  for (const forbidden of forbiddenPatterns) {
    assert(!csv.includes(forbidden), `CSV export must not leak ${forbidden}`);
    assert(!jsonStr.includes(forbidden), `JSON audit export must not leak ${forbidden}`);
  }

  // Check JSON audit trace structure with snake_case keys
  const events = JSON.parse(jsonStr);
  assert(Array.isArray(events));
  assert(events.some((e) => e.event_type === 'trial_start' && e.trial_id === 'trial_P05_p1_B'));
  assert(events.some((e) => e.event_type === 'corpus_navigation' && e.page_key === 'px_efficiency'));
  assert(events.some((e) => e.event_type === 'extension_search'));
  assert(events.some((e) => e.event_type === 'extension_zoom'));
  assert(events.some((e) => e.event_type === 'trial_success' && e.page_key === 'px_materials'));
  assert(events.some((e) => e.event_type === 'tlx_submitted'));
});

test('Data dictionary file and manager export match exact schema and snake_case format', () => {
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

  // Manager data dictionary text availability
  const manager = new StudyManager();
  const managerDict = manager.getDataDictionaryText();
  assert(typeof managerDict === 'string' && managerDict.length > 100);
  assert(managerDict.includes('trial_{participant_id}_p{period}_{condition}'));
});

test('Storage privacy boundary: zero raw URLs, query/hash material, or browser tab IDs in storage during active trial or after session finish', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  await study.startTrial({
    participantId: 'P01',
    sequence: 'seq_1',
    period: 1,
    condition: 'A',
    topicPack: 'pack_x'
  });

  // Navigate with secret query, hash, and specific numeric tab ID 42
  const sentinelUrl = 'http://127.0.0.1:8000/study/fixtures/pack_x/efficiency.html?sentinelSecret=topSecret123#fragSection';
  await study.handleNavigationCommitted({
    tabId: 42,
    url: sentinelUrl,
    transitionType: 'link'
  });

  // 1. Inspect actual study storage object while trial is ACTIVE
  const rawStorageActive = await storage.adapter.get(STUDY_STORAGE_KEY);
  const activeJson = JSON.stringify(rawStorageActive);

  // Assert sentinel query, hash, raw URL, and numeric tab ID are strictly absent
  assert(!activeJson.includes('sentinelSecret'), 'Active study storage must not contain query parameters');
  assert(!activeJson.includes('topSecret123'), 'Active study storage must not contain query values');
  assert(!activeJson.includes('fragSection'), 'Active study storage must not contain fragment hashes');
  assert(!activeJson.includes('efficiency.html'), 'Active study storage must not contain raw URLs or filenames');
  assert(!activeJson.includes('http://'), 'Active study storage must not contain protocols');
  assert(!activeJson.includes('lastCommittedUrl'), 'Active study storage must not contain lastCommittedUrl');
  assert(!activeJson.includes(':42') && !activeJson.includes('"42"'), 'Active study storage must not contain numeric tab ID');

  const storedActive = rawStorageActive[STUDY_STORAGE_KEY];
  assert.strictEqual(storedActive.activeTrial.tabMap, undefined, 'Active trial must not store tabMap in storage');
  assert.strictEqual(storedActive.activeTrial.tabNavState, undefined, 'Active trial must not store tabNavState in storage');

  // Verify event only has opaque page key and ephemeral tab key
  assert.strictEqual(storedActive.events.length, 2); // trial_start + corpus_navigation
  const navEv = storedActive.events[1];
  assert.strictEqual(navEv.page_key, 'px_efficiency');
  assert.strictEqual(navEv.tab_ephemeral_key, 'tab_1');

  // 2. Finish session during active trial
  await study.finishSession();

  // 3. Inspect actual study storage object after FINISH SESSION
  const rawStorageFinished = await storage.adapter.get(STUDY_STORAGE_KEY);
  const finishedJson = JSON.stringify(rawStorageFinished);

  assert(!finishedJson.includes('sentinelSecret'), 'Finished study storage must not contain query parameters');
  assert(!finishedJson.includes('topSecret123'), 'Finished study storage must not contain query values');
  assert(!finishedJson.includes('fragSection'), 'Finished study storage must not contain fragment hashes');
  assert(!finishedJson.includes('efficiency.html'), 'Finished study storage must not contain raw URLs');
  assert(!finishedJson.includes('lastCommittedUrl'), 'Finished study storage must not contain lastCommittedUrl');
  assert(!finishedJson.includes(':42') && !finishedJson.includes('"42"'), 'Finished study storage must not contain numeric tab ID');

  const storedFinished = rawStorageFinished[STUDY_STORAGE_KEY];
  assert.strictEqual(storedFinished.activeTrial, null);
  assert.strictEqual(storedFinished.trials.length, 1);
  const trialRow = storedFinished.trials[0];
  assert.strictEqual(trialRow.tabMap, undefined, 'Finalized trial record must not contain tabMap');
  assert.strictEqual(trialRow.tabNavState, undefined, 'Finalized trial record must not contain tabNavState');
  assert.strictEqual(trialRow.outcome, 'abandoned');
  assert.strictEqual(trialRow.incorrectPageOpens, 1);
});

test('Redirect destination handling: counts server redirect destinations and collapses client redirect intermediates', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  await study.startTrial({
    participantId: 'P01',
    sequence: 'seq_4',
    period: 1,
    condition: 'B',
    topicPack: 'pack_x'
  });

  // 1. Server redirect to wrong corpus page:
  // Browser receives HTTP 302 and commits the final destination with transitionQualifiers: ['server_redirect']
  const serverRedirect = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    transitionQualifiers: ['server_redirect']
  });
  assert.notStrictEqual(serverRedirect, null, 'Server redirect destination commit must not be dropped');
  assert.strictEqual(serverRedirect.incorrectPageOpens, 1, 'Server redirect to wrong corpus page must increment count once');
  assert.strictEqual(serverRedirect.pageKey, 'px_efficiency');

  // 2. Client redirect intermediate collapsing:
  // Intermediate corpus page (px_silicon) commits, then destination (px_grid) commits with client_redirect within 400ms
  const inter1 = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/silicon.html',
    transitionType: 'link'
  });
  assert.strictEqual(inter1.incorrectPageOpens, 2);

  const dest1 = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/grid.html',
    transitionQualifiers: ['client_redirect']
  });
  assert.strictEqual(dest1.incorrectPageOpens, 2, 'Intermediate redirect must collapse so count remains 2 (not 3)');
  assert.strictEqual(dest1.pageKey, 'px_grid');

  // 3. Client redirect to TARGET collapsing:
  // Intermediate corpus page commits, then destination target commits with client_redirect
  const inter2 = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/storage.html',
    transitionType: 'link'
  });
  assert.strictEqual(inter2.incorrectPageOpens, 3);

  const targetRedirect = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/materials.html',
    transitionQualifiers: ['client_redirect']
  });
  assert.strictEqual(targetRedirect.outcome, 'target_committed');
  assert.strictEqual(study._state.activeTrial.incorrectPageOpens, 2, 'Intermediate error must be undone when redirecting to target');

  // Target load completion succeeds
  const comp = await study.handleNavigationCompleted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/materials.html',
    status: 'complete'
  });
  assert.strictEqual(comp.outcome, 'success');
  assert.strictEqual(comp.incorrectPageOpens, 2);
});

test('Fast genuine repeat opens within 600ms vs duplicate signals: counts distinct visits and suppresses exact signal re-deliveries', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  await study.startTrial({
    participantId: 'P01',
    sequence: 'seq_4',
    period: 1,
    condition: 'B',
    topicPack: 'pack_x'
  });

  // First genuine open at t=1000
  const open1 = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    documentId: 'doc_1',
    timeStamp: 1000
  });
  assert.strictEqual(open1.incorrectPageOpens, 1);

  // Duplicate signal for doc_1 (e.g. repeated listener firing with same documentId)
  const dup1 = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    documentId: 'doc_1',
    timeStamp: 1000
  });
  assert.strictEqual(dup1, null, 'Duplicate signal with same documentId must be suppressed');
  assert.strictEqual(study._state.activeTrial.incorrectPageOpens, 1);

  // Duplicate signal with same event object reference
  const objEvent = {
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    timeStamp: 1100
  };
  const firstDelivery = await study.handleNavigationCommitted(objEvent);
  assert.strictEqual(firstDelivery.incorrectPageOpens, 2);
  const secondDelivery = await study.handleNavigationCommitted(objEvent);
  assert.strictEqual(secondDelivery, null, 'Same event object delivered twice must be suppressed');

  // Second genuine open 200ms later (e.g. fast repeat click in same tab to same URL)
  const open2 = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    documentId: 'doc_2',
    timeStamp: 1300
  });
  assert.strictEqual(open2.incorrectPageOpens, 3, 'Fast genuine repeat open within 600ms must be counted');

  // Distinct navigation IDs can share the same millisecond timestamp on a fast system.
  const open3 = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    documentId: 'doc_3',
    timeStamp: 1300
  });
  assert.strictEqual(open3.incorrectPageOpens, 4, 'Distinct document IDs must count even when browser timestamps collide');

  // If a browser omits navigation IDs, timestamp equality alone must not suppress a commit.
  const noIdOpen1 = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    timeStamp: 1400
  });
  assert.strictEqual(noIdOpen1.incorrectPageOpens, 5);
  const noIdOpen2 = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    timeStamp: 1400
  });
  assert.strictEqual(noIdOpen2.incorrectPageOpens, 6, 'Distinct commit events must count even when IDs are absent and timestamps collide');
});

test('Back/Forward navigation: counts destination visits and records forward_back transition qualifiers', async () => {
  const memStore = createMemoryStorage();
  const storage = new StorageManager({ storageBackend: memStore });
  await storage.init();

  const study = new StudyManager({ storageAdapter: storage.adapter });
  await study.init();

  await study.startTrial({
    participantId: 'P01',
    sequence: 'seq_4',
    period: 1,
    condition: 'B',
    topicPack: 'pack_x'
  });

  // Initial visit to px_efficiency
  await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    transitionType: 'link'
  });

  // Navigate to px_grid
  await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/grid.html',
    transitionType: 'link'
  });

  // Press Back to return to px_efficiency (transitionQualifiers: ['forward_back'])
  const backNav = await study.handleNavigationCommitted({
    tabId: 10,
    url: 'http://127.0.0.1:8000/pack_x/efficiency.html',
    transitionType: 'link',
    transitionQualifiers: ['forward_back']
  });

  assert.strictEqual(backNav.incorrectPageOpens, 3, 'Back navigation destination must be counted as a page open');

  const state = await study.getState();
  const backEvent = state.events.find((e) => e.qualifiers && e.qualifiers.includes('forward_back'));
  assert(backEvent, 'Event log must contain forward_back qualifier');
  assert.strictEqual(backEvent.page_key, 'px_efficiency');
});

test('CSV escaping: correctly handles commas, double quotes, and newlines', () => {
  assert.strictEqual(escapeCsvCell('simple'), 'simple');
  assert.strictEqual(escapeCsvCell(123), '123');
  assert.strictEqual(escapeCsvCell(''), '');
  assert.strictEqual(escapeCsvCell(null), '');
  assert.strictEqual(escapeCsvCell(undefined), '');

  // Comma requires quoting
  assert.strictEqual(escapeCsvCell('Hello, World'), '"Hello, World"');

  // Quotes require escaping and quoting
  assert.strictEqual(escapeCsvCell('He said "hello"'), '"He said ""hello"""');

  // Newlines require quoting
  assert.strictEqual(escapeCsvCell("Line 1\nLine 2"), '"Line 1\nLine 2"');
  assert.strictEqual(escapeCsvCell("Line 1\r\nLine 2"), '"Line 1\r\nLine 2"');

  // Combined commas, quotes, and newlines
  assert.strictEqual(escapeCsvCell('Item "A", with details\nSecond line'), '"Item ""A"", with details\nSecond line"');
});

await Promise.all(pendingTests);
console.log(`\nStudy & Privacy Verification Complete: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
