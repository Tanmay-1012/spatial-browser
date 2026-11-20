/**
 * Spatial Browser History - Study Manager (Schema V1)
 *
 * Manages opt-in, privacy-preserving within-subject experimental trial data,
 * 4-sequence Latin square counterbalanced assignments, 120-second retrieval countdown,
 * exact target completion detection upon document load completion,
 * non-target corpus page open counts without cross-tab false deduplication,
 * NASA-TLX workload scoring, session lifecycle controls (including Finish Session),
 * and local CSV/JSON export.
 *
 * Stored strictly in separate versioned storage key `spatial_browser_study_data`
 * to ensure ordinary history resets between rounds never delete study records.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();
    if (typeof globalThis !== 'undefined') {
      globalThis.SpatialStudyManager = exports;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STUDY_STORAGE_KEY = 'spatial_browser_study_data';
  const CURRENT_STUDY_SCHEMA_VERSION = 1;
  const RETRIEVAL_DEADLINE_MS = 120000; // 120 seconds

  // Counterbalanced Latin Square Sequence Specification
  // Rows: seq_1 .. seq_4. Columns: period 1, period 2.
  const LATIN_SQUARE_SEQUENCES = {
    seq_1: {
      1: { condition: 'A', tool: 'chrome_history', topicPack: 'pack_x' },
      2: { condition: 'B', tool: 'spatial_history', topicPack: 'pack_y' }
    },
    seq_2: {
      1: { condition: 'B', tool: 'spatial_history', topicPack: 'pack_y' },
      2: { condition: 'A', tool: 'chrome_history', topicPack: 'pack_x' }
    },
    seq_3: {
      1: { condition: 'A', tool: 'chrome_history', topicPack: 'pack_y' },
      2: { condition: 'B', tool: 'spatial_history', topicPack: 'pack_x' }
    },
    seq_4: {
      1: { condition: 'B', tool: 'spatial_history', topicPack: 'pack_x' },
      2: { condition: 'A', tool: 'chrome_history', topicPack: 'pack_y' }
    }
  };

  const PARTICIPANT_ID_REGEX = /^P\d{2,3}$/;

  function isValidParticipantId(id) {
    if (!id || typeof id !== 'string') return false;
    const trimmed = id.trim();
    // Reject formula injection characters and enforce P01-P999
    if (/^[=+\-@]/.test(trimmed)) return false;
    return PARTICIPANT_ID_REGEX.test(trimmed);
  }

  function getSequenceAssignment(sequence, period) {
    const seq = LATIN_SQUARE_SEQUENCES[sequence];
    if (!seq) return null;
    return seq[Number(period)] || null;
  }

  function getCorpusApi() {
    if (typeof globalThis !== 'undefined' && globalThis.SpatialStudyCorpus) {
      return globalThis.SpatialStudyCorpus;
    }
    if (typeof require === 'function') {
      try {
        return require('./study-corpus.js');
      } catch (_) {}
    }
    return null;
  }

  function createInitialStudyState() {
    return {
      schemaVersion: CURRENT_STUDY_SCHEMA_VERSION,
      studyEnabled: false,
      sessionStatus: 'standby', // 'standby' | 'active' | 'finished'
      activeTrial: null,
      lastCompletedTrialId: null,
      trials: [],
      events: [],
      metadata: {
        createdAt: Date.now(),
        lastExportedAt: null,
        sessionFinishedAt: null
      }
    };
  }

  function escapeCsvCell(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  class StudyManager {
    constructor(options = {}) {
      this.adapter = options.storageAdapter || (typeof globalThis !== 'undefined' && globalThis.SpatialStorage && globalThis.SpatialStorage.StorageManager
        ? new globalThis.SpatialStorage.StorageManager().adapter
        : null);
      this._state = null;
      this._timeoutTimer = null;
    }

    async init() {
      if (!this.adapter) {
        this._state = createInitialStudyState();
        return this._state;
      }
      try {
        const result = await this.adapter.get(STUDY_STORAGE_KEY);
        let data = result ? result[STUDY_STORAGE_KEY] : null;
        if (!data || typeof data !== 'object') {
          data = createInitialStudyState();
          await this.adapter.set({ [STUDY_STORAGE_KEY]: data });
        }
        this._state = data;
        return this._state;
      } catch (err) {
        console.warn('[SpatialStudyManager] Local storage init notice:', err);
        this._state = createInitialStudyState();
        return this._state;
      }
    }

    async getState() {
      if (!this._state) await this.init();
      return JSON.parse(JSON.stringify(this._state));
    }

    async _saveState() {
      if (!this.adapter || !this._state) return;
      await this.adapter.set({ [STUDY_STORAGE_KEY]: this._state });
    }

    setStudyEnabled(enabled) {
      if (!this._state) this._state = createInitialStudyState();
      this._state.studyEnabled = Boolean(enabled);
      return this._saveState();
    }

    isStudyEnabled() {
      return Boolean(this._state && this._state.studyEnabled);
    }

    getActiveTrial() {
      if (!this._state || !this._state.activeTrial) return null;
      return Object.assign({}, this._state.activeTrial);
    }

    getSessionStatus() {
      return (this._state && this._state.sessionStatus) || 'standby';
    }

    async startNewSession() {
      if (!this._state) await this.init();
      this._state.sessionStatus = 'active';
      this._state.studyEnabled = true;
      this._state.activeTrial = null;
      await this._saveState();
      return { sessionStatus: 'active' };
    }

    async finishSession(options = {}) {
      if (!this._state) await this.init();
      const now = Date.now();
      const reason = options.reason || 'researcher_completed';

      // If a trial is active when finish is called, complete it as abandoned
      if (this._state.activeTrial && this._state.activeTrial.status === 'active') {
        const active = this._state.activeTrial;
        const elapsedMs = Math.min(now - active.startTimestamp, RETRIEVAL_DEADLINE_MS);
        active.status = 'abandoned';
        active.outcome = 'abandoned';
        active.abandonReason = 'session_finished';
        active.endTimeUtc = new Date(now).toISOString();
        active.elapsedMs = elapsedMs;

        this._appendEvent({
          trial_id: active.trialId,
          timestamp_utc: active.endTimeUtc,
          elapsed_ms: elapsedMs,
          event_type: 'trial_abandon',
          page_key: null,
          navigation_type: null,
          qualifiers: null,
          tab_ephemeral_key: null
        });

        this._state.trials.push(Object.assign({}, active));
        this._state.lastCompletedTrialId = active.trialId;
        this._state.activeTrial = null;
      }

      this._state.sessionStatus = 'finished';
      this._state.studyEnabled = false;
      this._state.metadata.sessionFinishedAt = now;

      this._appendEvent({
        trial_id: this._state.lastCompletedTrialId || 'session',
        timestamp_utc: new Date(now).toISOString(),
        elapsed_ms: 0,
        event_type: 'session_finish',
        page_key: null,
        navigation_type: null,
        qualifiers: null,
        tab_ephemeral_key: null
      });

      await this._saveState();
      return { sessionStatus: 'finished', finishedAt: now, reason };
    }

    async startTrial(config = {}) {
      if (!this._state) await this.init();

      if (this._state.sessionStatus === 'finished') {
        throw new Error('Study session has been finished. Start a new session before recording further trials.');
      }

      if (this._state.activeTrial && this._state.activeTrial.status === 'active') {
        throw new Error('A study trial is already active. Stop or complete the current trial first.');
      }

      // 1. Participant code format validation (P01-P999)
      const participantId = String(config.participantId || '').trim();
      if (!isValidParticipantId(participantId)) {
        throw new Error(`Invalid participant code '${participantId}'. Participant codes must strictly match pseudonymous format P01–P999.`);
      }

      // 2. Sequence and Period validation
      const sequence = String(config.sequence || 'seq_1').trim();
      const period = Number(config.period);
      if (period !== 1 && period !== 2) {
        throw new Error(`Invalid study period '${config.period}'. Must be 1 or 2.`);
      }
      const seqSpec = getSequenceAssignment(sequence, period);
      if (!seqSpec) {
        throw new Error(`Invalid sequence '${sequence}'. Must be one of seq_1, seq_2, seq_3, seq_4.`);
      }

      // 3. Enforce Latin square counterbalancing mapping
      if (config.condition && String(config.condition).trim().toUpperCase() !== seqSpec.condition) {
        throw new Error(`Condition mismatch: Sequence ${sequence} Period ${period} assigns Condition ${seqSpec.condition}, but received '${config.condition}'.`);
      }
      if (config.topicPack && String(config.topicPack).trim().toLowerCase() !== seqSpec.topicPack) {
        throw new Error(`Topic pack mismatch: Sequence ${sequence} Period ${period} assigns Topic Pack ${seqSpec.topicPack}, but received '${config.topicPack}'.`);
      }
      if (config.tool && String(config.tool).trim().toLowerCase() !== seqSpec.tool) {
        throw new Error(`Tool mismatch: Sequence ${sequence} Period ${period} assigns Tool ${seqSpec.tool}, but received '${config.tool}'.`);
      }

      const condition = seqSpec.condition;
      const tool = seqSpec.tool;
      const topicPack = seqSpec.topicPack;

      const corpus = getCorpusApi();
      const defaultTarget = corpus ? corpus.getDefaultTargetKey(topicPack) : (topicPack === 'pack_x' ? 'px_materials' : 'py_modern1896');
      const targetKey = String(config.targetKey || defaultTarget).trim();
      const targetRevisitedDelay = Boolean(config.targetRevisitedDelay);
      const protocolDeviation = Boolean(config.protocolDeviation);

      const now = Date.now();
      const trialId = `trial_${participantId}_p${period}_${condition}`;

      const activeTrial = {
        trialId,
        participantId,
        sequence,
        period,
        condition,
        tool,
        topicPack,
        targetKey,
        targetRevisitedDelay,
        protocolDeviation,
        startTimeUtc: new Date(now).toISOString(),
        startTimestamp: now,
        deadlineTimestamp: now + RETRIEVAL_DEADLINE_MS,
        status: 'active',
        incorrectPageOpens: 0,
        tabMap: {},
        tabNavState: {}
      };

      this._state.studyEnabled = true;
      this._state.sessionStatus = 'active';
      this._state.activeTrial = activeTrial;

      this._appendEvent({
        trial_id: trialId,
        timestamp_utc: activeTrial.startTimeUtc,
        elapsed_ms: 0,
        event_type: 'trial_start',
        page_key: null,
        navigation_type: null,
        qualifiers: null,
        tab_ephemeral_key: null
      });

      await this._saveState();
      return activeTrial;
    }

    /**
     * Handles top-level navigation committed events during active trials.
     * Records qualifying incorrect page opens without cross-tab false deduplication.
     * Collapses redirect intermediates and ignores reloads and same-document hash changes.
     * Does NOT complete trial success upon commit; target completion requires document load completion.
     */
    async handleNavigationCommitted(details) {
      if (!this._state || !this._state.studyEnabled || !this._state.activeTrial) {
        await this.init();
      }
      if (!this._state || !this._state.studyEnabled || !this._state.activeTrial) {
        return null;
      }
      const active = this._state.activeTrial;
      if (active.status !== 'active') return null;

      const now = Date.now();
      if (now >= active.deadlineTimestamp) {
        return this.completeTrial('timeout');
      }

      const corpus = getCorpusApi();
      if (!corpus) return null;

      const rawUrl = details.url || '';
      const pageKey = corpus.matchCorpusPage(rawUrl);

      const tabIdStr = String(details.tabId);
      if (!active.tabNavState) active.tabNavState = {};
      if (!active.tabNavState[tabIdStr]) active.tabNavState[tabIdStr] = {};
      const tabState = active.tabNavState[tabIdStr];

      // Off-corpus navigation: completely ignored to preserve privacy
      // Clear tab's lastCommittedKey so any later return to a corpus page counts as a genuine open
      if (!pageKey) {
        tabState.lastCommittedKey = null;
        tabState.lastCommittedUrl = null;
        return null;
      }

      // Assign opaque ephemeral tab key (e.g. 'tab_1')
      if (!active.tabMap) active.tabMap = {};
      if (!active.tabMap[tabIdStr]) {
        active.tabMap[tabIdStr] = 'tab_' + (Object.keys(active.tabMap).length + 1);
      }
      const ephemeralTab = active.tabMap[tabIdStr];

      const transitionType = details.transitionType || 'link';
      const qualifiers = Array.isArray(details.transitionQualifiers) ? details.transitionQualifiers : [];

      // 1. Redirect intermediate suppression: collapse client/server redirects onto final destination
      const isRedirect = qualifiers.includes('client_redirect') || qualifiers.includes('server_redirect');
      if (isRedirect) {
        return null;
      }

      // 2. Reload suppression: ignore page reloads in the same tab
      const isReload = transitionType === 'reload';
      if (isReload) {
        return null;
      }

      // 3. Same-document hash changes suppression
      const isHashChange = Boolean(details.isHashChange);
      if (isHashChange) {
        return null;
      }

      // 4. Duplicate browser signals for the same navigation in this tab (<600ms on same URL)
      const isDuplicateSignal = (tabState.lastCommittedUrl === rawUrl && (now - (tabState.lastNavTimestamp || 0)) < 600);
      if (isDuplicateSignal) {
        return null;
      }

      // Update per-tab navigation state
      tabState.lastCommittedKey = pageKey;
      tabState.lastCommittedUrl = rawUrl;
      tabState.lastNavTimestamp = now;

      // If this navigation is to the target page, do NOT finalize success on commit;
      // success is recorded only once the tab completes full document loading (status === 'complete').
      if (pageKey === active.targetKey) {
        return { outcome: 'target_committed', pageKey };
      }

      // Qualifying non-target corpus page open:
      active.incorrectPageOpens += 1;
      const elapsedMs = Math.max(0, now - active.startTimestamp);

      this._appendEvent({
        trial_id: active.trialId,
        timestamp_utc: new Date(now).toISOString(),
        elapsed_ms: elapsedMs,
        event_type: 'corpus_navigation',
        page_key: pageKey,
        navigation_type: transitionType,
        qualifiers: qualifiers,
        tab_ephemeral_key: ephemeralTab
      });

      await this._saveState();
      return {
        outcome: 'in_progress',
        incorrectPageOpens: active.incorrectPageOpens,
        pageKey
      };
    }

    /**
     * Handles document load completion events (status === 'complete' or webNavigation.onCompleted).
     * Finalizes trial success ONLY after the exact allowlisted target has completely loaded.
     */
    async handleNavigationCompleted(details) {
      if (!this._state || !this._state.studyEnabled || !this._state.activeTrial) {
        return null;
      }
      const active = this._state.activeTrial;
      if (active.status !== 'active') return null;

      if (details.frameId !== 0 && details.frameId !== undefined) {
        return null;
      }

      const now = Date.now();
      if (now >= active.deadlineTimestamp) {
        return this.completeTrial('timeout');
      }

      const corpus = getCorpusApi();
      if (!corpus) return null;

      const rawUrl = details.url || '';
      const pageKey = corpus.matchCorpusPage(rawUrl);

      // Verify exact target reached and fully loaded
      if (pageKey === active.targetKey) {
        const tabIdStr = String(details.tabId);
        if (!active.tabMap) active.tabMap = {};
        if (!active.tabMap[tabIdStr]) {
          active.tabMap[tabIdStr] = 'tab_' + (Object.keys(active.tabMap).length + 1);
        }
        const ephemeralTab = active.tabMap[tabIdStr];
        const elapsedMs = Math.max(0, now - active.startTimestamp);
        const transitionType = details.transitionType || 'link';
        const qualifiers = Array.isArray(details.transitionQualifiers) ? details.transitionQualifiers : [];

        this._appendEvent({
          trial_id: active.trialId,
          timestamp_utc: new Date(now).toISOString(),
          elapsed_ms: elapsedMs,
          event_type: 'trial_success',
          page_key: pageKey,
          navigation_type: transitionType,
          qualifiers: qualifiers,
          tab_ephemeral_key: ephemeralTab
        });

        return this.completeTrial('success', pageKey);
      }
      return null;
    }

    async handleNavigation(details) {
      if (details && details.status === 'complete') {
        return this.handleNavigationCompleted(details);
      }
      return this.handleNavigationCommitted(details);
    }

    async recordStudyEvent(eventType, metadata = {}) {
      if (!this._state || !this._state.studyEnabled || !this._state.activeTrial) {
        await this.init();
      }
      if (!this._state || !this._state.studyEnabled || !this._state.activeTrial) return;
      const active = this._state.activeTrial;
      if (active.status !== 'active') return;

      const now = Date.now();
      const elapsedMs = Math.max(0, now - active.startTimestamp);

      this._appendEvent({
        trial_id: active.trialId,
        timestamp_utc: new Date(now).toISOString(),
        elapsed_ms: elapsedMs,
        event_type: eventType,
        page_key: metadata.pageKey || null,
        navigation_type: metadata.navigationType || null,
        qualifiers: metadata.qualifiers || null,
        tab_ephemeral_key: null
      });

      await this._saveState();
    }

    async abandonTrial() {
      if (!this._state || !this._state.activeTrial || this._state.activeTrial.status !== 'active') {
        return null;
      }
      const active = this._state.activeTrial;
      const now = Date.now();
      const elapsedMs = Math.min(now - active.startTimestamp, RETRIEVAL_DEADLINE_MS);

      this._appendEvent({
        trial_id: active.trialId,
        timestamp_utc: new Date(now).toISOString(),
        elapsed_ms: elapsedMs,
        event_type: 'trial_abandon',
        page_key: null,
        navigation_type: null,
        qualifiers: null,
        tab_ephemeral_key: null
      });

      return this.completeTrial('abandoned');
    }

    async checkDeadline() {
      if (!this._state || !this._state.activeTrial || this._state.activeTrial.status !== 'active') {
        return null;
      }
      const active = this._state.activeTrial;
      const now = Date.now();
      if (now >= active.deadlineTimestamp) {
        const elapsedMs = RETRIEVAL_DEADLINE_MS;
        this._appendEvent({
          trial_id: active.trialId,
          timestamp_utc: new Date(now).toISOString(),
          elapsed_ms: elapsedMs,
          event_type: 'trial_timeout',
          page_key: null,
          navigation_type: null,
          qualifiers: null,
          tab_ephemeral_key: null
        });
        return this.completeTrial('timeout');
      }
      return null;
    }

    async completeTrial(outcome = 'success', targetPageKey = null) {
      if (!this._state || !this._state.activeTrial) return null;
      const active = this._state.activeTrial;
      const now = Date.now();
      const elapsedMs = outcome === 'timeout'
        ? RETRIEVAL_DEADLINE_MS
        : Math.min(Math.max(0, now - active.startTimestamp), RETRIEVAL_DEADLINE_MS);

      const trialRecord = {
        trialId: active.trialId,
        participantId: active.participantId,
        sequence: active.sequence,
        period: active.period,
        condition: active.condition,
        tool: active.tool,
        topicPack: active.topicPack,
        targetKey: active.targetKey,
        startTimeUtc: active.startTimeUtc,
        endTimeUtc: new Date(now).toISOString(),
        elapsedMs,
        outcome,
        targetRevisitedDelay: active.targetRevisitedDelay,
        protocolDeviation: active.protocolDeviation,
        incorrectPageOpens: active.incorrectPageOpens,
        tlx: null,
        rawTlx: null
      };

      this._state.trials.push(trialRecord);
      this._state.lastCompletedTrialId = active.trialId;
      this._state.activeTrial = null;

      await this._saveState();
      return trialRecord;
    }

    async submitTlx(trialId, ratings) {
      if (!this._state) await this.init();
      const trial = this._state.trials.find((t) => t.trialId === trialId);
      if (!trial) {
        throw new Error(`Trial record not found for ID: ${trialId}`);
      }

      const dimensions = [
        { key: 'mentalDemand', label: 'Mental Demand' },
        { key: 'physicalDemand', label: 'Physical Demand' },
        { key: 'temporalDemand', label: 'Temporal Demand' },
        { key: 'performance', label: 'Performance' },
        { key: 'effort', label: 'Effort' },
        { key: 'frustration', label: 'Frustration' }
      ];

      const validated = {};
      let sum = 0;

      for (const d of dimensions) {
        const val = Number(ratings[d.key]);
        if (!Number.isFinite(val) || val < 0 || val > 100) {
          throw new Error(`NASA-TLX ${d.label} rating must be a number between 0 and 100.`);
        }
        if (Math.round(val) % 5 !== 0) {
          throw new Error(`NASA-TLX ${d.label} rating must be an increment of 5 (received ${val}).`);
        }
        validated[d.key] = Math.round(val);
        sum += validated[d.key];
      }

      const rawTlx = Number((sum / 6.0).toFixed(1));

      trial.tlx = validated;
      trial.rawTlx = rawTlx;

      this._appendEvent({
        trial_id: trialId,
        timestamp_utc: new Date().toISOString(),
        elapsed_ms: trial.elapsedMs,
        event_type: 'tlx_submitted',
        page_key: null,
        navigation_type: null,
        qualifiers: null,
        tab_ephemeral_key: null
      });

      await this._saveState();
      return trial;
    }

    _appendEvent(event) {
      if (!this._state.events) this._state.events = [];
      this._state.events.push(event);
    }

    generateTrialsCsv() {
      const headers = [
        'participant_id',
        'sequence',
        'period',
        'condition',
        'tool',
        'topic_pack',
        'target_key',
        'start_time_utc',
        'end_time_utc',
        'elapsed_ms',
        'outcome',
        'target_revisited_delay',
        'protocol_deviation',
        'incorrect_page_opens',
        'tlx_mental_demand',
        'tlx_physical_demand',
        'tlx_temporal_demand',
        'tlx_performance',
        'tlx_effort',
        'tlx_frustration',
        'raw_tlx'
      ];

      const rows = [headers.join(',')];
      const trials = (this._state && Array.isArray(this._state.trials)) ? this._state.trials : [];

      for (const t of trials) {
        const tlx = t.tlx || {};
        const values = [
          escapeCsvCell(t.participantId),
          escapeCsvCell(t.sequence),
          escapeCsvCell(t.period),
          escapeCsvCell(t.condition),
          escapeCsvCell(t.tool),
          escapeCsvCell(t.topicPack),
          escapeCsvCell(t.targetKey),
          escapeCsvCell(t.startTimeUtc),
          escapeCsvCell(t.endTimeUtc),
          escapeCsvCell(t.elapsedMs),
          escapeCsvCell(t.outcome),
          escapeCsvCell(Boolean(t.targetRevisitedDelay)),
          escapeCsvCell(Boolean(t.protocolDeviation)),
          escapeCsvCell(t.incorrectPageOpens || 0),
          escapeCsvCell(tlx.mentalDemand !== undefined ? tlx.mentalDemand : ''),
          escapeCsvCell(tlx.physicalDemand !== undefined ? tlx.physicalDemand : ''),
          escapeCsvCell(tlx.temporalDemand !== undefined ? tlx.temporalDemand : ''),
          escapeCsvCell(tlx.performance !== undefined ? tlx.performance : ''),
          escapeCsvCell(tlx.effort !== undefined ? tlx.effort : ''),
          escapeCsvCell(tlx.frustration !== undefined ? tlx.frustration : ''),
          escapeCsvCell(t.rawTlx !== undefined && t.rawTlx !== null ? t.rawTlx : '')
        ];
        rows.push(values.join(','));
      }

      return rows.join('\r\n') + '\r\n';
    }

    generateEventsJson() {
      const events = (this._state && Array.isArray(this._state.events)) ? this._state.events : [];
      return JSON.stringify(events, null, 2);
    }

    getDataDictionaryText() {
      return DATA_DICTIONARY_TEXT;
    }

    async clearStudyRecords() {
      this._state = createInitialStudyState();
      if (this.adapter) {
        await this.adapter.set({ [STUDY_STORAGE_KEY]: this._state });
      }
      return true;
    }
  }

  const DATA_DICTIONARY_TEXT = `# Spatial Browser History — Study Data Dictionary

Document Version: 1.0.0
Associated Files: study-trials.csv, study-events.json
Storage Key: spatial_browser_study_data (local-only, separate from spatial_browser_history_data)

## 1. study-trials.csv Schema
Each row corresponds to one condition trial evaluated by a participant.

- participant_id (String): Pseudonymous participant code (P01-P999).
- sequence (String): Counterbalanced sequence identifier (seq_1, seq_2, seq_3, seq_4).
- period (Integer): Study session block index (1 or 2).
- condition (String): Retrieval interface condition: A (Chrome History) or B (Spatial History).
- tool (String): Tool identifier (chrome_history or spatial_history).
- topic_pack (String): Assigned synthetic topic corpus (pack_x or pack_y).
- target_key (String): Opaque allowlisted target page identifier (px_materials or py_modern1896).
- start_time_utc (String): ISO 8601 UTC timestamp of retrieval timer start.
- end_time_utc (String): ISO 8601 UTC timestamp of retrieval trial conclusion.
- elapsed_ms (Integer): Total elapsed duration in milliseconds (<= 120000).
- outcome (String): Concluding status: success, timeout (>120s), or abandoned.
- target_revisited_delay (Boolean): Whether target was revisited during 10-min setup delay.
- protocol_deviation (Boolean): Whether experimental deviation occurred during round.
- incorrect_page_opens (Integer): Non-target allowlisted corpus pages loaded during retrieval.
- tlx_mental_demand (Number): NASA-TLX Mental Demand rating (0-100, step 5).
- tlx_physical_demand (Number): NASA-TLX Physical Demand rating (0-100, step 5).
- tlx_temporal_demand (Number): NASA-TLX Temporal Demand rating (0-100, step 5).
- tlx_performance (Number): NASA-TLX Performance rating (0-100, step 5, 0=Perfect, 100=Failure).
- tlx_effort (Number): NASA-TLX Effort rating (0-100, step 5).
- tlx_frustration (Number): NASA-TLX Frustration rating (0-100, step 5).
- raw_tlx (Number): Unweighted arithmetic mean across all six NASA-TLX subscales (0.0-100.0).

## 2. study-events.json Schema
Array of JSON event objects capturing chronological actions during timed retrieval:
- trial_id (String): Format trial_{participant_id}_p{period}_{condition}.
- timestamp_utc (String): Exact ISO 8601 UTC timestamp of event.
- elapsed_ms (Integer): Milliseconds elapsed since trial start.
- event_type (String): trial_start, corpus_navigation, extension_search, extension_zoom, trial_success, trial_timeout, trial_abandon, session_finish, tlx_submitted.
- page_key (String | null): Opaque allowlisted corpus page key (px_*, py_*).
- navigation_type (String | null): Transition type (link, typed, reload, back_forward).
- qualifiers (Array<String> | null): Transition qualifiers (client_redirect, from_address_bar).
- tab_ephemeral_key (String | null): Ephemeral session tab identifier (e.g. tab_1).

## 3. Privacy Guarantees
- Zero External Network Communication: All data stored and retained strictly on-device.
- Corpus Isolation: Off-corpus web pages and URLs are strictly ignored and never logged.
- Zero PII: No names, student IDs, query strings, URLs, or free-form inputs are captured.`;

  return {
    STUDY_STORAGE_KEY,
    CURRENT_STUDY_SCHEMA_VERSION,
    RETRIEVAL_DEADLINE_MS,
    LATIN_SQUARE_SEQUENCES,
    PARTICIPANT_ID_REGEX,
    isValidParticipantId,
    getSequenceAssignment,
    StudyManager,
    createInitialStudyState,
    DATA_DICTIONARY_TEXT
  };
});
