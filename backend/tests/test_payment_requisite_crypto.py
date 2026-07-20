from __future__ import annotations

import base64
import hashlib
import os

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from subsmarket.core.config import settings
from subsmarket.families.crypto import (
    decrypt_payment_requisite,
    encrypt_payment_requisite,
)


def _legacy_encrypt(secret: str, value: str) -> str:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key).encrypt(value.encode("utf-8")).decode("ascii")


def _v2_encrypt(secret: str, value: str) -> str:
    salt = os.urandom(16)
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=390_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret.encode("utf-8")))
    encrypted = Fernet(key).encrypt(value.encode("utf-8")).decode("ascii")
    encoded_salt = base64.urlsafe_b64encode(salt).decode("ascii")
    return f"v2:{encoded_salt}:{encrypted}"


def test_payment_requisite_crypto_uses_cached_versioned_format(
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "payment_requisite_secret", "test-secret")

    encrypted = encrypt_payment_requisite("+77001234567")

    assert encrypted.startswith("v3:")
    assert "+77001234567" not in encrypted
    assert decrypt_payment_requisite(encrypted) == "+77001234567"


def test_payment_requisite_crypto_reads_v3_with_previous_secret(monkeypatch) -> None:
    monkeypatch.setattr(settings, "payment_requisite_secret", "old-secret")
    monkeypatch.setattr(settings, "payment_requisite_previous_secrets", "")
    encrypted = encrypt_payment_requisite("+77001234567")

    monkeypatch.setattr(settings, "payment_requisite_secret", "new-secret")
    monkeypatch.setattr(
        settings,
        "payment_requisite_previous_secrets",
        "unused-secret, old-secret",
    )

    assert decrypt_payment_requisite(encrypted) == "+77001234567"


def test_payment_requisite_crypto_keeps_v2_tokens_readable(monkeypatch) -> None:
    monkeypatch.setattr(settings, "payment_requisite_secret", "test-secret")
    encrypted = _v2_encrypt("test-secret", "+77001234567")

    assert encrypted.startswith("v2:")
    assert decrypt_payment_requisite(encrypted) == "+77001234567"


def test_payment_requisite_crypto_reads_v2_with_previous_secret(monkeypatch) -> None:
    monkeypatch.setattr(settings, "payment_requisite_secret", "new-secret")
    monkeypatch.setattr(
        settings,
        "payment_requisite_previous_secrets",
        "old-secret",
    )
    encrypted = _v2_encrypt("old-secret", "+77001234567")

    assert decrypt_payment_requisite(encrypted) == "+77001234567"


def test_payment_requisite_crypto_keeps_legacy_tokens_readable(monkeypatch) -> None:
    monkeypatch.setattr(settings, "payment_requisite_secret", "test-secret")
    encrypted = _legacy_encrypt("test-secret", "+77001234567")

    assert not encrypted.startswith(("v2:", "v3:"))
    assert decrypt_payment_requisite(encrypted) == "+77001234567"


def test_payment_requisite_crypto_reads_legacy_with_previous_secret(
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "payment_requisite_secret", "new-secret")
    monkeypatch.setattr(
        settings,
        "payment_requisite_previous_secrets",
        "old-secret",
    )
    encrypted = _legacy_encrypt("old-secret", "+77001234567")

    assert decrypt_payment_requisite(encrypted) == "+77001234567"
