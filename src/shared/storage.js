/**
 * Spatial Browser History - Storage Manager (Schema V2)
 * 
 * Manages versioned local graph storage, tree hierarchy, download provenance,
 * session safety, and transient tab history state.
 * Enforces serial write coordination (via StorageQueue) and safe graph pruning.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();
    if (typeof globalThis !== 'undefined') {
      globalThis.SpatialStorage = exports;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'spatial_browser_history_data';
  const BACKUP_KEY = 'spatial_browser_history_data_v1_backup';
  const CURRENT_SCHEMA_VERSION = 2;
  const DEFAULT_MAX_NODES = 1000;
  const BACKUP_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Promise-chain queue ensuring all read-modify-write operations
   * are executed strictly in sequential order.
   */
  class StorageQueue {
    constructor() {
      this._chain = Promise.resolve();
    }

    enqueue(operation) {
      const next = this._chain.then(() => operation());
      this._chain = next.catch(function (err) {
        console.error('[SpatialStorage:QueueError]', err);
      });
      return next;
    }
  }

  /**
   * Adapter for Chrome and Firefox extension storage (local and session),
   * with fallback to in-memory store for automated unit testing.
   */
  class StorageAdapter {
    constructor(customStorage, customSessionStorage) {
      this._customStorage = customStorage || null;
      this._customSessionStorage = customSessionStorage || (customStorage && customStorage.session ? customStorage.session : null);
    }

    _getRawStorage() {
      if (this._customStorage) return this._customStorage;
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        return browser.storage.local;
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return chrome.storage.local;
      }
      return null;
    }

    _getRawSessionStorage() {
      if (this._customSessionStorage) return this._customSessionStorage;
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.session) {
        return browser.storage.session;
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
        return chrome.storage.session;
      }
      return null;
    }

    async get(key) {
      const raw = this._getRawStorage();
      if (!raw) {
        throw new Error('Local extension storage is not available in this environment.');
      }

      if (typeof raw.get === 'function') {
        const p = raw.get(key);
        if (p && typeof p.then === 'function') {
          return p;
        }
        return new Promise((resolve, reject) => {
          raw.get(key, (items) => {
            const err = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError);
            if (err) reject(err);
            else resolve(items);
          });
        });
      }
      throw new Error('Unsupported storage interface.');
    }

    async set(items) {
      const raw = this._getRawStorage();
      if (!raw) {
        throw new Error('Local extension storage is not available in this environment.');
      }

      if (typeof raw.set === 'function') {
        const p = raw.set(items);
        if (p && typeof p.then === 'function') {
          return p;
        }
        return new Promise((resolve, reject) => {
          raw.set(items, () => {
            const err = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError);
            if (err) reject(err);
            else resolve();
          });
        });
      }
      throw new Error('Unsupported storage interface.');
    }

    async remove(key) {
      const raw = this._getRawStorage();
      if (!raw) return;
      if (typeof raw.remove === 'function') {
        const p = raw.remove(key);
        if (p && typeof p.then === 'function') return p;
        return new Promise((resolve) => raw.remove(key, resolve));
      }
    }

    async getSession(key) {
      const raw = this._getRawSessionStorage();
      if (!raw) return {};
      if (typeof raw.get === 'function') {
        const p = raw.get(key);
        if (p && typeof p.then === 'function') return p;
        return new Promise((resolve, reject) => {
          raw.get(key, (items) => {
            const err = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError);
            if (err) reject(err);
            else resolve(items);
          });
        });
      }
      return {};
    }

    async setSession(items) {
      const raw = this._getRawSessionStorage();
      if (!raw) return;
      if (typeof raw.set === 'function') {
        const p = raw.set(items);
        if (p && typeof p.then === 'function') return p;
        return new Promise((resolve, reject) => {
          raw.set(items, () => {
            const err = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError);
            if (err) reject(err);
            else resolve();
          });
        });
      }
    }

    async removeSession(key) {
      const raw = this._getRawSessionStorage();
      if (!raw) return;
      if (typeof raw.remove === 'function') {
        const p = raw.remove(key);
        if (p && typeof p.then === 'function') return p;
        return new Promise((resolve) => raw.remove(key, resolve));
      }
    }
  }

  /**
   * Creates an empty, pristine Schema V2 data structure.
   */
  function createInitialState() {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      nodes: {},
      tabState: {},
      metadata: {
        createdAt: Date.now(),
        lastPrunedAt: null,
        totalNodesCreated: 0,
        downloadNodeMap: {}
      }
    };
  }

  /**
   * Generates a collision-resistant, timestamp-prefixed node identifier.
   */
  function generateNodeId(prefix = 'node_') {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    return `${prefix}${ts}_${rand}`;
  }

  /**
   * StorageManager coordinates all graph persistence, migrations, and tab state.
   */
  class StorageManager {
    constructor(options = {}) {
      this.adapter = new StorageAdapter(options.storageBackend, options.sessionBackend);
      this.queue = new StorageQueue();
      this.maxNodes = options.maxNodes || DEFAULT_MAX_NODES;
    }

    /**
     * Initializes storage, applying migrations and passive backup expiration.
     */
    async init() {
      return this.queue.enqueue(async () => {
        const state = await this._loadState();
        await this._expireBackupIfOldInternal();
        return state;
      });
    }

    async _loadState() {
      const result = await this.adapter.get(STORAGE_KEY);
      let data = result ? result[STORAGE_KEY] : null;

      if (!data) {
        data = createInitialState();
        await this.adapter.set({ [STORAGE_KEY]: data });
        return data;
      }

      // Check schema version migration
      if (typeof data.schemaVersion !== 'number' || data.schemaVersion < CURRENT_SCHEMA_VERSION) {
        data = await this._migrateState(data);
        await this.adapter.set({ [STORAGE_KEY]: data });
      }

      return data;
    }

    /**
     * Crash-safe migration from V1 (or earlier) to Schema V2.
     * 1. Creates verified V1 backup under BACKUP_KEY before any mutations.
     * 2. Synthesizes stable treeId and reciprocal parent/child links.
     * 3. Repairs dangling links and breaks cycles safely.
     * 4. Converts numeric-tab-ID tabState to single-node baseline with baselineEstablished.
     * 5. Validates candidate structure before committing.
     */
    async _migrateState(oldData) {
      // 1. Commit raw backup
      try {
        const backupPayload = {
          backupCreatedAt: Date.now(),
          data: JSON.parse(JSON.stringify(oldData))
        };
        await this.adapter.set({ [BACKUP_KEY]: backupPayload });
      } catch (err) {
        console.error('[SpatialStorage:MigrationBackupFailed]', err);
        throw err;
      }

      const candidate = createInitialState();
      if (oldData && typeof oldData === 'object') {
        if (oldData.metadata && typeof oldData.metadata === 'object') {
          candidate.metadata.createdAt = oldData.metadata.createdAt || candidate.metadata.createdAt;
          candidate.metadata.lastPrunedAt = oldData.metadata.lastPrunedAt || null;
          candidate.metadata.totalNodesCreated = oldData.metadata.totalNodesCreated || 0;
        }
      }
      candidate.metadata.downloadNodeMap = {};

      // 2. Ingest nodes
      const rawNodes = (oldData && oldData.nodes && typeof oldData.nodes === 'object') ? oldData.nodes : {};
      for (const [id, rawNode] of Object.entries(rawNodes)) {
        if (!rawNode || typeof rawNode !== 'object') continue;
        const nodeId = String(rawNode.id || id);
        candidate.nodes[nodeId] = {
          id: nodeId,
          treeId: null,
          nodeType: rawNode.nodeType === 'download' ? 'download' : 'page',
          url: rawNode.url || '',
          title: rawNode.title || rawNode.url || (rawNode.filename || ''),
          timestamp: typeof rawNode.timestamp === 'number' ? rawNode.timestamp : Date.now(),
          parentNodeId: rawNode.parentNodeId ? String(rawNode.parentNodeId) : null,
          childNodeIds: Array.isArray(rawNode.childNodeIds) ? rawNode.childNodeIds.map(String) : [],
          isCheckpoint: Boolean(rawNode.isCheckpoint),
          tabId: rawNode.tabId
        };
        if (candidate.nodes[nodeId].nodeType === 'download') {
          candidate.nodes[nodeId].filename = rawNode.filename || candidate.nodes[nodeId].title || 'download';
          candidate.nodes[nodeId].originDomain = rawNode.originDomain || '';
          candidate.nodes[nodeId].downloadId = rawNode.downloadId;
          if (rawNode.downloadId) {
            candidate.metadata.downloadNodeMap[String(rawNode.downloadId)] = nodeId;
          }
        }
      }

      // 3. Repair dangling parent links
      for (const node of Object.values(candidate.nodes)) {
        if (node.parentNodeId && !candidate.nodes[node.parentNodeId]) {
          node.parentNodeId = null;
          node.isCheckpoint = true;
        }
        node.childNodeIds = node.childNodeIds.filter((cid) => Boolean(candidate.nodes[cid]));
      }

      // 4. Cycle detection and resolution
      for (const node of Object.values(candidate.nodes)) {
        let curr = node;
        const seen = new Set([curr.id]);
        while (curr.parentNodeId && candidate.nodes[curr.parentNodeId]) {
          const parent = candidate.nodes[curr.parentNodeId];
          if (seen.has(parent.id)) {
            // Cycle detected: promote current node to root checkpoint
            curr.parentNodeId = null;
            curr.isCheckpoint = true;
            break;
          }
          seen.add(parent.id);
          curr = parent;
        }
      }

      // 5. Enforce reciprocal links
      for (const node of Object.values(candidate.nodes)) {
        if (node.parentNodeId && candidate.nodes[node.parentNodeId]) {
          const parent = candidate.nodes[node.parentNodeId];
          if (!parent.childNodeIds.includes(node.id)) {
            parent.childNodeIds.push(node.id);
          }
        }
      }
      for (const parent of Object.values(candidate.nodes)) {
        parent.childNodeIds = parent.childNodeIds.filter((cid) => {
          const child = candidate.nodes[cid];
          return child && child.parentNodeId === parent.id;
        });
      }

      // 6. TreeId assignment pass (roots get 'tree_' + id; children inherit)
      const roots = Object.values(candidate.nodes).filter((n) => !n.parentNodeId);
      for (const root of roots) {
        root.treeId = 'tree_' + root.id;
        const queue = [root];
        while (queue.length > 0) {
          const curr = queue.shift();
          for (const cid of curr.childNodeIds) {
            const child = candidate.nodes[cid];
            if (child && !child.treeId) {
              child.treeId = curr.treeId;
              queue.push(child);
            }
          }
        }
      }
      for (const node of Object.values(candidate.nodes)) {
        if (!node.treeId) {
          node.treeId = 'tree_' + node.id;
        }
      }

      // 7. Ingest tabState
      const rawTabState = (oldData && oldData.tabState && typeof oldData.tabState === 'object') ? oldData.tabState : {};
      for (const [tabId, entry] of Object.entries(rawTabState)) {
        if (typeof entry === 'string') {
          if (candidate.nodes[entry]) {
            candidate.tabState[tabId] = {
              currentNodeId: entry,
              historyStack: [entry],
              historyIndex: 0,
              lineageInvalidated: false,
              baselineEstablished: true
            };
          }
        } else if (entry && typeof entry === 'object' && entry.currentNodeId) {
          const headId = String(entry.currentNodeId);
          if (candidate.nodes[headId]) {
            const rawStack = Array.isArray(entry.historyStack) ? entry.historyStack.map(String) : [headId];
            const validStack = rawStack.filter((id) => Boolean(candidate.nodes[id]));
            const finalStack = validStack.length > 0 ? validStack : [headId];
            let index = typeof entry.historyIndex === 'number' ? entry.historyIndex : finalStack.length - 1;
            if (index < 0 || index >= finalStack.length) index = finalStack.length - 1;
            candidate.tabState[tabId] = {
              currentNodeId: headId,
              historyStack: finalStack,
              historyIndex: index,
              lineageInvalidated: Boolean(entry.lineageInvalidated),
              baselineEstablished: Boolean(entry.baselineEstablished)
            };
          }
        }
      }

      // 8. Strict structural validation
      if (candidate.schemaVersion !== 2) {
        throw new Error('Migration validation failed: schemaVersion must be 2');
      }
      for (const node of Object.values(candidate.nodes)) {
        if (!node.id || !node.treeId) {
          throw new Error(`Migration validation failed: missing id or treeId on node ${node.id}`);
        }
        if (node.parentNodeId && !candidate.nodes[node.parentNodeId]) {
          throw new Error(`Dangling parent ${node.parentNodeId}`);
        }
      }

      return candidate;
    }

    async _expireBackupIfOldInternal() {
      try {
        const res = await this.adapter.get(BACKUP_KEY);
        if (res && res[BACKUP_KEY]) {
          const backup = res[BACKUP_KEY];
          if (backup.backupCreatedAt && (Date.now() - backup.backupCreatedAt > BACKUP_EXPIRY_MS)) {
            await this.adapter.remove(BACKUP_KEY);
          }
        }
      } catch (err) {
        console.warn('[SpatialStorage] Failed to check/expire backup:', err);
      }
    }

    /**
     * Expire 24-hour backup if elapsed.
     */
    async expireBackupIfOld() {
      return this.queue.enqueue(async () => {
        await this._expireBackupIfOldInternal();
      });
    }

    /**
     * Retrieves the entire current state (read-only snapshot).
     */
    async getState() {
      return this.queue.enqueue(async () => {
        return this._loadState();
      });
    }

    /**
     * Records a new visit node or download item, manages reciprocal links,
     * updates tabState with single-node or forward-truncated stacks,
     * deduplicates downloads, and performs safe pruning.
     */
    async recordVisit(nodeData) {
      return this.queue.enqueue(async () => {
        const state = await this._loadState();

        // 1. Download node processing
        if (nodeData.nodeType === 'download') {
          const downloadId = Number(nodeData.downloadId);
          const mapKey = String(downloadId);

          // Deduplication: if already recorded, return existing node
          if (state.metadata.downloadNodeMap && state.metadata.downloadNodeMap[mapKey]) {
            const existingId = state.metadata.downloadNodeMap[mapKey];
            if (state.nodes[existingId]) {
              return state.nodes[existingId];
            }
          }

          const nodeId = nodeData.id || generateNodeId('dl_node_');
          let parentNodeId = nodeData.parentNodeId || null;
          let isCheckpoint = true;
          let treeId = 'tree_' + nodeId;

          if (parentNodeId && state.nodes[parentNodeId]) {
            const parent = state.nodes[parentNodeId];
            treeId = parent.treeId;
            isCheckpoint = false;
            if (!parent.childNodeIds.includes(nodeId)) {
              parent.childNodeIds.push(nodeId);
            }
          } else {
            parentNodeId = null;
            isCheckpoint = true;
          }

          const dlNode = {
            id: nodeId,
            treeId,
            nodeType: 'download',
            filename: nodeData.filename || 'download',
            originDomain: nodeData.originDomain || 'Source unavailable',
            timestamp: typeof nodeData.timestamp === 'number' ? nodeData.timestamp : Date.now(),
            parentNodeId,
            childNodeIds: [],
            isCheckpoint,
            downloadId
          };
          dlNode.title = dlNode.filename;

          state.nodes[nodeId] = dlNode;
          if (!state.metadata.downloadNodeMap) state.metadata.downloadNodeMap = {};
          state.metadata.downloadNodeMap[mapKey] = nodeId;
          state.metadata.totalNodesCreated = (state.metadata.totalNodesCreated || 0) + 1;

          this._pruneGraph(state);
          await this.adapter.set({ [STORAGE_KEY]: state });
          return dlNode;
        }

        // 2. Page visit node processing
        const nodeId = nodeData.id || generateNodeId('node_');
        let parentNodeId = nodeData.parentNodeId || null;
        let isCheckpoint = Boolean(nodeData.isCheckpoint);
        let treeId = 'tree_' + nodeId;

        if (parentNodeId && state.nodes[parentNodeId]) {
          const parent = state.nodes[parentNodeId];
          treeId = parent.treeId;
          if (!parent.childNodeIds.includes(nodeId)) {
            parent.childNodeIds.push(nodeId);
          }
        } else {
          parentNodeId = null;
          isCheckpoint = true;
        }

        const newNode = {
          id: nodeId,
          treeId,
          nodeType: 'page',
          url: nodeData.url,
          title: nodeData.title || nodeData.url,
          timestamp: typeof nodeData.timestamp === 'number' ? nodeData.timestamp : Date.now(),
          parentNodeId,
          childNodeIds: [],
          isCheckpoint,
          tabId: nodeData.tabId
        };

        state.nodes[nodeId] = newNode;

        // Tab state updates
        if (typeof nodeData.tabId !== 'undefined' && nodeData.tabId !== null) {
          const tabKey = String(nodeData.tabId);
          const existingTab = state.tabState[tabKey];

          if (!nodeData.resetStack && (!existingTab || existingTab.lineageInvalidated !== true) && existingTab && typeof existingTab === 'object' && Array.isArray(existingTab.historyStack)) {
            const stack = existingTab.historyStack.slice(0, existingTab.historyIndex + 1);
            stack.push(nodeId);
            state.tabState[tabKey] = {
              currentNodeId: nodeId,
              historyStack: stack,
              historyIndex: stack.length - 1,
              lineageInvalidated: false,
              baselineEstablished: true
            };
          } else {
            state.tabState[tabKey] = {
              currentNodeId: nodeId,
              historyStack: [nodeId],
              historyIndex: 0,
              lineageInvalidated: false,
              baselineEstablished: true
            };
          }
        }

        state.metadata.totalNodesCreated = (state.metadata.totalNodesCreated || 0) + 1;
        this._pruneGraph(state);
        await this.adapter.set({ [STORAGE_KEY]: state });
        return newNode;
      });
    }

    /**
     * Updates an existing node's title in place.
     */
    async updateNodeTitle(nodeId, title) {
      if (!nodeId || !title) return null;
      return this.queue.enqueue(async () => {
        const state = await this._loadState();
        const node = state.nodes[nodeId];
        if (node && node.title !== title) {
          node.title = title;
          await this.adapter.set({ [STORAGE_KEY]: state });
          return node;
        }
        return node || null;
      });
    }

    /**
     * Updates an existing node's URL (e.g. for immediate redirect/hash consolidation).
     */
    async updateNodeUrl(nodeId, newUrl) {
      if (!nodeId || !newUrl) return null;
      return this.queue.enqueue(async () => {
        const state = await this._loadState();
        const node = state.nodes[nodeId];
        if (node && node.url !== newUrl) {
          node.url = newUrl;
          await this.adapter.set({ [STORAGE_KEY]: state });
          return node;
        }
        return node || null;
      });
    }

    /**
     * Gets the latest active node for a specific tab ID.
     */
    async getCurrentNodeForTab(tabId) {
      if (tabId === undefined || tabId === null) return null;
      return this.queue.enqueue(async () => {
        const state = await this._loadState();
        const entry = state.tabState[String(tabId)];
        if (!entry) return null;
        const nodeId = typeof entry === 'string' ? entry : entry.currentNodeId;
        if (!nodeId) return null;
        return state.nodes[nodeId] || null;
      });
    }

    /**
     * Gets the full tabState object for a tab ID.
     */
    async getTabState(tabId) {
      if (tabId === undefined || tabId === null) return null;
      return this.queue.enqueue(async () => {
        const state = await this._loadState();
        const entry = state.tabState[String(tabId)];
        if (!entry) return null;
        if (typeof entry === 'string') {
          return {
            currentNodeId: entry,
            historyStack: [entry],
            historyIndex: 0,
            lineageInvalidated: false,
            baselineEstablished: true
          };
        }
        return Object.assign({}, entry);
      });
    }

    /**
     * Sets or updates the tabState for a tab ID.
     */
    async setTabState(tabId, tabObj) {
      if (tabId === undefined || tabId === null || !tabObj) return null;
      return this.queue.enqueue(async () => {
        const state = await this._loadState();
        const head = tabObj.currentNodeId || null;
        state.tabState[String(tabId)] = {
          currentNodeId: head,
          historyStack: Array.isArray(tabObj.historyStack)
            ? tabObj.historyStack.slice()
            : (head ? [head] : []),
          historyIndex: typeof tabObj.historyIndex === 'number' ? tabObj.historyIndex : 0,
          lineageInvalidated: Boolean(tabObj.lineageInvalidated),
          baselineEstablished: Boolean(tabObj.baselineEstablished)
        };
        await this.adapter.set({ [STORAGE_KEY]: state });
        return state.tabState[String(tabId)];
      });
    }

    /**
     * Removes a tab from transient tabState when closed.
     */
    async removeTabState(tabId) {
      if (tabId === undefined || tabId === null) return;
      return this.queue.enqueue(async () => {
        const state = await this._loadState();
        const key = String(tabId);
        if (key in state.tabState) {
          delete state.tabState[key];
          await this.adapter.set({ [STORAGE_KEY]: state });
        }
      });
    }

    /**
     * Drops tab associations that are not present in liveTabIds.
     */
    async retainTabState(liveTabIds) {
      const liveIds = new Set(Array.from(liveTabIds || [], (id) => String(id)));
      return this.queue.enqueue(async () => {
        const state = await this._loadState();
        let changed = false;
        for (const tabId of Object.keys(state.tabState)) {
          if (!liveIds.has(tabId)) {
            delete state.tabState[tabId];
            changed = true;
          }
        }
        if (changed) await this.adapter.set({ [STORAGE_KEY]: state });
        return state;
      });
    }

    /**
     * Replaces a tab ID in tabState.
     */
    async replaceTabState(oldTabId, newTabId) {
      return this.queue.enqueue(async () => {
        const state = await this._loadState();
        const oldKey = String(oldTabId);
        const newKey = String(newTabId);
        if (oldKey in state.tabState) {
          state.tabState[newKey] = state.tabState[oldKey];
          delete state.tabState[oldKey];
          await this.adapter.set({ [STORAGE_KEY]: state });
        }
      });
    }

    /**
     * Clears all stored graph data, tabState, download index, and V1 backup.
     */
    async clearAll() {
      return this.queue.enqueue(async () => {
        const emptyState = createInitialState();
        await this.adapter.set({ [STORAGE_KEY]: emptyState });
        await this.adapter.remove(BACKUP_KEY);
        return emptyState;
      });
    }

    /**
     * Pruning algorithm:
     * - Protects all active heads (currentNodeId) across all tabs in tabState.
     * - Prunes oldest non-active nodes until node count <= maxNodes.
     * - Promotes children to checkpoints (resets parentNodeId = null, keeps treeId).
     * - Removes pruned node IDs from parents' childNodeIds list.
     * - Removes pruned node IDs from history stacks and downloadNodeMap.
     */
    _pruneGraph(state) {
      const nodeIds = Object.keys(state.nodes);
      if (nodeIds.length <= this.maxNodes) {
        return;
      }

      // Collect active tab head node IDs to protect from pruning
      const activeHeadIds = new Set();
      for (const entry of Object.values(state.tabState)) {
        if (typeof entry === 'string') activeHeadIds.add(entry);
        else if (entry && entry.currentNodeId) activeHeadIds.add(entry.currentNodeId);
      }

      // Eligible nodes for pruning (oldest first)
      const candidates = nodeIds
        .map((id) => state.nodes[id])
        .filter((node) => Boolean(node) && !activeHeadIds.has(node.id))
        .sort((a, b) => a.timestamp - b.timestamp);

      let pruneCount = nodeIds.length - this.maxNodes;
      let prunedAny = false;

      for (let i = 0; i < candidates.length && pruneCount > 0; i++) {
        const victim = candidates[i];
        const victimId = victim.id;

        // 1. Promote children to root checkpoints while preserving treeId
        if (Array.isArray(victim.childNodeIds)) {
          for (const childId of victim.childNodeIds) {
            const childNode = state.nodes[childId];
            if (childNode && childNode.parentNodeId === victimId) {
              childNode.parentNodeId = null;
              childNode.isCheckpoint = true;
            }
          }
        }

        // 2. Remove victim from parent's childNodeIds list
        if (victim.parentNodeId && state.nodes[victim.parentNodeId]) {
          const parent = state.nodes[victim.parentNodeId];
          if (Array.isArray(parent.childNodeIds)) {
            parent.childNodeIds = parent.childNodeIds.filter((cid) => cid !== victimId);
          }
        }

        // 3. Clean up from downloadNodeMap
        if (victim.nodeType === 'download' && victim.downloadId && state.metadata.downloadNodeMap) {
          delete state.metadata.downloadNodeMap[String(victim.downloadId)];
        }

        // 4. Clean up from tabState history stacks
        for (const tabEntry of Object.values(state.tabState)) {
          if (tabEntry && Array.isArray(tabEntry.historyStack) && tabEntry.historyStack.includes(victimId)) {
            tabEntry.historyStack = tabEntry.historyStack.filter((id) => id !== victimId);
            if (tabEntry.historyIndex >= tabEntry.historyStack.length) {
              tabEntry.historyIndex = Math.max(0, tabEntry.historyStack.length - 1);
            }
          }
        }

        // 5. Delete victim from nodes
        delete state.nodes[victimId];
        pruneCount--;
        prunedAny = true;
      }

      if (prunedAny) {
        state.metadata.lastPrunedAt = Date.now();
      }
    }
  }

  /**
   * Helper to construct a clean in-memory storage adapter for unit tests.
   */
  function createMemoryStorage(initialData = {}, sessionInitialData = {}) {
    let memoryStore = JSON.parse(JSON.stringify(initialData));
    let sessionStore = JSON.parse(JSON.stringify(sessionInitialData));

    const sessionAdapter = {
      async get(key) {
        if (!key) return Object.assign({}, sessionStore);
        if (typeof key === 'string') {
          return key in sessionStore ? { [key]: JSON.parse(JSON.stringify(sessionStore[key])) } : {};
        }
        return {};
      },
      async set(items) {
        for (const k of Object.keys(items)) {
          sessionStore[k] = JSON.parse(JSON.stringify(items[k]));
        }
      },
      async remove(key) {
        delete sessionStore[key];
      }
    };

    return {
      async get(key) {
        if (!key) return Object.assign({}, memoryStore);
        if (typeof key === 'string') {
          return key in memoryStore ? { [key]: JSON.parse(JSON.stringify(memoryStore[key])) } : {};
        }
        return {};
      },
      async set(items) {
        for (const k of Object.keys(items)) {
          memoryStore[k] = JSON.parse(JSON.stringify(items[k]));
        }
      },
      async remove(key) {
        delete memoryStore[key];
      },
      session: sessionAdapter,
      _dump() {
        return memoryStore;
      },
      _dumpSession() {
        return sessionStore;
      }
    };
  }

  return {
    StorageManager,
    StorageQueue,
    createMemoryStorage,
    createInitialState,
    STORAGE_KEY,
    BACKUP_KEY,
    CURRENT_SCHEMA_VERSION,
    BACKUP_EXPIRY_MS
  };
});
