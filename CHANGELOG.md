# Changelog

All notable changes to **Spatial Browser History** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased] — Working Towards `v2.0`

Active development on `main` is building toward **Spatial Browser History `v2.0`** (Milestone 10–12 architecture).

### Completed on `main` (V2 Core Backend — Milestone 11 & Explorer UI — Milestone 12)
- **Schema V2 & Crash-Safe Migration:** Stable `treeId`, `nodeType` (`page` / `download`), `downloadNodeMap`, `baselineEstablished` tab state, V1 → V2 migration with verified backup (`spatial_browser_history_data_v1_backup`), and passive 24-hour wake-up expiration.
- **Branch-Aware Navigation Engine:** Same-tab Back/Forward resolution with sibling branching (`Wikipedia → Source A → Back → Source B`) and symmetrical duplicate-traversal lineage invalidation.
- **Session Safety & Startup Barrier:** Synchronous listener registration gated by `storage.session` marker checks, bounded retries, fail-closed protection on storage errors, and single-node baseline collapse for pre-restart live tabs.
- **Download Provenance Attribution:** Referrer-only attribution to uniquely matched source pages ($|M|=1$), `"Source unavailable"` fallback when missing or ambiguous, zero raw URLs or local paths stored, verified across distinct local hostnames (`localhost` source vs `127.0.0.1` CDN) in Chrome 156 and Firefox 158.
- **Research Tree Explorer Overview & Detail UI (Milestone 12):** Two-level Explorer with strict `treeId` summary cards, separate **Unattributed Downloads** shelf (`Source unavailable`), single-tree Detail View with sibling fan geometry, non-distorting context-ancestor filtering (`.is-context-ancestor`), download provenance drawer (`Downloaded from <originDomain>`, reopening disabled), Back-to-Overview scroll/filter/focus restoration, WCAG AA contrast, responsive layout, and `prefers-reduced-motion`. Build and `npm test` pass (`59 passed, 0 failed`: 12 build, 35 tracker, 12 UI). Firefox `160.0` E2E and two consecutive Chrome `157.0.8103.78` isolated-profile E2E runs passed with zero SW retries, `12 -> 12` restart persistence, narrow drawer-closed map captures, and 0 errors/warnings; pending lead acceptance.

### Next Toward `v2.0` Release Packaging
- **Lead Review & Final `v2.0` Tagging:** Complete Milestone 12 lead review, bump version manifests to `2.0.0`, and publish signed/checksummed `v2.0` release bundles.

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
