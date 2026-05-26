from __future__ import annotations

import json
import os
import re
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

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
        parsed_url = urlparse(self.path)
        route = parsed_url.path
        query = parse_qs(parsed_url.query)

        if route == "/asset/config":
            try:
                config = {}
                if CONFIG_FILE.exists():
                    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                self.respond(200, {"ok": True, "config": config})
            except Exception as error:
                self.respond(500, {"ok": False, "error": str(error)})
        elif route == "/file/pick":
            try:
                picked_path = pick_local_file()
                self.respond(200, {"ok": True, "path": picked_path})
            except Exception as error:
                self.respond(500, {"ok": False, "error": str(error)})
        elif route == "/file/read":
            try:
                raw_path = first_query_value(query, "path")
                if not raw_path:
                    raise ValueError("缺少 path 参数")
                content = read_local_text_file(raw_path)
                self.respond(200, {"ok": True, "path": raw_path, "content": content})
            except Exception as error:
                self.respond(400, {"ok": False, "error": str(error)})
        else:
            self.respond(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        route = urlparse(self.path).path

        if route == "/render":
            try:
                payload = self.read_json()
                result = render_video(payload)
                self.respond(200, {"ok": True, "output": result})
            except Exception as error:
                self.respond(500, {"ok": False, "error": str(error)})
        
        elif route == "/manifest/refresh":
            try:
                script_path = ROOT / "script" / "asset_manifest_manager.py"
                subprocess.run(["python", str(script_path)], check=True)
                manifest_file = PUBLIC_DIR / "asset_manifest.json"
                with open(manifest_file, "r", encoding="utf-8") as f:
                    assets = json.load(f)
                self.respond(200, {
                    "ok": True,
                    "message": "Manifest refreshed",
                    "assets": assets,
                })
            except Exception as error:
                self.respond(500, {"ok": False, "error": str(error)})

        elif route == "/asset/update":
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


def first_query_value(query: dict[str, list[str]], key: str) -> str:
    values = query.get(key)
    if not values:
        return ""
    return values[0]


def pick_local_file() -> str:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    selected = filedialog.askopenfilename(
        title="选择 DXML/XML 文件",
        filetypes=[
            ("DXML/XML 文件", "*.dxml *.xml"),
            ("文本文件", "*.txt *.json *.yaml *.yml"),
            ("所有文件", "*.*"),
        ],
    )
    root.destroy()

    return selected


def read_local_text_file(raw_path: str) -> str:
    file_path = Path(raw_path).expanduser().resolve()
    if not file_path.exists():
        raise FileNotFoundError(f"文件不存在：{file_path}")
    if not file_path.is_file():
        raise ValueError(f"目标不是文件：{file_path}")

    file_size = file_path.stat().st_size
    if file_size > 5 * 1024 * 1024:
        raise ValueError("文件过大（>5MB），请拆分后再读取")

    for encoding in ("utf-8-sig", "utf-8", "gb18030"):
        try:
            return file_path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue

    raise ValueError("文件不是可读取的文本编码（支持 utf-8 / gb18030）")


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
