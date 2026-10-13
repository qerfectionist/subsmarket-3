"""High-speed parallel downloader and optimizer for Mobbin screens."""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import sys
import urllib.request
from pathlib import Path
from PIL import Image

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def download_single(item: dict, out_dir: Path) -> tuple[str, bool, str]:
    sid = item["id"]
    url = item["url"]
    png_path = out_dir / f"{sid}.png"

    if png_path.exists() and png_path.stat().st_size > 5000:
        return sid, True, "cached"

    tmp_path = out_dir / f"{sid}.tmp"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as res:
            raw = res.read()
            with open(tmp_path, "wb") as f:
                f.write(raw)

        im = Image.open(tmp_path)
        im.save(png_path, "PNG")
        if tmp_path.exists():
            tmp_path.unlink()
        return sid, True, f"{im.size[0]}x{im.size[1]}"
    except Exception as exc:
        if tmp_path.exists():
            tmp_path.unlink()
        return sid, False, str(exc)


def sync_assets(items: list[dict], out_dir: Path, max_workers: int = 6) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"Syncing {len(items)} Mobbin screens into {out_dir} (parallel x{max_workers})...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(download_single, it, out_dir): it for it in items}
        for future in concurrent.futures.as_completed(futures):
            sid, ok, note = future.result()
            status = "OK" if ok else "ERR"
            print(f"  [{status}] {sid}: {note}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync Mobbin references")
    parser.add_argument("--input", "-i", type=Path, help="JSON file with list of [{id, url}]")
    parser.add_argument("--out", "-o", type=Path, default=Path("assets/mobbin_gallery"), help="Output directory")
    args = parser.parse_args()

    if not args.input or not args.input.exists():
        print("Usage: python tools/sync_mobbin_assets.py -i <screens.json> -o <out_dir>")
        sys.exit(1)

    with open(args.input, "r", encoding="utf-8") as f:
        items = json.load(f)

    sync_assets(items, args.out)


if __name__ == "__main__":
    main()
