/**
 * Spatial Browser History - Study Manager (Schema V1)
 *
 * Manages opt-in, privacy-preserving within-subject experimental trial data,
 * timed retrieval windows, target completion detection, incorrect corpus page open counts,
 * NASA-TLX workload scoring, and local CSV/JSON export.
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
      activeTrial: null,
      lastCompletedTrialId: null,
      trials: [],
      events: [],
      metadata: {
        createdAt: Date.now(),
        lastExportedAt: null
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

    async startTrial(config = {}) {
      if (!this._state) await this.init();
      if (this._state.activeTrial && this._state.activeTrial.status === 'active') {
        throw new Error('A study trial is already active. Stop or complete the current trial first.');
      }

      const corpus = getCorpusApi();
      const participantId = String(config.participantId || 'P01').trim();
      const sequence = String(config.sequence || 'seq_1').trim();
      const period = Number(config.period) || 1;
      const condition = String(config.condition || 'B').toUpperCase() === 'A' ? 'A' : 'B';
      const tool = condition === 'A' ? 'chrome_history' : 'spatial_history';
      const topicPack = String(config.topicPack || 'pack_x').trim();
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
        lastSeenCorpusKey: null,
        tabMap: {}
      };

      this._state.studyEnabled = true;
      this._state.activeTrial = activeTrial;

      this._appendEvent({
        trialId,
        timestampUtc: activeTrial.startTimeUtc,
        elapsedMs: 0,
        eventType: 'trial_start',
        pageKey: null,
        navigationType: null,
        qualifiers: null,
        tabEphemeralKey: null
      });

      await this._saveState();
      return activeTrial;
    }

    async handleNavigation(details) {
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
      if (!pageKey) {
        // Off-corpus navigation: completely ignored to preserve privacy
        return null;
      }

      // Assign opaque ephemeral tab key (e.g. 'tab_1')
      const tabIdStr = String(details.tabId);
      if (!active.tabMap[tabIdStr]) {
        active.tabMap[tabIdStr] = 'tab_' + (Object.keys(active.tabMap).length + 1);
      }
      const ephemeralTab = active.tabMap[tabIdStr];

      const elapsedMs = Math.max(0, now - active.startTimestamp);
      const transitionType = details.transitionType || 'link';
      const qualifiers = Array.isArray(details.transitionQualifiers) ? details.transitionQualifiers : [];

      // Check if target reached
      if (pageKey === active.targetKey) {
        // Complete when top-level navigation reached target
        this._appendEvent({
          trialId: active.trialId,
          timestampUtc: new Date(now).toISOString(),
          elapsedMs,
          eventType: 'trial_success',
          pageKey,
          navigationType: transitionType,
          qualifiers,
          tabEphemeralKey: ephemeralTab
        });
        return this.completeTrial('success', pageKey);
      }

      // Non-target corpus page open:
      // Exclude reloads, redirect intermediates, and same-document hash changes
      const isReload = transitionType === 'reload';
      const isHashChange = Boolean(details.isHashChange);
      const isConsecutiveDuplicate = (pageKey === active.lastSeenCorpusKey);

      if (!isReload && !isHashChange && !isConsecutiveDuplicate) {
        active.incorrectPageOpens += 1;
        active.lastSeenCorpusKey = pageKey;

        this._appendEvent({
          trialId: active.trialId,
          timestampUtc: new Date(now).toISOString(),
          elapsedMs,
          eventType: 'corpus_navigation',
          pageKey,
          navigationType: transitionType,
          qualifiers,
          tabEphemeralKey: ephemeralTab
        });

        await this._saveState();
        return {
          outcome: 'in_progress',
          incorrectPageOpens: active.incorrectPageOpens,
          pageKey
        };
      }

      return null;
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
        trialId: active.trialId,
        timestampUtc: new Date(now).toISOString(),
        elapsedMs,
        eventType,
        pageKey: metadata.pageKey || null,
        navigationType: metadata.navigationType || null,
        qualifiers: metadata.qualifiers || null,
        tabEphemeralKey: null
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
        trialId: active.trialId,
        timestampUtc: new Date(now).toISOString(),
        elapsedMs,
        eventType: 'trial_abandoned',
        pageKey: null,
        navigationType: null,
        qualifiers: null,
        tabEphemeralKey: null
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
          trialId: active.trialId,
          timestampUtc: new Date(now).toISOString(),
          elapsedMs,
          eventType: 'trial_timeout',
          pageKey: null,
          navigationType: null,
          qualifiers: null,
          tabEphemeralKey: null
        });
        return this.completeTrial('timeout');
      }
      return null;
    }

    async completeTrial(outcome = 'success') {
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

      const mental = Math.min(100, Math.max(0, Number(ratings.mentalDemand) || 0));
      const physical = Math.min(100, Math.max(0, Number(ratings.physicalDemand) || 0));
      const temporal = Math.min(100, Math.max(0, Number(ratings.temporalDemand) || 0));
      const performance = Math.min(100, Math.max(0, Number(ratings.performance) || 0));
      const effort = Math.min(100, Math.max(0, Number(ratings.effort) || 0));
      const frustration = Math.min(100, Math.max(0, Number(ratings.frustration) || 0));

      const rawTlx = Number(((mental + physical + temporal + performance + effort + frustration) / 6.0).toFixed(2));

      trial.tlx = {
        mentalDemand: mental,
        physicalDemand: physical,
        temporalDemand: temporal,
        performance: performance,
        effort: effort,
        frustration: frustration
      };
      trial.rawTlx = rawTlx;

      this._appendEvent({
        trialId,
        timestampUtc: new Date().toISOString(),
        elapsedMs: trial.elapsedMs,
        eventType: 'tlx_submitted',
        pageKey: null,
        navigationType: null,
        qualifiers: null,
        tabEphemeralKey: null
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

    async clearStudyRecords() {
      this._state = createInitialStudyState();
      if (this.adapter) {
        await this.adapter.set({ [STUDY_STORAGE_KEY]: this._state });
      }
      return true;
    }
  }

  return {
    STUDY_STORAGE_KEY,
    CURRENT_STUDY_SCHEMA_VERSION,
    RETRIEVAL_DEADLINE_MS,
    StudyManager,
    createInitialStudyState
  };
});
