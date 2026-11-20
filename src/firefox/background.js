/**
 * Firefox Background Event Page (Manifest V3)
 * Spatial Browser History
 */

/* global openOrFocusPage, SpatialStorage, SpatialTracker, SpatialBackgroundMessages, SpatialStudyManager */

// 1. Initialize storage, study, and tracker instances
const storageManager = new SpatialStorage.StorageManager();
const studyManager = new SpatialStudyManager.StudyManager({ storageAdapter: storageManager.adapter });
const tracker = new SpatialTracker.NavigationTracker(storageManager, browser, { studyManager });
globalThis.storageManager = storageManager;
globalThis.studyManager = studyManager;
globalThis.tracker = tracker;

// 2. Register all navigation event listeners synchronously at startup
tracker.init();
studyManager.init().catch(() => {});
SpatialBackgroundMessages.registerClearHistoryListener(browser.runtime, storageManager);

// Synchronize study state changes across UI and background
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.spatial_browser_study_data) {
    studyManager.init().catch(() => {});
  }
});

// 3. Register toolbar single-tab open/focus behavior
browser.action.onClicked.addListener(async () => {
  try {
    await openOrFocusPage('index.html', browser);
  } catch (error) {
    console.error('[SpatialHistory:Firefox] Failed to open or focus placeholder page:', error);
  }
});

// 4. Capture initial checkpoints for existing open tabs on install or browser startup
browser.runtime.onInstalled.addListener(async () => {
  try {
    await storageManager.init();
    await tracker.captureInitialCheckpoints();
  } catch (err) {
    console.error('[SpatialHistory:Firefox] Initialization error on install:', err);
  }
});

browser.runtime.onStartup.addListener(async () => {
  try {
    await storageManager.init();
    await tracker.captureInitialCheckpoints();
  } catch (err) {
    console.error('[SpatialHistory:Firefox] Initialization error on startup:', err);
  }
});
