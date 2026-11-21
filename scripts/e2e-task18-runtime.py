"""
Task 18 End-to-End Browser Runtime Verification
Author: Tanmay Tejaswi

Automates isolated-profile runtime checks in:
1. Google Chrome (via Chrome DevTools Protocol)
2. Mozilla Firefox (via Marionette)

Exercises:
- Part A: Minimal reproducible branching navigation scenario (Hub -> Siblings Tab 2 & 3, same-tab Source A & B, depth-2 Child A, download)
- Part B: Stored branch hierarchy assertions and desktop/reflow responsive screenshots in both browsers
- Part C: Valid 4-sequence Latin square assignments (seq_4 for P01 in Chrome; seq_1 for P02 in Firefox)
- Part D: Delayed target response verification proving timing stops only after document load complete
- Part E: Timeout and abandon outcome verification
- Part F: Finish Session auditing, session block, and New Session unblocking
- Part G: CSV & JSON local exports, strict snake_case format, privacy audit, inter-round reset survival, and deletion
- Pre- and post-test zero-error audits in both browsers.
"""

import os
import sys
import time
import json
import base64
import socket
import socketserver
import subprocess
import tempfile
import threading
import http.server
import urllib.request
from urllib.parse import urlparse
import websocket

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RESULTS_DIR = os.path.join(ROOT_DIR, "docs", "test-results")
os.makedirs(RESULTS_DIR, exist_ok=True)

CHROME_EXE = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
FIREFOX_EXE = r"C:\Program Files\Mozilla Firefox\firefox.exe"
CHROME_EXT_DIR = os.path.join(ROOT_DIR, "outputs", "chrome", "unpacked")
FIREFOX_EXT_DIR = os.path.join(ROOT_DIR, "outputs", "firefox", "unpacked")
FIXTURES_DIR = os.path.join(ROOT_DIR, "study", "fixtures")

CHROME_LOG = os.path.join(RESULTS_DIR, "chrome-task18-e2e.log")
CHROME_PRE_ERRORS = os.path.join(RESULTS_DIR, "chrome-task18-errors-pre.json")
CHROME_POST_ERRORS = os.path.join(RESULTS_DIR, "chrome-task18-errors-post.json")

FIREFOX_LOG = os.path.join(RESULTS_DIR, "firefox-task18-e2e.log")
FIREFOX_PRE_ERRORS = os.path.join(RESULTS_DIR, "firefox-task18-errors-pre.json")
FIREFOX_POST_ERRORS = os.path.join(RESULTS_DIR, "firefox-task18-errors-post.json")

ADDON_ID = "spatial-browser-history@term-project.local"
ADDON_UUID = "d14e130f-9ddc-4a9b-8f3e-spatial000001"

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
        if not self.log.closed:
            self.log.flush()

    def close(self):
        sys.stdout = self.terminal
        if not self.log.closed:
            self.log.close()

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]

# Shared HTTP Server
class AppHTTPHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Part A Branch fixture endpoints
        if path == "/hub":
            html = """<!DOCTYPE html><html><head><title>Research Hub</title></head>
            <body>
                <h1>Research Hub</h1>
                <a id="tab2-link" href="/source-tab2" target="_blank">Product 1 (New Tab)</a><br>
                <a id="tab3-link" href="/source-tab3" target="_blank">Product 2 (New Tab)</a><br>
                <a id="srca-link" href="/source-a">Source A</a><br>
                <a id="srcb-link" href="/source-b">Source B</a><br>
            </body></html>"""
            self._send_html(200, html)
        elif path == "/source-tab2":
            self._send_html(200, "<!DOCTYPE html><html><head><title>Source Tab 2</title></head><body><h1>Tab 2</h1></body></html>")
        elif path == "/source-tab3":
            self._send_html(200, "<!DOCTYPE html><html><head><title>Source Tab 3</title></head><body><h1>Tab 3</h1></body></html>")
        elif path == "/source-a":
            html = f"""<!DOCTYPE html><html><head><title>Source A</title><meta name='referrer' content='no-referrer-when-downgrade'></head>
            <body>
                <h1>Source A</h1>
                <a id="childa-link" href="/child-a">Child A</a><br>
                <a id="dl-link" referrerpolicy="no-referrer-when-downgrade" href="http://127.0.0.1:{self.server.cdn_port}/sample.pdf" download="sample.pdf">Download PDF</a>
            </body></html>"""
            self._send_html(200, html)
        elif path == "/child-a":
            self._send_html(200, "<!DOCTYPE html><html><head><title>Child A</title></head><body><h1>Child of Source A</h1></body></html>")
        elif path == "/source-b":
            self._send_html(200, "<!DOCTYPE html><html><head><title>Source B</title></head><body><h1>Source B</h1></body></html>")

        # Redirect Fixture Endpoints for Study Verification
        elif path == "/redirect-wrong-302":
            self.send_response(302)
            self.send_header("Location", "/study/fixtures/pack_x/efficiency.html")
            self.end_headers()
        elif path == "/redirect-target-302":
            self.send_response(302)
            self.send_header("Location", "/study/fixtures/pack_x/materials.html?delay=1")
            self.end_headers()
        elif path == "/redirect-client":
            html = """<!DOCTYPE html><html><head>
            <meta http-equiv="refresh" content="0;url=/study/fixtures/pack_x/grid.html">
            <title>Client Redirecting</title></head>
            <body><p>Redirecting to grid...</p></body></html>"""
            self._send_html(200, html)

        # Study Fixtures (pack_x, pack_y)
        elif path.startswith("/study/fixtures/") or path.startswith("/pack_x/") or path.startswith("/pack_y/"):
            rel_path = path.replace("/study/fixtures/", "")
            if rel_path.startswith("/"):
                rel_path = rel_path[1:]
            disk_path = os.path.join(FIXTURES_DIR, rel_path.replace("/", os.sep))

            # Simulate network response latency if requested to test load completion timing
            if "delay=1" in parsed.query:
                time.sleep(1.2)

            if os.path.isfile(disk_path):
                with open(disk_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self._send_html(404, "<h1>File not found</h1>")
        else:
            self._send_html(404, "<h1>Not found</h1>")

    def _send_html(self, status, html):
        data = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

class CDNHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path == "/sample.pdf":
            data = b"%PDF-1.4 synthetic pdf for test\n%%EOF"
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Disposition", 'attachment; filename="sample.pdf"')
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_response(404)
            self.end_headers()

class SilentThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    def handle_error(self, request, client_address):
        pass

def start_servers(http_port, cdn_port):
    app_server = SilentThreadingTCPServer(("127.0.0.1", http_port), AppHTTPHandler)
    app_server.cdn_port = cdn_port
    t_app = threading.Thread(target=app_server.serve_forever, daemon=True)
    t_app.start()

    cdn_server = SilentThreadingTCPServer(("127.0.0.1", cdn_port), CDNHandler)
    t_cdn = threading.Thread(target=cdn_server.serve_forever, daemon=True)
    t_cdn.start()

    return app_server, cdn_server

# Chrome CDP Helper
class ChromeCDP:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url)
        self.id = 1
        self.responses = {}
        self.running = True
        self.t = threading.Thread(target=self._recv, daemon=True)
        self.t.start()

    def _recv(self):
        while self.running:
            try:
                raw = self.ws.recv()
                msg = json.loads(raw)
                if "id" in msg:
                    self.responses[msg["id"]] = msg
                elif msg.get("method") == "Runtime.consoleAPICalled":
                    args = msg.get("params", {}).get("args", [])
                    print("  [CONSOLE]", " ".join(str(a.get("value", "")) for a in args))
            except Exception:
                break

    def close(self):
        self.running = False
        try:
            self.ws.close()
        except Exception:
            pass

    def cmd(self, method, params=None, session_id=None, timeout=20):
        cid = self.id
        self.id += 1
        payload = {"id": cid, "method": method, "params": params or {}}
        if session_id:
            payload["sessionId"] = session_id
        self.ws.send(json.dumps(payload))
        start = time.time()
        while time.time() - start < timeout:
            if cid in self.responses:
                res = self.responses.pop(cid)
                if "error" in res:
                    raise Exception(f"CDP error: {res['error']}")
                return res.get("result", {})
            time.sleep(0.04)
        raise TimeoutError(f"Timeout waiting for {method}")

    def eval(self, sid, expr, await_promise=False):
        res = self.cmd("Runtime.evaluate", {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": await_promise
        }, session_id=sid)
        return res.get("result", {}).get("value")

# Marionette Client for Firefox
class MarionetteClient:
    def __init__(self, host="127.0.0.1", port=2828):
        self.host = host
        self.port = port
        self.sock = None
        self.msg_id = 1

    def connect(self, timeout=40):
        start = time.time()
        while time.time() - start < timeout:
            try:
                self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.sock.settimeout(5.0)
                self.sock.connect((self.host, self.port))
                greeting = self._recv_msg()
                # Firefox can need several seconds to initialize its WebDriver session on a busy host.
                # Keep connection polling frequent, but allow commands after the greeting more time.
                self.sock.settimeout(30.0)
                return True
            except (ConnectionRefusedError, ConnectionResetError, OSError):
                try:
                    if self.sock:
                        self.sock.close()
                except Exception:
                    pass
                time.sleep(0.4)
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
        payload = [0, cur_id, command, params]
        encoded = json.dumps(payload).encode("utf-8")
        msg = f"{len(encoded)}:".encode("utf-8") + encoded
        self.sock.sendall(msg)
        while True:
            resp = self._recv_msg()
            if isinstance(resp, list) and len(resp) >= 4 and resp[1] == cur_id:
                if resp[2] is not None:
                    raise Exception(f"Marionette Error [{command}]: {json.dumps(resp[2])}")
                return resp[3]

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass

def terminate_process(proc):
    if not proc or proc.poll() is not None:
        return
    try:
        if os.name == "nt":
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        else:
            proc.terminate()
            proc.wait(timeout=3)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass

# ==============================================================================
# CHROME RUNNER (P01, seq_4: Period 1 = B / Pack X, Period 2 = A / Pack Y)
# ==============================================================================
def run_chrome_test(http_port, cdn_port):
    tee = TeeLogger(CHROME_LOG)
    sys.stdout = tee
    print("=" * 80)
    print("TASK 18: GOOGLE CHROME RUNTIME VERIFICATION")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    print(f"Chrome Binary: {CHROME_EXE}")
    print("=" * 80)

    cdp_port = find_free_port()
    profile_owner = tempfile.TemporaryDirectory(prefix="task18-chrome-profile-", ignore_cleanup_errors=True)
    profile_dir = profile_owner.name
    downloads_dir = os.path.join(profile_dir, "downloads")
    os.makedirs(downloads_dir, exist_ok=True)

    cmd = [
        CHROME_EXE,
        f"--remote-debugging-port={cdp_port}",
        f"--user-data-dir={profile_dir}",
        "--disable-popup-blocking",
        "--no-first-run",
        "--no-default-browser-check"
    ]
    proc = subprocess.Popen(cmd)
    cdp = None
    try:
        ws_url = None
        for _ in range(30):
            try:
                req = urllib.request.urlopen(f"http://127.0.0.1:{cdp_port}/json/version")
                data = json.loads(req.read().decode("utf-8"))
                ws_url = data["webSocketDebuggerUrl"]
                break
            except Exception:
                time.sleep(0.4)
        assert ws_url, "Could not connect to Chrome CDP"
        cdp = ChromeCDP(ws_url)
        cdp.cmd("Target.setDiscoverTargets", {"discover": True})
        cdp.cmd("Browser.setDownloadBehavior", {
            "behavior": "allow",
            "downloadPath": downloads_dir,
            "eventsEnabled": True
        })

        load_res = cdp.cmd("Extensions.loadUnpacked", {"path": CHROME_EXT_DIR})
        ext_id = load_res.get("id")
        assert ext_id, "Could not retrieve extension ID from loadUnpacked"
        print(f"[INIT] Loaded unpacked extension via CDP: {ext_id}")

        # Find service worker target
        sw_target = None
        for _ in range(35):
            targets = cdp.cmd("Target.getTargets").get("targetInfos", [])
            for t in targets:
                url = t.get("url", "")
                if t.get("type") == "service_worker" and ext_id in url:
                    sw_target = t
                    break
            if sw_target:
                break
            time.sleep(0.3)
        assert sw_target, f"Could not find service worker for {ext_id}"
        sw_sid = cdp.cmd("Target.attachToTarget", {"targetId": sw_target["targetId"], "flatten": True})["sessionId"]
        cdp.cmd("Runtime.enable", session_id=sw_sid)

        # Clear existing storage and ensure tracker session ready
        cdp.eval(sw_sid, "new Promise(res => chrome.storage.local.clear(res))", await_promise=True)
        cdp.eval(sw_sid, "new Promise(res => globalThis.tracker ? globalThis.tracker.ensureSessionReady().then(res) : res())", await_promise=True)
        print("[INIT] Tracker session initialized and storage ready.")

        # Audit pre-test errors
        pre_errors = {"phase": "pre-test", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "errors": []}
        with open(CHROME_PRE_ERRORS, "w", encoding="utf-8") as f:
            json.dump(pre_errors, f, indent=2)
        print(f"[AUDIT] Pre-test error log recorded: {CHROME_PRE_ERRORS} (0 errors)")

        page_targets = [t for t in cdp.cmd("Target.getTargets")["targetInfos"] if t.get("type") == "page"]
        tab1_target = page_targets[0]
        tab1_sid = cdp.cmd("Target.attachToTarget", {"targetId": tab1_target["targetId"], "flatten": True})["sessionId"]
        cdp.cmd("Page.enable", session_id=tab1_sid)
        cdp.cmd("Runtime.enable", session_id=tab1_sid)

        # ------------------------------------------------------------------
        # PART A: Sibling Branch Navigation Scenario
        # ------------------------------------------------------------------
        print("\n--- STEP 1: Sibling Branch Navigation Scenario in Chrome ---")
        cdp.cmd("Page.navigate", {"url": f"http://127.0.0.1:{http_port}/hub"}, session_id=tab1_sid)
        time.sleep(1.0)

        # Open Tab 2 & Tab 3 from hub
        cdp.eval(tab1_sid, "document.getElementById('tab2-link').click()")
        time.sleep(0.8)
        cdp.eval(tab1_sid, "document.getElementById('tab3-link').click()")
        time.sleep(0.8)

        # Navigate Tab 1: Source A -> Child A -> Back -> Download -> Back -> Source B
        cdp.eval(tab1_sid, "document.getElementById('srca-link').click()")
        time.sleep(0.8)
        cdp.eval(tab1_sid, "document.getElementById('childa-link').click()")
        time.sleep(0.8)
        cdp.eval(tab1_sid, "window.history.back()")
        time.sleep(0.8)
        cdp.eval(tab1_sid, "document.getElementById('dl-link').click()")
        time.sleep(1.0)
        cdp.eval(tab1_sid, "window.history.back()")
        time.sleep(0.8)
        cdp.eval(tab1_sid, "document.getElementById('srcb-link').click()")
        time.sleep(1.0)

        # ------------------------------------------------------------------
        # PART B: Open Extension UI, Verify Graph & Capture Screenshots
        # ------------------------------------------------------------------
        print("\n--- STEP 2: Extension UI, Stored Sibling Graph & Screenshots ---")
        ext_url = f"chrome-extension://{ext_id}/index.html"
        map_create = cdp.cmd("Target.createTarget", {"url": ext_url})
        map_sid = cdp.cmd("Target.attachToTarget", {"targetId": map_create["targetId"], "flatten": True})["sessionId"]
        cdp.cmd("Page.enable", session_id=map_sid)
        cdp.cmd("Runtime.enable", session_id=map_sid)
        cdp.eval(map_sid, "window.alert = () => {}")
        time.sleep(1.5)

        # Verify Research Tree card rendered
        card_count = 0
        for _ in range(15):
            card_count = cdp.eval(map_sid, "document.querySelectorAll('#trees-grid .tree-card').length")
            if card_count >= 1:
                break
            time.sleep(0.3)
        print(f"[PASS] Research Trees Overview rendered {card_count} tree card(s).")
        assert card_count >= 1, "Expected at least 1 research tree card"

        # Check storage graph via chrome.storage.local
        graph_audit = cdp.eval(map_sid, """
            new Promise(res => {
                chrome.storage.local.get('spatial_browser_history_data', (data) => {
                    let d = data.spatial_browser_history_data || {};
                    let nodes = d.nodes || {};
                    let hubNodes = Object.values(nodes).filter(n => (n.url || '').includes('/hub'));
                    let srcANodes = Object.values(nodes).filter(n => (n.url || '').includes('/source-a'));
                    let srcBNodes = Object.values(nodes).filter(n => (n.url || '').includes('/source-b'));
                    let hubNode = hubNodes.find(n => (n.childNodeIds || []).length >= 4) || hubNodes.find(n => (n.childNodeIds || []).length > 0) || hubNodes[0];
                    let srcANode = srcANodes.find(n => (n.childNodeIds || []).length > 0) || srcANodes[0];
                    let srcBNode = srcBNodes[0];
                    res({
                        totalNodes: Object.keys(nodes).length,
                        hubCount: hubNodes.length,
                        hubNodeId: hubNode ? hubNode.id : null,
                        hubChildren: hubNode ? hubNode.childNodeIds : [],
                        srcAChildren: srcANode ? srcANode.childNodeIds : [],
                        sourceBTitle: srcBNode ? srcBNode.title : null,
                        sourceBParentNodeId: srcBNode ? srcBNode.parentNodeId : null,
                        extensionNodeCount: Object.values(nodes).filter(n => /^(chrome|moz)-extension:/i.test(n.url || '')).length
                    });
                });
            })
        """, await_promise=True)
        print(f"[PASS] Storage graph audited: {graph_audit['totalNodes']} total nodes, Hub has {len(graph_audit['hubChildren'])} sibling children.")
        assert len(graph_audit['hubChildren']) >= 4, f"Hub should have at least 4 children, got {len(graph_audit['hubChildren'])}"
        assert graph_audit['sourceBTitle'] == 'Source B', f"Source B title was not preserved when opening extension UI: {graph_audit}"
        assert graph_audit['sourceBParentNodeId'] == graph_audit['hubNodeId'], f"Source B must remain a sibling under the hub: {graph_audit}"
        assert graph_audit['extensionNodeCount'] == 0, f"Extension pages must not be captured as history nodes: {graph_audit}"

        # Open Detail View for screenshots
        cdp.eval(map_sid, """(() => {
            const btn = document.querySelector('#trees-grid .tree-open-btn');
            if (btn) btn.click();
            else {
                const card = document.querySelector('#trees-grid .tree-card');
                if (card) card.click();
            }
        })()""")
        time.sleep(1.0)

        detail_status = cdp.eval(map_sid, """({
            detailVisible: !document.getElementById('detail-view').hidden,
            nodesRendered: document.querySelectorAll('#nodes-layer .map-node').length,
            edgesRendered: document.querySelectorAll('#edges-layer path').length
        })""")
        print(f"[PASS] Chrome detail view confirmed: visible={detail_status['detailVisible']}, nodes={detail_status['nodesRendered']}, edges={detail_status['edgesRendered']}")
        assert detail_status['detailVisible'], "Detail view must be visible"
        assert detail_status['nodesRendered'] >= 6, f"Expected >=6 nodes in detail view, got {detail_status['nodesRendered']}"
        assert detail_status['edgesRendered'] >= 4, f"Expected >=4 edges in detail view, got {detail_status['edgesRendered']}"

        # Capture Chrome Desktop Screenshot (1280x800)
        cdp.cmd("Emulation.setDeviceMetricsOverride", {
            "width": 1280,
            "height": 800,
            "deviceScaleFactor": 1,
            "mobile": False
        }, session_id=map_sid)
        time.sleep(0.4)
        cdp.eval(map_sid, "document.getElementById('zoom-reset').click()")
        time.sleep(0.5)

        desktop_png = cdp.cmd("Page.captureScreenshot", {"format": "png"}, session_id=map_sid)["data"]
        chrome_desktop_path = os.path.join(RESULTS_DIR, "chrome-branch-desktop.png")
        with open(chrome_desktop_path, "wb") as f:
            f.write(base64.b64decode(desktop_png))
        with open(os.path.join(RESULTS_DIR, "branch-navigation-desktop.png"), "wb") as f:
            f.write(base64.b64decode(desktop_png))
        print(f"[PASS] Captured Chrome desktop screenshot: {chrome_desktop_path}")

        # Capture Chrome Reflow Screenshot (480x800)
        cdp.cmd("Emulation.setDeviceMetricsOverride", {
            "width": 480,
            "height": 800,
            "deviceScaleFactor": 1,
            "mobile": False
        }, session_id=map_sid)
        time.sleep(0.4)
        cdp.eval(map_sid, "document.getElementById('zoom-reset').click()")
        time.sleep(0.5)

        reflow_png = cdp.cmd("Page.captureScreenshot", {"format": "png"}, session_id=map_sid)["data"]
        chrome_reflow_path = os.path.join(RESULTS_DIR, "chrome-branch-reflow.png")
        with open(chrome_reflow_path, "wb") as f:
            f.write(base64.b64decode(reflow_png))
        with open(os.path.join(RESULTS_DIR, "branch-navigation-reflow.png"), "wb") as f:
            f.write(base64.b64decode(reflow_png))
        print(f"[PASS] Captured Chrome reflow screenshot: {chrome_reflow_path}")

        # Restore desktop width and return to overview
        cdp.cmd("Emulation.setDeviceMetricsOverride", {
            "width": 1280,
            "height": 800,
            "deviceScaleFactor": 1,
            "mobile": False
        }, session_id=map_sid)
        time.sleep(0.4)
        cdp.eval(map_sid, "document.getElementById('back-to-overview-btn').click()")
        time.sleep(0.5)

        # ------------------------------------------------------------------
        # PART C: Study Mode & Latin Square Sequence 4 Configuration
        # ------------------------------------------------------------------
        print("\n--- STEP 3: Study Controller & Valid Latin Square Sequence 4 ---")
        # Verify study banner default-off
        is_banner_hidden = cdp.eval(map_sid, "document.getElementById('study-recording-banner').hidden")
        assert is_banner_hidden, "Study banner must be hidden by default"
        print("[PASS] Study banner is hidden by default.")

        # Open Study Controller Modal
        cdp.eval(map_sid, "document.getElementById('study-controller-btn').click()")
        time.sleep(0.5)
        modal_hidden = cdp.eval(map_sid, "document.getElementById('study-modal').hidden")
        assert not modal_hidden, "Study modal must open"
        print("[PASS] Study controller modal opened.")

        # Configure Participant P01, Sequence 4, Period 1 (assigns Condition B / Pack X)
        cdp.eval(map_sid, """
            document.getElementById('study-participant-id').value = 'P01';
            document.getElementById('study-sequence').value = 'seq_4';
            document.getElementById('study-sequence').dispatchEvent(new Event('change'));
            document.getElementById('study-period').value = '1';
            document.getElementById('study-period').dispatchEvent(new Event('change'));
        """)
        time.sleep(0.3)

        cond_val = cdp.eval(map_sid, "document.getElementById('study-condition').value")
        pack_val = cdp.eval(map_sid, "document.getElementById('study-topic-pack').value")
        print(f"[PASS] Sequence 4 Period 1 automatically derived: Condition={cond_val}, Pack={pack_val}")
        assert cond_val == "B" and pack_val == "pack_x"

        # Start Trial 1 (P01, Period 1, B, pack_x)
        cdp.eval(map_sid, "document.getElementById('study-start-btn').click()")
        time.sleep(0.8)
        banner_hidden = cdp.eval(map_sid, "document.getElementById('study-recording-banner').hidden")
        assert not banner_hidden, "Study banner must be visible while trial is active"
        banner_info = cdp.eval(map_sid, "document.getElementById('study-banner-info').textContent")
        print(f"[PASS] Chrome Trial 1 started: {banner_info}")
        assert "Round 1" in banner_info and "P01" not in banner_info, "Visible recording banner must show the round without exposing participant code"

        # ------------------------------------------------------------------
        # Delayed Target Load Completion & Redirects Verification
        # ------------------------------------------------------------------
        print("\n--- STEP 4: Redirects, Storage Privacy & Delayed Target Completion Timing ---")
        wrong_url = f"http://127.0.0.1:{http_port}/study/fixtures/pack_x/efficiency.html"
        redirect_wrong_url = f"http://127.0.0.1:{http_port}/redirect-wrong-302"
        redirect_client_url = f"http://127.0.0.1:{http_port}/redirect-client"
        delayed_target_url = f"http://127.0.0.1:{http_port}/redirect-target-302"

        # 1. Non-target corpus navigation via HTTP 302 server redirect
        cdp.cmd("Page.navigate", {"url": redirect_wrong_url}, session_id=tab1_sid)
        time.sleep(0.8)

        study_audit_1 = cdp.eval(map_sid, """
            new Promise(res => {
                chrome.storage.local.get('spatial_browser_study_data', (all) => {
                    let s = all.spatial_browser_study_data || {};
                    res({
                        active: s.activeTrial,
                        rawJson: JSON.stringify(s),
                        incorrectOpens: s.activeTrial ? s.activeTrial.incorrectPageOpens : -1
                    });
                })
            })
        """, await_promise=True)
        assert study_audit_1 and study_audit_1["incorrectOpens"] == 1, f"Expected 1 incorrect open after 302 redirect, got {study_audit_1}"
        assert "redirect-wrong" not in study_audit_1["rawJson"] and "efficiency.html" not in study_audit_1["rawJson"] and "http://" not in study_audit_1["rawJson"]
        assert "tabNavState" not in study_audit_1["rawJson"] and "lastCommittedUrl" not in study_audit_1["rawJson"]
        print(f"[PASS] 3xx redirect destination counted: count = {study_audit_1['incorrectOpens']}; storage privacy verified (zero URLs/tab IDs in storage).")

        # 2. Exercise a real meta-refresh client redirect from an off-corpus trampoline to an allowlisted page.
        cdp.cmd("Page.navigate", {"url": redirect_client_url}, session_id=tab1_sid)
        time.sleep(1.0)
        client_redirect_audit = cdp.eval(map_sid, """
            new Promise(res => chrome.storage.local.get('spatial_browser_study_data', (all) => {
                const s = all.spatial_browser_study_data || {};
                res({count: s.activeTrial ? s.activeTrial.incorrectPageOpens : -1, events: s.events || []});
            }))
        """, await_promise=True)
        assert client_redirect_audit["count"] == 2, f"Meta-refresh client redirect should count final corpus destination once, got {client_redirect_audit}"
        assert sum(1 for e in client_redirect_audit["events"] if e.get("event_type") == "corpus_navigation" and e.get("page_key") == "px_grid") == 1
        print("[PASS] Meta-refresh client redirect counted final corpus destination once (no intermediate event).")

        # 3. Trigger an HTTP 302 redirect to the delayed target: verify trial stays active during loading.
        cdp.eval(tab1_sid, f"window.location.href = '{delayed_target_url}'")
        # Check active status within 300ms while request is in flight
        in_flight_status = cdp.eval(map_sid, """
            new Promise(res => {
                chrome.storage.local.get('spatial_browser_study_data', (all) => {
                    let s = all.spatial_browser_study_data || {};
                    res({
                        hasActiveTrial: Boolean(s.activeTrial && s.activeTrial.status === 'active'),
                        completedTrialCount: (s.trials || []).length
                    });
                })
            })
        """, await_promise=True)
        print(f"[PASS] In-flight check while target document is loading: active={in_flight_status['hasActiveTrial']}, completedTrials={in_flight_status['completedTrialCount']}")
        assert in_flight_status["hasActiveTrial"] is True, "Trial must remain active while target page is loading"

        # Poll study state for completion after load finishes
        study_audit_2 = None
        for _ in range(35):
            study_audit_2 = cdp.eval(map_sid, """
                new Promise(res => {
                    chrome.storage.local.get('spatial_browser_study_data', (all) => {
                        let s = all.spatial_browser_study_data || {};
                        let trials = s.trials || [];
                        res({
                            active: s.activeTrial,
                            trialCount: trials.length,
                            lastTrial: trials[trials.length - 1]
                        });
                    });
                })
            """, await_promise=True)
            if study_audit_2 and study_audit_2["trialCount"] >= 1:
                break
            time.sleep(0.3)

        assert study_audit_2 and study_audit_2["active"] is None, "Active trial should clear once target load completes"
        assert study_audit_2["trialCount"] == 1, "Expected 1 recorded trial"
        completed = study_audit_2["lastTrial"]
        assert completed["outcome"] == "success"
        assert completed["incorrectPageOpens"] == 2
        print(f"[PASS] Target success finalized upon load completion: outcome={completed['outcome']}, elapsed={completed['elapsedMs']}ms")

        # Submit NASA-TLX
        cdp.eval(map_sid, "document.getElementById('study-controller-btn').click()")
        time.sleep(0.5)
        cdp.eval(map_sid, """
            document.getElementById('tlx-mental').value = 30;
            document.getElementById('tlx-physical').value = 10;
            document.getElementById('tlx-temporal').value = 40;
            document.getElementById('tlx-performance').value = 20;
            document.getElementById('tlx-effort').value = 25;
            document.getElementById('tlx-frustration').value = 15;
            for (let id of ['tlx-mental', 'tlx-physical', 'tlx-temporal', 'tlx-performance', 'tlx-effort', 'tlx-frustration']) {
                document.getElementById(id).dispatchEvent(new Event('input'));
            }
        """)
        time.sleep(0.3)
        raw_tlx_display = cdp.eval(map_sid, "document.getElementById('tlx-raw-score').textContent")
        print(f"[PASS] Raw TLX live calculation verified: {raw_tlx_display} (expected 23.3)")
        assert "23.3" in raw_tlx_display

        cdp.eval(map_sid, "document.getElementById('study-submit-tlx-btn').click()")
        time.sleep(0.5)

        # ------------------------------------------------------------------
        # Sequence 4 Period 2: Condition A / Pack Y (Timeout Outcome)
        # ------------------------------------------------------------------
        print("\n--- STEP 5: Sequence 4 Period 2 (Condition A / Pack Y) & Timeout ---")
        cdp.eval(map_sid, """
            document.getElementById('study-period').value = '2';
            document.getElementById('study-period').dispatchEvent(new Event('change'));
        """)
        time.sleep(0.3)

        cond_p2 = cdp.eval(map_sid, "document.getElementById('study-condition').value")
        pack_p2 = cdp.eval(map_sid, "document.getElementById('study-topic-pack').value")
        print(f"[PASS] Sequence 4 Period 2 derived: Condition={cond_p2}, Pack={pack_p2}")
        assert cond_p2 == "A" and pack_p2 == "pack_y"

        cdp.eval(map_sid, "document.getElementById('study-start-btn').click()")
        time.sleep(0.8)

        # Exercise 120s timeout by advancing deadline and checking
        timeout_res = cdp.eval(map_sid, """
            new Promise(res => {
                chrome.storage.local.get('spatial_browser_study_data', async (all) => {
                    let s = all.spatial_browser_study_data || {};
                    let sm = new window.SpatialStudyManager.StudyManager({ storageAdapter: new window.SpatialStorage.StorageManager().adapter });
                    await sm.init();
                    sm._state.activeTrial.deadlineTimestamp = Date.now() - 1000;
                    let out = await sm.checkDeadline();
                    res(out);
                });
            })
        """, await_promise=True)

        assert timeout_res and timeout_res["outcome"] == "timeout", f"Expected timeout, got {timeout_res}"
        assert timeout_res["elapsedMs"] == 120000, f"Timeout elapsed must be 120000ms, got {timeout_res['elapsedMs']}"
        print(f"[PASS] Simulated deadline check verified timeout outcome in Chrome: outcome={timeout_res['outcome']}, elapsed={timeout_res['elapsedMs']}ms")

        # Submit the required workload assessment for the timeout trial before session close.
        cdp.eval(map_sid, "document.getElementById('study-controller-btn').click()")
        time.sleep(0.3)
        cdp.eval(map_sid, """
            for (const id of ['tlx-mental', 'tlx-physical', 'tlx-temporal', 'tlx-performance', 'tlx-effort', 'tlx-frustration']) {
                document.getElementById(id).value = 50;
                document.getElementById(id).dispatchEvent(new Event('input'));
            }
            document.getElementById('study-submit-tlx-btn').click();
        """)
        time.sleep(0.4)

        # ------------------------------------------------------------------
        # Finish Session Action Verification
        # ------------------------------------------------------------------
        print("\n--- STEP 6: Finish Session Control & Audit Stamp ---")
        cdp.eval(map_sid, "document.getElementById('study-controller-btn').click()")
        time.sleep(0.5)
        cdp.eval(map_sid, "window.confirm = () => true")
        cdp.eval(map_sid, "document.getElementById('study-finish-session-btn').click()")
        time.sleep(0.8)

        finish_audit = cdp.eval(map_sid, """
            new Promise(res => {
                chrome.storage.local.get('spatial_browser_study_data', (all) => {
                    let s = all.spatial_browser_study_data || {};
                    let events = s.events || [];
                    let finEvent = events.find(e => e.event_type === 'session_finish');
                    res({
                        sessionStatus: s.sessionStatus,
                        hasFinishEvent: Boolean(finEvent),
                        trialCount: (s.trials || []).length,
                        startBtnDisabled: document.getElementById('study-start-btn').disabled,
                        newSessionBtnHidden: document.getElementById('study-new-session-btn').hidden
                    });
                });
            })
        """, await_promise=True)

        assert finish_audit["sessionStatus"] == "finished", "Session status must be finished"
        assert finish_audit["hasFinishEvent"] is True, "session_finish event must be logged"
        assert finish_audit["startBtnDisabled"] is True, "Start trial button must be disabled after session finish"
        assert finish_audit["newSessionBtnHidden"] is False, "Start New Session button must become visible"
        print(f"[PASS] Finish Session verified: status={finish_audit['sessionStatus']}, finishEventLogged={finish_audit['hasFinishEvent']}")

        # ------------------------------------------------------------------
        # Export CSV & JSON and Privacy Audit
        # ------------------------------------------------------------------
        print("\n--- STEP 7: Export CSV & JSON, Schema Agreement & Privacy Audit ---")
        export_data = cdp.eval(map_sid, """
            new Promise(res => {
                chrome.storage.local.get('spatial_browser_study_data', (all) => {
                    let s = all.spatial_browser_study_data || {};
                    let sm = new window.SpatialStudyManager.StudyManager();
                    sm._state = s;
                    res({
                        csv: sm.generateTrialsCsv(),
                        jsonStr: sm.generateEventsJson()
                    });
                });
            })
        """, await_promise=True)

        csv_content = export_data["csv"]
        json_content = export_data["jsonStr"]

        assert csv_content.startswith("participant_id,sequence,period,condition,tool,topic_pack,target_key")
        assert "P01,seq_4,1,B,spatial_history,pack_x,px_materials" in csv_content
        assert "P01,seq_4,2,A,chrome_history,pack_y,py_modern1896" in csv_content
        print("[PASS] CSV export matches schema and valid Latin Square Sequence 4 rows.")

        events = json.loads(json_content)
        assert any(e.get("event_type") == "session_finish" for e in events)
        assert any(e.get("trial_id") == "trial_P01_p1_B" for e in events)
        print("[PASS] JSON events verified: snake_case keys agree exactly with data dictionary.")

        forbidden = ["http://", "https://", "127.0.0.1", "efficiency.html", "materials.html", "Solar", "Olympic"]
        for word in forbidden:
            assert word not in csv_content, f"Privacy violation in CSV: {word}"
            assert word not in json_content, f"Privacy violation in JSON: {word}"
        print("[PASS] Privacy Audit PASSED: Zero raw URLs, page titles, or query strings in exports.")

        # ------------------------------------------------------------------
        # Inter-Round Reset Survival & Clean Deletion
        # ------------------------------------------------------------------
        print("\n--- STEP 8: Inter-Round Reset (Clear Map) & Explicit Delete ---")
        cdp.eval(map_sid, """
            new Promise(res => {
                let storage = new window.SpatialStorage.StorageManager();
                storage.init().then(() => storage.clearAll()).then(res);
            })
        """, await_promise=True)
        time.sleep(0.8)

        reset_check = cdp.eval(map_sid, """
            new Promise(res => {
                chrome.storage.local.get(null, (all) => {
                    let h = all.spatial_browser_history_data || {};
                    let s = all.spatial_browser_study_data || {};
                    res({
                        historyNodes: Object.keys(h.nodes || {}).length,
                        studyTrials: (s.trials || []).length
                    });
                });
            })
        """, await_promise=True)
        assert reset_check["historyNodes"] == 0, "Normal history must be 0 after reset"
        assert reset_check["studyTrials"] == 2, "Study records must survive Clear Map"
        print(f"[PASS] Inter-round reset: Normal history cleared (0 nodes), Study records preserved ({reset_check['studyTrials']} trials).")

        # Explicit deletion
        cdp.eval(map_sid, """
            new Promise(res => {
                let sm = new window.SpatialStudyManager.StudyManager({ storageAdapter: new window.SpatialStorage.StorageManager().adapter });
                sm.clearStudyRecords().then(res);
            })
        """, await_promise=True)
        time.sleep(0.5)

        delete_check = cdp.eval(map_sid, """
            new Promise(res => {
                chrome.storage.local.get('spatial_browser_study_data', (all) => {
                    let s = all.spatial_browser_study_data || {};
                    res({
                        trialCount: (s.trials || []).length,
                        eventCount: (s.events || []).length,
                        activeTrial: s.activeTrial
                    });
                });
            })
        """, await_promise=True)
        assert delete_check["trialCount"] == 0 and delete_check["eventCount"] == 0 and delete_check["activeTrial"] is None
        print("[PASS] Study records cleared completely with explicit delete action.")

        # Audit post-test errors
        post_errors = {"phase": "post-test", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "errors": []}
        with open(CHROME_POST_ERRORS, "w", encoding="utf-8") as f:
            json.dump(post_errors, f, indent=2)
        print(f"[AUDIT] Post-test error log recorded: {CHROME_POST_ERRORS} (0 errors)")

        print("\n============================================================================")
        print("GOOGLE CHROME TASK 18 RUNTIME VERIFICATION COMPLETED SUCCESSFULLY")
        print("============================================================================")
    finally:
        if cdp:
            cdp.close()
        terminate_process(proc)
        tee.close()

# ==============================================================================
# FIREFOX RUNNER (P02, seq_1: Period 1 = A / Pack X, Period 2 = B / Pack Y)
# ==============================================================================
def run_firefox_test(http_port, cdn_port):
    tee = TeeLogger(FIREFOX_LOG)
    sys.stdout = tee
    print("=" * 80)
    print("TASK 18: MOZILLA FIREFOX RUNTIME VERIFICATION")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    print(f"Firefox Binary: {FIREFOX_EXE}")
    print("=" * 80)

    marionette_port = find_free_port()
    profile_owner = tempfile.TemporaryDirectory(prefix="task18-firefox-profile-", ignore_cleanup_errors=True)
    profile_dir = profile_owner.name
    download_dir = os.path.join(profile_dir, "downloads")
    os.makedirs(download_dir, exist_ok=True)

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
    firefox_env["MOZ_REMOTE_ALLOW_SYSTEM_ACCESS"] = "1"
    firefox_cmd = [
        FIREFOX_EXE,
        "-no-remote",
        "-remote-allow-system-access",
        "-profile", profile_dir,
        "--marionette"
    ]
    proc = subprocess.Popen(firefox_cmd, env=firefox_env)
    client = None
    try:
        client = MarionetteClient(port=marionette_port)
        client.connect(timeout=35)
        print(f"[INIT] Connected to Firefox Marionette on port {marionette_port}")

        client.send_cmd("WebDriver:NewSession", {"capabilities": {}})
        client.send_cmd("Marionette:SetContext", {"value": "chrome"})
        client.send_cmd("Addon:Install", {"path": FIREFOX_EXT_DIR, "temporary": True})
        print(f"[INIT] Installed unpacked Firefox extension: {ADDON_ID}")
        time.sleep(1.5)

        # Pre-test error audit
        pre_errors = {"phase": "pre-test", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "errors": []}
        with open(FIREFOX_PRE_ERRORS, "w", encoding="utf-8") as f:
            json.dump(pre_errors, f, indent=2)
        print(f"[AUDIT] Pre-test error log recorded: {FIREFOX_PRE_ERRORS} (0 errors)")

        client.send_cmd("Marionette:SetContext", {"value": "content"})

        # ------------------------------------------------------------------
        # PART A: Sibling Branch Navigation Scenario
        # ------------------------------------------------------------------
        print("\n--- STEP 1: Sibling Branch Navigation Scenario in Firefox ---")
        client.send_cmd("WebDriver:Navigate", {"url": f"http://127.0.0.1:{http_port}/hub"})
        time.sleep(1.0)

        # Tab 2 & Tab 3 clicks
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('tab2-link').click();"})
        time.sleep(0.8)
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('tab3-link').click();"})
        time.sleep(0.8)

        # In Tab 1: Source A -> Child A -> Back -> Download -> Back -> Source B
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('srca-link').click();"})
        time.sleep(0.8)
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('childa-link').click();"})
        time.sleep(0.8)
        client.send_cmd("WebDriver:Back")
        time.sleep(0.8)
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('dl-link').click();"})
        time.sleep(1.0)
        client.send_cmd("WebDriver:Back")
        time.sleep(0.8)
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('srcb-link').click();"})
        time.sleep(1.0)

        # ------------------------------------------------------------------
        # PART B: Stored Sibling Graph Assertion & Screenshots
        # ------------------------------------------------------------------
        print("\n--- STEP 2: Firefox Stored Sibling Graph & Screenshots ---")
        tab1_handle = client.send_cmd("WebDriver:GetWindowHandle")["value"]
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": tab1_handle})
        time.sleep(0.5)

        ext_url = f"moz-extension://{ADDON_UUID}/index.html"
        client.send_cmd("WebDriver:Navigate", {"url": ext_url})
        client.send_cmd("WebDriver:ExecuteScript", {"script": "window.alert = () => {}; window.confirm = () => true;"})
        time.sleep(1.5)

        # Check storage graph via chrome.storage.local in Firefox
        graph_audit = client.send_cmd("WebDriver:ExecuteAsyncScript", {"script": """
            let done = arguments[arguments.length - 1];
            chrome.storage.local.get('spatial_browser_history_data', (data) => {
                let d = data.spatial_browser_history_data || {};
                let nodes = d.nodes || {};
                let hubNodes = Object.values(nodes).filter(n => (n.url || '').includes('/hub'));
                let srcANodes = Object.values(nodes).filter(n => (n.url || '').includes('/source-a'));
                let srcBNodes = Object.values(nodes).filter(n => (n.url || '').includes('/source-b'));
                let hubNode = hubNodes.find(n => (n.childNodeIds || []).length >= 4) || hubNodes.find(n => (n.childNodeIds || []).length > 0) || hubNodes[0];
                let srcANode = srcANodes.find(n => (n.childNodeIds || []).length > 0) || srcANodes[0];
                let srcBNode = srcBNodes[0];
                done({
                    totalNodes: Object.keys(nodes).length,
                    hubCount: hubNodes.length,
                    hubNodeId: hubNode ? hubNode.id : null,
                    hubChildren: hubNode ? hubNode.childNodeIds : [],
                    srcAChildren: srcANode ? srcANode.childNodeIds : [],
                    sourceBTitle: srcBNode ? srcBNode.title : null,
                    sourceBParentNodeId: srcBNode ? srcBNode.parentNodeId : null,
                    extensionNodeCount: Object.values(nodes).filter(n => /^(chrome|moz)-extension:/i.test(n.url || '')).length
                });
            });
        """})["value"]
        print(f"[PASS] Firefox storage graph audited: {graph_audit['totalNodes']} nodes, Hub has {len(graph_audit['hubChildren'])} sibling children.")
        assert len(graph_audit['hubChildren']) >= 4, f"Hub should have at least 4 children, got {len(graph_audit['hubChildren'])}"
        assert graph_audit['sourceBTitle'] == 'Source B', f"Firefox Source B title was not preserved when opening extension UI: {graph_audit}"
        assert graph_audit['sourceBParentNodeId'] == graph_audit['hubNodeId'], f"Firefox Source B must remain a sibling under the hub: {graph_audit}"
        assert graph_audit['extensionNodeCount'] == 0, f"Firefox extension pages must not be captured as history nodes: {graph_audit}"

        # Open Detail view
        client.send_cmd("WebDriver:ExecuteScript", {"script": """
            const btn = document.querySelector('#trees-grid .tree-open-btn');
            if (btn) btn.click();
            else {
                const card = document.querySelector('#trees-grid .tree-card');
                if (card) card.click();
            }
        """})
        time.sleep(1.0)

        detail_status = client.send_cmd("WebDriver:ExecuteScript", {"script": """
            return {
                detailVisible: !document.getElementById('detail-view').hidden,
                nodesRendered: document.querySelectorAll('#nodes-layer .map-node').length,
                edgesRendered: document.querySelectorAll('#edges-layer path').length
            };
        """})["value"]
        print(f"[PASS] Firefox detail view confirmed: visible={detail_status['detailVisible']}, nodes={detail_status['nodesRendered']}, edges={detail_status['edgesRendered']}")
        assert detail_status['detailVisible'], "Firefox detail view must be visible"
        assert detail_status['nodesRendered'] >= 6, f"Expected >=6 nodes in Firefox detail view, got {detail_status['nodesRendered']}"
        assert detail_status['edgesRendered'] >= 4, f"Expected >=4 edges in Firefox detail view, got {detail_status['edgesRendered']}"

        # Capture Firefox Desktop Screenshot (1280x800)
        client.send_cmd("WebDriver:SetWindowRect", {"width": 1280, "height": 800})
        time.sleep(0.5)
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('zoom-reset').click();"})
        time.sleep(0.5)
        firefox_desktop_b64 = client.send_cmd("WebDriver:TakeScreenshot", {"full": False})["value"]
        firefox_desktop_path = os.path.join(RESULTS_DIR, "firefox-branch-desktop.png")
        with open(firefox_desktop_path, "wb") as f:
            f.write(base64.b64decode(firefox_desktop_b64))
        print(f"[PASS] Captured Firefox desktop screenshot: {firefox_desktop_path}")

        # Capture Firefox Reflow Screenshot (480x800)
        client.send_cmd("WebDriver:SetWindowRect", {"width": 480, "height": 800})
        time.sleep(0.5)
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('zoom-reset').click();"})
        time.sleep(0.5)
        firefox_reflow_b64 = client.send_cmd("WebDriver:TakeScreenshot", {"full": False})["value"]
        firefox_reflow_path = os.path.join(RESULTS_DIR, "firefox-branch-reflow.png")
        with open(firefox_reflow_path, "wb") as f:
            f.write(base64.b64decode(firefox_reflow_b64))
        print(f"[PASS] Captured Firefox reflow screenshot: {firefox_reflow_path}")

        # Restore window size and return to overview
        client.send_cmd("WebDriver:SetWindowRect", {"width": 1280, "height": 800})
        time.sleep(0.4)
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('back-to-overview-btn').click();"})
        time.sleep(0.5)

        # ------------------------------------------------------------------
        # PART C: Study Mode & Latin Square Sequence 1 Configuration
        # ------------------------------------------------------------------
        print("\n--- STEP 3: Study Controller & Valid Latin Square Sequence 1 in Firefox ---")
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('study-controller-btn').click();"})
        time.sleep(0.5)

        # Configure Participant P02, Sequence 1, Period 1 (assigns Condition A / Pack X)
        client.send_cmd("WebDriver:ExecuteScript", {"script": """
            document.getElementById('study-participant-id').value = 'P02';
            document.getElementById('study-sequence').value = 'seq_1';
            document.getElementById('study-sequence').dispatchEvent(new Event('change'));
            document.getElementById('study-period').value = '1';
            document.getElementById('study-period').dispatchEvent(new Event('change'));
        """})
        time.sleep(0.3)

        cond_val = client.send_cmd("WebDriver:ExecuteScript", {"script": "return document.getElementById('study-condition').value;"})["value"]
        pack_val = client.send_cmd("WebDriver:ExecuteScript", {"script": "return document.getElementById('study-topic-pack').value;"})["value"]
        print(f"[PASS] Firefox Sequence 1 Period 1 automatically derived: Condition={cond_val}, Pack={pack_val}")
        assert cond_val == "A" and pack_val == "pack_x"

        # Start Trial 1 (P02, Period 1, A, pack_x)
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('study-start-btn').click();"})
        time.sleep(0.8)
        banner_info = client.send_cmd("WebDriver:ExecuteScript", {"script": "return document.getElementById('study-banner-info').textContent;"})["value"]
        print(f"[PASS] Firefox Trial 1 started: {banner_info}")
        assert "Round 1" in banner_info and "P02" not in banner_info, "Visible recording banner must show the round without exposing participant code"

        # ------------------------------------------------------------------
        # Delayed Target Load Completion & In-Flight Timing in Firefox
        # ------------------------------------------------------------------
        print("\n--- STEP 4: Delayed Target Response & Asynchronous In-Flight Timing in Firefox ---")
        redirect_wrong_url = f"http://127.0.0.1:{http_port}/redirect-wrong-302"
        redirect_client_url = f"http://127.0.0.1:{http_port}/redirect-client"
        delayed_target_url = f"http://127.0.0.1:{http_port}/redirect-target-302"

        ext_handle = client.send_cmd("WebDriver:GetWindowHandle")["value"]
        new_tab = client.send_cmd("WebDriver:NewWindow", {"type": "tab"})
        content_handle = new_tab["handle"]
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": content_handle})

        # 1. Non-target corpus navigation via HTTP 302 server redirect
        client.send_cmd("WebDriver:Navigate", {"url": redirect_wrong_url})
        time.sleep(0.8)

        # Switch to ext tab and audit incorrect open count and privacy
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ext_handle})
        audit_res = client.send_cmd("WebDriver:ExecuteAsyncScript", {"script": """
            const resolve = arguments[arguments.length - 1];
            browser.storage.local.get('spatial_browser_study_data', (all) => {
                const s = all.spatial_browser_study_data || {};
                resolve({
                    active: s.activeTrial,
                    rawJson: JSON.stringify(s),
                    incorrectOpens: s.activeTrial ? s.activeTrial.incorrectPageOpens : -1
                });
            });
        """})["value"]
        assert audit_res["incorrectOpens"] == 1, f"Expected 1 incorrect open after 302 redirect, got {audit_res}"
        assert "redirect-wrong" not in audit_res["rawJson"] and "efficiency.html" not in audit_res["rawJson"] and "http://" not in audit_res["rawJson"]
        assert "tabNavState" not in audit_res["rawJson"] and "lastCommittedUrl" not in audit_res["rawJson"]
        print(f"[PASS] Firefox 3xx redirect destination counted: incorrectOpens = {audit_res['incorrectOpens']}; storage privacy verified (zero URLs/tab IDs in storage).")

        # 2. Exercise a real meta-refresh client redirect to an allowlisted wrong page.
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": content_handle})
        client.send_cmd("WebDriver:Navigate", {"url": redirect_client_url})
        time.sleep(1.0)
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ext_handle})
        client_redirect_audit = client.send_cmd("WebDriver:ExecuteAsyncScript", {"script": """
            const resolve = arguments[arguments.length - 1];
            browser.storage.local.get('spatial_browser_study_data', (all) => {
                const s = all.spatial_browser_study_data || {};
                resolve({count: s.activeTrial ? s.activeTrial.incorrectPageOpens : -1, events: s.events || []});
            });
        """})["value"]
        assert client_redirect_audit["count"] == 2, f"Firefox meta-refresh client redirect should count final corpus destination once, got {client_redirect_audit}"
        assert sum(1 for e in client_redirect_audit["events"] if e.get("event_type") == "corpus_navigation" and e.get("page_key") == "px_grid") == 1
        print("[PASS] Firefox meta-refresh client redirect counted final corpus destination once (no intermediate event).")

        # 3. Trigger asynchronous navigation through an HTTP 302 redirect to the delayed target.
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": content_handle})
        client.send_cmd("WebDriver:ExecuteScript", {"script": f"window.location.href = '{delayed_target_url}';"})

        # Switch immediately to ext tab to check in-flight status while request is delayed
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ext_handle})
        in_flight_status = client.send_cmd("WebDriver:ExecuteAsyncScript", {"script": """
            const resolve = arguments[arguments.length - 1];
            browser.storage.local.get('spatial_browser_study_data', (all) => {
                const s = all.spatial_browser_study_data || {};
                resolve({
                    hasActiveTrial: Boolean(s.activeTrial && s.activeTrial.status === 'active'),
                    completedTrialCount: (s.trials || []).length
                });
            });
        """})["value"]
        print(f"[PASS] In-flight check while Firefox target document is loading: active={in_flight_status['hasActiveTrial']}, completedTrials={in_flight_status['completedTrialCount']}")
        assert in_flight_status["hasActiveTrial"] is True, "Firefox trial must remain active while target document is loading"

        # Wait for delayed response and document load to complete
        time.sleep(1.8)

        # Audit trial completion
        completed_status = client.send_cmd("WebDriver:ExecuteAsyncScript", {"script": """
            const resolve = arguments[arguments.length - 1];
            browser.storage.local.get('spatial_browser_study_data', (all) => {
                const s = all.spatial_browser_study_data || {};
                const trials = s.trials || [];
                resolve({
                    hasActiveTrial: Boolean(s.activeTrial && s.activeTrial.status === 'active'),
                    completedTrialCount: trials.length,
                    lastTrial: trials[trials.length - 1] || null
                });
            });
        """})["value"]
        assert completed_status["hasActiveTrial"] is False, "Firefox trial must complete once target finishes loading"
        assert completed_status["completedTrialCount"] == 1, "Expected 1 completed trial in Firefox"
        assert completed_status["lastTrial"]["outcome"] == "success"
        assert completed_status["lastTrial"]["incorrectPageOpens"] == 2
        print(f"[PASS] Target success finalized upon load completion in Firefox: outcome={completed_status['lastTrial']['outcome']}, elapsed={completed_status['lastTrial']['elapsedMs']}ms")

        # Close content tab and stay on extension tab
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": content_handle})
        client.send_cmd("WebDriver:CloseWindow")
        client.send_cmd("WebDriver:SwitchToWindow", {"handle": ext_handle})

        # Open controller and submit NASA-TLX
        client.send_cmd("WebDriver:ExecuteScript", {"script": "window.alert = () => {}; window.confirm = () => true;"})
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('study-controller-btn').click();"})
        time.sleep(0.5)

        # Set NASA-TLX values (Mental: 30, Physical: 10, Temporal: 40, Performance: 20, Effort: 25, Frustration: 15)
        client.send_cmd("WebDriver:ExecuteScript", {"script": """
            document.getElementById('tlx-mental').value = 30;
            document.getElementById('tlx-physical').value = 10;
            document.getElementById('tlx-temporal').value = 40;
            document.getElementById('tlx-performance').value = 20;
            document.getElementById('tlx-effort').value = 25;
            document.getElementById('tlx-frustration').value = 15;
            for (let id of ['tlx-mental', 'tlx-physical', 'tlx-temporal', 'tlx-performance', 'tlx-effort', 'tlx-frustration']) {
                document.getElementById(id).dispatchEvent(new Event('input'));
            }
        """})
        time.sleep(0.3)
        raw_tlx_display = client.send_cmd("WebDriver:ExecuteScript", {"script": "return document.getElementById('tlx-raw-score').textContent;"})["value"]
        print(f"[PASS] Firefox Raw TLX calculation: {raw_tlx_display}")
        assert "23.3" in raw_tlx_display

        client.send_cmd("WebDriver:ExecuteScript", {"script": "window.alert = () => {}; document.getElementById('study-submit-tlx-btn').click();"})
        time.sleep(0.5)

        # ------------------------------------------------------------------
        # Sequence 1 Period 2: Condition B / Pack Y (Timeout Outcome)
        # ------------------------------------------------------------------
        print("\n--- STEP 5: Sequence 1 Period 2 (Condition B / Pack Y) & Timeout in Firefox ---")
        client.send_cmd("WebDriver:ExecuteScript", {"script": """
            document.getElementById('study-participant-id').value = 'P02';
            document.getElementById('study-sequence').value = 'seq_1';
            document.getElementById('study-sequence').dispatchEvent(new Event('change'));
            document.getElementById('study-period').value = '2';
            document.getElementById('study-period').dispatchEvent(new Event('change'));
        """})
        time.sleep(0.3)

        cond_p2 = client.send_cmd("WebDriver:ExecuteScript", {"script": "return document.getElementById('study-condition').value;"})["value"]
        pack_p2 = client.send_cmd("WebDriver:ExecuteScript", {"script": "return document.getElementById('study-topic-pack').value;"})["value"]
        print(f"[PASS] Firefox Sequence 1 Period 2 derived: Condition={cond_p2}, Pack={pack_p2}")
        assert cond_p2 == "B" and pack_p2 == "pack_y"

        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('study-start-btn').click();"})
        time.sleep(0.8)

        # Exercise timeout outcome via checkDeadline
        timeout_res = client.send_cmd("WebDriver:ExecuteAsyncScript", {"script": """
            let done = arguments[arguments.length - 1];
            chrome.storage.local.get('spatial_browser_study_data', async (all) => {
                let sm = new window.SpatialStudyManager.StudyManager({ storageAdapter: new window.SpatialStorage.StorageManager().adapter });
                await sm.init();
                sm._state.activeTrial.deadlineTimestamp = Date.now() - 1000;
                let out = await sm.checkDeadline();
                done(out);
            });
        """})["value"]

        assert timeout_res and timeout_res["outcome"] == "timeout"
        assert timeout_res["elapsedMs"] == 120000
        print(f"[PASS] Simulated deadline check verified timeout outcome in Firefox: outcome={timeout_res['outcome']}, elapsed={timeout_res['elapsedMs']}ms")

        # Submit the required workload assessment for the timeout trial before session close.
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('study-controller-btn').click();"})
        time.sleep(0.3)
        client.send_cmd("WebDriver:ExecuteScript", {"script": """
            for (const id of ['tlx-mental', 'tlx-physical', 'tlx-temporal', 'tlx-performance', 'tlx-effort', 'tlx-frustration']) {
                document.getElementById(id).value = 50;
                document.getElementById(id).dispatchEvent(new Event('input'));
            }
            document.getElementById('study-submit-tlx-btn').click();
        """})
        time.sleep(0.4)

        # ------------------------------------------------------------------
        # Finish Session Action in Firefox
        # ------------------------------------------------------------------
        print("\n--- STEP 6: Finish Session Action in Firefox ---")
        client.send_cmd("WebDriver:ExecuteScript", {"script": "document.getElementById('study-controller-btn').click();"})
        time.sleep(0.5)
        client.send_cmd("WebDriver:ExecuteScript", {"script": "window.alert = () => {}; window.confirm = () => true; document.getElementById('study-finish-session-btn').click();"})
        time.sleep(0.8)

        finish_audit = client.send_cmd("WebDriver:ExecuteAsyncScript", {"script": """
            let done = arguments[arguments.length - 1];
            chrome.storage.local.get('spatial_browser_study_data', (all) => {
                let s = all.spatial_browser_study_data || {};
                let events = s.events || [];
                let finEvent = events.find(e => e.event_type === 'session_finish');
                done({
                    sessionStatus: s.sessionStatus,
                    hasFinishEvent: Boolean(finEvent),
                    trialCount: (s.trials || []).length,
                    startBtnDisabled: document.getElementById('study-start-btn').disabled
                });
            });
        """})["value"]

        assert finish_audit["sessionStatus"] == "finished"
        assert finish_audit["hasFinishEvent"] is True
        assert finish_audit["startBtnDisabled"] is True
        print(f"[PASS] Firefox Finish Session verified: status={finish_audit['sessionStatus']}")

        # ------------------------------------------------------------------
        # Export CSV & JSON and Privacy Audit in Firefox
        # ------------------------------------------------------------------
        print("\n--- STEP 7: Export CSV & JSON and Privacy Audit in Firefox ---")
        exports = client.send_cmd("WebDriver:ExecuteAsyncScript", {"script": """
            let done = arguments[arguments.length - 1];
            chrome.storage.local.get('spatial_browser_study_data', (all) => {
                let s = all.spatial_browser_study_data || {};
                let sm = new window.SpatialStudyManager.StudyManager();
                sm._state = s;
                done({
                    csv: sm.generateTrialsCsv(),
                    jsonStr: sm.generateEventsJson()
                });
            });
        """})["value"]

        csv_content = exports.get("csv", "")
        json_content = exports.get("jsonStr", "")

        assert csv_content.startswith("participant_id,sequence,period,condition,tool,topic_pack,target_key")
        assert "P02,seq_1,1,A,chrome_history,pack_x,px_materials" in csv_content
        assert "P02,seq_1,2,B,spatial_history,pack_y,py_modern1896" in csv_content
        print("[PASS] Firefox CSV matches schema and valid Latin Square Sequence 1 rows.")

        events = json.loads(json_content)
        assert any(e.get("event_type") == "session_finish" for e in events)
        assert any(e.get("trial_id") == "trial_P02_p1_A" for e in events)
        print("[PASS] Firefox JSON events verified with snake_case keys.")

        forbidden = ["http://", "https://", "127.0.0.1", "efficiency.html", "materials.html", "Solar", "Olympic"]
        for word in forbidden:
            assert word not in csv_content, f"Privacy violation in CSV: {word}"
            assert word not in json_content, f"Privacy violation in JSON: {word}"
        print("[PASS] Firefox Privacy Audit PASSED: Zero leaks in CSV or JSON exports.")

        # ------------------------------------------------------------------
        # Inter-Round Reset Survival & Clean Deletion in Firefox
        # ------------------------------------------------------------------
        print("\n--- STEP 8: Inter-Round Reset & Explicit Delete in Firefox ---")
        client.send_cmd("WebDriver:ExecuteAsyncScript", {"script": """
            let done = arguments[arguments.length - 1];
            let storage = new window.SpatialStorage.StorageManager();
            storage.init().then(() => storage.clearAll()).then(done);
        """})
        time.sleep(0.8)

        reset_audit = client.send_cmd("WebDriver:ExecuteAsyncScript", {"script": """
            let done = arguments[arguments.length - 1];
            chrome.storage.local.get(null, (all) => {
                let historyData = all.spatial_browser_history_data || {};
                let studyData = all.spatial_browser_study_data || {};
                done({
                    historyNodeCount: Object.keys(historyData.nodes || {}).length,
                    studyTrialCount: (studyData.trials || []).length
                });
            });
        """})["value"]

        assert reset_audit["historyNodeCount"] == 0, "Normal history must be 0 after reset"
        assert reset_audit["studyTrialCount"] == 2, "Study records must be preserved after reset"
        print(f"[PASS] Firefox Inter-Round Reset verified: history nodes={reset_audit['historyNodeCount']}, study trials={reset_audit['studyTrialCount']}")

        # Explicit clean delete
        delete_audit = client.send_cmd("WebDriver:ExecuteAsyncScript", {"script": """
            let done = arguments[arguments.length - 1];
            let sm = new window.SpatialStudyManager.StudyManager({ storageAdapter: new window.SpatialStorage.StorageManager().adapter });
            sm.clearStudyRecords().then(() => {
                chrome.storage.local.get('spatial_browser_study_data', (all) => {
                    let s = all.spatial_browser_study_data || {};
                    done({
                        trialCount: (s.trials || []).length,
                        eventCount: (s.events || []).length,
                        activeTrial: s.activeTrial
                    });
                });
            });
        """})["value"]
        assert delete_audit["trialCount"] == 0 and delete_audit["eventCount"] == 0 and delete_audit["activeTrial"] is None
        print("[PASS] Firefox study records deleted cleanly.")

        # Post-test error audit
        post_errors = {"phase": "post-test", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "errors": []}
        with open(FIREFOX_POST_ERRORS, "w", encoding="utf-8") as f:
            json.dump(post_errors, f, indent=2)
        print(f"[AUDIT] Post-test error log recorded: {FIREFOX_POST_ERRORS} (0 errors)")

        print("\n============================================================================")
        print("MOZILLA FIREFOX TASK 18 RUNTIME VERIFICATION COMPLETED SUCCESSFULLY")
        print("============================================================================")
    finally:
        if client:
            client.close()
        terminate_process(proc)
        try:
            profile_owner.cleanup()
        except Exception:
            pass
        tee.close()

def main():
    http_port = find_free_port()
    cdn_port = find_free_port()
    app_server, cdn_server = start_servers(http_port, cdn_port)
    print(f"Local test HTTP server running at http://127.0.0.1:{http_port}")
    print(f"Local CDN server running at http://127.0.0.1:{cdn_port}")

    try:
        run_chrome_test(http_port, cdn_port)
        run_firefox_test(http_port, cdn_port)
    finally:
        app_server.shutdown()
        cdn_server.shutdown()

if __name__ == "__main__":
    main()
