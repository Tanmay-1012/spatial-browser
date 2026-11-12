/**
 * Firefox Background Event Page (Manifest V3)
 * Spatial Browser History
 */

/* global openOrFocusPage, SpatialStorage, SpatialTracker, SpatialBackgroundMessages */

// 1. Initialize storage and tracker instances
const storageManager = new SpatialStorage.StorageManager();
const tracker = new SpatialTracker.NavigationTracker(storageManager, browser);

// 2. Register all navigation event listeners synchronously at startup
tracker.init();
SpatialBackgroundMessages.registerClearHistoryListener(browser.runtime, storageManager);

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
