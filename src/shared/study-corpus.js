/**
 * Spatial Browser History - Study Corpus Allowlist & Opaque Key Mapping
 *
 * Maps local study topic pack fixtures to opaque, privacy-preserving page keys.
 * Used during active study trials to detect allowlisted navigation and target completion
 * without storing or exporting raw URLs, search strings, or off-corpus browsing data.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();
    if (typeof globalThis !== 'undefined') {
      globalThis.SpatialStudyCorpus = exports;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TARGET_KEY_X = 'px_materials';
  const TARGET_KEY_Y = 'py_modern1896';

  const ALLOWLIST_DEFINITIONS = [
    // Topic Pack X: Solar Energy Technology
    { key: 'px_hub', pack: 'pack_x', patterns: ['/pack_x/index.html', '/pack_x/'] },
    { key: 'px_materials', pack: 'pack_x', patterns: ['/pack_x/materials.html'], isTarget: true },
    { key: 'px_perovskite', pack: 'pack_x', patterns: ['/pack_x/perovskite.html'] },
    { key: 'px_silicon', pack: 'pack_x', patterns: ['/pack_x/silicon.html'] },
    { key: 'px_efficiency', pack: 'pack_x', patterns: ['/pack_x/efficiency.html'] },
    { key: 'px_storage', pack: 'pack_x', patterns: ['/pack_x/storage.html'] },
    { key: 'px_grid', pack: 'pack_x', patterns: ['/pack_x/grid.html'] },
    { key: 'px_economics', pack: 'pack_x', patterns: ['/pack_x/economics.html'] },

    // Topic Pack Y: Olympic Games History
    { key: 'py_hub', pack: 'pack_y', patterns: ['/pack_y/index.html', '/pack_y/'] },
    { key: 'py_modern1896', pack: 'pack_y', patterns: ['/pack_y/modern1896.html'], isTarget: true },
    { key: 'py_marathon', pack: 'pack_y', patterns: ['/pack_y/marathon.html'] },
    { key: 'py_antiquity', pack: 'pack_y', patterns: ['/pack_y/antiquity.html'] },
    { key: 'py_winter', pack: 'pack_y', patterns: ['/pack_y/winter.html'] },
    { key: 'py_paralympic', pack: 'pack_y', patterns: ['/pack_y/paralympic.html'] },
    { key: 'py_torches', pack: 'pack_y', patterns: ['/pack_y/torches.html'] },
    { key: 'py_economics', pack: 'pack_y', patterns: ['/pack_y/economics.html'] }
  ];

  /**
   * Matches a raw URL against the allowlist definitions.
   * Restricts matching strictly to the local loopback origin (http://127.0.0.1 or http://localhost)
   * and expected study fixture paths.
   * Returns matching opaque page key (e.g. 'px_materials') or null if not in corpus.
   */
  function matchCorpusPage(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    let u;
    try {
      u = new URL(rawUrl);
    } catch (_) {
      return null;
    }

    // 1. Strict local loopback origin check: must be http: on 127.0.0.1 or localhost
    if (u.protocol !== 'http:') return null;
    if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') return null;

    let pathname = u.pathname.toLowerCase();

    // 2. Strict pathname matching: must match exact study fixture pattern or /study/fixtures prefix
    for (const def of ALLOWLIST_DEFINITIONS) {
      for (const pattern of def.patterns) {
        const studyPrefixed = '/study/fixtures' + pattern;
        if (pathname === pattern || pathname === studyPrefixed) {
          return def.key;
        }
        // Handle hub root with or without trailing slash
        if (pattern.endsWith('/')) {
          const trimmed = pattern.slice(0, -1);
          const trimmedPrefixed = studyPrefixed.slice(0, -1);
          if (pathname === trimmed || pathname === trimmedPrefixed) {
            return def.key;
          }
        }
      }
    }
    return null;
  }

  /**
   * Determines if a raw URL matches the designated target key for an active trial.
   */
  function isCorpusTarget(rawUrl, targetKey) {
    if (!targetKey) return false;
    const pageKey = matchCorpusPage(rawUrl);
    return pageKey === targetKey;
  }

  /**
   * Returns the pack code ('pack_x' or 'pack_y') associated with an opaque page key.
   */
  function getPackForPageKey(pageKey) {
    const found = ALLOWLIST_DEFINITIONS.find((d) => d.key === pageKey);
    return found ? found.pack : null;
  }

  /**
   * Returns default target key for a topic pack.
   */
  function getDefaultTargetKey(packCode) {
    if (packCode === 'pack_x') return TARGET_KEY_X;
    if (packCode === 'pack_y') return TARGET_KEY_Y;
    return null;
  }

  return {
    TARGET_KEY_X,
    TARGET_KEY_Y,
    ALLOWLIST_DEFINITIONS,
    matchCorpusPage,
    isCorpusTarget,
    getPackForPageKey,
    getDefaultTargetKey
  };
});
