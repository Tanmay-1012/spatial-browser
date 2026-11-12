/** Shared extension background message handlers. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SpatialBackgroundMessages = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CLEAR_HISTORY_MESSAGE = 'spatial-browser-history:clear';

  function registerClearHistoryListener(runtime, storageManager) {
    if (!runtime || !runtime.onMessage || !storageManager) return false;

    runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || message.type !== CLEAR_HISTORY_MESSAGE) return undefined;

      Promise.resolve()
        .then(() => storageManager.clearAll())
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error('[SpatialHistory] Failed to clear history:', error);
          sendResponse({ ok: false });
        });
      return true;
    });
    return true;
  }

  return { CLEAR_HISTORY_MESSAGE, registerClearHistoryListener };
});
