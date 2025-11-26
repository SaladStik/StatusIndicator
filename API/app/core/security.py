import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional


def generate_api_key(length: int = 32) -> str:
    """Generate a secure random API key"""
    return secrets.token_urlsafe(length)


def hash_api_key(api_key: str) -> str:
    """Hash an API key for secure storage"""
    return hashlib.sha256(api_key.encode()).hexdigest()


def verify_api_key(plain_key: str, hashed_key: str) -> bool:
    """Verify an API key against its hash"""
    return hash_api_key(plain_key) == hashed_key
