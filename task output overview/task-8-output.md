# Task 8 Output — Unknown-Opener Fallback and Cross-Browser Parity

**Status:** Completed & Verified  
**Milestone:** 8 (Full Runtime Parity Across Chrome and Firefox)  
**Browser Targets:** Google Chrome 156.0.8078.48 & Mozilla Firefox 158.0.1 (x64 Windows)  

---

## 1. Objectives & Scope
- Close all remaining cross-browser acceptance gaps between Google Chrome and Mozilla Firefox:
  1. Verify Chrome's real toolbar action in the browser UI via native Windows UI Automation (action 1 opens map, action 2 focuses existing tab).
  2. Implement and verify an unknown/closed-opener runtime scenario in Chrome.
  3. Add a dedicated automated test in `tests/test-tracker.mjs` for `webNavigation.onCreatedNavigationTarget` listener and opener association.
  4. Implement and verify the unknown-opener fallback scenario in Firefox (`scripts/e2e-firefox-verification.py`) by opening a test page from an untracked `about:blank` tab and closing the opener before navigation commits.
  5. Update visit counts, filter assertions, and documentation across `docs/TEST_PLAN.md` and `README.md` to establish full cross-browser runtime parity.

---

## 2. Key Deliverables & Code Changes
- `src/shared/tracker.js`: Refined `handleCreatedNavigationTarget` and `tabs.onCreated` opener mapping and fallback to root checkpoint when opener is unknown or closed.
- `tests/test-tracker.mjs`: Added unit test: `webNavigation.onCreatedNavigationTarget associates child tab with opener and resolves parent node`.
- `scripts/e2e-firefox-verification.py`:
  - Added `/unknown-parent` route to test HTTP server.
  - Added Step 3i: Created untracked `about:blank` tab in chrome context (`triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()`), launched `/unknown-parent`, and closed the untracked opener before commit.
  - Added Assertion 9: Checked `/unknown-parent` is recorded as a root checkpoint (`parentNodeId: null`, `isCheckpoint: true`, `childNodeIds: []`).
  - Updated pre-reopen stored visits from 6 to 7, and post-reopen visits from 7 to 8.
  - Updated search/filter assertions: 8 base visits, 2 matching `'target'`, 7 matching `'hour'`, and 8 preserved on cancel.
- `scripts/e2e-chrome-verification.py`: Executed matching 10-step verification with 8 visits and unknown-opener scenario.

---

## 3. Verification & Results
- **Automated Test Suite:** `npm test` -> **35 passed, 0 failed** (11 build, 16 tracker, 8 UI).
- **Chrome E2E Run:** 10/10 steps passed, 0 errors, 0 warnings.
- **Firefox E2E Run:** 10/10 steps passed, 0 errors, 0 warnings.
  - Unknown-opener child tab confirmed at `http://127.0.0.1:.../unknown-parent`.
  - Node recorded cleanly as root checkpoint with no broken or dangling links.
  - Initial visits: 7 -> Reopened child URL: 8 visits (+1 delta proven).
  - Search typing ('target'): 2 of 8 visits -> Clear search: 8 of 8 visits.
  - Time filter: 'hour' reduced to 7 of 8 visits (2hr-old visit excluded) -> 'all' restored 8.
  - Cancel clear preserved all 8 visits; confirm clear wiped storage to 0 visits.
  - Process restart preserved 1 visit across sessions.
  - Pre-restart error audit: 0 errors, 0 warnings.
  - Post-restart error audit: 0 errors, 0 warnings.

---

## 4. Cross-Browser Parity Status
Full cross-browser runtime parity was conclusively achieved. All core behaviors agree across both target browsers with zero extension errors.
