"""
Spatial Browser History — Firefox Navigation & Traversal Probe

Empirical test script measuring webNavigation and tabs events in Mozilla Firefox
for document navigations, browser Back and Forward button traversals,
SPA pushState/popstate transitions, and ancestor link clicks.

Output is written to stdout and saved to:
task output overview/probe-firefox-navigation.log
"""

import socket
import json
import time
import subprocess
import os
import shutil
import tempfile
import http.server
import threading
import sys

FIREFOX_EXE = r"C:\Program Files\Mozilla Firefox\firefox.exe"
EXT_DIR = r"D:\Projects\HCI Project\outputs\firefox\unpacked"
MARIONETTE_PORT = 2838
TEST_PORT = 54405
ADDON_ID = "spatial-browser-history@term-project.local"
ADDON_UUID = "d14e130f-9ddc-4a9b-8f3e-spatial000001"
LOG_FILE = r"D:\Projects\HCI Project\task output overview\probe-firefox-navigation.log"

class TeeLogger:
    def __init__(self, filepath):
        self.terminal = sys.stdout
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        self.log = open(filepath, "w", encoding="utf-8")
    def write(self, msg):
        self.terminal.write(msg)
        self.log.write(msg)
        self.terminal.flush()
        self.log.flush()
    def flush(self):
        self.terminal.flush()
        self.log.flush()
    def close(self):
        sys.stdout = self.terminal
        if not self.log.closed:
            self.log.close()

class TestHTTPHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        if self.path == "/page1":
            self.wfile.write(b"<!DOCTYPE html><html><head><title>Page 1</title></head><body><h1>Page 1</h1><a id='to-p2' href='/page2'>Go to Page 2</a><br><a id='to-p3' href='/page3'>Go to Page 3</a></body></html>")
        elif self.path == "/page2":
            self.wfile.write(b"<!DOCTYPE html><html><head><title>Page 2</title></head><body><h1>Page 2</h1><a id='to-p1' href='/page1'>Link to Page 1</a><br><button id='spa-btn' onclick=\"history.pushState({view:'spa'}, 'SPA Subpage', '/page2/spa-route'); document.title='SPA Subpage';\">Push SPA Route</button></body></html>")
        elif self.path == "/page3":
            self.wfile.write(b"<!DOCTYPE html><html><head><title>Page 3</title></head><body><h1>Page 3</h1><a id='to-p1' href='/page1'>Link to Page 1</a></body></html>")
        else:
            self.wfile.write(b"OK")
    def log_message(self, format, *args):
        pass

server = http.server.HTTPServer(("127.0.0.1", TEST_PORT), TestHTTPHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()

profile_dir = tempfile.mkdtemp(prefix="ff_probe_bf_")
uuid_map = json.dumps({ADDON_ID: ADDON_UUID})
escaped_uuid_map = uuid_map.replace('"', '\\"')
with open(os.path.join(profile_dir, "user.js"), "w", encoding="utf-8") as f:
    f.write('user_pref("marionette.enabled", true);\n')
    f.write(f'user_pref("marionette.port", {MARIONETTE_PORT});\n')
    f.write('user_pref("browser.tabs.remote.autostart", true);\n')
    f.write('user_pref("browser.sessionstore.resume_from_crash", false);\n')
    f.write(f'user_pref("extensions.webextensions.uuids", "{escaped_uuid_map}");\n')

firefox_env = os.environ.copy()
firefox_env["MOZ_REMOTE_ALLOW_SYSTEM_ACCESS"] = "1"

proc = subprocess.Popen([
    FIREFOX_EXE,
    "-no-remote",
    "-remote-allow-system-access",
    "-profile", profile_dir,
    "-marionette"
], env=firefox_env)

class MarionetteClient:
    def __init__(self, port=MARIONETTE_PORT):
        self.port = port
        self.sock = None
        self.msg_id = 1

    def connect(self, timeout=15):
        start = time.time()
        while time.time() - start < timeout:
            try:
                self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.sock.connect(("127.0.0.1", self.port))
                raw = self._read_raw()
                return json.loads(raw)
            except Exception:
                time.sleep(0.3)
        raise TimeoutError("Could not connect to Marionette")

    def _read_raw(self):
        chars = []
        while True:
            ch = self.sock.recv(1).decode("utf-8")
            if ch == ":":
                break
            chars.append(ch)
        length = int("".join(chars))
        data = bytearray()
        while len(data) < length:
            chunk = self.sock.recv(length - len(data))
            data.extend(chunk)
        return data.decode("utf-8")

    def send(self, name, params=None):
        mid = self.msg_id
        self.msg_id += 1
        msg = [0, mid, name, params or {}]
        payload = json.dumps(msg)
        wire = f"{len(payload.encode('utf-8'))}:{payload}"
        self.sock.sendall(wire.encode("utf-8"))
        res_raw = self._read_raw()
        data = json.loads(res_raw)
        if len(data) >= 4 and data[2] is not None:
            raise RuntimeError(f"Marionette error in {name}: {data[2]}")
        return data[3] if len(data) >= 4 else data

tee = TeeLogger(LOG_FILE)
sys.stdout = tee

try:
    print("=" * 80)
    print("FIREFOX DYNAMIC NAVIGATION & BACK/FORWARD PROBE LOG")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")

    client = MarionetteClient()
    client.connect()
    session_res = client.send("WebDriver:NewSession", {"capabilities": {}})
    
    # Query runtime browser info dynamically from Firefox Services.appinfo
    client.send("Marionette:SetContext", {"value": "chrome"})
    browser_info = client.send("WebDriver:ExecuteScript", {
        "script": "return { name: Services.appinfo.name, version: Services.appinfo.version, os: Services.appinfo.OS, buildID: Services.appinfo.appBuildID };",
        "args": []
    })["value"]
    client.send("Marionette:SetContext", {"value": "content"})

    browser_name = browser_info.get("name", "Firefox")
    browser_version = browser_info.get("version", "Unknown")
    browser_os = browser_info.get("os", "Windows")
    build_id = browser_info.get("buildID", "Unknown")
    print(f"Browser Target (Queried Dynamically): {browser_name} {browser_version} ({browser_os}, Build: {build_id})")
    print("=" * 80)

    install_res = client.send("Addon:Install", {"path": EXT_DIR, "temporary": True})
    print(f"[PASS] Addon installed: ID={install_res.get('value')}")

    # Open extension monitor page
    client.send("WebDriver:Navigate", {"url": f"moz-extension://{ADDON_UUID}/index.html"})
    time.sleep(1)

    setup_script = """
    window.__navLog = [];
    
    browser.webNavigation.onCommitted.addListener((details) => {
        if (details.frameId === 0 && details.url.includes("127.0.0.1")) {
            window.__navLog.push({
                event: 'onCommitted',
                url: details.url,
                transitionType: details.transitionType,
                transitionQualifiers: details.transitionQualifiers,
                timeStamp: details.timeStamp
            });
        }
    });

    if (browser.webNavigation.onHistoryStateUpdated) {
        browser.webNavigation.onHistoryStateUpdated.addListener((details) => {
            if (details.frameId === 0 && details.url.includes("127.0.0.1")) {
                window.__navLog.push({
                    event: 'onHistoryStateUpdated',
                    url: details.url,
                    transitionType: details.transitionType,
                    transitionQualifiers: details.transitionQualifiers,
                    timeStamp: details.timeStamp
                });
            }
        });
    }

    if (browser.webNavigation.onReferenceFragmentUpdated) {
        browser.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
            if (details.frameId === 0 && details.url.includes("127.0.0.1")) {
                window.__navLog.push({
                    event: 'onReferenceFragmentUpdated',
                    url: details.url,
                    transitionType: details.transitionType,
                    transitionQualifiers: details.transitionQualifiers,
                    timeStamp: details.timeStamp
                });
            }
        });
    }

    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.url && changeInfo.url.includes("127.0.0.1")) {
            window.__navLog.push({
                event: 'tabs.onUpdated:url',
                url: changeInfo.url,
                status: tab.status
            });
        }
    });

    return true;
    """
    client.send("WebDriver:ExecuteScript", {"script": setup_script, "args": []})
    ext_handle = client.send("WebDriver:GetWindowHandle")["value"]
    print(f"[PASS] Event logger attached in extension window ({ext_handle})")

    # Open a new tab in browser for navigation testing
    client.send("Marionette:SetContext", {"value": "chrome"})
    open_tab_script = f"""
    let win = Services.wm.getMostRecentWindow("navigator:browser");
    let tab = win.gBrowser.addTab("http://127.0.0.1:{TEST_PORT}/page1", {{
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
    }});
    win.gBrowser.selectedTab = tab;
    return true;
    """
    client.send("WebDriver:ExecuteScript", {"script": open_tab_script, "args": []})
    time.sleep(1)

    client.send("Marionette:SetContext", {"value": "content"})
    handles = client.send("WebDriver:GetWindowHandles")
    content_handle = [h for h in handles if h != ext_handle][0]
    client.send("WebDriver:SwitchToWindow", {"handle": content_handle})
    print(f"[STEP 1] Initial navigation to Page 1 in tab ({content_handle})")

    # Step 2: Click link to Page 2
    el2 = client.send("WebDriver:FindElement", {"using": "css selector", "value": "#to-p2"})
    client.send("WebDriver:ElementClick", {"id": el2["value"]["element-6066-11e4-a52e-4f735466cecf"]})
    time.sleep(1)
    print("[STEP 2] Clicked #to-p2 link -> committed /page2")

    # Step 3: Trigger SPA pushState on Page 2
    spa_btn = client.send("WebDriver:FindElement", {"using": "css selector", "value": "#spa-btn"})
    client.send("WebDriver:ElementClick", {"id": spa_btn["value"]["element-6066-11e4-a52e-4f735466cecf"]})
    time.sleep(1)
    print("[STEP 3] Clicked #spa-btn (history.pushState to /page2/spa-route)")

    # Step 4: Back button from SPA route -> returns to /page2
    client.send("WebDriver:Back")
    time.sleep(1)
    print("[STEP 4] Executed browser Back from SPA route -> /page2")

    # Step 5: Forward button to SPA route -> returns to /page2/spa-route
    client.send("WebDriver:Forward")
    time.sleep(1)
    print("[STEP 5] Executed browser Forward to SPA route -> /page2/spa-route")

    # Step 6: Back button from SPA route -> returns to /page2
    client.send("WebDriver:Back")
    time.sleep(1)
    print("[STEP 6] Executed browser Back from SPA route -> /page2")

    # Step 7: Back button from /page2 -> returns to /page1
    client.send("WebDriver:Back")
    time.sleep(1)
    print("[STEP 7] Executed browser Back from /page2 -> /page1")

    # Step 8: Forward button from /page1 -> returns to /page2
    client.send("WebDriver:Forward")
    time.sleep(1)
    print("[STEP 8] Executed browser Forward from /page1 -> /page2")

    # Step 9: Back button from /page2 -> returns to /page1
    client.send("WebDriver:Back")
    time.sleep(1)
    print("[STEP 9] Executed browser Back from /page2 -> /page1")

    # Step 10: Click link to Page 3 (branching from Page 1)
    el3 = client.send("WebDriver:FindElement", {"using": "css selector", "value": "#to-p3"})
    client.send("WebDriver:ElementClick", {"id": el3["value"]["element-6066-11e4-a52e-4f735466cecf"]})
    time.sleep(1)
    print("[STEP 10] Clicked #to-p3 link from /page1 -> committed /page3 (branching)")

    # Step 11: Click normal link on Page 3 pointing to ancestor Page 1 (<a href="/page1">)
    el1 = client.send("WebDriver:FindElement", {"using": "css selector", "value": "#to-p1"})
    client.send("WebDriver:ElementClick", {"id": el1["value"]["element-6066-11e4-a52e-4f735466cecf"]})
    time.sleep(1)
    print("[STEP 11] Clicked normal <a href='/page1'> on Page 3 pointing to ancestor URL")

    # Retrieve logged events from extension tab
    client.send("WebDriver:SwitchToWindow", {"handle": ext_handle})
    events = client.send("WebDriver:ExecuteScript", {"script": "return window.__navLog;", "args": []})
    
    print("\n" + "=" * 80)
    print("RAW OBSERVED EVENT LOG FROM FIREFOX:")
    print("=" * 80)
    for i, ev in enumerate(events.get("value", [])):
        ev_type = ev.get("event")
        url = ev.get("url")
        trans = ev.get("transitionType", "N/A")
        quals = ev.get("transitionQualifiers", "N/A")
        print(f"[{i+1:02d}] {ev_type:<32} url={url}")
        if "transitionType" in ev:
            print(f"     transitionType={trans:<10} transitionQualifiers={quals}")
        elif "status" in ev:
            print(f"     status={ev.get('status')}")
    print("=" * 80)
    print("PROBE EXECUTION COMPLETED SUCCESSFULLY.")

finally:
    try:
        proc.terminate()
        proc.wait(timeout=3)
    except Exception:
        pass
    shutil.rmtree(profile_dir, ignore_errors=True)
    tee.close()
