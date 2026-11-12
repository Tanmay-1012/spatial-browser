/**
 * Chrome Background Service Worker (Manifest V3)
 * Spatial Browser History
 */

/* global openOrFocusPage, SpatialStorage, SpatialTracker, SpatialBackgroundMessages */
importScripts('launch.js', 'storage.js', 'tracker.js', 'background-messages.js');

// 1. Initialize storage and tracker instances
const storageManager = new SpatialStorage.StorageManager();
const tracker = new SpatialTracker.NavigationTracker(storageManager, chrome);

// 2. Register all navigation event listeners synchronously at startup
tracker.init();
SpatialBackgroundMessages.registerClearHistoryListener(chrome.runtime, storageManager);

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
