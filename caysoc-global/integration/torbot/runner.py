"""CaySoc TorBot runner — loopback-only HTTP service.

Runs a pinned TorBot crawl through a local Tor SOCKS proxy and returns only a
sanitised summary plus the SHA-256 of the raw crawl result. Raw page content,
emails and onion URLs never leave this container; the aggregator stores the
hash and aggregate counts only.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import socket
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx

PORT = int(os.environ.get("RUNNER_PORT", "9055"))
SOCKS_PORT = int(os.environ.get("SOCKS_PORT", "9050"))
TIMEOUT = int(os.environ.get("TORBOT_TIMEOUT_SEC", "180"))
MAX_DEPTH = 2
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
URL_RE = re.compile(r"https?://[^\s\"'<>]+")

_tor: subprocess.Popen | None = None
_lock = threading.Lock()


def start_tor() -> bool:
    global _tor
    with _lock:
        if _tor and _tor.poll() is None:
            return True
        _tor = subprocess.Popen(
            ["tor", "--SocksPort", str(SOCKS_PORT), "--DataDirectory", "/tmp/torbot-data",
             "--Log", "notice stderr", "--AvoidDiskWrites", "1"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        # Wait for a real Tor circuit, not just an open SOCKS port.
        for _ in range(90):
            if _tor.poll() is not None:
                return False
            try:
                with socket.create_connection(("127.0.0.1", SOCKS_PORT), timeout=1):
                    pass
                with httpx.Client(proxy=f"socks5://127.0.0.1:{SOCKS_PORT}", timeout=8) as client:
                    if client.get("https://check.torproject.org/api/ip").status_code == 200:
                        return True
            except Exception:  # noqa: BLE001
                pass
            time.sleep(1)
        return False


def sanitise(value: str) -> str:
    """Return only a redacted host pattern — never a raw onion/URL."""
    host = re.sub(r"^https?://", "", value, flags=re.I).split("/")[0].lower()
    parts = [p for p in host.split(".") if p]
    return "***." + ".".join(parts[-2:]) if len(parts) >= 2 else "***"


def run_crawl(target: str, depth: int) -> dict:
    if not re.match(r"^https?://", target, flags=re.I):
        target = "http://" + target
    if not start_tor():
        raise RuntimeError("tor proxy failed to start")
    out = "/tmp/torbot-out/result.json"
    cmd = [
        "python", "/opt/torbot/main.py", "-u", target,
        "--depth", str(max(1, min(MAX_DEPTH, depth))),
        "--host", "127.0.0.1", "--port", str(SOCKS_PORT),
        "--save", "result", "--result-file", out, "-q",
    ]
    last_error = ""
    for attempt in range(3):
        if os.path.exists(out):
            os.remove(out)
        try:
            proc = subprocess.run(cmd, cwd="/tmp/torbot-out", capture_output=True, text=True, timeout=TIMEOUT)
            last_error = proc.stderr[-400:]
        except subprocess.TimeoutExpired:
            raise
        if os.path.exists(out):
            break
        time.sleep(3)
    else:
        raise RuntimeError("torbot produced no result: " + last_error)
    with open(out, "rb") as fh:
        raw = fh.read()
    result = json.loads(raw)
    os.remove(out)

    pages = result.get("pages", []) or []
    emails: set[str] = set()
    links: set[str] = set()
    for page in pages:
        text = (page.get("content") or {}).get("text", "") or ""
        emails.update(EMAIL_RE.findall(text)[:25])
        links.update(URL_RE.findall(text)[:40])
        if page.get("url"):
            links.add(page["url"])

    return {
        "ok": True,
        "target_pattern": sanitise(target),
        "target_sha256": hashlib.sha256(target.encode()).hexdigest(),
        "result_sha256": hashlib.sha256(raw).hexdigest(),
        "pages": len(pages),
        "fetched": sum(1 for p in pages if p.get("outcome") == "fetched"),
        "email_count": len(emails),
        "link_count": len(links),
        "brand_terms": sorted({t for t in ("caysoc", "0xsec", "hacakesec") if any(t in str(p).lower() for p in pages)})[:10],
        "note": "Sanitised summary only. Raw content, emails and URLs remain inside this container.",
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            return self._send(200, {"ok": True, "module": "torbot-runner", "tor": bool(_tor and _tor.poll() is None)})
        self._send(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/scan":
            return self._send(404, {"error": "not_found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length) or b"{}")
            target = str(body.get("target", "")).strip()
            if not target or not re.match(r"^(https?://)?[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", target):
                return self._send(400, {"error": "invalid_target"})
            depth = int(body.get("depth", 1) or 1)
            self._send(200, run_crawl(target, depth))
        except subprocess.TimeoutExpired:
            self._send(504, {"error": "crawl_timeout"})
        except Exception as exc:  # noqa: BLE001
            self._send(502, {"error": "crawl_failed", "message": str(exc)[:200]})

    def log_message(self, fmt: str, *args) -> None:
        return


if __name__ == "__main__":
    # Published only on the host's 127.0.0.1; must listen on all container IPs
    # so Docker's port forward can reach it.
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
