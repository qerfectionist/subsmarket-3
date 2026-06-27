from __future__ import annotations

import pytest

from subsmarket.ops.http_load_smoke import validate_http_target


def test_http_load_allows_local_target() -> None:
    assert validate_http_target("http://127.0.0.1:8002", allow_remote=False) == (
        "http://127.0.0.1:8002"
    )


def test_http_load_blocks_remote_target_by_default() -> None:
    with pytest.raises(ValueError, match="Remote HTTP load is blocked"):
        validate_http_target("https://api.example.com", allow_remote=False)


def test_http_load_rejects_invalid_target() -> None:
    with pytest.raises(ValueError, match="absolute HTTP URL"):
        validate_http_target("not-a-url", allow_remote=False)
