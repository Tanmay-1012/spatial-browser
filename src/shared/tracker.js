/**
 * Spatial Browser History - Navigation Tracker (V2)
 * 
 * Intercepts top-level browser navigations, SPA route changes, Back/Forward traversals,
 * and completed downloads. Manages session safety, startup barriers, branch-aware history
 * stacks, and download provenance attribution.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();
    if (typeof globalThis !== 'undefined') {
      globalThis.SpatialTracker = exports;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Helper to determine if a URL represents a trackable HTTP/HTTPS web page.
   */
  function isTrackableUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    try {
      const parsed = new URL(rawUrl);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  /**
   * Normalizes a URL by stripping trivial trailing slashes for comparison.
   */
  function normalizeUrl(rawUrl) {
    try {
      const u = new URL(rawUrl);
      let clean = u.origin + u.pathname;
      if (clean.length > 1 && clean.endsWith('/')) {
        clean = clean.slice(0, -1);
      }
      return clean + u.search + u.hash;
    } catch (_) {
      return rawUrl;
    }
  }

  /**
   * Extracts base URL without hash fragment to identify anchor-only scrolls.
   */
  function getBaseUrl(rawUrl) {
    try {
      const u = new URL(rawUrl);
      return u.origin + u.pathname + u.search;
    } catch (_) {
      return rawUrl;
    }
  }

  /**
   * Extracts basename of a filename (sanitizing directories and filesystem paths).
   */
  function getBasename(filePath) {
    if (!filePath || typeof filePath !== 'string') return 'download';
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || 'download';
  }

  /**
   * Extracts hostname/domain from a URL safely.
   */
  function extractDomain(rawUrl) {
    try {
      const u = new URL(rawUrl);
      return u.hostname || 'Source unavailable';
    } catch (_) {
      return 'Source unavailable';
    }
  }

  /**
   * NavigationTracker coordinates event listeners with storage persistence.
   */
  class NavigationTracker {
    constructor(storageManager, customApi, options = {}) {
      this.storage = storageManager;
      this.api = customApi || (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));
      this.sessionStorage = options.sessionStorage || (this.api?.storage?.session || (this.storage?.adapter?._getRawSessionStorage ? this.storage.adapter._getRawSessionStorage() : null));
      this.pendingOpeners = new Map();
      this.recentNavigations = new Map();
      this.debounceWindowMs = 600;
      this.tabQueues = new Map();
      this.observedTabIds = new Set();
      this._boundListeners = null;

      // Session readiness barrier & event buffer
      this.sessionInitialized = false;
      this.sessionInitializing = false;
      this.sessionInitPromise = null;
      this.resolveSessionReady = null;
      this.sessionReadyPromise = new Promise((resolve) => {
        this.resolveSessionReady = resolve;
      });
      this.sessionPendingQueue = [];
      this.maxPendingQueueSize = 20;
      this.initializedPostStartup = false;
    }

    /**
     * Initializes the tracker and registers browser event listeners synchronously.
     */
    init() {
      if (!this.api) {
        console.warn('[SpatialTracker] Extension API unavailable. Tracking disabled.');
        return;
      }

      this._registerListeners();

      // Trigger background initialization check
      this.ensureSessionReady().catch((err) => {
        console.warn('[SpatialTracker] Session readiness initialization warning:', err);
      });
    }

    _registerListeners() {
      const api = this.api;

      const onCommittedListener = (details) => {
        return this.handleNavigationCommitted(details);
      };

      const onHistoryStateUpdatedListener = (details) => {
        return this.handleHistoryStateUpdated(details);
      };

      const onReferenceFragmentUpdatedListener = (details) => {
        return this.handleReferenceFragmentUpdated(details);
      };

      const onCreatedNavigationTargetListener = (details) => {
        return this.handleCreatedNavigationTarget(details);
      };

      const onTabCreatedListener = (tab) => {
        return this.handleTabCreated(tab);
      };

      const onTabUpdatedListener = (tabId, changeInfo, tab) => {
        return this.handleTabUpdated(tabId, changeInfo, tab);
      };

      const onTabRemovedListener = (tabId) => {
        return this.handleTabRemoved(tabId);
      };

      const onTabReplacedListener = (addedTabId, removedTabId) => {
        return this.handleTabReplaced(addedTabId, removedTabId);
      };

      const onDownloadCreatedListener = (downloadItem) => {
        return this.handleDownloadCreated(downloadItem);
      };

      const onDownloadChangedListener = (downloadDelta) => {
        return this.handleDownloadChanged(downloadDelta);
      };

      if (api.webNavigation && api.webNavigation.onCommitted) {
        api.webNavigation.onCommitted.addListener(onCommittedListener);
      }
      if (api.webNavigation && api.webNavigation.onHistoryStateUpdated) {
        api.webNavigation.onHistoryStateUpdated.addListener(onHistoryStateUpdatedListener);
      }
      if (api.webNavigation && api.webNavigation.onReferenceFragmentUpdated) {
        api.webNavigation.onReferenceFragmentUpdated.addListener(onReferenceFragmentUpdatedListener);
      }
      if (api.webNavigation && api.webNavigation.onCreatedNavigationTarget) {
        api.webNavigation.onCreatedNavigationTarget.addListener(onCreatedNavigationTargetListener);
      }
      if (api.tabs && api.tabs.onCreated) {
        api.tabs.onCreated.addListener(onTabCreatedListener);
      }
      if (api.tabs && api.tabs.onUpdated) {
        api.tabs.onUpdated.addListener(onTabUpdatedListener);
      }
      if (api.tabs && api.tabs.onRemoved) {
        api.tabs.onRemoved.addListener(onTabRemovedListener);
      }
      if (api.tabs && api.tabs.onReplaced) {
        api.tabs.onReplaced.addListener(onTabReplacedListener);
      }
      if (api.downloads && api.downloads.onCreated) {
        api.downloads.onCreated.addListener(onDownloadCreatedListener);
      }
      if (api.downloads && api.downloads.onChanged) {
        api.downloads.onChanged.addListener(onDownloadChangedListener);
      }

      this._boundListeners = {
        onCommittedListener,
        onHistoryStateUpdatedListener,
        onReferenceFragmentUpdatedListener,
        onCreatedNavigationTargetListener,
        onTabCreatedListener,
        onTabUpdatedListener,
        onTabRemovedListener,
        onTabReplacedListener,
        onDownloadCreatedListener,
        onDownloadChangedListener
      };
    }

    destroy() {
      if (!this.api || !this._boundListeners) return;
      const api = this.api;
      const b = this._boundListeners;
      if (api.webNavigation?.onCommitted?.removeListener) api.webNavigation.onCommitted.removeListener(b.onCommittedListener);
      if (api.webNavigation?.onHistoryStateUpdated?.removeListener) api.webNavigation.onHistoryStateUpdated.removeListener(b.onHistoryStateUpdatedListener);
      if (api.webNavigation?.onReferenceFragmentUpdated?.removeListener) api.webNavigation.onReferenceFragmentUpdated.removeListener(b.onReferenceFragmentUpdatedListener);
      if (api.webNavigation?.onCreatedNavigationTarget?.removeListener) api.webNavigation.onCreatedNavigationTarget.removeListener(b.onCreatedNavigationTargetListener);
      if (api.tabs?.onCreated?.removeListener) api.tabs.onCreated.removeListener(b.onTabCreatedListener);
      if (api.tabs?.onUpdated?.removeListener) api.tabs.onUpdated.removeListener(b.onTabUpdatedListener);
      if (api.tabs?.onRemoved?.removeListener) api.tabs.onRemoved.removeListener(b.onTabRemovedListener);
      if (api.tabs?.onReplaced?.removeListener) api.tabs.onReplaced.removeListener(b.onTabReplacedListener);
      if (api.downloads?.onCreated?.removeListener) api.downloads.onCreated.removeListener(b.onDownloadCreatedListener);
      if (api.downloads?.onChanged?.removeListener) api.downloads.onChanged.removeListener(b.onDownloadChangedListener);
    }

    /**
     * Session readiness gateway.
     * Checks storage.session with bounded retries.
     * - If storage fails: fails closed (barrier stays closed, events queue or drop).
     * - If sessionInitialized is true: resolves barrier immediately.
     * - If absent: captures initial checkpoints (idempotent), commits baseline,
     *   writes session marker with retry, and drains queue on success.
     */
    async ensureSessionReady() {
      if (this.sessionInitialized) {
        return Promise.resolve();
      }
      if (this.sessionInitializing && this.sessionInitPromise) {
        return this.sessionInitPromise;
      }

      this.sessionInitializing = true;
      this.sessionInitPromise = (async () => {
        const markerRead = await this._readSessionMarkerWithRetry();
        if (!markerRead.success) {
          console.warn('[SpatialHistory:SessionStorageUnavailable] Failed to read session storage.');
          this.sessionInitializing = false;
          return;
        }

        if (markerRead.value === true) {
          this.sessionInitialized = true;
          this.initializedPostStartup = true;
          if (this.resolveSessionReady) this.resolveSessionReady();
          this._drainSessionPendingQueue();
          this.sessionInitializing = false;
          return;
        }

        // Fresh session: live tabs reconciliation
        await this.captureInitialCheckpoints();

        // Commit session marker
        const markerWritten = await this._writeSessionMarkerWithRetry();
        if (!markerWritten) {
          console.warn('[SpatialHistory:SessionMarkerWriteFailed] Failed to write session marker after local commit.');
          this.sessionInitializing = false;
          return;
        }

        this.sessionInitialized = true;
        this.initializedPostStartup = true;
        if (this.resolveSessionReady) this.resolveSessionReady();
        this._drainSessionPendingQueue();
        this.sessionInitializing = false;
      })();

      return this.sessionInitPromise;
    }

    async _readSessionMarkerWithRetry() {
      const delays = [50, 100, 200];
      const sessionRaw = this.sessionStorage || (this.api?.storage?.session);
      if (!sessionRaw) {
        return { success: false, value: undefined };
      }

      for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
          let result;
          if (typeof sessionRaw.get === 'function') {
            const p = sessionRaw.get('sessionInitialized');
            result = (p && typeof p.then === 'function') ? await p : await new Promise((res, rej) => {
              sessionRaw.get('sessionInitialized', (items) => {
                const err = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError);
                if (err) rej(err); else res(items);
              });
            });
          }
          const val = result ? result.sessionInitialized : undefined;
          return { success: true, value: val };
        } catch (err) {
          if (attempt < delays.length) {
            await new Promise((r) => setTimeout(r, delays[attempt]));
          }
        }
      }
      return { success: false, value: undefined };
    }

    async _writeSessionMarkerWithRetry() {
      const delays = [50, 100, 200];
      const sessionRaw = this.sessionStorage || (this.api?.storage?.session);
      if (!sessionRaw) return false;

      for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
          if (typeof sessionRaw.set === 'function') {
            const p = sessionRaw.set({ sessionInitialized: true });
            if (p && typeof p.then === 'function') {
              await p;
            } else {
              await new Promise((res, rej) => {
                sessionRaw.set({ sessionInitialized: true }, () => {
                  const err = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError);
                  if (err) rej(err); else res();
                });
              });
            }
          }
          return true;
        } catch (err) {
          if (attempt < delays.length) {
            await new Promise((r) => setTimeout(r, delays[attempt]));
          }
        }
      }
      return false;
    }

    async _withSessionGate(operation) {
      if (this.sessionInitialized) {
        return operation();
      }

      if (this.sessionPendingQueue.length >= this.maxPendingQueueSize) {
        const dropped = this.sessionPendingQueue.shift();
        if (dropped && dropped.reject) {
          dropped.reject(new Error('[SpatialTracker] Event dropped due to initialization barrier overflow'));
        }
      }

      return new Promise((resolve, reject) => {
        this.sessionPendingQueue.push({ operation, resolve, reject });
      });
    }

    async _drainSessionPendingQueue() {
      while (this.sessionPendingQueue.length > 0) {
        const item = this.sessionPendingQueue.shift();
        if (item) {
          try {
            const res = await item.operation();
            item.resolve(res);
          } catch (err) {
            item.reject(err);
          }
        }
      }
    }

    /**
     * Handles top-level committed page loads with branch-awareness.
     */
    async handleNavigationCommitted(details) {
      if (!details || details.frameId !== 0) return null;
      if (!isTrackableUrl(details.url)) return null;
      const tabId = details.tabId;
      this.observedTabIds.add(tabId);
      return this._withSessionGate(() => {
        return this._enqueueTab(tabId, () => this._processUrlChange(details, 'committed'));
      });
    }

    /**
     * Handles SPA client-side route updates.
     */
    async handleHistoryStateUpdated(details) {
      if (!details || details.frameId !== 0) return null;
      if (!isTrackableUrl(details.url)) return null;
      const tabId = details.tabId;
      this.observedTabIds.add(tabId);
      return this._withSessionGate(() => {
        return this._enqueueTab(tabId, () => this._processUrlChange(details, 'history'));
      });
    }

    /**
     * Handles fragment changes.
     */
    async handleReferenceFragmentUpdated(details) {
      if (!details || details.frameId !== 0) return null;
      if (!isTrackableUrl(details.url)) return null;
      const tabId = details.tabId;
      this.observedTabIds.add(tabId);
      return this._withSessionGate(() => {
        return this._enqueueTab(tabId, () => this._processUrlChange(details, 'fragment'));
      });
    }

    _enqueueTab(tabId, operation) {
      const key = String(tabId);
      const previous = this.tabQueues.get(key) || Promise.resolve();
      const current = previous.catch(() => {}).then(operation);
      this.tabQueues.set(key, current);
      return current.finally(() => {
        if (this.tabQueues.get(key) === current) this.tabQueues.delete(key);
      });
    }

    _isDuplicateSignal(tabId, url, source) {
      const now = Date.now();
      const key = `${tabId}:${normalizeUrl(url)}`;
      const previous = this.recentNavigations.get(key);
      this.recentNavigations.set(key, { source, receivedAt: now });
      this._pruneRecentNavigations(now);
      return Boolean(previous && previous.source !== source && now - previous.receivedAt < this.debounceWindowMs);
    }

    async _processUrlChange(details, source) {
      const tabId = details.tabId;
      const url = details.url;
      const timestamp = Number.isFinite(details.timeStamp) ? Math.round(details.timeStamp) : Date.now();

      if (this._isDuplicateSignal(tabId, url, source)) return null;

      const isForwardBack = Array.isArray(details.transitionQualifiers) &&
        details.transitionQualifiers.includes('forward_back');

      const tabState = await this.storage.getTabState(tabId);
      const currentNode = await this.storage.getCurrentNodeForTab(tabId);

      // Reload suppression: same URL on same active node (never suppress forward_back)
      if (!isForwardBack && currentNode && normalizeUrl(currentNode.url) === normalizeUrl(url)) {
        this.pendingOpeners.delete(tabId);
        return null;
      }

      // Fragment-only scrolling
      if (!isForwardBack && currentNode && getBaseUrl(currentNode.url) === getBaseUrl(url) && !this._isHashRoute(url)) {
        await this.storage.updateNodeUrl(currentNode.id, url);
        return null;
      }

      // 1. Back/Forward Traversal Resolution
      if (isForwardBack && tabState && Array.isArray(tabState.historyStack) && tabState.historyStack.length > 0) {
        const state = await this.storage.getState();
        const stack = tabState.historyStack;
        const i = typeof tabState.historyIndex === 'number' ? tabState.historyIndex : stack.length - 1;

        const matchingIndices = [];
        for (let k = 0; k < stack.length; k++) {
          const nid = stack[k];
          const n = state.nodes[nid];
          if (n && normalizeUrl(n.url) === normalizeUrl(url)) {
            matchingIndices.push(k);
          }
        }

        const isBackTarget = matchingIndices.includes(i - 1);
        const isForwardTarget = matchingIndices.includes(i + 1);

        // Ambiguity: multiple matching indices in history stack, or both backward & forward neighbors match
        if (matchingIndices.length > 1 || (isBackTarget && isForwardTarget)) {
          tabState.lineageInvalidated = true;
          tabState.currentNodeId = null;
          await this.storage.setTabState(tabId, tabState);
          this.pendingOpeners.delete(tabId);
          return null;
        }

        if (isBackTarget) {
          tabState.historyIndex = i - 1;
          tabState.currentNodeId = stack[i - 1];
          tabState.lineageInvalidated = false;
          await this.storage.setTabState(tabId, tabState);
          this.pendingOpeners.delete(tabId);
          return null;
        }

        if (isForwardTarget) {
          tabState.historyIndex = i + 1;
          tabState.currentNodeId = stack[i + 1];
          tabState.lineageInvalidated = false;
          await this.storage.setTabState(tabId, tabState);
          this.pendingOpeners.delete(tabId);
          return null;
        }

        if (matchingIndices.length === 1) {
          const targetIndex = matchingIndices[0];
          tabState.historyIndex = targetIndex;
          tabState.currentNodeId = stack[targetIndex];
          tabState.lineageInvalidated = false;
          await this.storage.setTabState(tabId, tabState);
          this.pendingOpeners.delete(tabId);
          return null;
        }

        // Unrecorded forward_back target: resynchronize as root checkpoint in new tree
        this.pendingOpeners.delete(tabId);
        return this.storage.recordVisit({
          url,
          title: url,
          timestamp,
          parentNodeId: null,
          isCheckpoint: true,
          tabId,
          resetStack: true
        });
      }

      // 2. Navigation after lineage invalidation
      if (tabState && tabState.lineageInvalidated === true) {
        this.pendingOpeners.delete(tabId);
        return this.storage.recordVisit({
          url,
          title: url,
          timestamp,
          parentNodeId: null,
          isCheckpoint: true,
          tabId,
          resetStack: true
        });
      }

      // 3. Ordinary Navigation
      let parentNodeId = null;
      let isCheckpoint = false;
      let openerTabId = this.pendingOpeners.get(tabId);
      this.pendingOpeners.delete(tabId);

      if (!currentNode && typeof openerTabId !== 'number' && this.api?.tabs?.get) {
        try {
          const tab = await this.api.tabs.get(tabId);
          if (tab && typeof tab.openerTabId === 'number') openerTabId = tab.openerTabId;
        } catch (_) {}
      }

      if (typeof openerTabId === 'number' && openerTabId !== tabId) {
        const openerNode = await this.storage.getCurrentNodeForTab(openerTabId);
        if (openerNode && openerNode.id) parentNodeId = openerNode.id;
        else isCheckpoint = true;
      } else if (currentNode && currentNode.id) {
        parentNodeId = currentNode.id;
      } else {
        isCheckpoint = true;
      }

      let title = url;
      if (this.api?.tabs?.get) {
        try {
          const tab = await this.api.tabs.get(tabId);
          if (tab && tab.title) title = tab.title;
        } catch (_) {}
      }

      return this.storage.recordVisit({ url, title, timestamp, parentNodeId, isCheckpoint, tabId });
    }

    _isHashRoute(url) {
      try {
        const hash = new URL(url).hash;
        return hash.startsWith('#/') || hash.startsWith('#!');
      } catch (_) {
        return false;
      }
    }

    handleTabCreated(tab) {
      if (!tab) return;
      this.observedTabIds.add(tab.id);
      if (typeof tab.openerTabId === 'number') {
        this.pendingOpeners.set(tab.id, tab.openerTabId);
      }
    }

    handleCreatedNavigationTarget(details) {
      if (!details || typeof details.tabId !== 'number') return;
      this.observedTabIds.add(details.tabId);
      if (typeof details.sourceTabId === 'number' && details.sourceTabId !== details.tabId) {
        this.pendingOpeners.set(details.tabId, details.sourceTabId);
      }
    }

    async handleTabUpdated(tabId, changeInfo, tab) {
      if (!changeInfo) return null;
      this.observedTabIds.add(tabId);

      return this._withSessionGate(() => {
        return this._enqueueTab(tabId, async () => {
          let urlResult = null;
          if (typeof changeInfo.url === 'string' && tab && tab.status !== 'loading' && isTrackableUrl(changeInfo.url)) {
            urlResult = await this._processUrlChange({
              tabId,
              frameId: 0,
              url: changeInfo.url,
              timeStamp: Date.now()
            }, 'tab-url');
          }

          if (typeof changeInfo.title !== 'string' || !changeInfo.title.trim()) return urlResult;
          const currentNode = await this.storage.getCurrentNodeForTab(tabId);
          const newTitle = changeInfo.title.trim();
          if (currentNode && tab && isTrackableUrl(tab.url) && normalizeUrl(tab.url) !== normalizeUrl(currentNode.url)) {
            return urlResult;
          }
          if (currentNode && currentNode.title !== newTitle) {
            return await this.storage.updateNodeTitle(currentNode.id, newTitle);
          }
          return urlResult;
        });
      });
    }

    async handleTabRemoved(tabId) {
      this.pendingOpeners.delete(tabId);
      this.observedTabIds.delete(tabId);
      return this._enqueueTab(tabId, () => this.storage.removeTabState(tabId));
    }

    async handleTabReplaced(addedTabId, removedTabId) {
      this.observedTabIds.delete(removedTabId);
      this.observedTabIds.add(addedTabId);
      if (this.pendingOpeners.has(removedTabId)) {
        this.pendingOpeners.set(addedTabId, this.pendingOpeners.get(removedTabId));
        this.pendingOpeners.delete(removedTabId);
      }
      return await this.storage.replaceTabState(removedTabId, addedTabId);
    }

    async handleDownloadCreated(downloadItem) {
      if (!downloadItem || !downloadItem.id) return null;
      if (downloadItem.state === 'complete') {
        return this._processCompletedDownload(downloadItem);
      }
    }

    async handleDownloadChanged(downloadDelta) {
      if (!downloadDelta || !downloadDelta.id) return null;
      if (downloadDelta.state && downloadDelta.state.current === 'complete') {
        if (this.api?.downloads?.search) {
          try {
            const items = await this.api.downloads.search({ id: downloadDelta.id });
            if (items && items.length > 0) {
              return this._processCompletedDownload(items[0]);
            }
          } catch (_) {}
        }
        return this._processCompletedDownload({
          id: downloadDelta.id,
          filename: downloadDelta.filename ? downloadDelta.filename.current : 'download',
          url: downloadDelta.url ? downloadDelta.url.current : '',
          endTime: downloadDelta.endTime ? downloadDelta.endTime.current : Date.now()
        });
      }
    }

    async _processCompletedDownload(item) {
      if (!item || typeof item.id === 'undefined') return null;

      return this._withSessionGate(async () => {
        const state = await this.storage.getState();
        const downloadId = item.id;
        const mapKey = String(downloadId);

        if (state.metadata.downloadNodeMap && state.metadata.downloadNodeMap[mapKey]) {
          return state.nodes[state.metadata.downloadNodeMap[mapKey]] || null;
        }

        let parentNodeId = null;
        let originDomain = 'Source unavailable';
        const referrer = item.referrer;
        if (referrer && isTrackableUrl(referrer)) {
          const matches = Object.values(state.nodes).filter(
            (n) => n.nodeType === 'page' && normalizeUrl(n.url) === normalizeUrl(referrer)
          );
          if (matches.length === 1) {
            parentNodeId = matches[0].id;
            originDomain = extractDomain(matches[0].url);
          }
        }

        const filename = getBasename(item.filename);
        const timestamp = item.endTime ? (new Date(item.endTime).getTime() || Date.now()) : Date.now();

        return this.storage.recordVisit({
          nodeType: 'download',
          downloadId,
          filename,
          originDomain,
          timestamp,
          parentNodeId
        });
      });
    }

    /**
     * Discovers live tabs at initialization and enforces zero-trust single-node baseline.
     */
    async captureInitialCheckpoints() {
      if (!this.api || !this.api.tabs || !this.api.tabs.query) return [];

      const results = [];
      try {
        const tabs = await this.api.tabs.query({});
        const trackableTabs = tabs.filter((tab) => tab && typeof tab.id === 'number' && isTrackableUrl(tab.url));
        const liveTabIds = new Set([
          ...trackableTabs.map((tab) => String(tab.id)),
          ...Array.from(this.observedTabIds, (tabId) => String(tabId))
        ]);
        await this.storage.retainTabState(liveTabIds);

        const state = await this.storage.getState();

        for (const tab of trackableTabs) {
          const recorded = await this._enqueueTab(tab.id, async () => {
            const tabState = await this.storage.getTabState(tab.id);

            // 1. Idempotency Check: Already committed single-node baseline
            if (tabState && tabState.baselineEstablished === true &&
                Array.isArray(tabState.historyStack) && tabState.historyStack.length === 1 &&
                tabState.historyIndex === 0 &&
                state.nodes[tabState.currentNodeId] &&
                normalizeUrl(state.nodes[tabState.currentNodeId].url) === normalizeUrl(tab.url)) {
              if (tab.title && state.nodes[tabState.currentNodeId].title !== tab.title) {
                await this.storage.updateNodeTitle(tabState.currentNodeId, tab.title);
              }
              return null;
            }

            // 2. Untrusted Prior-Session State Check: Multi-node stack or missing baselineEstablished
            if (tabState && (
                !tabState.baselineEstablished ||
                (Array.isArray(tabState.historyStack) && tabState.historyStack.length > 1) ||
                tabState.historyIndex !== 0
            )) {
              if (tabState.currentNodeId && state.nodes[tabState.currentNodeId] &&
                  normalizeUrl(state.nodes[tabState.currentNodeId].url) === normalizeUrl(tab.url)) {
                await this.storage.setTabState(tab.id, {
                  currentNodeId: tabState.currentNodeId,
                  historyStack: [tabState.currentNodeId],
                  historyIndex: 0,
                  lineageInvalidated: false,
                  baselineEstablished: true
                });
                if (tab.title && state.nodes[tabState.currentNodeId].title !== tab.title) {
                  await this.storage.updateNodeTitle(tabState.currentNodeId, tab.title);
                }
                return null;
              }
            }

            // 3. Match candidate nodes in graph (|M|)
            const candidateNodes = Object.values(state.nodes).filter(
              (n) => n.nodeType !== 'download' && normalizeUrl(n.url) === normalizeUrl(tab.url)
            );

            if (candidateNodes.length === 1) {
              const matched = candidateNodes[0];
              await this.storage.setTabState(tab.id, {
                currentNodeId: matched.id,
                historyStack: [matched.id],
                historyIndex: 0,
                lineageInvalidated: false,
                baselineEstablished: true
              });
              if (tab.title && matched.title !== tab.title) {
                await this.storage.updateNodeTitle(matched.id, tab.title);
              }
              return null;
            }

            // 4. Ambiguous or zero matches: independent root checkpoint
            return this.storage.recordVisit({
              url: tab.url,
              title: tab.title || tab.url,
              timestamp: Date.now(),
              parentNodeId: null,
              isCheckpoint: true,
              tabId: tab.id
            });
          });

          if (recorded) results.push(recorded);
        }
      } catch (err) {
        console.warn('[SpatialTracker] Failed to record initial checkpoints:', err);
      }
      return results;
    }

    _pruneRecentNavigations(now) {
      for (const [key, entry] of this.recentNavigations.entries()) {
        if (now - entry.receivedAt > 10000) {
          this.recentNavigations.delete(key);
        }
      }
    }
  }

  return {
    NavigationTracker,
    isTrackableUrl,
    normalizeUrl,
    getBaseUrl,
    getBasename,
    extractDomain
  };
});
