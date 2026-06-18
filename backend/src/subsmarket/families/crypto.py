from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet

from subsmarket.core.config import settings


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.payment_requisite_secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_payment_requisite(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_payment_requisite(value: str) -> str:
    return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
