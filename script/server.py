from __future__ import annotations

import json
import os
import re
import shutil
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


def is_finite_number(value: float) -> bool:
    return value == value and value not in (float("inf"), float("-inf"))


def load_asset_config() -> dict[str, Any]:
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def apply_asset_update(config: dict[str, Any], payload: dict[str, Any]) -> None:
    asset_path = payload.get("path")
    if not asset_path:
        raise ValueError("Asset path is required")

    existing = config.get(asset_path, {})
    if not isinstance(existing, dict):
        existing = {}

    if "alias" in payload:
        alias = payload.get("alias")
        if alias:
            existing["alias"] = alias
        elif "alias" in existing:
            del existing["alias"]

    if "tags" in payload:
        tags = payload.get("tags")
        if isinstance(tags, list):
            existing["tags"] = tags
        elif "tags" in existing:
            del existing["tags"]

    for field_name in ("defaultScale", "defaultAnchorX", "defaultAnchorY"):
        if field_name not in payload:
            continue
        value = payload.get(field_name)
        if value is None or value == "":
            if field_name in existing:
                del existing[field_name]
            continue
        number = float(value)
        if not is_finite_number(number):
            raise ValueError(f"{field_name} 不是有效数字")
        existing[field_name] = number

    config[asset_path] = existing


def save_asset_config(config: dict[str, Any]) -> None:
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def refresh_manifest_assets() -> list[dict[str, Any]]:
    script_path = ROOT / "script" / "asset_manifest_manager.py"
    subprocess.run(["python", str(script_path)], check=True)
    manifest_file = PUBLIC_DIR / "asset_manifest.json"
    with open(manifest_file, "r", encoding="utf-8") as f:
        return json.load(f)


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
        elif route == "/file/pick-dir":
            try:
                picked_path = pick_local_directory()
                self.respond(200, {"ok": True, "path": picked_path})
            except Exception as error:
                self.respond(500, {"ok": False, "error": str(error)})
        elif route == "/file/pick-image":
            try:
                picked_image = pick_local_image_into_public()
                self.respond(200, {"ok": True, **picked_image})
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
        
        elif route == "/render-xml":
            try:
                payload = self.read_json()
                xml_content = payload.get("xml")
                if not xml_content:
                    raise ValueError("Missing xml content")
                
                # 保存 XML 到临时文件供 Remotion 读取
                temp_xml_path = PUBLIC_DIR / "temp_render.xml"
                temp_xml_path.write_text(xml_content, encoding="utf-8")
                
                # 调用 Remotion 渲染 PixiXml 组合
                result = render_xml_video(payload)
                self.respond(200, {"ok": True, "output": result})
            except Exception as error:
                self.respond(500, {"ok": False, "error": str(error)})
        
        elif route == "/manifest/refresh":
            try:
                assets = refresh_manifest_assets()
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
                config = load_asset_config()
                apply_asset_update(config, payload)
                save_asset_config(config)
                refresh_manifest_assets()
                self.respond(200, {"ok": True, "message": "Asset updated and manifest refreshed"})
            except Exception as error:
                self.respond(500, {"ok": False, "error": str(error)})

        elif route == "/asset/batch-update":
            try:
                payload = self.read_json()
                updates = payload.get("updates")
                if not isinstance(updates, list) or len(updates) == 0:
                    raise ValueError("updates 不能为空")

                config = load_asset_config()
                for update in updates:
                    if not isinstance(update, dict):
                        raise ValueError("updates 中存在非法项")
                    apply_asset_update(config, update)

                save_asset_config(config)
                refresh_manifest_assets()
                self.respond(200, {"ok": True, "message": f"Batch updated {len(updates)} assets"})
            except Exception as error:
                self.respond(500, {"ok": False, "error": str(error)})

        elif route == "/debug/log":
            try:
                payload = self.read_json()
                append_debug_log(payload)
                self.respond(200, {"ok": True})
            except Exception as error:
                self.respond(500, {"ok": False, "error": str(error)})
        
        elif route == "/tool/batch-rename":
            try:
                payload = self.read_json()
                target_dir = payload.get("target_dir")
                old_str = payload.get("old_str")
                new_str = payload.get("new_str")
                
                if not target_dir or not os.path.exists(target_dir):
                    raise ValueError(f"Invalid target directory: {target_dir}")
                
                from batch_rename_files_and_folders import batch_rename_files_and_folders
                
                # Capture output if possible, or just run it
                batch_rename_files_and_folders(target_dir, old_str, new_str)
                
                self.respond(200, {"ok": True, "message": "Batch rename completed successfully"})
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


def pick_local_directory() -> str:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    selected = filedialog.askdirectory(title="选择目标文件夹")
    root.destroy()

    return selected


def pick_local_image_into_public() -> dict[str, str]:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    selected = filedialog.askopenfilename(
        title="选择图片文件",
        filetypes=[
            ("图片文件", "*.png *.jpg *.jpeg *.webp *.gif *.bmp"),
            ("所有文件", "*.*"),
        ],
    )
    root.destroy()

    if not selected:
        raise ValueError("未选择任何图片文件")

    source = Path(selected).expanduser().resolve()
    if not source.exists() or not source.is_file():
        raise ValueError(f"图片文件无效：{source}")

    target_dir = PUBLIC_DIR / "user_uploads"
    target_dir.mkdir(parents=True, exist_ok=True)

    ext = source.suffix.lower() or ".png"
    target_name = f"user-{int(time.time())}-{safe_slug(source.stem)}{ext}"
    target = target_dir / target_name
    shutil.copy2(source, target)

    relative_path = target.relative_to(PUBLIC_DIR).as_posix()
    return {
        "path": relative_path,
        "url": f"/{relative_path}",
    }


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


def append_debug_log(payload: dict[str, Any]) -> None:
    log_file = PUBLIC_DIR / "log.txt"
    log_file.parent.mkdir(parents=True, exist_ok=True)

    record = {
        "time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
        "level": payload.get("level", "DEBUG"),
        "source": payload.get("source", ""),
        "message": payload.get("message", ""),
        "detail": payload.get("detail"),
    }

    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


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


def render_xml_video(payload: dict[str, Any]) -> str:
    name = safe_slug(str(payload.get("name") or "xml-render"))
    fps = max(1, safe_int(payload.get("fps"), 60))
    width = max(64, safe_int(payload.get("width"), 1280))
    height = max(64, safe_int(payload.get("height"), 720))
    total_frames = max(1, safe_int(payload.get("totalFrames"), 1))

    OUTPUT_DIR.mkdir(exist_ok=True)
    output = OUTPUT_DIR / f"{name}-{int(time.time())}.mp4"
    
    props = {
        "xmlPath": "temp_render.xml",
        "width": width,
        "height": height,
        "fps": fps,
        "durationInFrames": total_frames
    }

    npx = "npx.cmd" if os.name == "nt" else "npx"
    command = [
        npx,
        "remotion",
        "render",
        "src/remotion/Root.tsx",
        "PixiXml",
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
