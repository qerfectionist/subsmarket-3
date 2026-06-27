from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "backend" / "src" / "subsmarket" / "families" / "api"


def clean(path: Path) -> None:
    lines = path.read_text(encoding="utf-8").splitlines()
    out: list[str] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        if line.strip() == "router = APIRouter()":
            index += 1
            continue
        if line.startswith("@router."):
            index += 1
            while index < len(lines) and lines[index].strip() != ")":
                index += 1
            if index < len(lines):
                index += 1
            continue
        if (
            out
            and not line.startswith("def ")
            and re.match(r'^\s+["/\{]', line)
        ):
            while index < len(lines) and not lines[index].startswith("def "):
                index += 1
            continue
        out.append(line)
        index += 1
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def main() -> None:
    for name in ["requests.py", "management.py", "members.py", "payments.py", "detail.py"]:
        clean(ROOT / name)
        print(f"cleaned {name}")


if __name__ == "__main__":
    main()