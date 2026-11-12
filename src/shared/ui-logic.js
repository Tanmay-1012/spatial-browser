/**
 * Pure helpers shared by the map UI and its automated tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SpatialUILogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function filterNodes(nodes, query, timeFilter, now = Date.now()) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    const windows = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000
    };
    const timeWindow = windows[timeFilter] || Infinity;

    return (Array.isArray(nodes) ? nodes : []).filter((node) => {
      if (!node || typeof node.id !== 'string') return false;
      if (timeWindow !== Infinity) {
        if (!Number.isFinite(node.timestamp)) return false;
        const age = now - node.timestamp;
        if (age < 0 || age > timeWindow) return false;
      }
      if (!normalizedQuery) return true;
      return String(node.title || '').toLowerCase().includes(normalizedQuery) ||
        String(node.url || '').toLowerCase().includes(normalizedQuery);
    });
  }

  function computeGraphLayout(nodesMap, options = {}) {
    const {
      horizontalSpacing = 270,
      verticalSpacing = 68,
      treeVerticalGap = 54,
      marginLeft = 80,
      marginTop = 80
    } = options;
    const layoutNodes = [];
    const layoutEdges = [];
    if (!(nodesMap instanceof Map) || nodesMap.size === 0) {
      return { layoutNodes, layoutEdges };
    }

    const compareNodes = (a, b) => {
      const at = Number.isFinite(a.timestamp) ? a.timestamp : 0;
      const bt = Number.isFinite(b.timestamp) ? b.timestamp : 0;
      return at - bt || String(a.id).localeCompare(String(b.id));
    };
    const roots = Array.from(nodesMap.values())
      .filter((node) => !node.parentNodeId || !nodesMap.has(node.parentNodeId))
      .sort(compareNodes);
    const visited = new Set();
    let currentY = marginTop;

    function layoutSubtree(node, depth, forcedRoot = false) {
      visited.add(node.id);
      const x = marginLeft + depth * horizontalSpacing;
      const children = (Array.isArray(node.childNodeIds) ? node.childNodeIds : [])
        .map((childId) => nodesMap.get(childId))
        .filter((child) => child && !visited.has(child.id) && child.parentNodeId === node.id)
        .sort(compareNodes);

      let y;
      if (children.length === 0) {
        y = currentY;
        currentY += verticalSpacing;
      } else {
        const childLayouts = [];
        for (const child of children) {
          childLayouts.push(layoutSubtree(child, depth + 1));
          layoutEdges.push({ parentId: node.id, childId: child.id });
        }
        y = (childLayouts[0].y + childLayouts[childLayouts.length - 1].y) / 2;
      }

      const result = {
        id: node.id,
        url: node.url,
        title: node.title,
        timestamp: node.timestamp,
        isCheckpoint: Boolean(node.isCheckpoint || forcedRoot || !node.parentNodeId || !nodesMap.has(node.parentNodeId)),
        parentNodeId: node.parentNodeId,
        childNodeIds: node.childNodeIds,
        x,
        y
      };
      layoutNodes.push(result);
      return result;
    }

    for (const root of roots) {
      if (!visited.has(root.id)) {
        layoutSubtree(root, 0, true);
        currentY += treeVerticalGap;
      }
    }

    // A damaged or cyclic graph may have no root. Render each remaining component
    // from a deterministic fallback root instead of returning a blank canvas.
    const remaining = Array.from(nodesMap.values()).sort(compareNodes);
    for (const node of remaining) {
      if (!visited.has(node.id)) {
        layoutSubtree(node, 0, true);
        currentY += treeVerticalGap;
      }
    }

    // Keep SVG and keyboard focus order spatially predictable: top-to-bottom,
    // with ancestors before descendants when they share a row.
    layoutNodes.sort((a, b) => a.y - b.y || a.x - b.x || compareNodes(a, b));
    return { layoutNodes, layoutEdges };
  }

  function isSafeHttpUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || rawUrl.length === 0) return false;
    try {
      const protocol = new URL(rawUrl).protocol;
      return protocol === 'http:' || protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  return { filterNodes, computeGraphLayout, isSafeHttpUrl };
});
