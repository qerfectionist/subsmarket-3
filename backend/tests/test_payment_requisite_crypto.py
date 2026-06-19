from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet

from subsmarket.core.config import settings
from subsmarket.families.crypto import (
    decrypt_payment_requisite,
    encrypt_payment_requisite,
)


def _legacy_encrypt(secret: str, value: str) -> str:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key).encrypt(value.encode("utf-8")).decode("ascii")


def test_payment_requisite_crypto_uses_versioned_pbkdf2_format(
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "payment_requisite_secret", "test-secret")

    encrypted = encrypt_payment_requisite("+77001234567")

    assert encrypted.startswith("v2:")
    assert "+77001234567" not in encrypted
    assert decrypt_payment_requisite(encrypted) == "+77001234567"


def test_payment_requisite_crypto_keeps_legacy_tokens_readable(monkeypatch) -> None:
    monkeypatch.setattr(settings, "payment_requisite_secret", "test-secret")
    encrypted = _legacy_encrypt("test-secret", "+77001234567")

    assert not encrypted.startswith("v2:")
    assert decrypt_payment_requisite(encrypted) == "+77001234567"
