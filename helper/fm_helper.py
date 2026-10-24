#!/usr/bin/env python3
"""friendly-microman helper.

A small local server that does what a web page cannot do on its own:
  * serves the app at http://localhost:8765
  * lists USB serial ports and guesses which board is on each
  * installs libraries (pip, mpremote mip, arduino-cli)
  * compiles and uploads Arduino sketches (arduino-cli)
  * uploads MicroPython main.py (mpremote)
  * runs a Python program on a Raspberry Pi and streams its output

Only the Python standard library is required. Optional tools are used when found:
arduino-cli, mpremote (pip install mpremote) and pyserial (pip install pyserial).

Run:  python3 helper/fm_helper.py            then open http://localhost:8765
      python3 helper/fm_helper.py --host 0.0.0.0   to reach a Pi from another computer (trusted networks only)
"""
import argparse
import glob
import json
import os
import platform
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

VERSION = "0.1.0"
ROOT = Path(__file__).resolve().parent.parent
WORK = Path.home() / ".friendly-microman"
VENV = Path.home() / "fm-env"
TOKEN = secrets.token_urlsafe(24)

BOARD_URLS = {
    "esp32": "https://espressif.github.io/arduino-esp32/package_esp32_index.json",
    "esp8266": "https://arduino.esp8266.com/stable/package_esp8266com_index.json",
    "rp2040": "https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json",
}
USB_GUESS = {
    0x2E8A: "Raspberry Pi Pico", 0x2341: "Arduino", 0x2A03: "Arduino", 0x10C4: "CP210x (ESP32 / ESP8266)",
    0x1A86: "CH340 (Arduino clone / ESP)", 0x0403: "FTDI serial", 0x303A: "Espressif ESP32",
}
SAFE_PKG = re.compile(r"^[A-Za-z0-9 ._:/@<>=+~-]{1,160}$")
SAFE_FQBN = re.compile(r"^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.=,-]+$")
SAFE_PORT = re.compile(r"^(/dev/[A-Za-z0-9._-]+|COM[0-9]{1,3})$")


def tool(name):
    return shutil.which(name)


def run(cmd, timeout=900, cwd=None):
    """Run a command (a list, never a shell string) and return (ok, output)."""
    try:
        p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=timeout, cwd=cwd)
        return p.returncode == 0, "$ " + " ".join(cmd) + "\n" + p.stdout
    except FileNotFoundError:
        return False, cmd[0] + " is not installed."
    except subprocess.TimeoutExpired:
        return False, "Timed out: " + " ".join(cmd)


def is_pi():
    try:
        return "Raspberry Pi" in Path("/proc/device-tree/model").read_text(errors="ignore")
    except OSError:
        return False


def pi_python():
    """Python for running user programs: the ~/fm-env venv (made on first use) on a Pi."""
    py = VENV / "bin" / "python"
    if py.exists():
        return str(py)
    if is_pi():
        ok, _ = run([sys.executable, "-m", "venv", "--system-site-packages", str(VENV)], timeout=300)
        if ok and py.exists():
            return str(py)
    return sys.executable


def list_ports():
    ports = []
    try:
        from serial.tools import list_ports as lp  # pyserial
        for p in lp.comports():
            ports.append({"device": p.device, "description": p.description or "", "vid": p.vid, "guess": USB_GUESS.get(p.vid, "")})
        return ports
    except ImportError:
        pass
    if tool("arduino-cli"):
        ok, out = run(["arduino-cli", "board", "list", "--format", "json"], timeout=30)
        try:
            data = json.loads(out.split("\n", 1)[1])
            items = data.get("detected_ports", data) if isinstance(data, dict) else data
            for item in items:
                port = item.get("port", item)
                props = port.get("properties", {})
                vid = int(props.get("vid", "0"), 16) if props.get("vid") else None
                boards = item.get("matching_boards") or []
                ports.append({"device": port.get("address"), "description": port.get("label", ""), "vid": vid,
                              "guess": boards[0]["name"] if boards else USB_GUESS.get(vid, "")})
            return [p for p in ports if p["device"]]
        except (ValueError, IndexError, KeyError, AttributeError):
            pass
    for dev in sorted(glob.glob("/dev/ttyACM*") + glob.glob("/dev/ttyUSB*") + glob.glob("/dev/cu.usb*")):
        ports.append({"device": dev, "description": "", "vid": None, "guess": ""})
    return ports


def board_url(fqbn):
    return BOARD_URLS.get(fqbn.split(":")[0])


def ensure_core(fqbn, log):
    core = ":".join(fqbn.split(":")[:2])
    url = board_url(fqbn)
    extra = ["--additional-urls", url] if url else []
    ok, out = run(["arduino-cli", "core", "list", "--format", "json"] + extra, timeout=60)
    if ok and ('"' + core + '"') in out:
        return True
    log.append("Installing board support for " + core + " (only the first time)...")
    ok, out = run(["arduino-cli", "core", "update-index"] + extra, timeout=600)
    log.append(out)
    ok, out = run(["arduino-cli", "core", "install", core] + extra, timeout=1800)
    log.append(out)
    return ok


# ----- running Python programs (Pi) -----
class Runner:
    def __init__(self):
        self.proc = None
        self.text = ""
        self.lock = threading.Lock()

    def start(self, code):
        self.stop()
        folder = Path.home() / "friendly-microman"
        folder.mkdir(exist_ok=True)
        path = folder / "program.py"
        path.write_text(code)
        with self.lock:
            self.text = "Running " + str(path) + "\n"
        self.proc = subprocess.Popen([pi_python(), "-u", str(path)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=str(folder))
        threading.Thread(target=self._pump, args=(self.proc,), daemon=True).start()
        return str(path)

    def _pump(self, proc):
        for line in proc.stdout:
            with self.lock:
                self.text = (self.text + line)[-200000:]
        proc.wait()
        with self.lock:
            self.text += "\n[program ended with code %s]\n" % proc.returncode

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()

    def running(self):
        return bool(self.proc and self.proc.poll() is None)


RUNNER = Runner()


class Handler(SimpleHTTPRequestHandler):
    server_version = "friendly-microman/" + VERSION

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):
        if "/api/log" not in str(args[0] if args else ""):
            sys.stderr.write("  " + (fmt % args) + "\n")

    # ----- safety checks -----
    def host_ok(self):
        host = (self.headers.get("Host") or "").split(":")[0].strip("[]")
        return host in self.server.allowed_hosts

    def origin_ok(self):
        origin = self.headers.get("Origin")
        return origin is None or origin in self.server.allowed_origins

    def cors(self):
        origin = self.headers.get("Origin")
        if origin and origin in self.server.allowed_origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-FM-Token")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Vary", "Origin")

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        if not (self.host_ok() and self.origin_ok()):
            self.send_response(403)
            self.end_headers()
            return
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_GET(self):
        if not self.host_ok():
            self.send_error(403, "Unknown host")
            return
        url = urlparse(self.path)
        if not url.path.startswith("/api/"):
            return super().do_GET()
        if not self.origin_ok():
            return self.send_json({"error": "This page is not allowed to use the helper."}, 403)
        q = parse_qs(url.query)
        if url.path == "/api/status":
            return self.send_json({"version": VERSION, "platform": platform.system(), "pi": is_pi(), "tools": {
                "arduino-cli": bool(tool("arduino-cli")), "mpremote": bool(tool("mpremote")),
                "espeak-ng": bool(tool("espeak-ng")), "python": True}})
        if url.path == "/api/token":
            # Same-origin pages send no Origin on GET; browsers block other sites from reading this answer.
            if self.headers.get("Sec-Fetch-Site") not in (None, "same-origin", "none"):
                return self.send_json({"error": "Open the app from the helper's own address."}, 403)
            return self.send_json({"token": TOKEN})
        if not self.token_ok():
            return self.send_json({"error": "Missing helper token. Open the app from http://localhost:%d." % self.server.server_port}, 401)
        if url.path == "/api/ports":
            return self.send_json({"ports": list_ports()})
        if url.path == "/api/log":
            since = int((q.get("since") or ["0"])[0] or 0)
            with RUNNER.lock:
                text = RUNNER.text
            since = min(since, len(text))
            return self.send_json({"text": text[since:], "next": len(text), "running": RUNNER.running()})
        if url.path == "/api/libs/list":
            kind = (q.get("kind") or [""])[0]
            if kind == "arduino":
                ok, out = run(["arduino-cli", "lib", "list"], timeout=60)
            else:
                ok, out = run([pi_python(), "-m", "pip", "list"], timeout=60)
            return self.send_json({"ok": ok, "output": out})
        return self.send_json({"error": "Unknown address"}, 404)

    def token_ok(self):
        return secrets.compare_digest(self.headers.get("X-FM-Token", ""), TOKEN)

    def do_POST(self):
        if not (self.host_ok() and self.origin_ok()):
            return self.send_json({"error": "Not allowed"}, 403)
        if not self.token_ok():
            return self.send_json({"error": "Missing helper token. Open the app from http://localhost:%d." % self.server.server_port}, 401)
        length = int(self.headers.get("Content-Length") or 0)
        if length > 2_000_000:
            return self.send_json({"error": "Too big"}, 413)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            return self.send_json({"error": "Bad JSON"}, 400)
        path = urlparse(self.path).path
        try:
            handler = {
                "/api/libs/install": self.install_lib,
                "/api/arduino/upload": self.arduino_upload,
                "/api/micropython/upload": self.mp_upload,
                "/api/python/run": self.python_run,
                "/api/python/stop": self.python_stop,
            }.get(path)
            if not handler:
                return self.send_json({"error": "Unknown address"}, 404)
            return self.send_json(handler(body))
        except ValueError as e:
            return self.send_json({"error": str(e)}, 400)

    # ----- actions -----
    def install_lib(self, b):
        kind, pkg, port = b.get("kind"), (b.get("pkg") or "").strip(), b.get("port") or ""
        if not SAFE_PKG.match(pkg):
            raise ValueError("That library name has characters I will not pass on.")
        if kind == "pip":
            ok, out = run([pi_python(), "-m", "pip", "install"] + pkg.split(), timeout=1800)
        elif kind == "arduino":
            if not tool("arduino-cli"):
                raise ValueError("arduino-cli is not installed. See https://arduino.github.io/arduino-cli/latest/installation/")
            ok, out = run(["arduino-cli", "lib", "install", pkg], timeout=900)
        elif kind == "mip":
            if not tool("mpremote"):
                raise ValueError("mpremote is not installed. Run: pip install mpremote")
            cmd = ["mpremote"] + (["connect", self.port(port)] if port else []) + ["mip", "install", pkg]
            ok, out = run(cmd, timeout=300)
        elif kind == "apt":
            return {"ok": False, "output": "System packages need your password. In a terminal run:\n  sudo apt install -y " + pkg}
        else:
            raise ValueError("Unknown library type")
        if not ok:
            raise ValueError(out[-1500:])
        return {"ok": ok, "output": out}

    def port(self, port):
        if not SAFE_PORT.match(port or ""):
            raise ValueError("Pick a USB port first.")
        return port

    def arduino_upload(self, b):
        if not tool("arduino-cli"):
            raise ValueError("arduino-cli is not installed. See https://arduino.github.io/arduino-cli/latest/installation/")
        fqbn, port = b.get("fqbn") or "", self.port(b.get("port"))
        if not SAFE_FQBN.match(fqbn):
            raise ValueError("Unknown board type")
        name = re.sub(r"[^A-Za-z0-9_]", "_", b.get("name") or "sketch")[:40] or "sketch"
        folder = WORK / "sketches" / name
        folder.mkdir(parents=True, exist_ok=True)
        (folder / (name + ".ino")).write_text(b.get("code") or "")
        log = []
        if not ensure_core(fqbn, log):
            return {"ok": False, "output": "\n".join(log)}
        url = board_url(fqbn)
        extra = ["--additional-urls", url] if url else []
        ok, out = run(["arduino-cli", "compile", "--fqbn", fqbn, "--upload", "-p", port, str(folder)] + extra, timeout=1800)
        log.append(out)
        return {"ok": ok, "output": "\n".join(log)}

    def mp_upload(self, b):
        if not tool("mpremote"):
            raise ValueError("mpremote is not installed. Run: pip install mpremote")
        port = self.port(b.get("port"))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "main.py"
            path.write_text(b.get("code") or "")
            ok, out = run(["mpremote", "connect", port, "fs", "cp", str(path), ":main.py", "+", "reset"], timeout=120)
        return {"ok": ok, "output": out}

    def python_run(self, b):
        path = RUNNER.start(b.get("code") or "")
        return {"ok": True, "output": "Started " + path}

    def python_stop(self, b):
        RUNNER.stop()
        return {"ok": True, "output": "Stopped."}


def main():
    ap = argparse.ArgumentParser(description="friendly-microman local helper")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", default="127.0.0.1", help="address to listen on (default: this computer only)")
    args = ap.parse_args()
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    srv.allowed_hosts = {"localhost", "127.0.0.1", "::1"}
    if args.host not in ("127.0.0.1", "localhost"):
        srv.allowed_hosts.add(platform.node())
        srv.allowed_hosts.add(platform.node() + ".local")
        if args.host != "0.0.0.0":
            srv.allowed_hosts.add(args.host)
    srv.allowed_origins = {"http://localhost:%d" % args.port, "http://127.0.0.1:%d" % args.port}
    srv.allowed_origins.update(h if "://" in h else "http://%s:%d" % (h, args.port) for h in list(srv.allowed_hosts))
    print("friendly-microman helper %s" % VERSION)
    print("  Open http://localhost:%d in Chrome or Edge" % args.port)
    print("  Tools: arduino-cli=%s  mpremote=%s" % ("yes" if tool("arduino-cli") else "no", "yes" if tool("mpremote") else "no"))
    print("  Press Ctrl+C to stop.")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        RUNNER.stop()
        print("\nStopped.")


if __name__ == "__main__":
    main()
