/**
 * Spatial Browser History - Shared Launch Behavior
 * 
 * Canonical logic to open the extension's main interface tab or focus an
 * existing tab if already open, avoiding duplicate views.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();
    if (typeof globalThis !== 'undefined') {
      globalThis.openOrFocusPage = exports.openOrFocusPage;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // Coalesce simultaneous toolbar clicks while the query/create operation is in flight.
  // The API object keys the map so independent test/browser contexts do not share state.
  const pendingLaunchesByApi = new WeakMap();

  /**
   * Resolves the WebExtension API root (browser or chrome).
   * @param {object} [explicitApi]
   * @returns {object}
   */
  function getExtensionApi(explicitApi) {
    if (explicitApi) return explicitApi;
    if (typeof browser !== 'undefined' && browser.runtime && browser.tabs) {
      return browser;
    }
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.tabs) {
      return chrome;
    }
    throw new Error('WebExtension runtime API (chrome or browser) is not available.');
  }

  /**
   * Opens the requested extension page in a tab, or focuses it if already open.
   * 
   * @param {string} [pagePath='index.html'] - Extension relative page path.
   * @param {object} [customApi] - Optional explicit chrome/browser API override for testing.
   * @returns {Promise<{ action: 'focused' | 'created', tabId: number, windowId?: number }>}
   */
  async function openOrFocusPage(pagePath = 'index.html', customApi) {
    const api = getExtensionApi(customApi);
    let pendingForApi = pendingLaunchesByApi.get(api);
    if (!pendingForApi) {
      pendingForApi = new Map();
      pendingLaunchesByApi.set(api, pendingForApi);
    }

    const pendingLaunch = pendingForApi.get(pagePath);
    if (pendingLaunch) return pendingLaunch;

    const launchPromise = launchOrFocusPage(pagePath, api);
    pendingForApi.set(pagePath, launchPromise);
    try {
      return await launchPromise;
    } finally {
      if (pendingForApi.get(pagePath) === launchPromise) {
        pendingForApi.delete(pagePath);
      }
    }
  }

  async function launchOrFocusPage(pagePath, api) {
    const targetUrl = api.runtime.getURL(pagePath);

    // Query tabs across all windows
    const tabs = await api.tabs.query({});
    const existingTab = tabs.find(function (tab) {
      if (!tab || !tab.url) return false;
      // Exact match or prefix match (handles hash or query parameters)
      return tab.url === targetUrl || tab.url.startsWith(targetUrl + '#') || tab.url.startsWith(targetUrl + '?');
    });

    if (existingTab && typeof existingTab.id === 'number') {
      // Focus existing tab
      await api.tabs.update(existingTab.id, { active: true });

      // Focus the containing window if supported
      if (typeof existingTab.windowId === 'number' && api.windows && api.windows.update) {
        try {
          await api.windows.update(existingTab.windowId, { focused: true });
        } catch (winErr) {
          // Window might already have focus or API call failed gracefully
          console.warn('[SpatialHistory] Window focus update notice:', winErr);
        }
      }

      return {
        action: 'focused',
        tabId: existingTab.id,
        windowId: existingTab.windowId
      };
    }

    // Tab does not exist yet: create a new one
    const createdTab = await api.tabs.create({ url: targetUrl });
    return {
      action: 'created',
      tabId: createdTab.id,
      windowId: createdTab.windowId
    };
  }

  return {
    openOrFocusPage: openOrFocusPage,
    getExtensionApi: getExtensionApi
  };
});
