# Changelog

All notable changes to **Spatial Browser History** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.1.0] — 2026-11-21

Feature and stabilization release repairing visible branching geometry, securing web-page titles against internal extension updates, expanding the automated test suite to 80 tests, and adding an opt-in privacy-preserving user study controller.

### Added & Enhanced
- **Visual Sibling Branching Layout Engine:**
  - Repaired desktop and narrow reflow detail-view layout so sibling nodes (e.g. `Wikipedia → Source A → Back → Source B`) render as distinct parallel branches with matching horizontal levels and distinct vertical coordinates, avoiding flat linear appearances.
  - Narrow responsive reflow (`<= 900px`) maintains bounded indents and valid edge routing across multi-branch deep trees.
- **Tab Title Preservation Guard:**
  - Fixed tab title updates to require matching trackable HTTP/HTTPS URLs. Extension-internal pages (`chrome-extension://`, `moz-extension://`) and browser URLs (`chrome://`, `about:`) are prevented from renaming previous web visit nodes.
- **Opt-in User Study Controller & Privacy Export Engine:**
  - Integrated local study mode for Within-Subject Design (WSD) usability evaluations.
  - Enforces counterbalanced $2 \times 2$ Latin Square cell assignments across evaluation conditions (Condition A Chrome History vs. Condition B Spatial History map) and matched static corpus packs (Pack X Solar Energy / Pack Y Olympic Games).
  - 6-dimension NASA-TLX workload evaluation with discrete step-5 validation and automatic raw TLX score calculation.
  - Zero-URL privacy boundary: CSV and JSON exports redact raw URLs, queries, fragments, and numeric tab IDs.
  - Verified server HTTP 302 redirect destination counting, meta-refresh client redirect collapsing, and signal-level rapid-open deduplication.
- **Automated Verification:**
  - Test suite expanded to **80 passed, 0 failed** across `verify-builds.mjs`, `test-tracker.mjs`, `test-ui.mjs`, `test-branch.mjs`, and `test-study.mjs`.
  - Browser E2E runtime verified in **Google Chrome 157.0.8103.80** and **Mozilla Firefox 160.0.1** with 0 console errors.

---

## [2.0.0] — 2026-11-16

Final major release delivering the **Research Tree Explorer**, **Branch-Aware Navigation Engine**, **Download Provenance Attribution**, and **Automated CI Quality Gate** across Chrome and Firefox.

### Added & Enhanced (Milestones 10–16 Architecture)
- **Schema V2 & Crash-Safe Migration:** Stable `treeId`, `nodeType` (`page` / `download`), `downloadNodeMap`, `baselineEstablished` tab state, V1 → V2 migration with verified backup (`spatial_browser_history_data_v1_backup`), and passive 24-hour wake-up expiration.
- **Branch-Aware Navigation Engine:** Same-tab Back/Forward resolution with sibling branching (`Wikipedia → Source A → Back → Source B`) and symmetrical duplicate-traversal lineage invalidation.
- **Session Safety & Startup Barrier:** Synchronous listener registration gated by `storage.session` marker checks, bounded retries, fail-closed protection on storage errors, and single-node baseline collapse for pre-restart live tabs.
- **Download Provenance Attribution:** Referrer-only attribution to uniquely matched source pages ($|M|=1$), `"Source unavailable"` fallback when missing or ambiguous, zero raw URLs or local paths stored, verified across distinct local hostnames (`localhost` source vs `127.0.0.1` CDN).
- **Research Tree Explorer Overview & Detail UI:** Two-level Explorer with strict `treeId` summary cards, separate **Unattributed Downloads** shelf (`Source unavailable`), single-tree Detail View with sibling fan geometry, responsive indented-column reflow layout for narrow screens (`<= 900px`, `fitScale = 1.05`, `effectiveTitleFontSize = 13.7px`, `renderedTitleHeight >= 10px`), non-distorting context-ancestor filtering (`.is-context-ancestor`), download provenance drawer (`Downloaded from <originDomain>`, reopening disabled), Back-to-Overview scroll/filter/focus restoration, WCAG AA contrast, and `prefers-reduced-motion`.
- **Automated Verification & CI Quality Gate:** `npm test` passing **61 passed, 0 failed** (`12` build/manifest, `35` tracker/storage, `14` UI). Isolated-profile runtime E2E test suites passed with **0 errors, 0 warnings** in **Google Chrome 157.0.8103.78** and **Mozilla Firefox 160.0**. GitHub Actions CI build & test quality gate operational.

---

## [0.1.0] — 2026-11-12

First verified cross-browser **Manifest V3** stable release targeting **Google Chrome 109+** and **Mozilla Firefox 115.0+**.

### Highlights
- Single-tab toolbar open-or-focus launch behavior (`launch.js`) across Chrome and Firefox.
- Local-first graph capture (`chrome.storage.local` / `browser.storage.local`) for same-tab links, HTTP redirects, SPA `history.pushState` routes, fragment updates, reload deduplication, dynamic title updates, and known/unknown opener tabs.
- V2 storage schema, branch-aware Back/Forward tracking, session startup safety, and distinct-host download provenance (`originDomain` privacy boundary enforced).
- Interactive hierarchical SVG history map with debounced search, time range filtering, details drawer with safe HTTP/HTTPS URL reopening, keyboard controls, and accessible Clear Map modal focus trap.
- Zero-dependency deterministic build pipeline (`node scripts/build.mjs`) producing unpacked extensions, `.zip`, `.xpi`, and `SHA256SUMS`.
- **Verification:** `npm test` **55 passed, 0 failed** (`12` build/manifest, `35` tracker/storage, `8` UI logic); isolated-profile E2E suites passed with **0 failures, 0 errors, 0 warnings** in **Google Chrome 156.0.8078.48** and **Mozilla Firefox 158.0.1**.
