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
OUTPUT_DIR = ROOT / "out"
PUBLIC_DIR = ROOT / "public"
CONFIG_FILE = PUBLIC_DIR / "asset_custom_config.json"
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

    def do_GET(self) -> None:
        if self.path == "/asset/config":
            try:
                config = {}
                if CONFIG_FILE.exists():
                    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                self.respond(200, {"ok": True, "config": config})
            except Exception as error:
                self.respond(500, {"ok": False, "error": str(error)})
        else:
            self.respond(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        if self.path == "/render":
            try:
                payload = self.read_json()
                result = render_video(payload)
                self.respond(200, {"ok": True, "output": result})
            except Exception as error:
                self.respond(500, {"ok": False, "error": str(error)})
        
        elif self.path == "/manifest/refresh":
            try:
                script_path = ROOT / "script" / "asset_manifest_manager.py"
                subprocess.run(["python", str(script_path)], check=True)
                self.respond(200, {"ok": True, "message": "Manifest refreshed"})
            except Exception as error:
                self.respond(500, {"ok": False, "error": str(error)})

        elif self.path == "/asset/update":
            try:
                payload = self.read_json()
                # payload format: {"path": "assets/ui/hero.png", "alias": "hero", "tags": ["character", "player"]}
                asset_path = payload.get("path")
                if not asset_path:
                    raise ValueError("Asset path is required")
                
                config = {}
                if CONFIG_FILE.exists():
                    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                
                config[asset_path] = {
                    "alias": payload.get("alias"),
                    "tags": payload.get("tags", [])
                }
                
                with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                    json.dump(config, f, indent=2, ensure_ascii=False)
                
                # 更新配置后自动刷新 Manifest
                script_path = ROOT / "script" / "asset_manifest_manager.py"
                subprocess.run(["python", str(script_path)], check=True)
                
                self.respond(200, {"ok": True, "message": "Asset updated and manifest refreshed"})
            except Exception as error:
                self.respond(500, {"ok": False, "error": str(error)})
        
        else:
            self.respond(404, {"ok": False, "error": "not found"})

    def read_json(self) -> dict[str, Any]:
        length = safe_int(self.headers.get("content-length"), 0)
        body = self.rfile.read(length).decode("utf-8")
        return json.loads(body or "{}")

    def respond(self, status: int, data: dict[str, Any] | None) -> None:
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        if data is None:
            self.end_headers()
            return

        encoded = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)
        self.wfile.flush()


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
