from __future__ import annotations

import json
import os
import re
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "renders"
HOST = "127.0.0.1"
PORT = 8787


def safe_int(value: Any, fallback: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def safe_slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-")
    return slug[:48] or "seed"


class RenderHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        self.respond(204, None)

    def do_POST(self) -> None:
        if self.path != "/render":
            self.respond(404, {"ok": False, "error": "not found"})
            return

        try:
            payload = self.read_json()
            result = render_video(payload)
            self.respond(200, {"ok": True, "output": result})
        except Exception as error:  # noqa: BLE001 - errors are returned to the browser.
            self.respond(500, {"ok": False, "error": str(error)})

    def read_json(self) -> dict[str, Any]:
        length = safe_int(self.headers.get("content-length"), 0)
        body = self.rfile.read(length).decode("utf-8")
        return json.loads(body or "{}")

    def respond(self, status: int, data: dict[str, Any] | None) -> None:
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        if data is None:
            self.end_headers()
            return

        encoded = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def render_video(payload: dict[str, Any]) -> str:
    seed = str(payload.get("seed") or "new-world")
    from_frame = max(0, safe_int(payload.get("fromFrame"), 0))
    to_frame = max(from_frame + 1, safe_int(payload.get("toFrame"), from_frame + 240))
    fps = max(1, safe_int(payload.get("fps"), 60))
    width = max(64, safe_int(payload.get("width"), 1280))
    height = max(64, safe_int(payload.get("height"), 720))
    duration = to_frame - from_frame

    OUTPUT_DIR.mkdir(exist_ok=True)
    output = OUTPUT_DIR / f"{safe_slug(seed)}-{from_frame}-{to_frame}-{int(time.time())}.mp4"
    props = {
        "seed": seed,
        "fromFrame": from_frame,
        "durationInFrames": duration,
        "fps": fps,
        "width": width,
        "height": height,
    }

    npx = "npx.cmd" if os.name == "nt" else "npx"
    command = [
        npx,
        "remotion",
        "render",
        "src/remotion/Root.tsx",
        "PixiBounce",
        str(output),
        f"--props={json.dumps(props, ensure_ascii=False)}",
      ]

    completed = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode != 0:
        details = completed.stderr.strip() or completed.stdout.strip()
        raise RuntimeError(details or "Remotion render failed")

    return str(output)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), RenderHandler)
    print(f"render server listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
