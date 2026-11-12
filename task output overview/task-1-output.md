# Task 1 Output — Cross-Browser Extension Skeleton & Packaging Foundation

**Status:** Completed & Verified  
**Milestone:** 1 (Foundation)  

---

## 1. Objectives & Scope
- Establish a clean, greenfield extension repository structure supporting both **Google Chrome** and **Mozilla Firefox**.
- Create valid Manifest V3 manifests for both browsers:
  - Chrome: Uses background service worker (`background.service_worker`).
  - Firefox: Uses background scripts/event-page configuration (`background.scripts`) with declared Gecko ID (`spatial-browser-history@term-project.local`).
- Implement the canonical toolbar open-or-focus behavior in `src/shared/launch.js`:
  - Opening the extension action when the map is not open creates a new tab.
  - Clicking the toolbar action when the map is already open smoothly focuses the existing tab and window without duplicate tabs.
- Build a deterministic packaging helper in `scripts/build.mjs` with zero third-party dependencies, generating unpacked builds and release archives under `outputs/`.
- Establish documentation, declared least-privilege permissions, and temporary installation instructions in `README.md`.

---

## 2. Key Deliverables & Changed Files
- `src/shared/index.html`: Shared extension interface shell with accessible empty/placeholder state and CSP-compliant structure.
- `src/shared/styles.css`: Base layout, dark theme, and accessible contrast styling.
- `src/shared/launch.js`: Shared tab open-or-focus logic (`openOrFocusPage`).
- `src/shared/icons/`: Standard 16, 32, 48, 128px PNGs and master SVG icon.
- `src/chrome/manifest.json`: Chrome MV3 manifest with service worker and permissions (`tabs`, `storage`, `webNavigation`).
- `src/chrome/background.js`: Chrome service worker entry point importing shared launch logic.
- `src/firefox/manifest.json`: Firefox MV3 manifest with Gecko ID and background scripts.
- `src/firefox/background.js`: Firefox background event page entry point.
- `scripts/build.mjs`: Zero-dependency packaging helper.
- `scripts/generate-icons.py`: Standard library icon generator.
- `tests/verify-builds.mjs`: Automated tests for build outputs, manifests, CSP, icon validity, and launch focus logic.

---

## 3. Verification & Results
- **Automated Verification:** `node tests/verify-builds.mjs`
  - Output directory structure validated.
  - Shared asset parity verified byte-for-byte across builds.
  - Manifest V3 specifications and permissions validated for Chrome and Firefox.
  - CSP compliance verified (zero inline scripts, zero inline event handlers).
  - Open-or-focus logic verified under mock extension APIs (single tab, repeat focus, concurrent clicks).
- **Result:** 11 passed, 0 failed.
