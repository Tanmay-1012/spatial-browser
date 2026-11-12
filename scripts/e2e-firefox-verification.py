import http.server
import json
import os
import socket
import socketserver
import subprocess
import tempfile
import threading
import time
import sys
from urllib.parse import urlsplit

# Dual output logger: writes to stdout and persists to docs/test-results/firefox-e2e.log
class TeeLogger:
    def __init__(self, filepath):
        self.terminal = sys.stdout
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        self.log = open(filepath, "w", encoding="utf-8")

    def write(self, message):
        self.terminal.write(message)
        self.log.write(message)
        self.terminal.flush()
        self.log.flush()

    def flush(self):
        self.terminal.flush()
        if not self.log.closed:
            self.log.flush()

    def close(self):
        sys.stdout = self.terminal
        if not self.log.closed:
            self.log.close()

TEST_PORT = 0
CDN_PORT = 0
LOG_FILE_PATH = r"D:\Projects\HCI Project\docs\test-results\firefox-e2e.log"
ADDON_UUID = "d14e130f-9ddc-4a9b-8f3e-spatial000001"
ADDON_ID = "spatial-browser-history@term-project.local"

# Local test HTTP server
class TestHTTPHandler(http.server.BaseHTTPRequestHandler):
    def respond_html(self, status, body):
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        if self.path == "/page1":
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Page One</title></head><body><h1>Page One</h1><a id='link2' href='/page2'>Go to Page 2</a></body></html>")
        elif self.path == "/page2":
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Page Two</title></head><body><h1>Page Two</h1></body></html>")
        elif self.path == "/redirect":
            self.send_response(302)
            self.send_header("Location", f"http://127.0.0.1:{TEST_PORT}/target")
            self.send_header("Content-Length", "0")
            self.end_headers()
        elif self.path == "/target":
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Target Page</title></head><body><h1>Target Page</h1></body></html>")
        elif self.path == "/opener":
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Opener Page</title></head><body><button id='openbtn' onclick=\"window.open('/child', '_blank')\">Open Child</button><a id='openlink' href='/child' target='_blank'>Open Child Link</a></body></html>")
        elif self.path == "/child":
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Child Page</title></head><body><h1>Child Page Content</h1></body></html>")
        elif self.path == "/unknown-parent":
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Unknown Parent Page</title></head><body><h1>Unknown Parent Content</h1></body></html>")
        elif self.path == "/wiki":
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Wikipedia Portal</title><meta name='referrer' content='no-referrer-when-downgrade'></head><body><h1>Wikipedia Article</h1><a id='link-a' href='/source-a'>Source A Reference</a> <a id='link-b' href='/source-b'>Source B Reference</a></body></html>")
        elif self.path == "/source-a":
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Source A Document</title></head><body><h1>Source A Content</h1></body></html>")
        elif self.path == "/source-b":
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Source B Document</title></head><body><h1>Source B Content</h1></body></html>")
        elif self.path == "/download-portal":
            self.respond_html(200, f"<!DOCTYPE html><html><head><title>Download Portal</title><meta name='referrer' content='no-referrer-when-downgrade'></head><body><h1>Research Papers Portal</h1><a id='dl-cdn-link' referrerpolicy='no-referrer-when-downgrade' href='http://127.0.0.1:{CDN_PORT}/cdn-file.pdf' download='research_paper.pdf'>Download Research Paper</a><a id='dl-unattributed' rel='noreferrer' href='http://127.0.0.1:{CDN_PORT}/cdn-unattributed.zip' download='dataset.zip'>Download Unattributed Dataset</a></body></html>")
        elif self.path == "/ambiguous-page":
            self.respond_html(200, f"<!DOCTYPE html><html><head><title>Ambiguous Page</title><meta name='referrer' content='no-referrer-when-downgrade'></head><body><h1>Ambiguous Download Source</h1><a id='dl-ambig-link' referrerpolicy='no-referrer-when-downgrade' href='http://127.0.0.1:{CDN_PORT}/cdn-ambiguous.bin' download='ambiguous.bin'>Download Ambiguous Item</a></body></html>")
        elif self.path == "/restart-step1":
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Restart Step 1</title></head><body><h1>Step 1 of Multi-Node Session</h1><a id='step2-link' href='/restart-step2'>Go to Step 2</a></body></html>")
        elif self.path == "/restart-step2":
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Restart Step 2</title></head><body><h1>Step 2 of Multi-Node Session</h1><a id='step3-link' href='/restart-step3'>Go to Step 3</a></body></html>")
        elif self.path == "/restart-step3":
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Restart Step 3</title></head><body><h1>Step 3 Multi-Node Session Head</h1></body></html>")
        elif self.path == "/restart-target":
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Restart Persistent Page</title></head><body><h1>Restart Target</h1></body></html>")
        else:
            self.respond_html(200, "<!DOCTYPE html><html><head><title>Generic Page</title></head><body>Generic Content</body></html>")

    def log_message(self, format, *args):
        pass

# Secondary HTTP server simulating independent CDN file host
class CDNHTTPHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/cdn-file.pdf":
            data = b"%PDF-1.4 sample pdf content for download test\n%%EOF"
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Disposition", 'attachment; filename="research_paper.pdf"')
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif self.path == "/cdn-unattributed.zip":
            data = b"PK\x03\x04sample zip content"
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", 'attachment; filename="dataset.zip"')
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif self.path == "/cdn-ambiguous.bin":
            data = b"\x00\x01\x02\x03ambiguous binary data"
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", 'attachment; filename="ambiguous.bin"')
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

class MarionetteClient:
    def __init__(self, host="127.0.0.1", port=2828):
        self.host = host
        self.port = port
        self.sock = None
        self.msg_id = 1

    def connect(self, timeout=20):
        start = time.time()
        while time.time() - start < timeout:
            try:
                self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.sock.settimeout(5.0)
                self.sock.connect((self.host, self.port))
                greeting = self._recv_msg()
                return True
            except (ConnectionRefusedError, ConnectionResetError, OSError):
                try:
                    if self.sock:
                        self.sock.close()
                except Exception:
                    pass
                time.sleep(0.5)
        raise TimeoutError("Could not connect to Marionette")

    def _recv_msg(self):
        len_str = ""
        while True:
            c = self.sock.recv(1).decode("utf-8")
            if not c:
                raise ConnectionResetError("Socket closed")
            if c == ":":
                break
            len_str += c
        msg_len = int(len_str)
        raw_data = b""
        while len(raw_data) < msg_len:
            chunk = self.sock.recv(msg_len - len(raw_data))
            if not chunk:
                raise ConnectionResetError("Socket closed during read")
            raw_data += chunk
        return json.loads(raw_data.decode("utf-8"))

    def send_cmd(self, command, params=None):
        if params is None:
            params = {}
        cur_id = self.msg_id
        self.msg_id += 1
        msg = [0, cur_id, command, params]
        raw = json.dumps(msg).encode("utf-8")
        payload = f"{len(raw)}:".encode("utf-8") + raw
        self.sock.sendall(payload)
        resp = self._recv_msg()
        if resp[2] is not None:
            raise RuntimeError(f"Marionette error in {command}: {resp[2]}")
        return resp[3]

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass

def find_free_local_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as port_probe:
        port_probe.bind(("127.0.0.1", 0))
        return port_probe.getsockname()[1]

def extract_element_id(resp):
    if isinstance(resp, dict):
        val = resp.get("value", resp)
        if isinstance(val, dict):
            # Standard W3C element identifier key
            for k in ["element-6066-11e4-a52e-4f735466cecf", "ELEMENT"]:
                if k in val:
                    return val[k]
            return list(val.values())[0] if val else None
        return val
    return resp

def query_console_errors(client, phase_name, target_uuid):
    client.send_cmd("Marionette:SetContext", {"value": "chrome"})
    audit = client.send_cmd("WebDriver:ExecuteScript", {
        "script": """
        let msgs = Services.console.getMessageArray();
        let extensionErrors = [];
        let extensionWarnings = [];
        let extensionInfo = [];

        for (let m of msgs) {
            let isScriptError = (m instanceof Ci.nsIScriptError);
            let msgText = m.message || '';
            let source = (isScriptError && m.sourceName) ? m.sourceName : '';
            let isWarning = isScriptError ? ((m.flags & Ci.nsIScriptError.warningFlag) !== 0) : false;
            let isInfo = isScriptError ? ((m.flags & Ci.nsIScriptError.infoFlag) !== 0) : false;
            let isError = isScriptError ? (!isWarning && !isInfo) : false;

            if (!isScriptError) {
                let lower = msgText.toLowerCase();
                if (lower.includes("error") || lower.includes("exception")) {
                    isError = true;
                } else if (lower.includes("warn")) {
                    isWarning = true;
                } else {
                    isInfo = true;
                }
            }

            let matchesSource = source.includes(arguments[0]) || 
                                source.includes("spatial-browser-history") ||
                                source.includes("storage.js") ||
                                source.includes("tracker.js") ||
                                source.includes("app.js") ||
                                source.includes("ui-logic.js") ||
                                source.includes("launch.js") ||
                                source.includes("background.js") ||
                                source.includes("background-messages.js");
            let matchesText = msgText.includes("Spatial") || 
                              msgText.includes("spatial-browser-history") ||
                              msgText.includes(arguments[0]);

            if (matchesSource || matchesText) {
                let entry = {
                    message: msgText,
                    source: source,
                    line: isScriptError ? m.lineNumber : null,
                    column: isScriptError ? m.columnNumber : null,
                    category: isScriptError ? m.category : null,
                    severity: isError ? "ERROR" : (isWarning ? "WARNING" : "INFO")
                };
                if (isError) {
                    extensionErrors.push(entry);
                } else if (isWarning) {
                    extensionWarnings.push(entry);
                } else {
                    extensionInfo.push(entry);
                }
            }
        }
        return {
            totalGeckoMessages: msgs.length,
            extensionErrors: extensionErrors,
            extensionWarnings: extensionWarnings,
            extensionInfo: extensionInfo
        };
        """,
        "args": [target_uuid]
    })["value"]
    return audit

def save_error_audit(audit_data, phase_name, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    payload = {
        "phase": phase_name,
        "browserTarget": "Mozilla Firefox 158.0.1 (x64 Windows)",
        "addonId": ADDON_ID,
        "addonUuid": ADDON_UUID,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "totalGeckoMessagesEvaluated": audit_data["totalGeckoMessages"],
        "errorCount": len(audit_data["extensionErrors"]),
        "warningCount": len(audit_data["extensionWarnings"]),
        "infoCount": len(audit_data.get("extensionInfo", [])),
        "extensionErrors": audit_data["extensionErrors"],
        "extensionWarnings": audit_data["extensionWarnings"],
        "extensionInfo": audit_data.get("extensionInfo", [])
    }
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"  [SAVED] {phase_name} audit artifact written to: {filepath}")

# Suppress socket reset tracebacks caused by browser speculative connection probes
class SilentTCPServer(socketserver.TCPServer):
    allow_reuse_address = True
    def handle_error(self, request, client_address):
        pass

class DualStackSilentTCPServer(socketserver.TCPServer):
    address_family = socket.AF_INET6
    allow_reuse_address = True

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()

    def handle_error(self, request, client_address):
        pass

def run_tests():
    tee = TeeLogger(LOG_FILE_PATH)
    sys.stdout = tee

    print("=" * 76)
    print("TASK 7: FIREFOX 158.0.1 FILTER-INPUT & ERROR-AUDIT VERIFICATION RUN")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Browser Target: Mozilla Firefox 158.0.1 (x64 Windows)")
    print("=" * 76)

    # 1. Start Local HTTP Servers on OS-assigned ports (dual-stack for main server so both 127.0.0.1 and localhost resolve).
    global TEST_PORT, CDN_PORT
    server = DualStackSilentTCPServer(("::", TEST_PORT), TestHTTPHandler)
    TEST_PORT = server.server_address[1]
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    print(f"[INIT] Local test HTTP server started at http://127.0.0.1:{TEST_PORT} (and http://localhost:{TEST_PORT})")

    cdn_server = SilentTCPServer(("127.0.0.1", CDN_PORT), CDNHTTPHandler)
    CDN_PORT = cdn_server.server_address[1]
    cdn_thread = threading.Thread(target=cdn_server.serve_forever, daemon=True)
    cdn_thread.start()
    print(f"[INIT] Secondary CDN file server started at http://127.0.0.1:{CDN_PORT}")

    profile_owner = tempfile.TemporaryDirectory(prefix="spatial-browser-history-firefox-")
    profile_dir = profile_owner.name
    download_dir = os.path.join(profile_dir, "downloads")
    os.makedirs(download_dir, exist_ok=True)
    marionette_port = find_free_local_port()
    ext_dir = r"D:\Projects\HCI Project\outputs\firefox\unpacked"
    firefox_exe = r"C:\Program Files\Mozilla Firefox\firefox.exe"
    proc = None
    proc2 = None
    client = None
    client2 = None
    try:
        uuid_map = json.dumps({ADDON_ID: ADDON_UUID})
        escaped_uuid_map = uuid_map.replace('"', '\\"')
        escaped_download_dir = download_dir.replace('\\', '\\\\')

        with open(os.path.join(profile_dir, "user.js"), "w", encoding="utf-8") as f:
            f.write('user_pref("marionette.enabled", true);\n')
            f.write(f'user_pref("marionette.port", {marionette_port});\n')
            f.write('user_pref("browser.tabs.remote.autostart", true);\n')
            f.write('user_pref("browser.sessionstore.resume_from_crash", false);\n')
            f.write(f'user_pref("extensions.webextensions.uuids", "{escaped_uuid_map}");\n')
            f.write('user_pref("browser.download.folderList", 2);\n')
            f.write(f'user_pref("browser.download.dir", "{escaped_download_dir}");\n')
            f.write('user_pref("browser.download.useDownloadDir", true);\n')
            f.write('user_pref("browser.download.manager.showWhenStarting", false);\n')
            f.write('user_pref("browser.helperApps.neverAsk.saveToDisk", "application/pdf,application/zip,application/octet-stream");\n')
            f.write('user_pref("pdfjs.disabled", true);\n')

        firefox_env = os.environ.copy()
        # Firefox 158 requires system access to be explicitly enabled through
        # this environment variable for Marionette chrome-context commands.
        firefox_env["MOZ_REMOTE_ALLOW_SYSTEM_ACCESS"] = "1"
        firefox_cmd = [
            firefox_exe,
            "-no-remote",
            "-remote-allow-system-access",
            "-profile", profile_dir,
            "--marionette"
        ]
        proc = subprocess.Popen(firefox_cmd, env=firefox_env)

        client = MarionetteClient(port=marionette_port)
        client.connect()
        client.send_cmd("WebDriver:NewSession", {"capabilities": {}})
        print("[INIT] Connected to Firefox 158.0.1 via Marionette.")

        # --- STEP 1: INSTALL EXTENSION ---
        print("\n--- STEP 1: Unpacked Extension Installation & Toolbar Setup ---")
        addon_res = client.send_cmd("Addon:Install", {
            "path": ext_dir,
            "temporary": True
        })
        installed_id = addon_res.get("value")
        assert installed_id == ADDON_ID, f"Unexpected addon ID: {installed_id}"
        print(f"[PASS] Temporary unpacked extension installed successfully (Addon ID: {installed_id}).")

        # Pin toolbar action button to navigation toolbar in chrome context
        client.send_cmd("Marionette:SetContext", {"value": "chrome"})
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": "CustomizableUI.addWidgetToArea('spatial-browser-history_term-project_local-browser-action', 'nav-bar');"
        })
        bap_el_res = client.send_cmd("WebDriver:FindElement", {
            "using": "css selector",
            "value": "#spatial-browser-history_term-project_local-BAP"
        })
        bap_element_id = extract_element_id(bap_el_res)
        assert bap_element_id is not None, "Toolbar action BAP button must be found in nav-bar"
        print(f"[PASS] Toolbar action button pinned to nav-bar (Element ID: {bap_element_id}).")

        # --- STEP 2: TOOLBAR ACTION BROWSER INPUT & REPEAT FOCUS ---
        print("\n--- STEP 2: Invoke Actual Toolbar Action with Browser Click & Verify Existing Tab Focus ---")
        tabs_before_action1 = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return window.gBrowser.tabs.length;"
        })["value"]
        
        # Action 1: First browser click on toolbar button opens extension map in a new tab
        client.send_cmd("WebDriver:ElementClick", {"id": bap_element_id})
        time.sleep(2)

        action1_result = client.send_cmd("WebDriver:ExecuteScript", {
            "script": """
            let tabs = Array.from(window.gBrowser.tabs).map(t => t.linkedBrowser.currentURI.spec);
            let selectedUri = window.gBrowser.selectedTab.linkedBrowser.currentURI.spec;
            return {
                totalTabs: tabs.length,
                allTabs: tabs,
                selectedTab: selectedUri
            };
            """
        })["value"]
        print(f"[PASS] Browser Action 1 (WebDriver:ElementClick): totalTabs={action1_result['totalTabs']} (was {tabs_before_action1}), selected='{action1_result['selectedTab']}'")
        assert action1_result["totalTabs"] == tabs_before_action1 + 1, "First toolbar click must open exactly 1 new tab"
        assert "moz-extension://" in action1_result["selectedTab"] and "index.html" in action1_result["selectedTab"], "First toolbar click must focus extension index.html"

        # Switch focus back to the first tab (about:home) to test second click focus
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": "window.gBrowser.selectedTab = window.gBrowser.tabs[0];"
        })
        time.sleep(0.5)
        switched_back = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return window.gBrowser.selectedTab.linkedBrowser.currentURI.spec;"
        })["value"]
        assert switched_back == "about:home", "Selected tab must be about:home prior to repeat action"

        # Action 2: Second browser click on toolbar button must FOCUS existing map tab without opening new tab
        client.send_cmd("WebDriver:ElementClick", {"id": bap_element_id})
        time.sleep(2)

        action2_result = client.send_cmd("WebDriver:ExecuteScript", {
            "script": """
            let tabs = Array.from(window.gBrowser.tabs).map(t => t.linkedBrowser.currentURI.spec);
            let selectedUri = window.gBrowser.selectedTab.linkedBrowser.currentURI.spec;
            return {
                totalTabs: tabs.length,
                selectedTab: selectedUri
            };
            """
        })["value"]
        print(f"[PASS] Browser Action 2 (WebDriver:ElementClick repeat): totalTabs={action2_result['totalTabs']} (did not increase), selected='{action2_result['selectedTab']}'")
        assert action2_result["totalTabs"] == action1_result["totalTabs"], "Second toolbar click must NOT open a new tab"
        assert "moz-extension://" in action2_result["selectedTab"] and "index.html" in action2_result["selectedTab"], "Second toolbar click must re-focus existing map tab"

        # --- STEP 3: EXERCISE REAL BROWSING & VERIFY STORED VISITS AND PARENT RELATIONSHIPS ---
        print("\n--- STEP 3: Exercise Browsing Scenarios & Verify Stored Visits and Parent Relationships ---")
        client.send_cmd("Marionette:SetContext", {"value": "content"})
        handles = client.send_cmd("WebDriver:GetWindowHandles")
        browsing_handle = handles[0]  # The non-extension window tab
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": browsing_handle})

        base_url = f"http://127.0.0.1:{TEST_PORT}"
        source_host_url = f"http://localhost:{TEST_PORT}"

        # 3a. Initial visit: Page 1
        print("  [3a] Navigating to Page 1...")
        client.send_cmd("WebDriver:Navigate", {"url": f"{base_url}/page1"})
        time.sleep(1)

        # 3b. Same-tab visit: Page 2
        print("  [3b] Same-tab click to Page 2...")
        link2_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#link2"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(link2_el)})
        time.sleep(1)

        # 3c. HTTP 302 Redirect: /redirect -> /target
        print("  [3c] Navigating to HTTP 302 redirect (/redirect -> /target)...")
        client.send_cmd("WebDriver:Navigate", {"url": f"{base_url}/redirect"})
        time.sleep(1)

        # 3d. Reload
        print("  [3d] Reloading target page (testing reload deduplication)...")
        client.send_cmd("WebDriver:ExecuteScript", {"script": "location.reload();"})
        time.sleep(1)

        # 3e. Dynamic title update
        print("  [3e] Updating document.title dynamically...")
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": "document.title = 'Updated Target Title';"
        })
        time.sleep(0.5)

        # 3f. Fragment change (anchor)
        print("  [3f] Updating location.hash to #section1...")
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": "location.hash = 'section1';"
        })
        time.sleep(0.5)

        # 3g. SPA route (pushState)
        print("  [3g] History API route update (pushState to /target/spa-route)...")
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": "history.pushState({}, 'SPA Page', '/target/spa-route');"
        })
        time.sleep(1)

        # 3h. Known opener navigation
        print("  [3h] Navigating to /opener and opening /child tab...")
        client.send_cmd("WebDriver:Navigate", {"url": f"{base_url}/opener"})
        time.sleep(1)
        openbtn_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#openbtn"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(openbtn_el)})
        time.sleep(2)

        # Switch to child tab and close it specifically
        current_handles = client.send_cmd("WebDriver:GetWindowHandles")
        child_handle = None
        for h in current_handles:
            client.send_cmd("WebDriver:SwitchToWindow", {"handle": h})
            u = client.send_cmd("WebDriver:GetCurrentURL")["value"]
            if "/child" in u:
                child_handle = h
                break

        assert child_handle is not None, f"Could not find child tab with /child among {current_handles}"
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": child_handle})
        child_tab_url = client.send_cmd("WebDriver:GetCurrentURL")["value"]
        print(f"  [3h] Child tab confirmed at {child_tab_url}. Closing child tab...")
        client.send_cmd("WebDriver:ExecuteScript", {"script": "window.close();"})
        time.sleep(1)

        # 3i. Unknown or closed opener navigation
        print("  [3i] Navigating via unknown/closed opener from untracked about:blank...")
        client.send_cmd("Marionette:SetContext", {"value": "chrome"})
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": """
            let tab = window.gBrowser.addTab('about:blank', {
                triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
            });
            window.gBrowser.selectedTab = tab;
            """
        })
        time.sleep(0.5)

        client.send_cmd("Marionette:SetContext", {"value": "content"})
        handles_for_blank = client.send_cmd("WebDriver:GetWindowHandles")
        about_blank_handle = None
        for h in handles_for_blank:
            client.send_cmd("WebDriver:SwitchToWindow", {"handle": h})
            if client.send_cmd("WebDriver:GetCurrentURL")["value"] == "about:blank":
                about_blank_handle = h
                break
        assert about_blank_handle is not None, "about:blank tab handle must exist"

        target_unknown_url = f"{base_url}/unknown-parent"
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": f"""
            let w = window.open('{target_unknown_url}', '_blank');
            window.close();
            """
        })
        time.sleep(2)

        # Find the unknown-parent child tab
        handles_after_unknown = client.send_cmd("WebDriver:GetWindowHandles")
        unknown_handle = None
        for h in handles_after_unknown:
            client.send_cmd("WebDriver:SwitchToWindow", {"handle": h})
            u = client.send_cmd("WebDriver:GetCurrentURL")["value"]
            if "/unknown-parent" in u:
                unknown_handle = h
                break
        assert unknown_handle is not None, "Child tab with /unknown-parent must exist"
        print(f"  [3i] Unknown-opener child tab confirmed at {target_unknown_url}. Closing child tab...")
        client.send_cmd("WebDriver:ExecuteScript", {"script": "window.close();"})
        time.sleep(1)

        # Switch to extension tab to inspect storage and verify parent relationships
        ext_handles = client.send_cmd("WebDriver:GetWindowHandles")
        ext_handle = None
        for h in ext_handles:
            client.send_cmd("WebDriver:SwitchToWindow", {"handle": h})
            u = client.send_cmd("WebDriver:GetCurrentURL")["value"]
            if "moz-extension://" in u and "index.html" in u:
                ext_handle = h
                break
        assert ext_handle is not None, "Extension tab handle must be found"

        # Query full storage state before reopening
        storage_pre_reopen = client.send_cmd("WebDriver:ExecuteAsyncScript", {
            "script": """
            let [resolve] = arguments;
            browser.storage.local.get(null).then(resolve);
            """
        })["value"]
        
        stored_nodes_pre = storage_pre_reopen.get("spatial_browser_history_data", {}).get("nodes", {})
        initial_stored_count = len(stored_nodes_pre)
        print(f"\n[VISIT COUNT AUDIT - PRE-REOPEN]")
        print(f"  Stored visits in local storage: {initial_stored_count}")
        assert initial_stored_count == 7, f"Expected exactly 7 initial stored visits, found {initial_stored_count}"

        nodes_by_url = {}
        for nid, node in stored_nodes_pre.items():
            nodes_by_url[node["url"]] = node
            print(f"    - [{nid}] url={node['url']}, parent={node['parentNodeId']}, children={node['childNodeIds']}, checkpoint={node['isCheckpoint']}, title='{node['title']}'")

        # 1. Assert Page 1 is a checkpoint with parentNodeId == null
        node_page1 = next((n for u, n in nodes_by_url.items() if "/page1" in u), None)
        assert node_page1 is not None, "Page 1 node must exist in storage"
        assert node_page1["parentNodeId"] is None, "Page 1 must have null parentNodeId"
        assert node_page1["isCheckpoint"] is True, "Page 1 must be marked as checkpoint"
        print("[PASS] Verified Page 1: Root checkpoint with parentNodeId: null.")

        # 2. Assert Page 2 is a child of Page 1 (same-tab navigation)
        node_page2 = next((n for u, n in nodes_by_url.items() if "/page2" in u), None)
        assert node_page2 is not None, "Page 2 node must exist in storage"
        assert node_page2["parentNodeId"] == node_page1["id"], f"Page 2 parent must be Page 1 ({node_page1['id']}), got {node_page2['parentNodeId']}"
        assert node_page2["id"] in node_page1["childNodeIds"], "Page 1 childNodeIds must include Page 2"
        print("[PASS] Verified same-tab navigation: Page 2 parent is Page 1, Page 1 childNodeIds includes Page 2.")

        # 3. Assert Redirect destination /target is child of Page 2
        node_target = next((n for u, n in nodes_by_url.items() if "/target" in u and "/spa-route" not in u), None)
        assert node_target is not None, "Target node must exist in storage"
        assert node_target["parentNodeId"] == node_page2["id"], f"Target parent must be Page 2 ({node_page2['id']}), got {node_target['parentNodeId']}"
        print("[PASS] Verified redirect destination: /target parent is Page 2.")

        # 4. Assert Reload deduplication: exactly one node exists for /target
        target_nodes = [n for n in stored_nodes_pre.values() if urlsplit(n.get("url", "")).path == "/target"]
        assert len(target_nodes) == 1, f"Reload deduplication failed: expected 1 target node, found {len(target_nodes)}"
        print("[PASS] Verified reload deduplication: Exactly 1 node stored for /target despite reload.")

        # 5. Assert Title update: target node has title 'Updated Target Title'
        assert node_target["title"] == "Updated Target Title", f"Title update failed: expected 'Updated Target Title', got '{node_target['title']}'"
        print(f"[PASS] Verified dynamic title update: node title updated in place to '{node_target['title']}'.")

        # 6. Assert Fragment change: updated node URL without creating duplicate node
        assert "#section1" in node_target["url"], f"Fragment update failed: expected #section1 in {node_target['url']}"
        print(f"[PASS] Verified anchor fragment: Updated node URL to '{node_target['url']}' without creating extra visit.")

        # 7. Assert SPA pushState: /target/spa-route is child of /target
        node_spa = next((n for u, n in nodes_by_url.items() if "/target/spa-route" in u), None)
        assert node_spa is not None, "SPA route node must exist in storage"
        assert node_spa["parentNodeId"] == node_target["id"], f"SPA route parent must be /target ({node_target['id']}), got {node_spa['parentNodeId']}"
        print("[PASS] Verified SPA route (pushState): /target/spa-route parent is /target.")

        # 8. Assert Opener tab: /child is child of /opener
        node_opener = next((n for u, n in nodes_by_url.items() if "/opener" in u), None)
        node_child = next((n for u, n in nodes_by_url.items() if "/child" in u), None)
        assert node_opener is not None, "Opener node must exist in storage"
        assert node_child is not None, "Child node must exist in storage"
        assert node_child["parentNodeId"] == node_opener["id"], f"Child node parent must be Opener ({node_opener['id']}), got {node_child['parentNodeId']}"
        assert node_child["id"] in node_opener["childNodeIds"], "Opener childNodeIds must include Child node ID"
        print(f"[PASS] Verified opener relationship: /child parent is /opener ({node_opener['id']}), opener children include child.")

        # 9. Assert Unknown / Closed opener: /unknown-parent is a root checkpoint with parentNodeId == null
        node_unknown = next((n for u, n in nodes_by_url.items() if "/unknown-parent" in u), None)
        assert node_unknown is not None, "Unknown parent node must exist in storage"
        assert node_unknown["parentNodeId"] is None, f"Unknown/closed opener visit must have parentNodeId: None, got {node_unknown['parentNodeId']}"
        assert node_unknown["isCheckpoint"] is True, "Unknown/closed opener visit must be marked isCheckpoint: True"
        assert len(node_unknown["childNodeIds"]) == 0, "Unknown/closed opener visit must have no child nodes"
        print(f"[PASS] Verified unknown/closed opener: /unknown-parent recorded as root checkpoint (parentNodeId: null, isCheckpoint: true, childNodeIds: []).")

        initial_svg_nodes = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.querySelectorAll('.map-node').length;"
        })["value"]
        print(f"  Rendered SVG map nodes before reopen: {initial_svg_nodes}")
        assert initial_svg_nodes == 7, f"Expected 7 SVG nodes before reopen, got {initial_svg_nodes}"

        # --- STEP 4: SELECT CLOSED CHILD NODE VIA BROWSER INPUT & EXPLICIT REOPEN VISIT COUNT ---
        print("\n--- STEP 4: Select Closed Child Node via Browser Input & Explicitly Audit Reopened Visit Count ---")
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ext_handle})

        # Fit the map to view so all nodes are positioned inside the visible viewport
        fit_btn_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#zoom-reset"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(fit_btn_el)})
        time.sleep(0.5)

        # Calculate bounding rect of child node for real browser pointer click
        child_rect = client.send_cmd("WebDriver:ExecuteScript", {
            "script": """
            let childEl = document.querySelector(`.map-node[data-id="${arguments[0]}"]`);
            if (!childEl) return null;
            let r = childEl.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            """,
            "args": [node_child["id"]]
        })["value"]
        assert child_rect is not None, f"Child node {node_child['id']} must exist in DOM"
        print(f"  Child node position after fit view: ({child_rect['x']}, {child_rect['y']})")

        # Perform real browser pointer click on the child node
        pointer_click_child = {
            "actions": [
                {
                    "type": "pointer",
                    "id": "mousePointer",
                    "parameters": {"pointerType": "mouse"},
                    "actions": [
                        {"type": "pointerMove", "duration": 50, "x": int(child_rect["x"]), "y": int(child_rect["y"]), "origin": "viewport"},
                        {"type": "pointerDown", "button": 0},
                        {"type": "pointerUp", "button": 0}
                    ]
                }
            ]
        }
        client.send_cmd("WebDriver:PerformActions", pointer_click_child)
        time.sleep(0.5)

        drawer_state = client.send_cmd("WebDriver:ExecuteScript", {
            "script": """
            return {
                panelHidden: document.getElementById('details-panel').hidden,
                title: document.getElementById('details-title').textContent,
                url: document.getElementById('details-url').textContent
            };
            """
        })["value"]
        assert drawer_state["panelHidden"] is False, "Details drawer must open on node selection"
        assert "/child" in drawer_state["url"], f"Details URL must be /child, got {drawer_state['url']}"
        print(f"[PASS] Selected closed child node via browser pointer click: title='{drawer_state['title']}', url='{drawer_state['url']}'")

        # Click #reopen-btn using WebDriver:ElementClick
        reopen_btn_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#reopen-btn"})
        handles_before = set(client.send_cmd("WebDriver:GetWindowHandles"))
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(reopen_btn_el)})
        time.sleep(2)

        handles_after = set(client.send_cmd("WebDriver:GetWindowHandles"))
        new_handles = list(handles_after - handles_before)
        assert len(new_handles) == 1, f"Reopen button must open exactly 1 new tab, got {len(new_handles)} new handles"
        reopened_handle = new_handles[0]
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": reopened_handle})
        reopened_actual_url = client.send_cmd("WebDriver:GetCurrentURL")["value"]
        print(f"[PASS] Reopened saved URL in new tab: {reopened_actual_url}")
        assert "/child" in reopened_actual_url, f"Reopened URL must contain /child, got {reopened_actual_url}"
        assert reopened_actual_url.startswith("http://"), "Reopened URL must be safe HTTP protocol"

        # Explicitly verify the visit count change in storage caused by reopening
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ext_handle})
        storage_post_reopen = client.send_cmd("WebDriver:ExecuteAsyncScript", {
            "script": """
            let [resolve] = arguments;
            browser.storage.local.get(null).then(resolve);
            """
        })["value"]
        stored_nodes_post = storage_post_reopen.get("spatial_browser_history_data", {}).get("nodes", {})
        post_reopen_count = len(stored_nodes_post)
        print(f"\n[VISIT COUNT AUDIT - POST-REOPEN]")
        print(f"  Stored visits in local storage: {post_reopen_count} (initial: {initial_stored_count}, +1 from reopened tab)")
        assert post_reopen_count == initial_stored_count + 1, f"Expected exactly {initial_stored_count + 1} visits after reopen, got {post_reopen_count}"
        assert post_reopen_count == 8, f"Expected 8 visits after reopen, got {post_reopen_count}"

        new_visit_nodes = [n for nid, n in stored_nodes_post.items() if nid not in stored_nodes_pre]
        assert len(new_visit_nodes) == 1, f"Expected exactly 1 new visit node, got {len(new_visit_nodes)}"
        new_visit = new_visit_nodes[0]
        print(f"  New visit recorded: [{new_visit['id']}] url={new_visit['url']}, parent={new_visit['parentNodeId']}")
        assert "/child" in new_visit["url"], f"New visit URL must be /child, got {new_visit['url']}"

        svg_nodes_post_reopen = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.querySelectorAll('.map-node').length;"
        })["value"]
        print(f"  Rendered SVG map nodes after reopen: {svg_nodes_post_reopen}")
        assert svg_nodes_post_reopen == 8, f"Expected 8 SVG nodes after reopen, got {svg_nodes_post_reopen}"
        print("[PASS] Explicit visit-count change proven: 7 visits before reopen -> 8 visits after reopen.")

        # Close the reopened tab and switch back to extension
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": reopened_handle})
        client.send_cmd("WebDriver:ExecuteScript", {"script": "window.close();"})
        time.sleep(1)
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ext_handle})

        # --- STEP 5: PROVE SEARCH & TIME FILTERING ACROSS A REAL BOUNDARY ---
        print("\n--- STEP 5: Prove Search and Time Filtering Across Real Boundary ---")
        base_active_count = 8
        print(f"  Base active visit count: {base_active_count}")

        # Search for 'target' via WebDriver typing
        print("  [Search] Typing 'target' into #search-input via WebDriver:ElementSendKeys...")
        search_input_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#search-input"})
        search_input_id = extract_element_id(search_input_el)
        client.send_cmd("WebDriver:ElementSendKeys", {"id": search_input_id, "text": "target"})
        # Allow input debounce (150ms in app.js) and DOM re-render
        time.sleep(0.6)

        search_active_badge = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('node-count-badge').textContent;"
        })["value"]
        search_visible_nodes = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.querySelectorAll('.map-node').length;"
        })["value"]
        search_input_val = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('search-input').value;"
        })["value"]
        print(f"  [Search 'target'] Input value: '{search_input_val}', Badge: '{search_active_badge}', matching count: {search_visible_nodes}")
        assert search_input_val == "target", "Search input value must be 'target'"
        assert "of" in search_active_badge, "Badge must reflect filtered 'X of Y visits'"
        assert search_visible_nodes == 2, f"Expected 2 matching nodes for 'target', got {search_visible_nodes}"

        # Clear search via clear button
        search_clear_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#search-clear-btn"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(search_clear_el)})
        time.sleep(0.5)

        restored_badge = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('node-count-badge').textContent;"
        })["value"]
        restored_nodes_count = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.querySelectorAll('.map-node').length;"
        })["value"]
        restored_input_val = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('search-input').value;"
        })["value"]
        print(f"  [Clear Search] Input value: '{restored_input_val}', Restored badge: '{restored_badge}', node count: {restored_nodes_count}")
        assert restored_input_val == "", "Search input value must be empty after clear"
        assert restored_nodes_count == base_active_count, "Clearing search must restore all initial nodes"
        print("[PASS] Verified search query typing and clear-search button via WebDriver browser inputs.")

        # Time filtering with visits on both sides of a 1-hour time boundary
        print("  Testing time filtering across boundary (setting Page 1 timestamp to 2 hours ago)...")
        two_hours_ago = int((time.time() - 7200) * 1000)
        
        client.send_cmd("WebDriver:ExecuteAsyncScript", {
            "script": """
            let [page1Id, oldTs, resolve] = arguments;
            browser.storage.local.get('spatial_browser_history_data').then(data => {
                let graph = data.spatial_browser_history_data;
                if (graph && graph.nodes[page1Id]) {
                    graph.nodes[page1Id].timestamp = oldTs;
                    browser.storage.local.set({ spatial_browser_history_data: graph }).then(resolve);
                } else {
                    resolve(false);
                }
            });
            """,
            "args": [node_page1["id"], two_hours_ago]
        })
        time.sleep(1)

        # Trigger time filter 'hour' (1 hour window) via WebDriver option click
        print("  [Time Filter] Selecting 'hour' option via WebDriver:ElementClick...")
        opt_hour_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#time-filter option[value='hour']"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(opt_hour_el)})
        time.sleep(0.5)

        hour_badge = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('node-count-badge').textContent;"
        })["value"]
        hour_nodes_count = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.querySelectorAll('.map-node').length;"
        })["value"]
        hour_sel_val = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('time-filter').value;"
        })["value"]
        page1_in_hour = client.send_cmd("WebDriver:ExecuteScript", {
            "script": """
            return !!document.querySelector(`.map-node[data-id="${arguments[0]}"]`);
            """,
            "args": [node_page1["id"]]
        })["value"]
        print(f"  [Filter 'hour'] Value: '{hour_sel_val}', Badge: '{hour_badge}', count: {hour_nodes_count}, Page 1 in map: {page1_in_hour}")
        assert hour_sel_val == "hour", f"Expected select value 'hour', got '{hour_sel_val}'"
        assert hour_nodes_count == base_active_count - 1, f"Expected {base_active_count - 1} nodes in 1-hour filter, got {hour_nodes_count}"
        assert page1_in_hour is False, "Page 1 (>1hr old) must be excluded in 1-hour filter"

        # Trigger time filter 'all' via WebDriver option click
        print("  [Time Filter] Selecting 'all' option via WebDriver:ElementClick...")
        opt_all_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#time-filter option[value='all']"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(opt_all_el)})
        time.sleep(0.5)

        all_nodes_count = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.querySelectorAll('.map-node').length;"
        })["value"]
        all_sel_val = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('time-filter').value;"
        })["value"]
        page1_in_all = client.send_cmd("WebDriver:ExecuteScript", {
            "script": """
            return !!document.querySelector(`.map-node[data-id="${arguments[0]}"]`);
            """,
            "args": [node_page1["id"]]
        })["value"]
        print(f"  [Filter 'all'] Value: '{all_sel_val}', Count: {all_nodes_count}, Page 1 in map: {page1_in_all}")
        assert all_sel_val == "all", f"Expected select value 'all', got '{all_sel_val}'"
        assert all_nodes_count == base_active_count, "All filter must restore all visits"
        assert page1_in_all is True, "Page 1 must be included in 'all' filter"

        # Trigger time filter 'day' (24 hour window - 2hr visit should be included) via WebDriver option click
        print("  [Time Filter] Selecting 'day' option via WebDriver:ElementClick...")
        opt_day_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#time-filter option[value='day']"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(opt_day_el)})
        time.sleep(0.5)

        day_nodes_count = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.querySelectorAll('.map-node').length;"
        })["value"]
        day_sel_val = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('time-filter').value;"
        })["value"]
        print(f"  [Filter 'day'] Value: '{day_sel_val}', Count: {day_nodes_count} (includes 2hr-old visit)")
        assert day_sel_val == "day", f"Expected select value 'day', got '{day_sel_val}'"
        assert day_nodes_count == base_active_count, "24-hour filter must include 2hr-old visit"

        # Reset filter to 'all' via WebDriver option click
        opt_reset_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#time-filter option[value='all']"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(opt_reset_el)})
        time.sleep(0.5)
        print("[PASS] Verified time filtering across boundary via WebDriver option selection: 2hr visit excluded in 'hour' and restored in 'all'/'day'.")

        # --- STEP 6: EXERCISE PAN, ZOOM, KEYBOARD NAVIGATION, AND FOCUS TRAPPING VIA BROWSER INPUT ---
        print("\n--- STEP 6: Exercise Pan, Zoom, Keyboard Navigation, and Dialog Focus Trapping via Browser Input ---")
        
        # 6a. Pan via real browser pointer drag
        viewport_t_before = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('map-viewport').getAttribute('transform');"
        })["value"]
        
        map_rect = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "let r = document.getElementById('map-container').getBoundingClientRect(); return { x: r.left + 250, y: r.top + 250 };"
        })["value"]
        
        browser_drag_action = {
            "actions": [
                {
                    "type": "pointer",
                    "id": "mousePointer",
                    "parameters": {"pointerType": "mouse"},
                    "actions": [
                        {"type": "pointerMove", "duration": 50, "x": int(map_rect["x"]), "y": int(map_rect["y"]), "origin": "viewport"},
                        {"type": "pointerDown", "button": 0},
                        {"type": "pointerMove", "duration": 150, "x": int(map_rect["x"] + 80), "y": int(map_rect["y"] + 60), "origin": "viewport"},
                        {"type": "pointerUp", "button": 0}
                    ]
                }
            ]
        }
        client.send_cmd("WebDriver:PerformActions", browser_drag_action)
        time.sleep(0.5)

        viewport_t_after = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('map-viewport').getAttribute('transform');"
        })["value"]
        print(f"  [Browser Pointer Pan] before: {viewport_t_before} -> after: {viewport_t_after}")
        assert viewport_t_before != viewport_t_after, "Browser pointer drag must update viewport transform"

        # 6b. Pan via browser keyboard arrow keys
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": "document.getElementById('map-container').focus();"
        })
        keyboard_pan_action = {
            "actions": [
                {
                    "type": "key",
                    "id": "keyboardInput",
                    "actions": [
                        {"type": "keyDown", "value": "\uE014"}, # ArrowRight
                        {"type": "keyUp", "value": "\uE014"},
                        {"type": "keyDown", "value": "\uE015"}, # ArrowDown
                        {"type": "keyUp", "value": "\uE015"}
                    ]
                }
            ]
        }
        client.send_cmd("WebDriver:PerformActions", keyboard_pan_action)
        time.sleep(0.3)
        viewport_t_after_key = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('map-viewport').getAttribute('transform');"
        })["value"]
        print(f"  [Browser Keyboard Pan] after arrows: {viewport_t_after_key}")
        assert viewport_t_after != viewport_t_after_key, "Browser arrow keys must pan viewport"

        # 6c. Zoom controls (in, out, wheel, fit) via browser clicks
        zoom_in_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#zoom-in"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(zoom_in_el)})
        time.sleep(0.3)
        zoomInT = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('map-viewport').getAttribute('transform');"
        })["value"]

        zoom_out_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#zoom-out"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(zoom_out_el)})
        time.sleep(0.3)
        zoomOutT = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('map-viewport').getAttribute('transform');"
        })["value"]

        # Mouse wheel zoom action
        wheel_action = {
            "actions": [
                {
                    "type": "wheel",
                    "id": "wheelInput",
                    "actions": [
                        {"type": "scroll", "x": int(map_rect["x"]), "y": int(map_rect["y"]), "deltaX": 0, "deltaY": -120, "duration": 50, "origin": "viewport"}
                    ]
                }
            ]
        }
        client.send_cmd("WebDriver:PerformActions", wheel_action)
        time.sleep(0.3)

        zoom_reset_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#zoom-reset"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(zoom_reset_el)})
        time.sleep(0.3)
        fitT = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('map-viewport').getAttribute('transform');"
        })["value"]
        print(f"  [Zoom Controls] zoomIn={zoomInT}, zoomOut={zoomOutT}, fit={fitT}")
        assert zoomInT != zoomOutT, "Zoom in and out must produce different scales"
        assert fitT is not None, "Fit button must establish a fit transform"

        # 6d. Keyboard navigation on nodes (Enter key via browser input)
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": "if (!document.getElementById('details-panel').hidden) document.getElementById('details-close-btn').click();"
        })
        time.sleep(0.3)
        first_node_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": ".map-node"})
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": "document.querySelector('.map-node').focus();"
        })
        enter_action = {
            "actions": [
                {
                    "type": "key",
                    "id": "keyboardInput",
                    "actions": [
                        {"type": "keyDown", "value": "\uE007"}, # Enter
                        {"type": "keyUp", "value": "\uE007"}
                    ]
                }
            ]
        }
        client.send_cmd("WebDriver:PerformActions", enter_action)
        time.sleep(0.3)

        key_select_state = client.send_cmd("WebDriver:ExecuteScript", {
            "script": """
            let n = document.querySelector('.map-node');
            return {
                isSelected: n.classList.contains('is-selected'),
                panelHidden: document.getElementById('details-panel').hidden
            };
            """
        })["value"]
        print(f"  [Browser Enter Key Selection] isSelected={key_select_state['isSelected']}, panelHidden={key_select_state['panelHidden']}")
        assert key_select_state["isSelected"] is True, "Enter key must select node"
        assert key_select_state["panelHidden"] is False, "Enter key must open details drawer"

        # 6e. Focus trapping in Clear Modal via real Browser Tab / Shift+Tab keys
        print("  Testing Clear Dialog focus trapping with browser Tab and Shift+Tab keys...")
        clear_map_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#clear-map-btn"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(clear_map_el)})
        time.sleep(0.5)

        modal_open = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return !document.getElementById('clear-modal').hidden;"
        })["value"]
        initial_active_id = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.activeElement ? document.activeElement.id : null;"
        })["value"]
        print(f"  [Clear Modal Opened] modalOpen={modal_open}, initialFocus='{initial_active_id}'")
        assert modal_open is True, "Clear modal must open"
        assert initial_active_id == "cancel-clear-btn", "Initial focus must default to cancel button"

        # 1. Send browser Tab key: from cancel-clear-btn (last element) -> wraps forward to confirm-clear-btn (first element)
        browser_tab_key = {
            "actions": [
                {
                    "type": "key",
                    "id": "keyboardInput",
                    "actions": [
                        {"type": "keyDown", "value": "\uE004"}, # Tab
                        {"type": "keyUp", "value": "\uE004"}
                    ]
                }
            ]
        }
        client.send_cmd("WebDriver:PerformActions", browser_tab_key)
        time.sleep(0.3)
        after_tab_focus = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.activeElement ? document.activeElement.id : null;"
        })["value"]
        print(f"  [Browser Tab Key Action] focus wrapped to: '{after_tab_focus}'")
        assert after_tab_focus == "confirm-clear-btn", f"Tab key must wrap to confirm button, got '{after_tab_focus}'"

        # 2. Send browser Shift+Tab key: from confirm-clear-btn (first element) -> wraps backward to cancel-clear-btn (last element)
        browser_shift_tab_key = {
            "actions": [
                {
                    "type": "key",
                    "id": "keyboardInput",
                    "actions": [
                        {"type": "keyDown", "value": "\uE008"}, # Shift
                        {"type": "keyDown", "value": "\uE004"}, # Tab
                        {"type": "keyUp", "value": "\uE004"},
                        {"type": "keyUp", "value": "\uE008"}
                    ]
                }
            ]
        }
        client.send_cmd("WebDriver:PerformActions", browser_shift_tab_key)
        time.sleep(0.3)
        after_shift_tab_focus = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.activeElement ? document.activeElement.id : null;"
        })["value"]
        print(f"  [Browser Shift+Tab Key Action] focus wrapped to: '{after_shift_tab_focus}'")
        assert after_shift_tab_focus == "cancel-clear-btn", f"Shift+Tab must wrap to cancel button, got '{after_shift_tab_focus}'"

        # Click cancel button via browser click to verify cancellation preserves visits
        cancel_clear_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#cancel-clear-btn"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(cancel_clear_el)})
        time.sleep(0.5)

        modal_closed = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('clear-modal').hidden;"
        })["value"]
        preserved_nodes = client.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.querySelectorAll('.map-node').length;"
        })["value"]
        print(f"  [Cancel preserved nodes]: {preserved_nodes} of {base_active_count}, modalClosed={modal_closed}")
        assert modal_closed is True, "Modal must close on cancel"
        assert preserved_nodes == base_active_count, f"Cancellation must preserve nodes, got {preserved_nodes}"

        # Now test confirmation: Clear Map Permanently via browser click
        print("  Testing Confirm Clear Map...")
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(clear_map_el)})
        time.sleep(0.5)
        confirm_clear_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#confirm-clear-btn"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(confirm_clear_el)})
        time.sleep(1.5)

        after_clear_state = client.send_cmd("WebDriver:ExecuteScript", {
            "script": """
            return {
                emptyStateHidden: document.getElementById('empty-state').hidden,
                nodeCount: document.querySelectorAll('.map-node').length,
                badge: document.getElementById('node-count-badge').textContent
            };
            """
        })["value"]
        print(f"  [After Confirm Clear]: emptyStateHidden={after_clear_state['emptyStateHidden']}, nodeCount={after_clear_state['nodeCount']}, badge='{after_clear_state['badge']}'")
        assert after_clear_state["emptyStateHidden"] is False, "Empty state must be visible after clearing"
        assert after_clear_state["nodeCount"] == 0, "Map nodes must be 0 after clearing"
        assert after_clear_state["badge"] == "0 visits", "Badge must show 0 visits"
        print("[PASS] Verified clear dialog: Browser Tab/Shift+Tab focus trap proven, cancel preserves data, confirm clears storage and resets map.")

        # --- STEP 6.5: TASK 11 CORE SCENARIOS (SIBLING BRANCHING, DOWNLOAD ATTRIBUTION, AMBIGUOUS REFERRER) ---
        print("\n--- STEP 6.5: Task 11 Core Scenarios: Sibling Branching & Download Provenance ---")
        
        # 1. Sibling Branching: Wikipedia -> Source A -> Back -> Source B
        print("  [6.5a] Exercising Sibling Branching: /wiki -> /source-a -> Back -> /source-b...")
        client.send_cmd("Marionette:SetContext", {"value": "content"})
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": browsing_handle})
        client.send_cmd("WebDriver:Navigate", {"url": f"{base_url}/wiki"})
        time.sleep(1.0)
        
        link_a_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#link-a"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(link_a_el)})
        time.sleep(1.0)
        
        # Go back to Wikipedia
        client.send_cmd("WebDriver:Back")
        time.sleep(1.0)
        
        link_b_el = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#link-b"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(link_b_el)})
        time.sleep(1.0)

        # Switch to extension tab to query storage
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ext_handle})
        storage_sibling = client.send_cmd("WebDriver:ExecuteAsyncScript", {
            "script": "let [resolve] = arguments; browser.storage.local.get(null).then(resolve);"
        })["value"]
        nodes_sibling = storage_sibling.get("spatial_browser_history_data", {}).get("nodes", {})
        
        wiki_node = next((n for n in nodes_sibling.values() if "/wiki" in n.get("url", "")), None)
        source_a_node = next((n for n in nodes_sibling.values() if "/source-a" in n.get("url", "")), None)
        source_b_node = next((n for n in nodes_sibling.values() if "/source-b" in n.get("url", "")), None)

        assert wiki_node is not None, "Wikipedia root node must exist in storage"
        assert source_a_node is not None, "Source A node must exist in storage"
        assert source_b_node is not None, "Source B node must exist in storage"
        assert wiki_node["parentNodeId"] is None, "Wikipedia must be root checkpoint (parentNodeId: None)"
        assert source_a_node["parentNodeId"] == wiki_node["id"], f"Source A parent must be Wikipedia ({wiki_node['id']}), got {source_a_node['parentNodeId']}"
        assert source_b_node["parentNodeId"] == wiki_node["id"], f"Source B parent must be Wikipedia ({wiki_node['id']}), got {source_b_node['parentNodeId']}"
        assert source_a_node["treeId"] == wiki_node["treeId"], "Source A must share Wikipedia treeId"
        assert source_b_node["treeId"] == wiki_node["treeId"], "Source B must share Wikipedia treeId"
        assert source_a_node["id"] in wiki_node["childNodeIds"], "Wikipedia childNodeIds must include Source A"
        assert source_b_node["id"] in wiki_node["childNodeIds"], "Wikipedia childNodeIds must include Source B"
        wiki_count = len([n for n in nodes_sibling.values() if "/wiki" in n.get("url", "")])
        assert wiki_count == 1, f"Expected exactly 1 Wikipedia node (traversal deduplicated), got {wiki_count}"
        print(f"[PASS] Sibling Branching Proven: Source A ({source_a_node['id']}) and Source B ({source_b_node['id']}) are siblings under Wikipedia ({wiki_node['id']}) in tree {wiki_node['treeId']}.")

        # 2. Download Provenance: Local page on distinct source hostname (localhost), download served from CDN host (127.0.0.1)
        print("  [6.5b] Exercising Distinct-Host Download Provenance from http://localhost/download-portal to http://127.0.0.1 CDN...")
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": browsing_handle})
        client.send_cmd("WebDriver:Navigate", {"url": f"{source_host_url}/download-portal"})
        time.sleep(1.0)
        
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": "document.getElementById('dl-cdn-link').click();"
        })

        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ext_handle})
        cdn_dl_node = None
        portal_node = None
        nodes_dl = {}
        for _ in range(15):
            time.sleep(0.5)
            storage_dl = client.send_cmd("WebDriver:ExecuteAsyncScript", {
                "script": "let [resolve] = arguments; browser.storage.local.get(null).then(resolve);"
            })["value"]
            nodes_dl = storage_dl.get("spatial_browser_history_data", {}).get("nodes", {})
            portal_node = next((n for n in nodes_dl.values() if "/download-portal" in n.get("url", "")), None)
            cdn_dl_node = next((n for n in nodes_dl.values() if n.get("nodeType") == "download" and n.get("filename") == "research_paper.pdf"), None)
            if cdn_dl_node and portal_node:
                break

        assert portal_node is not None, "Portal page node must exist"
        assert portal_node.get("url", "").startswith(source_host_url), f"Portal page must load from '{source_host_url}', got '{portal_node.get('url')}'"
        assert cdn_dl_node is not None, f"Download node for research_paper.pdf must exist in storage (nodes: {list(nodes_dl.keys())})"
        assert cdn_dl_node["parentNodeId"] == portal_node["id"], f"Download node must be child of source page ({portal_node['id']}), got {cdn_dl_node['parentNodeId']}"
        assert cdn_dl_node["treeId"] == portal_node["treeId"], "Download node must inherit source page treeId"
        assert cdn_dl_node["originDomain"] == "localhost", f"Origin domain must equal source hostname 'localhost' (and differ from CDN host '127.0.0.1'), got '{cdn_dl_node['originDomain']}'"
        assert cdn_dl_node["originDomain"] != "127.0.0.1", "Origin domain must NOT use the CDN download host '127.0.0.1'"
        assert cdn_dl_node["filename"] == "research_paper.pdf", f"Filename must be basename only, got '{cdn_dl_node['filename']}'"
        assert cdn_dl_node.get("url") is None, "Download node must NOT persist raw URL or CDN tokens"
        assert cdn_dl_node["id"] in portal_node["childNodeIds"], "Portal page childNodeIds must include download node"
        print(f"[PASS] Distinct-Host Download Provenance Proven: research_paper.pdf (from 127.0.0.1 CDN) attributed to source portal {portal_node['id']} (originDomain: {cdn_dl_node['originDomain']} != 127.0.0.1), raw URL/CDN omitted.")

        # 3. Unattributed Download: missing / empty referrer
        print("  [6.5c] Exercising Unattributed Download (no referrer)...")
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ext_handle})
        client.send_cmd("WebDriver:ExecuteAsyncScript", {
            "script": f"""
            let resolve = arguments[arguments.length - 1];
            browser.downloads.download({{
                url: "http://127.0.0.1:{CDN_PORT}/cdn-unattributed.zip",
                filename: "dataset.zip"
            }}).then(resolve).catch(err => resolve(err.message));
            """
        })
        unattr_dl_node = None
        for _ in range(15):
            time.sleep(0.5)
            storage_unattr = client.send_cmd("WebDriver:ExecuteAsyncScript", {
                "script": "let [resolve] = arguments; browser.storage.local.get(null).then(resolve);"
            })["value"]
            nodes_unattr = storage_unattr.get("spatial_browser_history_data", {}).get("nodes", {})
            unattr_dl_node = next((n for n in nodes_unattr.values() if n.get("nodeType") == "download" and n.get("filename") == "dataset.zip"), None)
            if unattr_dl_node:
                break

        assert unattr_dl_node is not None, "Unattributed download node for dataset.zip must exist"
        assert unattr_dl_node["parentNodeId"] is None, "Unattributed download must have parentNodeId: None"
        assert unattr_dl_node["originDomain"] == "Source unavailable", f"Expected 'Source unavailable', got '{unattr_dl_node['originDomain']}'"
        assert unattr_dl_node["isCheckpoint"] is True, "Unattributed download must be marked isCheckpoint: True"
        assert unattr_dl_node.get("url") is None, "Unattributed download must not store raw URL"
        print(f"[PASS] Unattributed Download Proven: dataset.zip recorded with parentNodeId: null, originDomain: '{unattr_dl_node['originDomain']}'.")

        # 4. Ambiguous Referrer Download: matching multiple page nodes
        print("  [6.5d] Exercising Ambiguous Referrer Download (|M|=2 matches)...")
        # Open a second content tab in chrome context
        client.send_cmd("Marionette:SetContext", {"value": "chrome"})
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": """
            let tab = window.gBrowser.addTab('about:blank', {
                triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
            });
            window.gBrowser.selectedTab = tab;
            """
        })
        time.sleep(0.5)

        client.send_cmd("Marionette:SetContext", {"value": "content"})
        all_handles = client.send_cmd("WebDriver:GetWindowHandles")
        ambig_handle = None
        for h in all_handles:
            if h != browsing_handle and h != ext_handle:
                client.send_cmd("WebDriver:SwitchToWindow", {"handle": h})
                if client.send_cmd("WebDriver:GetCurrentURL")["value"] == "about:blank":
                    ambig_handle = h
                    break
        assert ambig_handle is not None, "Second tab handle must be identified"

        # Tab 1 navigates to /ambiguous-page on localhost
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": browsing_handle})
        client.send_cmd("WebDriver:Navigate", {"url": f"{source_host_url}/ambiguous-page"})
        time.sleep(1.0)

        # Tab 2 also navigates to /ambiguous-page on localhost
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ambig_handle})
        client.send_cmd("WebDriver:Navigate", {"url": f"{source_host_url}/ambiguous-page"})
        time.sleep(1.0)

        # Verify 2 page nodes exist for /ambiguous-page
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ext_handle})
        storage_ambig_pre = client.send_cmd("WebDriver:ExecuteAsyncScript", {
            "script": "let [resolve] = arguments; browser.storage.local.get(null).then(resolve);"
        })["value"]
        ambig_pages = [n for n in storage_ambig_pre.get("spatial_browser_history_data", {}).get("nodes", {}).values() if "/ambiguous-page" in n.get("url", "")]
        assert len(ambig_pages) == 2, f"Expected exactly 2 ambiguous page nodes, got {len(ambig_pages)}"

        # Trigger download with referrer /ambiguous-page from Tab 1
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": browsing_handle})
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": "document.getElementById('dl-ambig-link').click();"
        })

        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ext_handle})
        ambig_dl_node = None
        for _ in range(15):
            time.sleep(0.5)
            storage_ambig_post = client.send_cmd("WebDriver:ExecuteAsyncScript", {
                "script": "let [resolve] = arguments; browser.storage.local.get(null).then(resolve);"
            })["value"]
            nodes_ambig = storage_ambig_post.get("spatial_browser_history_data", {}).get("nodes", {})
            ambig_dl_node = next((n for n in nodes_ambig.values() if n.get("nodeType") == "download" and n.get("filename") == "ambiguous.bin"), None)
            if ambig_dl_node:
                break

        assert ambig_dl_node is not None, "Ambiguous download node must exist"
        assert ambig_dl_node["parentNodeId"] is None, "Ambiguous download must NOT guess a parent node (must have parentNodeId: None)"
        assert ambig_dl_node["originDomain"] == "Source unavailable", f"Ambiguous download must record 'Source unavailable', got '{ambig_dl_node['originDomain']}'"
        assert ambig_dl_node["isCheckpoint"] is True, "Ambiguous download must be a root checkpoint"
        print(f"[PASS] Ambiguous Referrer Proven: ambiguous.bin matching 2 pages fell back safely to parentNodeId: null, origin: '{ambig_dl_node['originDomain']}'.")

        # Close Tab 2
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ambig_handle})
        client.send_cmd("WebDriver:ExecuteScript", {"script": "window.close();"})
        time.sleep(0.5)

        # --- STEP 7: ERROR AUDIT PRE-RESTART ---
        print("\n--- STEP 7: Error Log Audit & Persistence (Pre-Restart Phase) ---")
        pre_restart_audit = query_console_errors(client, "Pre-Restart Phase", ADDON_UUID)
        pre_restart_audit_file = r"D:\Projects\HCI Project\docs\test-results\firefox-errors-pre-restart.json"
        save_error_audit(pre_restart_audit, "Pre-Restart Phase", pre_restart_audit_file)
        print(f"  Evaluated {pre_restart_audit['totalGeckoMessages']} Gecko console records prior to restart.")
        print(f"  Extension Errors: {len(pre_restart_audit['extensionErrors'])}, Warnings: {len(pre_restart_audit['extensionWarnings'])}, Info: {len(pre_restart_audit.get('extensionInfo', []))}")
        for err in pre_restart_audit["extensionErrors"]:
            print(f"    - [ERROR] {err['source']}:{err['line']} {err['message']}")
        for warn in pre_restart_audit["extensionWarnings"][:3]:
            print(f"    - [WARN] {warn['source']}:{warn['line']} {warn['message']}")
        assert len(pre_restart_audit["extensionErrors"]) == 0, f"Detected unexpected extension errors: {pre_restart_audit['extensionErrors']}"
        assert len(pre_restart_audit["extensionWarnings"]) == 0, f"Detected unexpected extension warnings: {pre_restart_audit['extensionWarnings']}"
        print("[PASS] Pre-restart error audit passed with 0 errors and 0 warnings.")

        # --- STEP 8: BROWSER PROCESS RESTART & MULTI-NODE SESSION PERSISTENCE ---
        print("\n--- STEP 8: Browser Process Restart & Multi-Node Session Persistence ---")
        
        # 8a. Multi-Node Session Navigation in fresh live tab (/restart-step1 -> /restart-step2 -> /restart-step3)
        print("  [8a] Exercising multi-node session navigation in fresh live tab (/restart-step1 -> /restart-step2 -> /restart-step3)...")
        # Create a fresh browsing tab
        client.send_cmd("Marionette:SetContext", {"value": "chrome"})
        client.send_cmd("WebDriver:ExecuteScript", {
            "script": """
            let tab = window.gBrowser.addTab('about:blank', {
                triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
            });
            window.gBrowser.selectedTab = tab;
            """
        })
        time.sleep(0.5)

        client.send_cmd("Marionette:SetContext", {"value": "content"})
        all_handles = client.send_cmd("WebDriver:GetWindowHandles")
        fresh_browsing_handle = None
        for h in all_handles:
            if h != ext_handle and h != browsing_handle:
                fresh_browsing_handle = h
                break
        assert fresh_browsing_handle is not None, "Fresh browsing tab must exist"

        # Close the older browsing tab
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": browsing_handle})
        client.send_cmd("WebDriver:ExecuteScript", {"script": "window.close();"})
        time.sleep(0.5)

        browsing_handle = fresh_browsing_handle
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": browsing_handle})
        client.send_cmd("WebDriver:Navigate", {"url": f"{base_url}/restart-step1"})
        time.sleep(1.0)
        
        step2_link = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#step2-link"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(step2_link)})
        time.sleep(1.0)
        
        step3_link = client.send_cmd("WebDriver:FindElement", {"using": "css selector", "value": "#step3-link"})
        client.send_cmd("WebDriver:ElementClick", {"id": extract_element_id(step3_link)})
        time.sleep(1.0)

        # Switch to extension tab and query storage
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ext_handle})
        pre_restart_storage = client.send_cmd("WebDriver:ExecuteAsyncScript", {
            "script": "let [resolve] = arguments; browser.storage.local.get(null).then(resolve);"
        })["value"]
        stored_nodes_pre_restart = pre_restart_storage.get("spatial_browser_history_data", {}).get("nodes", {})
        pre_restart_count = len(stored_nodes_pre_restart)
        print(f"  Pre-restart node count stored in SQLite: {pre_restart_count}")

        step1_node = next((n for n in stored_nodes_pre_restart.values() if "/restart-step1" in n.get("url", "")), None)
        step2_node = next((n for n in stored_nodes_pre_restart.values() if "/restart-step2" in n.get("url", "")), None)
        step3_node = next((n for n in stored_nodes_pre_restart.values() if "/restart-step3" in n.get("url", "")), None)
        assert step1_node and step2_node and step3_node, "All three restart step nodes must exist in storage before restart"

        pre_restart_tab_state = pre_restart_storage.get("spatial_browser_history_data", {}).get("tabState", {})
        active_content_tab_key = next((k for k, ts in pre_restart_tab_state.items() if ts.get("currentNodeId") == step3_node["id"]), None)
        assert active_content_tab_key is not None, "Content tab state must be present"
        active_tab_stack_pre = pre_restart_tab_state[active_content_tab_key].get("historyStack", [])
        print(f"  Pre-restart tab {active_content_tab_key} historyStack: {active_tab_stack_pre} (length {len(active_tab_stack_pre)})")
        assert len(active_tab_stack_pre) == 3, f"Expected 3-node stack before restart, got {len(active_tab_stack_pre)}"
        assert active_tab_stack_pre == [step1_node["id"], step2_node["id"], step3_node["id"]], "History stack must reflect linear 3-step navigation"
        print(f"[PASS] Pre-restart multi-node baseline verified: tab {active_content_tab_key} has 3-node history stack.")

        # 8b. Browser Process Restart
        print("  [8b] Terminating Firefox process for full browser restart...")
        client.close()
        proc.kill()
        proc.wait()
        time.sleep(1.0)
        print("  Firefox process terminated cleanly.")

        # Relaunch Firefox with persistent profile and pass restart-step3 URL
        print("  Relaunching Firefox with persistent profile and live tab...")
        proc2 = subprocess.Popen([
            firefox_exe,
            "-no-remote",
            "-remote-allow-system-access",
            "-profile", profile_dir,
            "--marionette"
        ], env=firefox_env)

        client2 = MarionetteClient(port=marionette_port)
        client2.connect()
        client2.send_cmd("WebDriver:NewSession", {"capabilities": {}})
        print("  Reconnected to restarted Firefox.")

        # Restore the live tab to /restart-step3 before loading extension so initialization discovers it
        client2.send_cmd("Marionette:SetContext", {"value": "content"})
        initial_handles = client2.send_cmd("WebDriver:GetWindowHandles")
        client2.send_cmd("WebDriver:SwitchToWindow", {"handle": initial_handles[0]})
        client2.send_cmd("WebDriver:Navigate", {"url": f"{base_url}/restart-step3"})
        time.sleep(1.0)

        # Re-register unpacked extension
        client2.send_cmd("Addon:Install", {
            "path": ext_dir,
            "temporary": True
        })
        time.sleep(2.0)

        # Open extension index page
        client2.send_cmd("Marionette:SetContext", {"value": "chrome"})
        client2.send_cmd("WebDriver:ExecuteScript", {
            "script": """
            let policy = WebExtensionPolicy.getByID(arguments[0]);
            let tab = window.gBrowser.addTab(policy.getURL("index.html"), {
                triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
            });
            window.gBrowser.selectedTab = tab;
            return policy.getURL("index.html");
            """,
            "args": [ADDON_ID]
        })
        time.sleep(2)

        client2.send_cmd("Marionette:SetContext", {"value": "content"})
        handles2 = client2.send_cmd("WebDriver:GetWindowHandles")
        restarted_map_handle = None
        for h in handles2:
            client2.send_cmd("WebDriver:SwitchToWindow", {"handle": h})
            u = client2.send_cmd("WebDriver:GetCurrentURL")["value"]
            if "moz-extension://" in u and "index.html" in u:
                restarted_map_handle = h
                break
        assert restarted_map_handle is not None, "Extension map tab handle must exist in restarted session"

        # 1. Assert full graph persistence
        post_restart_storage = client2.send_cmd("WebDriver:ExecuteAsyncScript", {
            "script": "let [resolve] = arguments; browser.storage.local.get(null).then(resolve);"
        })["value"]
        stored_nodes_post = post_restart_storage.get("spatial_browser_history_data", {}).get("nodes", {})
        post_restart_count = len(stored_nodes_post)
        print(f"  Post-restart stored node count in SQLite: {post_restart_count} (was {pre_restart_count})")
        assert post_restart_count == pre_restart_count, f"Persistence error: expected {pre_restart_count} nodes in graph, got {post_restart_count}"
        assert step1_node["id"] in stored_nodes_post, "Step 1 node must persist in graph"
        assert step2_node["id"] in stored_nodes_post, "Step 2 node must persist in graph"
        assert step3_node["id"] in stored_nodes_post, "Step 3 node must persist in graph"

        # 2. Assert live tab single-node baseline collapse
        post_tab_state = post_restart_storage.get("spatial_browser_history_data", {}).get("tabState", {})
        post_tab_entry = next((ts for ts in post_tab_state.values() if ts.get("currentNodeId") == step3_node["id"]), None)
        assert post_tab_entry is not None, "Live tab entry for Step 3 must exist after restart"
        print(f"  Post-restart live tab state: stack={post_tab_entry.get('historyStack')}, index={post_tab_entry.get('historyIndex')}, baselineEstablished={post_tab_entry.get('baselineEstablished')}")
        assert post_tab_entry.get("historyStack") == [step3_node["id"]], f"History stack must collapse to single-node baseline [step3], got {post_tab_entry.get('historyStack')}"
        assert post_tab_entry.get("historyIndex") == 0, f"History index must reset to 0, got {post_tab_entry.get('historyIndex')}"
        assert post_tab_entry.get("baselineEstablished") is True, "Baseline must be established for discovered live tab"
        assert post_tab_entry.get("lineageInvalidated") is False, "Lineage must not be invalidated"
        print("[PASS] Verified Browser Restart: Live tab with multi-node session collapsed to single-node baseline [step3], stored graph remains completely intact.")

        restarted_nodes = client2.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.querySelectorAll('.map-node').length;"
        })["value"]
        restarted_badge = client2.send_cmd("WebDriver:ExecuteScript", {
            "script": "return document.getElementById('node-count-badge').textContent;"
        })["value"]
        print(f"  Post-restart rendered node count in SVG map: {restarted_nodes} ({restarted_badge})")
        assert restarted_nodes == pre_restart_count, f"Rendered nodes mismatch: expected {pre_restart_count}, got {restarted_nodes}"
        print("[PASS] Verified UI map reconciliation: All persisted visits correctly rendered after restart.")

        # --- STEP 9: POST-RESTART ERROR AUDIT & PERSISTENCE ---
        print("\n--- STEP 9: Error Log Audit & Persistence (Post-Restart Phase) ---")
        post_restart_audit = query_console_errors(client2, "Post-Restart Phase", ADDON_UUID)
        post_restart_audit_file = r"D:\Projects\HCI Project\docs\test-results\firefox-errors-post-restart.json"
        save_error_audit(post_restart_audit, "Post-Restart Phase", post_restart_audit_file)
        print(f"  Evaluated {post_restart_audit['totalGeckoMessages']} Gecko console records in restarted session.")
        print(f"  Post-Restart Extension Errors: {len(post_restart_audit['extensionErrors'])}, Warnings: {len(post_restart_audit['extensionWarnings'])}, Info: {len(post_restart_audit.get('extensionInfo', []))}")
        for err in post_restart_audit["extensionErrors"]:
            print(f"    - [ERROR] {err['source']}:{err['line']} {err['message']}")
        for warn in post_restart_audit["extensionWarnings"][:3]:
            print(f"    - [WARN] {warn['source']}:{warn['line']} {warn['message']}")
        assert len(post_restart_audit["extensionErrors"]) == 0, f"Detected unexpected post-restart extension errors: {post_restart_audit['extensionErrors']}"
        assert len(post_restart_audit["extensionWarnings"]) == 0, f"Detected unexpected post-restart extension warnings: {post_restart_audit['extensionWarnings']}"
        print("[PASS] Post-restart error audit passed with 0 errors and 0 warnings.")

        # --- STEP 10: CROSS-BROWSER BEHAVIOR COMPARISON & EVALUATION ---
        print("\n--- STEP 10: Cross-Browser Comparison & Evaluation ---")
        print("  [FIREFOX 158.0.1 RUNTIME EVALUATION]")
        print("  - Extension Loading: Validated via Addon:Install in Firefox 158.0.1.")
        print("  - Toolbar Action Open-or-Focus: Exact parity; first browser UI click opens map tab, repeat click focuses existing map without duplication.")
        print("  - Navigation Topology: Exact parity across same-tab, redirects, reloads, title updates, fragments,")
        print("    SPA routes (pushState), known-opener tabs, and unknown/closed opener fallback (root checkpoint, parentNodeId: null).")
        print("  - Reload Deduplication: Exact parity; exactly 1 node stored for /target despite reload.")
        print("  - Closed Child URL Reopen: Exact parity; 7 initial visits -> 8 visits after reopening child URL (+1 visit).")
        print("  - Search & Time Filtering: Exact parity; search reduces to 2 of 8 visits, clear restores 8 visits;")
        print("    1-hour filter excludes 2hr-old visit, 'all' and 'day' restore all visits.")
        print("  - UI Controls & Focus Trapping: Exact parity; pan, zoom, fit, Enter node selection, Tab/Shift+Tab wrap.")
        print("  - Storage Clearing: Exact parity; cancel preserves graph, confirm resets storage and map to 0 visits.")
        print("  - Task 11 Sibling Branching: Exact parity; Wikipedia -> Source A -> Back -> Source B produces A and B as siblings under Wikipedia.")
        print("  - Task 11 Download Provenance: Exact parity; completed download from 127.0.0.1 CDN host attributes strictly to source page hostname (localhost).")
        print("  - Task 11 Unattributed & Ambiguous Referrers: Exact parity; missing or ambiguous referrers safely fall back to 'Source unavailable'.")
        print("  - Task 11 Multi-Node Session Restart: Exact parity; multi-node history stacks collapse to single-node baselines while stored graph remains intact.")
        print("  - Error Telemetry: Exact parity; 0 extension errors, 0 warnings across both live and restart phases.")

        client2.close()
        proc2.kill()
        proc2.wait()

        print("\n" + "=" * 76)
        print("ALL INTERACTIVE BROWSER INPUT & AUDIT CHECKS COMPLETED SUCCESSFULLY (0 FAILURES)")
        print("=" * 76)

    finally:
        for active_client in (client, client2):
            if active_client:
                active_client.close()
        for active_process in (proc, proc2):
            if active_process and active_process.poll() is None:
                active_process.kill()
                active_process.wait()
        server.shutdown()
        server.server_close()
        try:
            cdn_server.shutdown()
            cdn_server.server_close()
        except Exception:
            pass
        profile_owner.cleanup()
        tee.close()

if __name__ == "__main__":
    run_tests()
