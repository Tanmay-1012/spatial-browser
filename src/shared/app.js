/**
 * Spatial Browser History - Main Application UI Logic
 * 
 * Manages the interactive SVG history map, hierarchical tree layout,
 * pan and zoom, search and time filtering, visit details, reopening URLs,
 * and clear-map action.
 * 
 * Strict CSP & Safety: All browser-provided strings rendered as text (zero innerHTML).
 */

(function () {
  'use strict';

  // SVG namespace
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Layout metrics
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 44;
  const HORIZONTAL_SPACING = 270;
  const VERTICAL_SPACING = 68;
  const TREE_VERTICAL_GAP = 54;
  const MARGIN_LEFT = 80;
  const MARGIN_TOP = 80;

  // Global state
  let storageManager = null;
  let currentState = null;
  let activeNodesMap = new Map();
  let layoutNodes = [];
  let layoutEdges = [];
  let selectedNodeId = null;

  // Viewport transform state
  let scale = 1.0;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let startDragX = 0;
  let startDragY = 0;

  // WebExtension API detection
  const api = (typeof browser !== 'undefined' && browser.runtime) 
    ? browser 
    : (typeof chrome !== 'undefined' && chrome.runtime) 
      ? chrome 
      : null;
  const uiLogic = globalThis.SpatialUILogic;

  // DOM element references
  let elMapContainer, elMapSvg, elViewport, elEdgesLayer, elNodesLayer;
  let elEmptyState, elNoResultsState, elDetailsPanel, elClearModal;
  let elSearchInput, elSearchClearBtn, elTimeFilter, elNodeCountBadge;
  let elZoomIn, elZoomOut, elZoomReset, elClearMapBtn, elConfirmClearBtn, elCancelClearBtn;
  let elResetFiltersBtn, elDetailsCloseBtn, elReopenBtn, elClearError;
  let elDetailsTitle, elDetailsUrl, elDetailsTime, elDetailsType, elDetailsBadge;
  let elDetailsParent, elDetailsChildren, elParentLineageContainer, elChildrenLineageContainer;
  let needsInitialFit = true;

  /**
   * Initializes the DOM elements and event handlers.
   */
  async function init() {
    cacheDomElements();
    setupEventListeners();
    setupPanAndZoom();

    // Initialize storage backend
    if (typeof globalThis.SpatialStorage !== 'undefined') {
      storageManager = new globalThis.SpatialStorage.StorageManager();
      try {
        await storageManager.init();
      } catch (err) {
        console.warn('[SpatialApp] Storage initialization notice:', err);
      }
    }

    // Listen for storage changes across tabs to update map live
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
    elMapContainer = document.getElementById('map-container');
    elMapSvg = document.getElementById('map-svg');
    elViewport = document.getElementById('map-viewport');
    elEdgesLayer = document.getElementById('edges-layer');
    elNodesLayer = document.getElementById('nodes-layer');

    elEmptyState = document.getElementById('empty-state');
    elNoResultsState = document.getElementById('no-results-state');
    elDetailsPanel = document.getElementById('details-panel');
    elClearModal = document.getElementById('clear-modal');

    elSearchInput = document.getElementById('search-input');
    elSearchClearBtn = document.getElementById('search-clear-btn');
    elTimeFilter = document.getElementById('time-filter');
    elNodeCountBadge = document.getElementById('node-count-badge');

    elZoomIn = document.getElementById('zoom-in');
    elZoomOut = document.getElementById('zoom-out');
    elZoomReset = document.getElementById('zoom-reset');
    elClearMapBtn = document.getElementById('clear-map-btn');
    elConfirmClearBtn = document.getElementById('confirm-clear-btn');
    elCancelClearBtn = document.getElementById('cancel-clear-btn');
    elClearError = document.getElementById('clear-error');
    elResetFiltersBtn = document.getElementById('reset-filters-btn');
    elDetailsCloseBtn = document.getElementById('details-close-btn');
    elReopenBtn = document.getElementById('reopen-btn');

    elDetailsTitle = document.getElementById('details-title');
    elDetailsUrl = document.getElementById('details-url');
    elDetailsTime = document.getElementById('details-time');
    elDetailsType = document.getElementById('details-type');
    elDetailsBadge = document.getElementById('details-badge');
    elDetailsParent = document.getElementById('details-parent');
    elDetailsChildren = document.getElementById('details-children');
    elParentLineageContainer = document.getElementById('parent-lineage-container');
    elChildrenLineageContainer = document.getElementById('children-lineage-container');
  }

  function setupEventListeners() {
    // Search input with debounce
    let searchDebounceTimer;
    elSearchInput.addEventListener('input', () => {
      const query = elSearchInput.value.trim();
      elSearchClearBtn.hidden = !query;
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        applyFiltersAndRender();
      }, 150);
    });

    elSearchClearBtn.addEventListener('click', () => {
      elSearchInput.value = '';
      elSearchClearBtn.hidden = true;
      elSearchInput.focus();
      applyFiltersAndRender();
    });

    // Time range filter
    elTimeFilter.addEventListener('change', () => {
      applyFiltersAndRender();
    });

    // Reset filters button in no-results state
    elResetFiltersBtn.addEventListener('click', () => {
      elSearchInput.value = '';
      elSearchClearBtn.hidden = true;
      elTimeFilter.value = 'all';
      applyFiltersAndRender();
    });

    // Clear Map Modal
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
        closeDetailsPanel();
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

    // Close modal on Escape
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

    // Details panel close button
    elDetailsCloseBtn.addEventListener('click', () => {
      closeDetailsPanel(true);
    });

    // Reopen URL in new tab
    elReopenBtn.addEventListener('click', () => {
      if (!selectedNodeId || !currentState || !currentState.nodes[selectedNodeId]) return;
      const node = currentState.nodes[selectedNodeId];
      reopenUrl(node.url);
    });

    // Zoom buttons
    elZoomIn.addEventListener('click', () => zoomBy(1.2));
    elZoomOut.addEventListener('click', () => zoomBy(0.83));
    elZoomReset.addEventListener('click', () => fitGraphToView());
  }

  /**
   * Loads state from storage backend and renders the map.
   */
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

  /**
   * Filters nodes based on current search query and time range.
   */
  function applyFiltersAndRender() {
    if (!currentState || !currentState.nodes) {
      showEmptyState();
      return;
    }

    const allNodes = Object.values(currentState.nodes);
    const totalCount = allNodes.length;

    if (totalCount === 0) {
      showEmptyState();
      return;
    }

    const query = elSearchInput.value.trim().toLowerCase();
    const filteredNodes = uiLogic.filterNodes(allNodes, query, elTimeFilter.value, Date.now());
    activeNodesMap = new Map(filteredNodes.map((node) => [node.id, Object.assign({}, node)]));
    if (selectedNodeId && !activeNodesMap.has(selectedNodeId)) closeDetailsPanel();

    const matchCount = activeNodesMap.size;
    elNodeCountBadge.textContent = `${matchCount} of ${totalCount} visits`;

    if (matchCount === 0) {
      showNoResultsState();
      return;
    }

    // Hide placeholder states, show map
    elEmptyState.hidden = true;
    elNoResultsState.hidden = true;
    elMapContainer.hidden = false;

    // Run layout and draw graph
    computeGraphLayout();
    renderSvgGraph();
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
    elMapContainer.hidden = true;
    elNodeCountBadge.textContent = '0 visits';
    elEdgesLayer.replaceChildren();
    elNodesLayer.replaceChildren();
    layoutNodes = [];
    layoutEdges = [];
    activeNodesMap.clear();
    closeDetailsPanel();
  }

  function showNoResultsState() {
    elEmptyState.hidden = true;
    elNoResultsState.hidden = false;
    elMapContainer.hidden = true;
    elEdgesLayer.replaceChildren();
    elNodesLayer.replaceChildren();
    layoutNodes = [];
    layoutEdges = [];
    activeNodesMap.clear();
    closeDetailsPanel();
  }

  /**
   * Hierarchical forest layout:
   * - Roots placed on left (depth 0).
   * - Children placed along X (depth * HORIZONTAL_SPACING).
   * - Y coordinates distributed recursively without overlap.
   */
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

  /**
   * Renders layout nodes and cubic bezier edges into SVG.
   */
  function renderSvgGraph() {
    // Clear previous SVG layers
    while (elEdgesLayer.firstChild) elEdgesLayer.removeChild(elEdgesLayer.firstChild);
    while (elNodesLayer.firstChild) elNodesLayer.removeChild(elNodesLayer.firstChild);

    const nodeCoords = new Map();
    for (const n of layoutNodes) {
      nodeCoords.set(n.id, n);
    }

    // 1. Draw Edges
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

    // 2. Draw Nodes
    const query = elSearchInput.value.trim().toLowerCase();

    for (const n of layoutNodes) {
      const g = document.createElementNS(SVG_NS, 'g');
      let classes = 'map-node';
      if (n.isCheckpoint) classes += ' is-root';
      if (n.id === selectedNodeId) classes += ' is-selected';
      if (query) classes += ' is-search-match';
      g.setAttribute('class', classes);
      g.setAttribute('transform', `translate(${n.x}, ${n.y})`);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('data-id', n.id);

      const hostname = getDomain(n.url);
      const timeStr = formatRelativeTime(n.timestamp);
      const safeTitle = truncateText(n.title || n.url, 26);
      const safeSubtitle = truncateText(`${hostname} • ${timeStr}`, 30);

      g.setAttribute('aria-label', `${n.title || n.url} on ${hostname}, visited ${timeStr}`);

      // Pill Background Rect
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', 'node-pill');
      rect.setAttribute('x', String(-NODE_WIDTH / 2));
      rect.setAttribute('y', String(-NODE_HEIGHT / 2));
      rect.setAttribute('width', String(NODE_WIDTH));
      rect.setAttribute('height', String(NODE_HEIGHT));
      rect.setAttribute('rx', '8');
      rect.setAttribute('ry', '8');
      g.appendChild(rect);

      // Node Status Circle
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('class', 'node-icon-circle');
      circle.setAttribute('cx', String(-NODE_WIDTH / 2 + 16));
      circle.setAttribute('cy', '0');
      circle.setAttribute('r', '5');
      g.appendChild(circle);

      // Node Title Text
      const textTitle = document.createElementNS(SVG_NS, 'text');
      textTitle.setAttribute('class', 'node-text-title');
      textTitle.setAttribute('x', String(-NODE_WIDTH / 2 + 30));
      textTitle.setAttribute('y', '-3');
      textTitle.textContent = safeTitle;
      g.appendChild(textTitle);

      // Node Subtitle Text (domain & time)
      const textSub = document.createElementNS(SVG_NS, 'text');
      textSub.setAttribute('class', 'node-text-sub');
      textSub.setAttribute('x', String(-NODE_WIDTH / 2 + 30));
      textSub.setAttribute('y', '13');
      textSub.textContent = safeSubtitle;
      g.appendChild(textSub);

      // Interactions: Click and Enter
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

  /**
   * Selects a node, highlights connected branches, and opens details drawer.
   */
  function selectNode(nodeId, focusPanel = false) {
    selectedNodeId = nodeId;

    // Update SVG selection classes
    const nodeEls = elNodesLayer.querySelectorAll('.map-node');
    for (const el of nodeEls) {
      if (el.getAttribute('data-id') === nodeId) {
        el.classList.add('is-selected');
      } else {
        el.classList.remove('is-selected');
      }
    }

    // Highlight connected edges
    const edgeEls = elEdgesLayer.querySelectorAll('.graph-edge');
    for (const edge of edgeEls) {
      const p = edge.getAttribute('data-parent');
      const c = edge.getAttribute('data-child');
      if (p === nodeId || c === nodeId) {
        edge.classList.add('is-highlighted');
      } else {
        edge.classList.remove('is-highlighted');
      }
    }

    // Populate Details Drawer
    const node = currentState.nodes[nodeId];
    if (!node) return;

    elDetailsTitle.textContent = node.title || node.url;
    elDetailsUrl.textContent = node.url;
    elDetailsTime.textContent = new Date(node.timestamp).toLocaleString();

    if (node.isCheckpoint || !node.parentNodeId) {
      elDetailsType.textContent = 'Root Checkpoint';
      elDetailsBadge.textContent = 'Starting Point';
      elDetailsBadge.className = 'badge badge-root';
    } else {
      elDetailsType.textContent = 'Navigation Branch';
      elDetailsBadge.textContent = 'Branch Visit';
      elDetailsBadge.className = 'badge badge-branch';
    }

    // Populate Parent Link
    while (elDetailsParent.firstChild) elDetailsParent.removeChild(elDetailsParent.firstChild);
    if (node.parentNodeId && currentState.nodes[node.parentNodeId]) {
      elParentLineageContainer.hidden = false;
      const parentNode = currentState.nodes[node.parentNodeId];
      const pText = document.createTextNode(truncateText(parentNode.title || parentNode.url, 32));
      elDetailsParent.replaceChildren(pText);
      elDetailsParent.setAttribute('aria-label', `Go to parent visit: ${parentNode.title || parentNode.url}`);
      elDetailsParent.onclick = () => {
        navigateToNode(parentNode.id);
      };
    } else {
      elParentLineageContainer.hidden = true;
    }

    // Populate Children Links
    while (elDetailsChildren.firstChild) elDetailsChildren.removeChild(elDetailsChildren.firstChild);
    const validChildren = (node.childNodeIds || [])
      .map(cid => currentState.nodes[cid])
      .filter(Boolean);

    if (validChildren.length > 0) {
      elChildrenLineageContainer.hidden = false;
      for (const child of validChildren) {
        const childPill = document.createElement('button');
        childPill.type = 'button';
        childPill.className = 'lineage-node-pill';
        childPill.setAttribute('aria-label', `Go to child visit: ${child.title || child.url}`);
        childPill.textContent = truncateText(child.title || child.url, 32);
        childPill.onclick = () => {
          navigateToNode(child.id);
        };
        elDetailsChildren.appendChild(childPill);
      }
    } else {
      elChildrenLineageContainer.hidden = true;
    }

    // Open Details Panel
    elDetailsPanel.hidden = false;
    if (focusPanel) elDetailsCloseBtn.focus();
  }

  function navigateToNode(nodeId) {
    if (!activeNodesMap.has(nodeId)) {
      elSearchInput.value = '';
      elSearchClearBtn.hidden = true;
      elTimeFilter.value = 'all';
      applyFiltersAndRender();
    }
    if (!activeNodesMap.has(nodeId)) return;
    selectNode(nodeId);
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

    const nodeEls = elNodesLayer.querySelectorAll('.map-node');
    for (const el of nodeEls) el.classList.remove('is-selected');

    const edgeEls = elEdgesLayer.querySelectorAll('.graph-edge');
    for (const edge of edgeEls) edge.classList.remove('is-highlighted');

    if (restoreFocus && previousNodeId) {
      for (const nodeEl of elNodesLayer.querySelectorAll('.map-node')) {
        if (nodeEl.getAttribute('data-id') === previousNodeId) {
          nodeEl.focus();
          break;
        }
      }
    }
  }

  /**
   * Centers the given node in the viewport.
   */
  function centerNode(nodeId) {
    const lNode = layoutNodes.find(n => n.id === nodeId);
    if (!lNode) return;

    const containerRect = elMapContainer.getBoundingClientRect();
    translateX = (containerRect.width / 2) - lNode.x * scale;
    translateY = (containerRect.height / 2) - lNode.y * scale;
    applyTransform();
  }

  /**
   * Auto-fits all layout nodes into the visible SVG container.
   */
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

  /**
   * Setup interactive mouse dragging, wheel zooming, and keyboard pan/zoom.
   */
  function setupPanAndZoom() {
    // Mouse Drag Panning
    elMapContainer.addEventListener('mousedown', (e) => {
      // Ignore clicks on SVG nodes or buttons
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

    // Mouse Wheel Zooming
    elMapContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = elMapContainer.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.min(Math.max(0.2, scale * zoomFactor), 3.0);

      // Zoom toward cursor location
      translateX = mouseX - (mouseX - translateX) * (newScale / scale);
      translateY = mouseY - (mouseY - translateY) * (newScale / scale);
      scale = newScale;

      applyTransform();
    }, { passive: false });

    // Keyboard Pan & Zoom
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

    // Clicking map background deselects active node
    elMapContainer.addEventListener('click', (e) => {
      if (!e.target.closest('.map-node') && !e.target.closest('.details-panel')) {
        closeDetailsPanel();
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

  /**
   * Validates and reopens an HTTP/HTTPS address in a new tab.
   */
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

  // Formatting utility functions
  function getDomain(rawUrl) {
    try {
      return new URL(rawUrl).hostname.replace(/^www\./, '');
    } catch (_) {
      return 'web';
    }
  }

  function formatRelativeTime(ts) {
    const elapsedSec = Math.floor((Date.now() - ts) / 1000);
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

  // Bootstrapping
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
