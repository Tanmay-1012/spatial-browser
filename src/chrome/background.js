/**
 * Chrome Background Service Worker (Manifest V3)
 * Spatial Browser History
 */

/* global openOrFocusPage, SpatialStorage, SpatialTracker, SpatialBackgroundMessages, SpatialStudyManager */
try {
  importScripts('launch.js', 'storage.js', 'study-corpus.js', 'study-manager.js', 'tracker.js', 'background-messages.js');

  // 1. Initialize storage, study, and tracker instances
  const storageManager = new SpatialStorage.StorageManager();
  const studyManager = new SpatialStudyManager.StudyManager({ storageAdapter: storageManager.adapter });
  const tracker = new SpatialTracker.NavigationTracker(storageManager, chrome, { studyManager });
  globalThis.storageManager = storageManager;
  globalThis.studyManager = studyManager;
  globalThis.tracker = tracker;

  // 2. Register all navigation event listeners synchronously at startup
  tracker.init();
  studyManager.init().catch(() => {});
  SpatialBackgroundMessages.registerClearHistoryListener(chrome.runtime, storageManager);

  // Synchronize study state changes across UI and background
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.spatial_browser_study_data) {
      studyManager.init().catch(() => {});
    }
  });

  // 3. Register toolbar single-tab open/focus behavior
  chrome.action.onClicked.addListener(async () => {
    try {
      await openOrFocusPage('index.html', chrome);
    } catch (error) {
      console.error('[SpatialHistory:Chrome] Failed to open or focus placeholder page:', error);
    }
  });

  // 4. Capture initial checkpoints for existing open tabs on install or browser startup
  chrome.runtime.onInstalled.addListener(async () => {
    try {
      await storageManager.init();
      await tracker.captureInitialCheckpoints();
    } catch (err) {
      console.error('[SpatialHistory:Chrome] Initialization error on install:', err);
    }
  });

  chrome.runtime.onStartup.addListener(async () => {
    try {
      await storageManager.init();
      await tracker.captureInitialCheckpoints();
    } catch (err) {
      console.error('[SpatialHistory:Chrome] Initialization error on startup:', err);
    }
  });
} catch (err) {
  globalThis.__bgErr = (err && (err.stack || err.message)) || String(err);
  console.error('[SpatialHistory:Chrome] Background service worker initialization failed:', err);
}
