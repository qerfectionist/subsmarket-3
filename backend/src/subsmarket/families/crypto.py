from __future__ import annotations

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from subsmarket.core.config import settings

PBKDF2_ITERATIONS = 390_000
V2_PREFIX = "v2"
V3_PREFIX = "v3"
SALT_BYTES = 16
V3_KDF_SALT = b"subsmarket-payment-requisite-v3"


def _legacy_fernet() -> Fernet:
    digest = hashlib.sha256(settings.payment_requisite_secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def _pbkdf2_fernet(salt: bytes) -> Fernet:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
    )
    key = base64.urlsafe_b64encode(
        kdf.derive(settings.payment_requisite_secret.encode("utf-8"))
    )
    return Fernet(key)


@lru_cache(maxsize=4)
def _cached_fernet(secret: str) -> Fernet:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=V3_KDF_SALT,
        iterations=PBKDF2_ITERATIONS,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret.encode("utf-8")))
    return Fernet(key)


def encrypt_payment_requisite(value: str) -> str:
    encrypted = (
        _cached_fernet(settings.payment_requisite_secret)
        .encrypt(value.encode("utf-8"))
        .decode("ascii")
    )
    return f"{V3_PREFIX}:{encrypted}"


def _decrypt_v2_payment_requisite(value: str) -> str:
    _, encoded_salt, encrypted = value.split(":", 2)
    salt = base64.urlsafe_b64decode(encoded_salt.encode("ascii"))
    return _pbkdf2_fernet(salt).decrypt(encrypted.encode("ascii")).decode("utf-8")


def decrypt_payment_requisite(value: str) -> str:
    if value.startswith(f"{V3_PREFIX}:"):
        _, encrypted = value.split(":", 1)
        return (
            _cached_fernet(settings.payment_requisite_secret)
            .decrypt(encrypted.encode("ascii"))
            .decode("utf-8")
        )
    if value.startswith(f"{V2_PREFIX}:"):
        return _decrypt_v2_payment_requisite(value)
    return _legacy_fernet().decrypt(value.encode("ascii")).decode("utf-8")
