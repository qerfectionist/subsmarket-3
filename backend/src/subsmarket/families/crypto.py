from __future__ import annotations

import base64
import hashlib
from collections.abc import Callable
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from subsmarket.core.config import settings

PBKDF2_ITERATIONS = 390_000
V2_PREFIX = "v2"
V3_PREFIX = "v3"
SALT_BYTES = 16
V3_KDF_SALT = b"subsmarket-payment-requisite-v3"


def _legacy_fernet(secret: str) -> Fernet:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def _pbkdf2_fernet(salt: bytes, secret: str) -> Fernet:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret.encode("utf-8")))
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


def _decrypt_v2_payment_requisite(value: str, secret: str) -> str:
    _, encoded_salt, encrypted = value.split(":", 2)
    salt = base64.urlsafe_b64decode(encoded_salt.encode("ascii"))
    return (
        _pbkdf2_fernet(salt, secret)
        .decrypt(encrypted.encode("ascii"))
        .decode("utf-8")
    )


def _decryption_secrets() -> tuple[str, ...]:
    secrets = [settings.payment_requisite_secret]
    for candidate in settings.payment_requisite_previous_secrets.split(","):
        secret = candidate.strip()
        if secret and secret not in secrets:
            secrets.append(secret)
    return tuple(secrets[:4])


def _decrypt_with_configured_secrets(decryptor: Callable[[str], str]) -> str:
    last_error: InvalidToken | None = None
    for secret in _decryption_secrets():
        try:
            return decryptor(secret)
        except InvalidToken as exc:
            last_error = exc
    if last_error is not None:
        raise last_error
    raise InvalidToken


def decrypt_payment_requisite(value: str) -> str:
    if value.startswith(f"{V3_PREFIX}:"):
        _, encrypted = value.split(":", 1)
        return _decrypt_with_configured_secrets(
            lambda secret: _cached_fernet(secret)
            .decrypt(encrypted.encode("ascii"))
            .decode("utf-8")
        )
    if value.startswith(f"{V2_PREFIX}:"):
        return _decrypt_with_configured_secrets(
            lambda secret: _decrypt_v2_payment_requisite(value, secret)
        )
    return _decrypt_with_configured_secrets(
        lambda secret: _legacy_fernet(secret)
        .decrypt(value.encode("ascii"))
        .decode("utf-8")
    )
