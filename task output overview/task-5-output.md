# Task 5 Output — Conclusive Firefox End-to-End Verification

**Status:** Completed & Verified  
**Milestone:** 5 (Firefox E2E Conclusive Evidence)  
**Browser Target:** Mozilla Firefox 158.0.1 (x64 Windows)  

---

## 1. Objectives & Scope
- Upgrade `scripts/e2e-firefox-verification.py` from synthetic events to genuine Marionette / WebDriver browser input actions:
  - Real browser toolbar action clicks on `spatial-browser-history_term-project_local-BAP`.
  - Native pointer dragging for canvas panning.
  - W3C wheel actions for zooming.
  - Native keyboard arrow keys and Enter key for node selection.
  - Tab and Shift+Tab keyboard focus navigation to verify dialog focus trapping.
- Make visit-count auditing explicit: assert initial visit count, track child tab reopening, and assert exactly $+1$ visit delta upon reopening the closed child tab.
- Capture and evaluate Gecko `Services.console` records across browsing and restart phases.
- Preserve full run logs under `docs/test-results/firefox-e2e.log`.

---

## 2. Verified Execution Steps & Results
1. **Unpacked Extension Installation:** Temporary add-on loaded via Marionette (`Addon ID: spatial-browser-history@term-project.local`). Pinned action button to nav-bar.
2. **Toolbar Action Click & Repeat Focus:**
   - Action 1 (`WebDriver:ElementClick`): Opened map tab (`totalTabs=2`, was 1).
   - Switched to `about:home`.
   - Action 2 (`WebDriver:ElementClick` repeat): Refocused existing map tab without increasing tab count (`totalTabs=2`).
3. **Browsing Scenarios & Relationship Assertions:**
   - Page 1: Root checkpoint (`parentNodeId: null`, `isCheckpoint: true`).
   - Same-tab navigation (Page 2): Child of Page 1.
   - Redirect (HTTP 302 `/redirect` -> `/target`): Target recorded as child of Page 2.
   - Reload deduplication: Exactly 1 node stored for `/target` despite reload.
   - Dynamic title update: Updated in place to `'Updated Target Title'`.
   - Anchor fragment: `#section1` updated current URL without creating extra visit.
   - SPA route (`pushState`): `/target/spa-route` recorded as child of `/target`.
   - Opener relationship: `/child` tab recorded as child of `/opener`.
4. **Explicit Visit-Count Audit & URL Reopening:**
   - Initial stored visits: **6 visits** (6 SVG nodes).
   - Selected closed `/child` node via pointer action, clicked `#reopen-btn`.
   - Opened tab loaded `http://127.0.0.1:.../child`.
   - Final stored visits: **7 visits** (+1 new visit explicitly audited).
5. **Pan, Zoom, Keyboard Navigation, and Dialog Focus Trap:**
   - Pointer drag panned viewport `(68.17, 342.41) -> (148.17, 402.41)`.
   - Keyboard arrow keys panned canvas. Zoom in, zoom out, fit button, and W3C wheel zoom verified.
   - Enter key opened details drawer.
   - Clear modal Tab/Shift+Tab focus trapping verified: initial focus on `#cancel-clear-btn`, Tab moved focus to `#confirm-clear-btn`, Shift+Tab wrapped backward to `#cancel-clear-btn`.
   - Modal cancel preserved all visits; modal confirm cleared storage and rendered empty state.
6. **Browser Restart & Persistence:**
   - Stored node in SQLite, terminated Firefox process, relaunched with persistent profile, reopened map, and verified 1 visit persisted.

---

## 3. Artifacts Preserved
- Full execution log: `docs/test-results/firefox-e2e.log` (10/10 steps passed, 0 failures).
- Updated checklist: `docs/TEST_PLAN.md`.
