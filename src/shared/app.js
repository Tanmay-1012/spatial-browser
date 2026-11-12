/**
 * Spatial Browser History - Research Tree Explorer Application Logic
 *
 * Manages the two-level Research Tree Explorer:
 * 1. Overview: research tree cards grouped strictly by stable treeId, plus Unattributed Downloads shelf.
 * 2. Tree Detail View: selected tree branch-fan layout, search/time filters with ancestry context,
 *    pan/zoom/fit controls, visit and download provenance details drawer, and safe URL reopening.
 *
 * Strict CSP & Safety: All browser-provided strings rendered strictly via textContent/replaceChildren.
 */

(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 44;
  const HORIZONTAL_SPACING = 270;
  const VERTICAL_SPACING = 68;
  const TREE_VERTICAL_GAP = 54;
  const MARGIN_LEFT = 80;
  const MARGIN_TOP = 80;

  // Application state
  let storageManager = null;
  let currentState = null;
  let viewMode = 'overview'; // 'overview' | 'detail'
  let selectedTreeId = null;

  const overviewFilters = {
    query: '',
    timeFilter: 'all',
    scrollTop: 0,
    focusedTreeId: null
  };

  const detailFilters = {
    query: '',
    timeFilter: 'all'
  };

  let activeNodesMap = new Map();
  let layoutNodes = [];
  let layoutEdges = [];
  let selectedNodeId = null;

  // Viewport transform state (detail view)
  let scale = 1.0;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let startDragX = 0;
  let startDragY = 0;
  let needsInitialFit = true;

  const api = (typeof browser !== 'undefined' && browser.runtime)
    ? browser
    : (typeof chrome !== 'undefined' && chrome.runtime)
      ? chrome
      : null;
  const uiLogic = globalThis.SpatialUILogic;

  // DOM references
  let elOverviewBrand, elDetailBrand, elBackToOverviewBtn, elDetailTreeDomain, elDetailTreeTitle;
  let elNodeCountBadge, elDetailCountBadge, elZoomControls;
  let elSearchInput, elSearchClearBtn, elTimeFilter, elZoomIn, elZoomOut, elZoomReset;
  let elClearMapBtn, elClearModal, elConfirmClearBtn, elCancelClearBtn, elClearError;
  let elOverviewView, elTreesGrid, elOverviewTreesSummary, elResearchTreesEmpty;
  let elUnattributedSection, elUnattributedList;
  let elDetailView, elMapContainer, elViewport, elEdgesLayer, elNodesLayer, elDetailContextBanner;
  let elDetailNoResults, elDetailResetFiltersBtn;
  let elEmptyState, elNoResultsState, elResetFiltersBtn;
  let elDetailsPanel, elDetailsBadge, elDetailsHeading, elDetailsCloseBtn;
  let elDetailsTitleLabel, elDetailsTitle, elDetailsUrlField, elDetailsUrl;
  let elDetailsSourceField, elDetailsSource, elDetailsTimeLabel, elDetailsTime, elDetailsType;
  let elDetailsActions, elReopenBtn;
  let elParentLineageContainer, elParentLineageLabel, elDetailsParent, elChildrenLineageContainer, elDetailsChildren;

  async function init() {
    cacheDomElements();
    setupEventListeners();
    setupPanAndZoom();

    if (typeof globalThis.SpatialStorage !== 'undefined') {
      storageManager = new globalThis.SpatialStorage.StorageManager();
      try {
        await storageManager.init();
      } catch (err) {
        console.warn('[SpatialApp] Storage initialization notice:', err);
      }
    }

    if (api && api.storage && api.storage.onChanged) {
      api.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.spatial_browser_history_data) {
          loadAndRender();
        }
      });
    }

    await loadAndRender();
  }

  function cacheDomElements() {
    elOverviewBrand = document.getElementById('overview-brand');
    elDetailBrand = document.getElementById('detail-brand');
    elBackToOverviewBtn = document.getElementById('back-to-overview-btn');
    elDetailTreeDomain = document.getElementById('detail-tree-domain');
    elDetailTreeTitle = document.getElementById('detail-tree-title');
    elNodeCountBadge = document.getElementById('node-count-badge');
    elDetailCountBadge = document.getElementById('detail-count-badge');

    elSearchInput = document.getElementById('search-input');
    elSearchClearBtn = document.getElementById('search-clear-btn');
    elTimeFilter = document.getElementById('time-filter');
    elZoomControls = document.getElementById('zoom-controls');
    elZoomIn = document.getElementById('zoom-in');
    elZoomOut = document.getElementById('zoom-out');
    elZoomReset = document.getElementById('zoom-reset');

    elClearMapBtn = document.getElementById('clear-map-btn');
    elClearModal = document.getElementById('clear-modal');
    elConfirmClearBtn = document.getElementById('confirm-clear-btn');
    elCancelClearBtn = document.getElementById('cancel-clear-btn');
    elClearError = document.getElementById('clear-error');

    elOverviewView = document.getElementById('overview-view');
    elTreesGrid = document.getElementById('trees-grid');
    elOverviewTreesSummary = document.getElementById('overview-trees-summary');
    elResearchTreesEmpty = document.getElementById('research-trees-empty');
    elUnattributedSection = document.getElementById('unattributed-section');
    elUnattributedList = document.getElementById('unattributed-list');

    elDetailView = document.getElementById('detail-view');
    elMapContainer = document.getElementById('map-container');
    elViewport = document.getElementById('map-viewport');
    elEdgesLayer = document.getElementById('edges-layer');
    elNodesLayer = document.getElementById('nodes-layer');
    elDetailContextBanner = document.getElementById('detail-context-banner');
    elDetailNoResults = document.getElementById('detail-no-results');
    elDetailResetFiltersBtn = document.getElementById('detail-reset-filters-btn');

    elEmptyState = document.getElementById('empty-state');
    elNoResultsState = document.getElementById('no-results-state');
    elResetFiltersBtn = document.getElementById('reset-filters-btn');

    elDetailsPanel = document.getElementById('details-panel');
    elDetailsBadge = document.getElementById('details-badge');
    elDetailsHeading = document.getElementById('details-heading');
    elDetailsCloseBtn = document.getElementById('details-close-btn');
    elDetailsTitleLabel = document.getElementById('details-title-label');
    elDetailsTitle = document.getElementById('details-title');
    elDetailsUrlField = document.getElementById('details-url-field');
    elDetailsUrl = document.getElementById('details-url');
    elDetailsSourceField = document.getElementById('details-source-field');
    elDetailsSource = document.getElementById('details-source');
    elDetailsTimeLabel = document.getElementById('details-time-label');
    elDetailsTime = document.getElementById('details-time');
    elDetailsType = document.getElementById('details-type');
    elDetailsActions = document.getElementById('details-actions');
    elReopenBtn = document.getElementById('reopen-btn');
    elParentLineageContainer = document.getElementById('parent-lineage-container');
    elParentLineageLabel = document.getElementById('parent-lineage-label');
    elDetailsParent = document.getElementById('details-parent');
    elChildrenLineageContainer = document.getElementById('children-lineage-container');
    elDetailsChildren = document.getElementById('details-children');
  }

  function getActiveFilterStore() {
    return viewMode === 'detail' ? detailFilters : overviewFilters;
  }

  function setupEventListeners() {
    let searchDebounceTimer;
    elSearchInput.addEventListener('input', () => {
      const store = getActiveFilterStore();
      store.query = elSearchInput.value;
      elSearchClearBtn.hidden = !store.query.trim();
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        applyFiltersAndRender();
      }, 150);
    });

    elSearchClearBtn.addEventListener('click', () => {
      const store = getActiveFilterStore();
      store.query = '';
      elSearchInput.value = '';
      elSearchClearBtn.hidden = true;
      elSearchInput.focus();
      applyFiltersAndRender();
    });

    elTimeFilter.addEventListener('change', () => {
      const store = getActiveFilterStore();
      store.timeFilter = elTimeFilter.value;
      applyFiltersAndRender();
    });

    elResetFiltersBtn.addEventListener('click', () => {
      overviewFilters.query = '';
      overviewFilters.timeFilter = 'all';
      syncHeaderAndInputs();
      applyFiltersAndRender();
      elSearchInput.focus();
    });

    elDetailResetFiltersBtn.addEventListener('click', () => {
      detailFilters.query = '';
      detailFilters.timeFilter = 'all';
      syncHeaderAndInputs();
      applyFiltersAndRender();
      elMapContainer.focus();
    });

    elBackToOverviewBtn.addEventListener('click', () => {
      returnToOverview();
    });

    // Clear Map modal
    elClearMapBtn.addEventListener('click', () => {
      elClearError.hidden = true;
      elClearModal.hidden = false;
      elCancelClearBtn.focus();
    });

    elCancelClearBtn.addEventListener('click', () => {
      elClearModal.hidden = true;
      elClearMapBtn.focus();
    });

    elConfirmClearBtn.addEventListener('click', async () => {
      elConfirmClearBtn.disabled = true;
      elCancelClearBtn.disabled = true;
      elClearModal.focus();
      elClearError.hidden = true;
      try {
        if (!api || !api.runtime || !api.runtime.sendMessage || !globalThis.SpatialBackgroundMessages) {
          throw new Error('Background extension service is unavailable.');
        }
        const result = await api.runtime.sendMessage({
          type: globalThis.SpatialBackgroundMessages.CLEAR_HISTORY_MESSAGE
        });
        if (!result || !result.ok) throw new Error('The background service did not clear the graph.');

        elClearModal.hidden = true;
        closeDetailsPanel(false);
        viewMode = 'overview';
        selectedTreeId = null;
        overviewFilters.query = '';
        overviewFilters.timeFilter = 'all';
        overviewFilters.scrollTop = 0;
        overviewFilters.focusedTreeId = null;
        detailFilters.query = '';
        detailFilters.timeFilter = 'all';
        needsInitialFit = true;
        await loadAndRender();
        elClearMapBtn.focus();
      } catch (error) {
        elClearError.textContent = 'Could not clear the saved history. Please try again.';
        elClearError.hidden = false;
        console.error('[SpatialApp] Failed to clear history:', error);
      } finally {
        elConfirmClearBtn.disabled = false;
        elCancelClearBtn.disabled = false;
        if (!elClearModal.hidden) elConfirmClearBtn.focus();
      }
    });

    elClearModal.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(elClearModal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) {
        e.preventDefault();
        elClearModal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === elClearModal)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!elClearModal.hidden) {
          elClearModal.hidden = true;
          elClearMapBtn.focus();
        } else if (!elDetailsPanel.hidden) {
          closeDetailsPanel(true);
        }
      }
    });

    elDetailsCloseBtn.addEventListener('click', () => {
      closeDetailsPanel(true);
    });

    elReopenBtn.addEventListener('click', () => {
      if (!selectedNodeId || !currentState || !currentState.nodes[selectedNodeId]) return;
      const node = currentState.nodes[selectedNodeId];
      if (uiLogic.isDownloadNode(node)) return;
      reopenUrl(node.url);
    });

    elZoomIn.addEventListener('click', () => zoomBy(1.2));
    elZoomOut.addEventListener('click', () => zoomBy(0.83));
    elZoomReset.addEventListener('click', () => fitGraphToView());
  }

  function syncHeaderAndInputs() {
    const isDetail = viewMode === 'detail' && Boolean(selectedTreeId);
    elOverviewBrand.hidden = isDetail;
    elDetailBrand.hidden = !isDetail;
    elZoomControls.hidden = !isDetail;

    const store = isDetail ? detailFilters : overviewFilters;
    elSearchInput.placeholder = isDetail
      ? 'Search in this tree...'
      : 'Search titles, addresses, or files...';
    elSearchInput.value = store.query;
    elSearchClearBtn.hidden = !store.query.trim();
    elTimeFilter.value = store.timeFilter;
  }

  async function loadAndRender() {
    if (!storageManager) {
      showEmptyState();
      return;
    }

    try {
      currentState = await storageManager.getState();
      applyFiltersAndRender();
    } catch (err) {
      console.error('[SpatialApp] Failed to load graph state:', err);
      showEmptyState();
    }
  }

  function applyFiltersAndRender() {
    syncHeaderAndInputs();

    if (!currentState || !currentState.nodes || Object.keys(currentState.nodes).length === 0) {
      viewMode = 'overview';
      selectedTreeId = null;
      syncHeaderAndInputs();
      showEmptyState();
      return;
    }

    if (viewMode === 'detail' && selectedTreeId) {
      renderDetailView();
    } else {
      renderOverview();
    }
  }

  function renderOverview() {
    const summary = uiLogic.buildResearchTrees(currentState, {
      query: overviewFilters.query,
      timeFilter: overviewFilters.timeFilter,
      now: Date.now()
    });

    if (summary.totalCapturedCount === 0) {
      showEmptyState();
      return;
    }

    const treeLabel = `${summary.allTreesCount} Research ${summary.allTreesCount === 1 ? 'Tree' : 'Trees'}`;
    const visitLabel = `${summary.totalVisitsCount} ${summary.totalVisitsCount === 1 ? 'Visit' : 'Visits'}`;
    elNodeCountBadge.textContent = `${treeLabel} · ${visitLabel}`;

    const visibleItemsCount = summary.trees.length + summary.unattributedDownloads.length;
    if (visibleItemsCount === 0) {
      showOverviewNoResultsState();
      return;
    }

    elEmptyState.hidden = true;
    elNoResultsState.hidden = true;
    elDetailView.hidden = true;
    elOverviewView.hidden = false;
    closeDetailsPanel(false);

    const hasFilter = Boolean(overviewFilters.query.trim() || overviewFilters.timeFilter !== 'all');
    elOverviewTreesSummary.textContent = hasFilter
      ? `Showing ${summary.trees.length} of ${summary.allTreesCount}`
      : `${summary.allTreesCount} ${summary.allTreesCount === 1 ? 'tree' : 'trees'}`;

    renderTreeCards(summary.trees, hasFilter);
    renderUnattributedShelf(summary.unattributedDownloads);
  }

  function renderTreeCards(trees, hasFilter) {
    elTreesGrid.replaceChildren();
    elResearchTreesEmpty.hidden = trees.length > 0;

    for (const tree of trees) {
      elTreesGrid.appendChild(createTreeCard(tree, hasFilter));
    }
  }

  function createTreeCard(tree, hasFilter) {
    const card = document.createElement('article');
    card.className = 'tree-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('data-tree-id', tree.treeId);

    // Header: domain icon + domain + open-tabs/pruned badges
    const header = document.createElement('div');
    header.className = 'tree-card-header';

    const domainPill = document.createElement('div');
    domainPill.className = 'tree-domain-pill';

    const avatar = document.createElement('span');
    avatar.className = 'tree-domain-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = (tree.domain || 'W').charAt(0).toUpperCase();

    const domainName = document.createElement('span');
    domainName.className = 'tree-domain-name';
    domainName.textContent = tree.domain || 'web';

    domainPill.appendChild(avatar);
    domainPill.appendChild(domainName);
    header.appendChild(domainPill);

    const badgesWrap = document.createElement('div');
    badgesWrap.className = 'tree-card-badges';
    if (tree.openTabCount > 0) {
      const openBadge = document.createElement('span');
      openBadge.className = 'badge badge-tabs';
      openBadge.textContent = `${tree.openTabCount} open ${tree.openTabCount === 1 ? 'tab' : 'tabs'}`;
      badgesWrap.appendChild(openBadge);
    }
    if (tree.rootPruned) {
      const prunedBadge = document.createElement('span');
      prunedBadge.className = 'badge badge-root';
      prunedBadge.textContent = 'Root pruned';
      badgesWrap.appendChild(prunedBadge);
    }
    header.appendChild(badgesWrap);
    card.appendChild(header);

    // Title
    const titleEl = document.createElement('h3');
    titleEl.className = 'tree-card-title';
    titleEl.textContent = tree.title;
    card.appendChild(titleEl);

    // Stats row
    const stats = document.createElement('div');
    stats.className = 'tree-card-stats';

    const statParts = [
      `${tree.visitCount} ${tree.visitCount === 1 ? 'visit' : 'visits'}`,
      `${tree.branchCount} ${tree.branchCount === 1 ? 'branch' : 'branches'}`,
      `${tree.openTabCount} open ${tree.openTabCount === 1 ? 'tab' : 'tabs'}`
    ];
    if (tree.downloadCount > 0) {
      statParts.push(`${tree.downloadCount} ${tree.downloadCount === 1 ? 'download' : 'downloads'}`);
    }

    for (const part of statParts) {
      const span = document.createElement('span');
      span.className = 'tree-stat-item';
      span.textContent = `• ${part}`;
      stats.appendChild(span);
    }
    card.appendChild(stats);

    // Latest activity and updated time
    const meta = document.createElement('div');
    meta.className = 'tree-card-meta';

    const latestEl = document.createElement('div');
    latestEl.className = 'tree-card-latest';
    if (tree.latestNode && uiLogic.isDownloadNode(tree.latestNode)) {
      const origin = tree.latestNode.originDomain || 'Source unavailable';
      const dlFile = tree.latestNode.filename || 'download';
      latestEl.textContent = `Latest: Downloaded: ${dlFile} (from ${origin})`;
    } else if (tree.latestNode) {
      const latestLabel = tree.latestNode.title || uiLogic.getDomainLabel(tree.latestNode.url);
      latestEl.textContent = `Latest: ${latestLabel}`;
    } else {
      latestEl.textContent = 'Latest: Recorded session';
    }
    meta.appendChild(latestEl);

    const updatedEl = document.createElement('div');
    updatedEl.className = 'tree-card-updated';
    updatedEl.textContent = `Updated ${formatRelativeTime(tree.updatedAt)}`;
    meta.appendChild(updatedEl);

    if (hasFilter) {
      const matchNote = document.createElement('div');
      matchNote.className = 'tree-card-match-note';
      matchNote.textContent = `${tree.matchedNodeCount} matching ${tree.matchedNodeCount === 1 ? 'item' : 'items'}`;
      meta.appendChild(matchNote);
    }

    card.appendChild(meta);

    // Action button
    const footer = document.createElement('div');
    footer.className = 'tree-card-footer';

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'btn btn-primary btn-sm tree-open-btn';
    openBtn.setAttribute('data-tree-id', tree.treeId);
    openBtn.setAttribute('aria-label', `Open Tree Detail View for ${tree.title}`);

    const labelSpan = document.createElement('span');
    labelSpan.textContent = 'Open Tree Detail View';
    const arrowSpan = document.createElement('span');
    arrowSpan.setAttribute('aria-hidden', 'true');
    arrowSpan.textContent = '→';

    openBtn.appendChild(labelSpan);
    openBtn.appendChild(arrowSpan);
    openBtn.addEventListener('click', () => {
      openTreeDetail(tree.treeId);
    });

    footer.appendChild(openBtn);
    card.appendChild(footer);
    return card;
  }

  function renderUnattributedShelf(downloads) {
    elUnattributedList.replaceChildren();
    if (!downloads || downloads.length === 0) {
      elUnattributedSection.hidden = true;
      return;
    }

    elUnattributedSection.hidden = false;
    for (const dl of downloads) {
      elUnattributedList.appendChild(createUnattributedItem(dl));
    }
  }

  function createUnattributedItem(dl) {
    const li = document.createElement('li');
    li.className = 'unattributed-item';
    li.setAttribute('data-node-id', dl.id);

    const fileGroup = document.createElement('div');
    fileGroup.className = 'unattributed-file-group';

    const glyph = document.createElement('span');
    glyph.className = 'download-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = '↓';

    const nameEl = document.createElement('span');
    nameEl.className = 'unattributed-filename';
    nameEl.textContent = dl.filename || dl.title || 'download';

    fileGroup.appendChild(glyph);
    fileGroup.appendChild(nameEl);
    li.appendChild(fileGroup);

    const metaGroup = document.createElement('div');
    metaGroup.className = 'unattributed-meta-group';

    const timeEl = document.createElement('span');
    timeEl.className = 'unattributed-time';
    timeEl.textContent = `Completed ${formatRelativeTime(dl.timestamp)}`;
    timeEl.title = new Date(dl.timestamp).toLocaleString();

    const badge = document.createElement('span');
    badge.className = 'badge badge-unattributed';
    badge.textContent = 'Source unavailable';

    metaGroup.appendChild(timeEl);
    metaGroup.appendChild(badge);
    li.appendChild(metaGroup);

    return li;
  }

  function openTreeDetail(treeId) {
    if (!treeId) return;
    overviewFilters.scrollTop = elOverviewView.scrollTop;
    overviewFilters.focusedTreeId = treeId;

    viewMode = 'detail';
    selectedTreeId = treeId;
    detailFilters.query = '';
    detailFilters.timeFilter = 'all';
    needsInitialFit = true;
    closeDetailsPanel(false);

    applyFiltersAndRender();
    if (elBackToOverviewBtn) elBackToOverviewBtn.focus();
  }

  function returnToOverview() {
    closeDetailsPanel(false);
    viewMode = 'overview';
    selectedTreeId = null;
    needsInitialFit = true;
    applyFiltersAndRender();

    requestAnimationFrame(() => {
      if (elOverviewView && !elOverviewView.hidden) {
        elOverviewView.scrollTop = overviewFilters.scrollTop || 0;
        if (overviewFilters.focusedTreeId) {
          const cardBtn = Array.from(elTreesGrid.querySelectorAll('.tree-open-btn'))
            .find((btn) => btn.getAttribute('data-tree-id') === overviewFilters.focusedTreeId);
          if (cardBtn) {
            cardBtn.focus({ preventScroll: true });
            return;
          }
        }
        elOverviewView.focus({ preventScroll: true });
      }
    });
  }

  function renderDetailView() {
    const detail = uiLogic.buildTreeDetailView(currentState, selectedTreeId, {
      query: detailFilters.query,
      timeFilter: detailFilters.timeFilter,
      now: Date.now()
    });

    if (!detail.treeMeta) {
      returnToOverview();
      return;
    }

    elEmptyState.hidden = true;
    elNoResultsState.hidden = true;
    elOverviewView.hidden = true;
    elDetailView.hidden = false;

    elDetailTreeDomain.textContent = detail.treeMeta.domain;
    elDetailTreeTitle.textContent = truncateText(detail.treeMeta.title, 48);

    if (!detail.hasActiveFilter) {
      elDetailCountBadge.textContent = `${detail.allTreeNodesCount} ${detail.allTreeNodesCount === 1 ? 'node' : 'nodes'}`;
    } else if (detail.contextAncestorIds.size > 0) {
      elDetailCountBadge.textContent = `${detail.matchedIds.size} of ${detail.allTreeNodesCount} matching (+${detail.contextAncestorIds.size} context)`;
    } else {
      elDetailCountBadge.textContent = `${detail.matchedIds.size} of ${detail.allTreeNodesCount} matching`;
    }

    if (detail.contextAncestorIds.size > 0) {
      const c = detail.contextAncestorIds.size;
      elDetailContextBanner.textContent = `Showing ${c} ancestor context ${c === 1 ? 'node' : 'nodes'} (dimmed) outside the filter to preserve tree hierarchy.`;
      elDetailContextBanner.hidden = false;
    } else {
      elDetailContextBanner.hidden = true;
    }

    activeNodesMap = detail.nodesMap;
    if (selectedNodeId && !activeNodesMap.has(selectedNodeId)) {
      closeDetailsPanel(false);
    }

    if (activeNodesMap.size === 0) {
      showDetailNoResultsState();
      return;
    }

    elDetailNoResults.hidden = true;
    elMapContainer.hidden = false;

    computeGraphLayout();
    renderSvgGraph(detail.hasActiveFilter);
    if (needsInitialFit) {
      const tryInitialFit = () => {
        if (fitGraphToView()) needsInitialFit = false;
        else requestAnimationFrame(tryInitialFit);
      };
      requestAnimationFrame(tryInitialFit);
    }
  }

  function showEmptyState() {
    elEmptyState.hidden = false;
    elNoResultsState.hidden = true;
    elOverviewView.hidden = true;
    elDetailView.hidden = true;
    elNodeCountBadge.textContent = '0 visits';
    elEdgesLayer.replaceChildren();
    elNodesLayer.replaceChildren();
    layoutNodes = [];
    layoutEdges = [];
    activeNodesMap.clear();
    closeDetailsPanel(false);
  }

  function showOverviewNoResultsState() {
    elEmptyState.hidden = true;
    elOverviewView.hidden = true;
    elDetailView.hidden = true;
    elNoResultsState.hidden = false;
    closeDetailsPanel(false);
  }

  function showDetailNoResultsState() {
    elMapContainer.hidden = true;
    elDetailNoResults.hidden = false;
    elEdgesLayer.replaceChildren();
    elNodesLayer.replaceChildren();
    layoutNodes = [];
    layoutEdges = [];
    closeDetailsPanel(false);
  }

  function computeGraphLayout() {
    const layout = uiLogic.computeGraphLayout(activeNodesMap, {
      horizontalSpacing: HORIZONTAL_SPACING,
      verticalSpacing: VERTICAL_SPACING,
      treeVerticalGap: TREE_VERTICAL_GAP,
      marginLeft: MARGIN_LEFT,
      marginTop: MARGIN_TOP
    });
    layoutNodes = layout.layoutNodes;
    layoutEdges = layout.layoutEdges;
  }

  function renderSvgGraph(hasActiveFilter = false) {
    elEdgesLayer.replaceChildren();
    elNodesLayer.replaceChildren();

    const nodeCoords = new Map();
    for (const n of layoutNodes) {
      nodeCoords.set(n.id, n);
    }

    for (const edge of layoutEdges) {
      const p = nodeCoords.get(edge.parentId);
      const c = nodeCoords.get(edge.childId);
      if (!p || !c) continue;

      const startX = p.x + (NODE_WIDTH / 2);
      const startY = p.y;
      const endX = c.x - (NODE_WIDTH / 2);
      const endY = c.y;

      const deltaX = (endX - startX) * 0.5;
      const d = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;

      const pathEl = document.createElementNS(SVG_NS, 'path');
      pathEl.setAttribute('d', d);
      pathEl.setAttribute('class', 'graph-edge');
      pathEl.setAttribute('marker-end', 'url(#branch-arrow)');
      pathEl.setAttribute('data-parent', edge.parentId);
      pathEl.setAttribute('data-child', edge.childId);
      elEdgesLayer.appendChild(pathEl);
    }

    const query = detailFilters.query.trim();

    for (const n of layoutNodes) {
      const isDownload = n.nodeType === 'download';
      const g = document.createElementNS(SVG_NS, 'g');

      let classes = 'map-node';
      if (isDownload) classes += ' is-download';
      else if (n.isCheckpoint) classes += ' is-root';
      if (n.isActiveHead) classes += ' is-active-head';
      if (n.isContextAncestor) classes += ' is-context-ancestor';
      if (hasActiveFilter && query && n.isMatch && !n.isContextAncestor) classes += ' is-search-match';
      if (n.id === selectedNodeId) classes += ' is-selected';

      g.setAttribute('class', classes);
      g.setAttribute('transform', `translate(${n.x}, ${n.y})`);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('data-id', n.id);
      g.setAttribute('data-node-type', n.nodeType);

      const timeStr = formatRelativeTime(n.timestamp);
      let safeTitle, safeSubtitle, ariaLabel;

      if (isDownload) {
        const originLabel = n.originDomain || 'Source unavailable';
        const fname = n.filename || n.title || 'download';
        safeTitle = truncateText(fname, 24);
        safeSubtitle = truncateText(`Downloaded from ${originLabel} • ${timeStr}`, 30);
        ariaLabel = `Download: ${fname}, Downloaded from ${originLabel}, completed ${timeStr}`;
      } else {
        const hostname = uiLogic.getDomainLabel(n.url);
        safeTitle = truncateText(n.title || n.url, 24);
        safeSubtitle = truncateText(`${hostname} • ${timeStr}`, 30);
        ariaLabel = `${n.title || n.url} on ${hostname}, visited ${timeStr}${n.isActiveHead ? ', open tab' : ''}${n.isContextAncestor ? ', ancestor context' : ''}`;
      }

      g.setAttribute('aria-label', ariaLabel);

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', 'node-pill');
      rect.setAttribute('x', String(-NODE_WIDTH / 2));
      rect.setAttribute('y', String(-NODE_HEIGHT / 2));
      rect.setAttribute('width', String(NODE_WIDTH));
      rect.setAttribute('height', String(NODE_HEIGHT));
      rect.setAttribute('rx', '8');
      rect.setAttribute('ry', '8');
      g.appendChild(rect);

      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('class', 'node-icon-circle');
      circle.setAttribute('cx', String(-NODE_WIDTH / 2 + 16));
      circle.setAttribute('cy', '0');
      circle.setAttribute('r', '5');
      g.appendChild(circle);

      if (n.isActiveHead) {
        const activeDot = document.createElementNS(SVG_NS, 'circle');
        activeDot.setAttribute('class', 'node-active-dot');
        activeDot.setAttribute('cx', String(NODE_WIDTH / 2 - 12));
        activeDot.setAttribute('cy', '-10');
        activeDot.setAttribute('r', '3.5');
        g.appendChild(activeDot);
      }

      const textTitle = document.createElementNS(SVG_NS, 'text');
      textTitle.setAttribute('class', 'node-text-title');
      textTitle.setAttribute('x', String(-NODE_WIDTH / 2 + 30));
      textTitle.setAttribute('y', '-3');
      textTitle.textContent = safeTitle;
      g.appendChild(textTitle);

      const textSub = document.createElementNS(SVG_NS, 'text');
      textSub.setAttribute('class', 'node-text-sub');
      textSub.setAttribute('x', String(-NODE_WIDTH / 2 + 30));
      textSub.setAttribute('y', '13');
      textSub.textContent = safeSubtitle;
      g.appendChild(textSub);

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        selectNode(n.id, true);
      });

      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectNode(n.id, true);
        }
      });

      elNodesLayer.appendChild(g);
    }
  }

  function selectNode(nodeId, focusPanel = false) {
    selectedNodeId = nodeId;

    for (const el of elNodesLayer.querySelectorAll('.map-node')) {
      el.classList.toggle('is-selected', el.getAttribute('data-id') === nodeId);
    }

    for (const edge of elEdgesLayer.querySelectorAll('.graph-edge')) {
      const p = edge.getAttribute('data-parent');
      const c = edge.getAttribute('data-child');
      edge.classList.toggle('is-highlighted', p === nodeId || c === nodeId);
    }

    const node = currentState && currentState.nodes ? currentState.nodes[nodeId] : null;
    if (!node) return;

    if (uiLogic.isDownloadNode(node)) {
      populateDownloadDetails(node);
    } else {
      populatePageDetails(node);
    }

    populateLineage(node);

    elDetailsPanel.hidden = false;
    if (focusPanel) elDetailsCloseBtn.focus();
  }

  function populatePageDetails(node) {
    elDetailsHeading.textContent = 'Page Details';
    elDetailsTitleLabel.textContent = 'Title';
    elDetailsTitle.textContent = node.title || node.url;
    elDetailsUrlField.hidden = false;
    elDetailsUrl.textContent = node.url;
    elDetailsSourceField.hidden = true;
    elDetailsSource.textContent = '';
    elDetailsActions.hidden = false;
    elDetailsTimeLabel.textContent = 'Visited';
    elDetailsTime.textContent = new Date(node.timestamp).toLocaleString();
    elParentLineageLabel.textContent = 'Reached From (Parent)';

    const layoutEntry = activeNodesMap.get(node.id);
    const contextSuffix = layoutEntry && layoutEntry.isContextAncestor ? ' (Filter Context)' : '';

    if (node.isCheckpoint || !node.parentNodeId) {
      elDetailsType.textContent = `Root Checkpoint${contextSuffix}`;
      elDetailsBadge.textContent = 'Starting Point';
      elDetailsBadge.className = 'badge badge-root';
    } else {
      elDetailsType.textContent = `Navigation Branch${contextSuffix}`;
      elDetailsBadge.textContent = 'Branch Visit';
      elDetailsBadge.className = 'badge badge-branch';
    }
  }

  function populateDownloadDetails(node) {
    const origin = node.originDomain || 'Source unavailable';
    const isUnavailable = origin.toLowerCase() === 'source unavailable';

    elDetailsHeading.textContent = 'Download Details';
    elDetailsTitleLabel.textContent = 'Filename';
    elDetailsTitle.textContent = node.filename || node.title || 'download';

    // Never offer page URL display or page reopening for download nodes.
    elDetailsUrlField.hidden = true;
    elDetailsUrl.textContent = '';
    elDetailsActions.hidden = true;

    elDetailsSourceField.hidden = false;
    elDetailsSource.textContent = isUnavailable ? 'Source unavailable' : `Downloaded from ${origin}`;
    elDetailsSource.classList.toggle('is-unavailable', isUnavailable);

    elDetailsTimeLabel.textContent = 'Completed';
    elDetailsTime.textContent = new Date(node.timestamp).toLocaleString();
    elDetailsType.textContent = 'Download Provenance';
    elDetailsBadge.textContent = 'Download';
    elDetailsBadge.className = isUnavailable ? 'badge badge-unattributed' : 'badge badge-download';
    elParentLineageLabel.textContent = 'Downloaded From Page';
  }

  function populateLineage(node) {
    elDetailsParent.replaceChildren();
    if (node.parentNodeId && currentState.nodes[node.parentNodeId]) {
      elParentLineageContainer.hidden = false;
      const parentNode = currentState.nodes[node.parentNodeId];
      const pLabel = parentNode.title || parentNode.url || parentNode.filename;
      elDetailsParent.textContent = truncateText(pLabel, 34);
      elDetailsParent.setAttribute('aria-label', `Go to parent node: ${pLabel}`);
      elDetailsParent.onclick = () => navigateToNode(parentNode.id);
    } else {
      elParentLineageContainer.hidden = true;
    }

    elDetailsChildren.replaceChildren();
    const validChildren = (Array.isArray(node.childNodeIds) ? node.childNodeIds : [])
      .map((cid) => currentState.nodes[cid])
      .filter(Boolean);

    if (validChildren.length > 0) {
      elChildrenLineageContainer.hidden = false;
      for (const child of validChildren) {
        const childPill = document.createElement('button');
        childPill.type = 'button';
        childPill.className = 'lineage-node-pill';
        const isDl = uiLogic.isDownloadNode(child);
        const childLabel = isDl
          ? `Download: ${child.filename || 'download'}`
          : (child.title || child.url);
        childPill.setAttribute('aria-label', `Go to child ${isDl ? 'download' : 'visit'}: ${childLabel}`);
        childPill.textContent = truncateText(childLabel, 34);
        childPill.onclick = () => navigateToNode(child.id);
        elDetailsChildren.appendChild(childPill);
      }
    } else {
      elChildrenLineageContainer.hidden = true;
    }
  }

  function navigateToNode(nodeId) {
    if (!activeNodesMap.has(nodeId)) {
      detailFilters.query = '';
      detailFilters.timeFilter = 'all';
      applyFiltersAndRender();
    }
    if (!activeNodesMap.has(nodeId)) return;
    selectNode(nodeId, false);
    centerNode(nodeId);
    for (const nodeEl of elNodesLayer.querySelectorAll('.map-node')) {
      if (nodeEl.getAttribute('data-id') === nodeId) {
        nodeEl.focus();
        break;
      }
    }
  }

  function closeDetailsPanel(restoreFocus = false) {
    const previousNodeId = selectedNodeId;
    elDetailsPanel.hidden = true;
    selectedNodeId = null;

    for (const el of elNodesLayer.querySelectorAll('.map-node')) {
      el.classList.remove('is-selected');
    }
    for (const edge of elEdgesLayer.querySelectorAll('.graph-edge')) {
      edge.classList.remove('is-highlighted');
    }

    if (restoreFocus && previousNodeId) {
      for (const nodeEl of elNodesLayer.querySelectorAll('.map-node')) {
        if (nodeEl.getAttribute('data-id') === previousNodeId) {
          nodeEl.focus();
          break;
        }
      }
    }
  }

  function centerNode(nodeId) {
    const lNode = layoutNodes.find((n) => n.id === nodeId);
    if (!lNode) return;

    const containerRect = elMapContainer.getBoundingClientRect();
    translateX = (containerRect.width / 2) - lNode.x * scale;
    translateY = (containerRect.height / 2) - lNode.y * scale;
    applyTransform();
  }

  function fitGraphToView() {
    if (layoutNodes.length === 0) {
      scale = 1.0;
      translateX = 0;
      translateY = 0;
      applyTransform();
      return true;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of layoutNodes) {
      minX = Math.min(minX, n.x - NODE_WIDTH / 2);
      maxX = Math.max(maxX, n.x + NODE_WIDTH / 2);
      minY = Math.min(minY, n.y - NODE_HEIGHT / 2);
      maxY = Math.max(maxY, n.y + NODE_HEIGHT / 2);
    }

    const containerRect = elMapContainer.getBoundingClientRect();
    if (containerRect.width <= 0 || containerRect.height <= 0) return false;
    const padding = 60;
    const graphWidth = maxX - minX + padding * 2;
    const graphHeight = maxY - minY + padding * 2;

    const scaleX = containerRect.width / graphWidth;
    const scaleY = containerRect.height / graphHeight;
    scale = Math.min(Math.max(0.003, Math.min(scaleX, scaleY)), 1.25);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    translateX = (containerRect.width / 2) - centerX * scale;
    translateY = (containerRect.height / 2) - centerY * scale;

    applyTransform();
    return true;
  }

  function setupPanAndZoom() {
    elMapContainer.addEventListener('mousedown', (e) => {
      if (e.target.closest('.map-node') || e.target.closest('button') || e.target.closest('input')) {
        return;
      }
      isDragging = true;
      startDragX = e.clientX - translateX;
      startDragY = e.clientY - translateY;
      elMapContainer.classList.add('is-panning');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      translateX = e.clientX - startDragX;
      translateY = e.clientY - startDragY;
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        elMapContainer.classList.remove('is-panning');
      }
    });

    elMapContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = elMapContainer.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.min(Math.max(0.2, scale * zoomFactor), 3.0);

      translateX = mouseX - (mouseX - translateX) * (newScale / scale);
      translateY = mouseY - (mouseY - translateY) * (newScale / scale);
      scale = newScale;

      applyTransform();
    }, { passive: false });

    elMapContainer.addEventListener('keydown', (e) => {
      const panStep = 60;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          translateX += panStep;
          applyTransform();
          break;
        case 'ArrowRight':
          e.preventDefault();
          translateX -= panStep;
          applyTransform();
          break;
        case 'ArrowUp':
          e.preventDefault();
          translateY += panStep;
          applyTransform();
          break;
        case 'ArrowDown':
          e.preventDefault();
          translateY -= panStep;
          applyTransform();
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomBy(1.2);
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomBy(0.83);
          break;
        case '0':
          e.preventDefault();
          fitGraphToView();
          break;
      }
    });

    elMapContainer.addEventListener('click', (e) => {
      if (!e.target.closest('.map-node') && !e.target.closest('.details-panel')) {
        closeDetailsPanel(false);
      }
    });
  }

  function zoomBy(factor) {
    const rect = elMapContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const newScale = Math.min(Math.max(0.2, scale * factor), 3.0);
    translateX = centerX - (centerX - translateX) * (newScale / scale);
    translateY = centerY - (centerY - translateY) * (newScale / scale);
    scale = newScale;

    applyTransform();
  }

  function applyTransform() {
    if (elViewport) {
      elViewport.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);
    }
  }

  function reopenUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return;
    try {
      if (!uiLogic.isSafeHttpUrl(rawUrl)) {
        console.warn('[SpatialApp] Reopen blocked: URL must be HTTP or HTTPS:', rawUrl);
        return;
      }
      if (api && api.tabs && api.tabs.create) {
        api.tabs.create({ url: rawUrl });
      } else {
        window.open(rawUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.warn('[SpatialApp] Invalid URL cannot be reopened:', err);
    }
  }

  function formatRelativeTime(ts) {
    if (!Number.isFinite(ts)) return 'recently';
    const elapsedSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (elapsedSec < 60) return 'just now';
    const min = Math.floor(elapsedSec / 60);
    if (min < 60) return `${min}m ago`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function truncateText(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
