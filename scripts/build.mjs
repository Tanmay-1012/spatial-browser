/**
 * Spatial Browser History - Deterministic Packaging Helper
 * 
 * Generates unpacked builds and release packages under `outputs/`:
 *   - outputs/chrome/unpacked/ (unpacked Chrome MV3 build)
 *   - outputs/chrome/spatial-browser-history-extension.zip
 *   - outputs/firefox/unpacked/ (unpacked Firefox MV3 build)
 *   - outputs/firefox/spatial-browser-history-firefox.zip
 *   - outputs/firefox/spatial-browser-history-firefox.xpi
 * 
 * Uses only Node.js and Python standard libraries with zero external dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SRC_DIR = path.join(ROOT_DIR, 'src');
const SHARED_DIR = path.join(SRC_DIR, 'shared');
const CHROME_SRC_DIR = path.join(SRC_DIR, 'chrome');
const FIREFOX_SRC_DIR = path.join(SRC_DIR, 'firefox');
const OUTPUTS_DIR = path.join(ROOT_DIR, 'outputs');

const CHROME_OUT_DIR = path.join(OUTPUTS_DIR, 'chrome', 'unpacked');
const FIREFOX_OUT_DIR = path.join(OUTPUTS_DIR, 'firefox', 'unpacked');

const CHROME_ZIP_PATH = path.join(OUTPUTS_DIR, 'chrome', 'spatial-browser-history-extension.zip');
const FIREFOX_ZIP_PATH = path.join(OUTPUTS_DIR, 'firefox', 'spatial-browser-history-firefox.zip');
const FIREFOX_XPI_PATH = path.join(OUTPUTS_DIR, 'firefox', 'spatial-browser-history-firefox.xpi');

function sha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      if (child === '.gitkeep') continue;
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function listFilesRecursive(rootDir, currentDir = rootDir) {
  return fs.readdirSync(currentDir, { withFileTypes: true })
    .filter((entry) => entry.name !== '.gitkeep')
    .flatMap((entry) => {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) return listFilesRecursive(rootDir, absolutePath);
      return [path.relative(rootDir, absolutePath).split(path.sep).join('/')];
    })
    .sort();
}

function validateManifest(manifestPath, browserType) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest missing at ${manifestPath}`);
  }
  const raw = fs.readFileSync(manifestPath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in manifest ${manifestPath}: ${err.message}`);
  }

  if (data.manifest_version !== 3) {
    throw new Error(`[${browserType}] Manifest version must be 3, found: ${data.manifest_version}`);
  }

  if (!data.name || !data.version) {
    throw new Error(`[${browserType}] Manifest missing name or version`);
  }

  if (!data.action) {
    throw new Error(`[${browserType}] Manifest must declare an action for toolbar button`);
  }

  const expectedPermissions = ['tabs', 'storage', 'webNavigation', 'downloads'];
  for (const perm of expectedPermissions) {
    if (!Array.isArray(data.permissions) || !data.permissions.includes(perm)) {
      throw new Error(`[${browserType}] Manifest missing expected permission: ${perm}`);
    }
  }

  if (browserType === 'chrome') {
    if (!data.background || !data.background.service_worker) {
      throw new Error(`[Chrome] Manifest V3 requires background.service_worker`);
    }
    if (data.browser_specific_settings) {
      throw new Error(`[Chrome] Chrome manifest should not contain browser_specific_settings`);
    }
  }

  if (browserType === 'firefox') {
    if (!data.background || !Array.isArray(data.background.scripts)) {
      throw new Error(`[Firefox] Firefox Manifest V3 requires background.scripts array`);
    }
    const requiredScripts = ['launch.js', 'storage.js', 'tracker.js', 'background.js'];
    for (const scr of requiredScripts) {
      if (!data.background.scripts.includes(scr)) {
        throw new Error(`[Firefox] Firefox background.scripts missing ${scr}`);
      }
    }
    if (!data.browser_specific_settings || !data.browser_specific_settings.gecko || !data.browser_specific_settings.gecko.id) {
      throw new Error(`[Firefox] Firefox manifest requires browser_specific_settings.gecko.id`);
    }
  }

  return data;
}

function createZipArchive(sourceDir, zipPath) {
  const pythonScript = `
import zipfile, os, sys

source_dir = sys.argv[1]
output_zip = sys.argv[2]

with zipfile.ZipFile(output_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for root, dirs, files in os.walk(source_dir):
        dirs.sort()
        files.sort()
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, source_dir).replace(os.sep, '/')
            info = zipfile.ZipInfo(rel_path, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            with open(full_path, 'rb') as source_file:
                zf.writestr(info, source_file.read(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
`;

  try {
    execFileSync('python', ['-c', pythonScript, sourceDir, zipPath], { stdio: 'inherit' });
  } catch (err) {
    throw new Error(`Failed to create archive ${zipPath}: ${err.message}`);
  }
}

function build() {
  console.log('--- Building Spatial Browser History ---');
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

  // Clean prior unpacked build directories
  if (fs.existsSync(CHROME_OUT_DIR)) {
    fs.rmSync(CHROME_OUT_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(FIREFOX_OUT_DIR)) {
    fs.rmSync(FIREFOX_OUT_DIR, { recursive: true, force: true });
  }

  fs.mkdirSync(CHROME_OUT_DIR, { recursive: true });
  fs.mkdirSync(FIREFOX_OUT_DIR, { recursive: true });

  console.log('[1/4] Copying shared assets to build roots...');
  copyRecursive(SHARED_DIR, CHROME_OUT_DIR);
  copyRecursive(SHARED_DIR, FIREFOX_OUT_DIR);

  console.log('[2/4] Applying browser-specific configurations...');
  copyRecursive(CHROME_SRC_DIR, CHROME_OUT_DIR);
  copyRecursive(FIREFOX_SRC_DIR, FIREFOX_OUT_DIR);

  console.log('[3/4] Validating build manifests and parity...');
  const chromeManifest = validateManifest(path.join(CHROME_OUT_DIR, 'manifest.json'), 'chrome');
  const firefoxManifest = validateManifest(path.join(FIREFOX_OUT_DIR, 'manifest.json'), 'firefox');

  // Verify every shared source file, including nested icons, is present and identical.
  const sharedFiles = listFilesRecursive(SHARED_DIR);
  for (const file of sharedFiles) {
    if (!fs.existsSync(path.join(CHROME_OUT_DIR, file)) || !fs.existsSync(path.join(FIREFOX_OUT_DIR, file))) {
      throw new Error(`Shared asset missing from one or both builds: ${file}`);
    }
    if (sha256(path.join(SHARED_DIR, file)) !== sha256(path.join(CHROME_OUT_DIR, file)) ||
        sha256(path.join(SHARED_DIR, file)) !== sha256(path.join(FIREFOX_OUT_DIR, file))) {
      throw new Error(`Shared asset does not match source in generated builds: ${file}`);
    }
    const cHash = sha256(path.join(CHROME_OUT_DIR, file));
    const fHash = sha256(path.join(FIREFOX_OUT_DIR, file));
    if (cHash !== fHash) {
      throw new Error(`Shared asset parity mismatch for ${file}: Chrome=${cHash} != Firefox=${fHash}`);
    }
  }

  console.log('[4/4] Generating release archives...');
  createZipArchive(CHROME_OUT_DIR, CHROME_ZIP_PATH);
  createZipArchive(FIREFOX_OUT_DIR, FIREFOX_ZIP_PATH);
  fs.copyFileSync(FIREFOX_ZIP_PATH, FIREFOX_XPI_PATH);

  console.log('[5/5] Generating SHA-256 checksums...');
  const checksumsPath = path.join(OUTPUTS_DIR, 'SHA256SUMS');
  const chromeZipHash = sha256(CHROME_ZIP_PATH);
  const firefoxZipHash = sha256(FIREFOX_ZIP_PATH);
  const firefoxXpiHash = sha256(FIREFOX_XPI_PATH);

  const checksumsContent = [
    `${chromeZipHash}  chrome/spatial-browser-history-extension.zip`,
    `${firefoxZipHash}  firefox/spatial-browser-history-firefox.zip`,
    `${firefoxXpiHash}  firefox/spatial-browser-history-firefox.xpi`,
    ''
  ].join('\n');
  fs.writeFileSync(checksumsPath, checksumsContent, 'utf8');

  console.log('\n--- Build Completed Successfully ---');
  console.log(`Chrome Unpacked:  ${CHROME_OUT_DIR}`);
  console.log(`Firefox Unpacked: ${FIREFOX_OUT_DIR}`);
  console.log(`Chrome Archive:   ${CHROME_ZIP_PATH} (${fs.statSync(CHROME_ZIP_PATH).size} bytes)`);
  console.log(`Firefox Archive:  ${FIREFOX_ZIP_PATH} (${fs.statSync(FIREFOX_ZIP_PATH).size} bytes)`);
  console.log(`Firefox Package:  ${FIREFOX_XPI_PATH} (${fs.statSync(FIREFOX_XPI_PATH).size} bytes)`);
  console.log(`Checksum File:    ${checksumsPath}`);
  console.log(`Chrome Version:   ${chromeManifest.version} (min Chrome ${chromeManifest.minimum_chrome_version})`);
  console.log(`Firefox Version:  ${firefoxManifest.version} (min Firefox ${firefoxManifest.browser_specific_settings.gecko.strict_min_version})`);
}

build();
