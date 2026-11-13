/**
 * Pure helpers shared by the Research Tree Explorer UI and automated tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SpatialUILogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function isDownloadNode(node) {
    return Boolean(node && node.nodeType === 'download');
  }

  function isUnattributedDownload(node) {
    if (!isDownloadNode(node)) return false;
    const origin = String(node.originDomain || '').trim();
    return !origin || origin.toLowerCase() === 'source unavailable';
  }

  function getDomainLabel(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) return 'web';
    try {
      const host = new URL(rawUrl).hostname.replace(/^www\./, '');
      return host || 'web';
    } catch (_) {
      return 'web';
    }
  }

  function compareNodesAsc(a, b) {
    const at = Number.isFinite(a.timestamp) ? a.timestamp : 0;
    const bt = Number.isFinite(b.timestamp) ? b.timestamp : 0;
    return at - bt || String(a.id).localeCompare(String(b.id));
  }

  function compareNodesDesc(a, b) {
    return compareNodesAsc(b, a);
  }

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
      const fields = isDownloadNode(node)
        ? [node.filename, node.title, node.originDomain]
        : [node.title, node.url, getDomainLabel(node.url)];
      return fields.some((val) => String(val || '').toLowerCase().includes(normalizedQuery));
    });
  }

  function collectActiveTabHeads(state) {
    const countsByNodeId = new Map();
    const tabState = (state && state.tabState && typeof state.tabState === 'object') ? state.tabState : {};
    for (const entry of Object.values(tabState)) {
      const headId = typeof entry === 'string'
        ? entry
        : (entry && typeof entry.currentNodeId === 'string' ? entry.currentNodeId : null);
      if (!headId) continue;
      countsByNodeId.set(headId, (countsByNodeId.get(headId) || 0) + 1);
    }
    return countsByNodeId;
  }

  function summarizeTreeGroup(treeId, treeNodes, activeHeadCounts, query, timeFilter, now) {
    const groupMap = new Map(treeNodes.map((n) => [n.id, n]));
    const pageNodes = treeNodes.filter((n) => !isDownloadNode(n));
    const downloadNodes = treeNodes.filter((n) => isDownloadNode(n));

    const visualRoots = treeNodes
      .filter((n) => !n.parentNodeId || !groupMap.has(n.parentNodeId))
      .sort((a, b) => {
        const aIsPage = isDownloadNode(a) ? 1 : 0;
        const bIsPage = isDownloadNode(b) ? 1 : 0;
        return aIsPage - bIsPage || compareNodesAsc(a, b);
      });

    const sortedPagesAsc = pageNodes.slice().sort(compareNodesAsc);
    const sortedAllDesc = treeNodes.slice().sort(compareNodesDesc);
    const representative = visualRoots.find((n) => !isDownloadNode(n))
      || sortedPagesAsc[0]
      || visualRoots[0]
      || sortedAllDesc[0];

    const latestNode = sortedAllDesc[0];

    // Leaf count across surviving nodes inside this tree captures parallel research branches cleanly.
    let leafCount = 0;
    for (const n of treeNodes) {
      const inTreeChildren = (Array.isArray(n.childNodeIds) ? n.childNodeIds : [])
        .filter((cid) => groupMap.has(cid) && groupMap.get(cid).parentNodeId === n.id);
      if (inTreeChildren.length === 0) leafCount++;
    }
    const branchCount = Math.max(1, leafCount);

    let openTabCount = 0;
    for (const n of treeNodes) {
      openTabCount += activeHeadCounts.get(n.id) || 0;
    }

    const expectedRootId = treeId && treeId.startsWith('tree_') ? treeId.slice('tree_'.length) : null;
    const rootPruned = Boolean(
      visualRoots.length > 1 ||
      (expectedRootId && representative && representative.id !== expectedRootId)
    );

    const matchedNodes = filterNodes(treeNodes, query, timeFilter, now);
    const domain = isDownloadNode(representative)
      ? (representative.originDomain || 'web')
      : getDomainLabel(representative.url);
    const title = isDownloadNode(representative)
      ? (representative.filename || 'Downloaded File')
      : (representative.title || representative.url || 'Untitled Research');

    return {
      treeId,
      title,
      domain,
      representativeNodeId: representative ? representative.id : null,
      visitCount: pageNodes.length,
      downloadCount: downloadNodes.length,
      totalNodeCount: treeNodes.length,
      matchedNodeCount: matchedNodes.length,
      branchCount,
      openTabCount,
      visualRootCount: visualRoots.length,
      rootPruned,
      latestNode,
      updatedAt: latestNode && Number.isFinite(latestNode.timestamp) ? latestNode.timestamp : 0
    };
  }

  function buildResearchTrees(state, options = {}) {
    const query = options.query || '';
    const timeFilter = options.timeFilter || 'all';
    const now = typeof options.now === 'number' ? options.now : Date.now();

    const allNodes = (state && state.nodes && typeof state.nodes === 'object')
      ? Object.values(state.nodes).filter((n) => n && typeof n.id === 'string')
      : [];
    const activeHeadCounts = collectActiveTabHeads(state);

    const unattributedAll = [];
    const groups = new Map();

    for (const node of allNodes) {
      if (isUnattributedDownload(node)) {
        unattributedAll.push(node);
        continue;
      }
      const treeId = node.treeId || ('tree_' + node.id);
      if (!groups.has(treeId)) groups.set(treeId, []);
      groups.get(treeId).push(node);
    }

    const allTrees = [];
    for (const [treeId, treeNodes] of groups.entries()) {
      // Never synthesize a tree card for download-only groups lacking an origin page unless explicitly attributed.
      const hasPageOrAttributed = treeNodes.some((n) => !isDownloadNode(n) || !isUnattributedDownload(n));
      if (!hasPageOrAttributed) continue;
      allTrees.push(summarizeTreeGroup(treeId, treeNodes, activeHeadCounts, query, timeFilter, now));
    }

    allTrees.sort((a, b) => (b.updatedAt - a.updatedAt) || String(a.treeId).localeCompare(String(b.treeId)));

    const visibleTrees = allTrees.filter((tree) => tree.matchedNodeCount > 0);
    const unattributedSorted = unattributedAll.slice().sort(compareNodesDesc);
    const visibleUnattributed = filterNodes(unattributedSorted, query, timeFilter, now);

    const totalVisitsCount = allNodes.filter((n) => !isDownloadNode(n)).length;
    const totalDownloadsCount = allNodes.filter((n) => isDownloadNode(n)).length;

    return {
      trees: visibleTrees,
      allTrees,
      allTreesCount: allTrees.length,
      totalCapturedCount: allNodes.length,
      totalVisitsCount,
      totalDownloadsCount,
      unattributedDownloads: visibleUnattributed,
      allUnattributedCount: unattributedSorted.length,
      activeHeadCounts
    };
  }

  function buildTreeDetailView(state, treeId, options = {}) {
    const query = String(options.query || '').trim();
    const timeFilter = options.timeFilter || 'all';
    const now = typeof options.now === 'number' ? options.now : Date.now();
    const activeHeadCounts = collectActiveTabHeads(state);

    const allNodes = (state && state.nodes && typeof state.nodes === 'object')
      ? Object.values(state.nodes).filter((n) => n && typeof n.id === 'string')
      : [];
    const treeNodes = allNodes.filter(
      (n) => !isUnattributedDownload(n) && (n.treeId || ('tree_' + n.id)) === treeId
    );

    if (treeNodes.length === 0) {
      return {
        treeMeta: null,
        nodesMap: new Map(),
        allTreeNodesCount: 0,
        matchedIds: new Set(),
        contextAncestorIds: new Set(),
        visibleCount: 0,
        hasActiveFilter: Boolean(query || (timeFilter && timeFilter !== 'all'))
      };
    }

    const treeMeta = summarizeTreeGroup(treeId, treeNodes, activeHeadCounts, query, timeFilter, now);
    const treeNodesById = new Map(treeNodes.map((n) => [n.id, n]));
    const matchedNodes = filterNodes(treeNodes, query, timeFilter, now);
    const matchedIds = new Set(matchedNodes.map((n) => n.id));
    const hasActiveFilter = Boolean(query || (timeFilter && timeFilter !== 'all'));

    const visibleIds = new Set();
    const contextAncestorIds = new Set();

    if (!hasActiveFilter) {
      for (const n of treeNodes) visibleIds.add(n.id);
    } else if (matchedIds.size > 0) {
      for (const id of matchedIds) {
        visibleIds.add(id);
        let curr = treeNodesById.get(id);
        const seen = new Set([id]);
        while (curr && curr.parentNodeId && treeNodesById.has(curr.parentNodeId) && !seen.has(curr.parentNodeId)) {
          const parentId = curr.parentNodeId;
          seen.add(parentId);
          visibleIds.add(parentId);
          if (!matchedIds.has(parentId)) contextAncestorIds.add(parentId);
          curr = treeNodesById.get(parentId);
        }
      }
    }

    const nodesMap = new Map();
    for (const id of visibleIds) {
      const raw = treeNodesById.get(id);
      if (!raw) continue;
      nodesMap.set(id, Object.assign({}, raw, {
        isMatch: matchedIds.has(id),
        isContextAncestor: contextAncestorIds.has(id),
        isActiveHead: (activeHeadCounts.get(id) || 0) > 0
      }));
    }

    return {
      treeMeta,
      nodesMap,
      allTreeNodesCount: treeNodes.length,
      matchedIds,
      contextAncestorIds,
      visibleCount: nodesMap.size,
      hasActiveFilter
    };
  }

  function computeGraphLayout(nodesMap, options = {}) {
    const layoutMode = options.layoutMode || 'horizontal';
    const {
      horizontalSpacing = 270,
      verticalSpacing = 68,
      treeVerticalGap = 54,
      marginLeft = (layoutMode === 'reflow' ? 24 : 80),
      marginTop = (layoutMode === 'reflow' ? 36 : 80),
      nodeWidth = 220,
      nodeHeight = 44,
      indentX = 24,
      rowSpacing = 58,
      maxIndent = 132
    } = options;
    const layoutNodes = [];
    const layoutEdges = [];
    if (!(nodesMap instanceof Map) || nodesMap.size === 0) {
      return { layoutNodes, layoutEdges, layoutMode };
    }

    const roots = Array.from(nodesMap.values())
      .filter((node) => !node.parentNodeId || !nodesMap.has(node.parentNodeId))
      .sort(compareNodesAsc);
    const visited = new Set();

    if (layoutMode === 'reflow') {
      let currentRow = 0;

      function layoutReflowSubtree(node, depth, forcedRoot = false) {
        visited.add(node.id);
        const effectiveIndent = Math.min(depth * indentX, maxIndent);
        const x = marginLeft + effectiveIndent + (nodeWidth / 2);
        const y = marginTop + currentRow * rowSpacing + (nodeHeight / 2);
        currentRow++;

        const children = (Array.isArray(node.childNodeIds) ? node.childNodeIds : [])
          .map((childId) => nodesMap.get(childId))
          .filter((child) => child && !visited.has(child.id) && child.parentNodeId === node.id)
          .sort(compareNodesAsc);

        const result = {
          id: node.id,
          treeId: node.treeId || null,
          nodeType: isDownloadNode(node) ? 'download' : 'page',
          url: node.url || '',
          title: node.title || '',
          filename: node.filename || '',
          originDomain: node.originDomain || '',
          downloadId: node.downloadId,
          timestamp: node.timestamp,
          isCheckpoint: Boolean(node.isCheckpoint || forcedRoot || !node.parentNodeId || !nodesMap.has(node.parentNodeId)),
          isContextAncestor: Boolean(node.isContextAncestor),
          isActiveHead: Boolean(node.isActiveHead),
          isMatch: node.isMatch !== undefined ? Boolean(node.isMatch) : true,
          parentNodeId: node.parentNodeId,
          childNodeIds: node.childNodeIds,
          depth,
          x,
          y
        };
        layoutNodes.push(result);

        for (const child of children) {
          layoutEdges.push({ parentId: node.id, childId: child.id });
          layoutReflowSubtree(child, depth + 1);
        }

        return result;
      }

      for (const root of roots) {
        if (!visited.has(root.id)) {
          layoutReflowSubtree(root, 0, true);
          currentRow++;
        }
      }

      const remaining = Array.from(nodesMap.values()).sort(compareNodesAsc);
      for (const node of remaining) {
        if (!visited.has(node.id)) {
          layoutReflowSubtree(node, 0, true);
          currentRow++;
        }
      }

      layoutNodes.sort((a, b) => a.y - b.y || a.x - b.x || compareNodesAsc(a, b));
      return { layoutNodes, layoutEdges, layoutMode };
    }

    let currentY = marginTop;

    function layoutSubtree(node, depth, forcedRoot = false) {
      visited.add(node.id);
      const x = marginLeft + depth * horizontalSpacing;
      const children = (Array.isArray(node.childNodeIds) ? node.childNodeIds : [])
        .map((childId) => nodesMap.get(childId))
        .filter((child) => child && !visited.has(child.id) && child.parentNodeId === node.id)
        .sort(compareNodesAsc);

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
        treeId: node.treeId || null,
        nodeType: isDownloadNode(node) ? 'download' : 'page',
        url: node.url || '',
        title: node.title || '',
        filename: node.filename || '',
        originDomain: node.originDomain || '',
        downloadId: node.downloadId,
        timestamp: node.timestamp,
        isCheckpoint: Boolean(node.isCheckpoint || forcedRoot || !node.parentNodeId || !nodesMap.has(node.parentNodeId)),
        isContextAncestor: Boolean(node.isContextAncestor),
        isActiveHead: Boolean(node.isActiveHead),
        isMatch: node.isMatch !== undefined ? Boolean(node.isMatch) : true,
        parentNodeId: node.parentNodeId,
        childNodeIds: node.childNodeIds,
        depth,
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
    const remaining = Array.from(nodesMap.values()).sort(compareNodesAsc);
    for (const node of remaining) {
      if (!visited.has(node.id)) {
        layoutSubtree(node, 0, true);
        currentY += treeVerticalGap;
      }
    }

    // Keep SVG and keyboard focus order spatially predictable: top-to-bottom,
    // with ancestors before descendants when they share a row.
    layoutNodes.sort((a, b) => a.y - b.y || a.x - b.x || compareNodesAsc(a, b));
    return { layoutNodes, layoutEdges, layoutMode };
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

  return {
    isDownloadNode,
    isUnattributedDownload,
    getDomainLabel,
    filterNodes,
    collectActiveTabHeads,
    buildResearchTrees,
    buildTreeDetailView,
    computeGraphLayout,
    isSafeHttpUrl
  };
});
