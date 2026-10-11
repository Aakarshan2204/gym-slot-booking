"""
Authentication and Cryptographic Utilities.
Handles bcrypt password hashing, JWT generation/verification, and CSPRNG check-in codes.
"""

import os
import re
import secrets
import datetime
from typing import Dict, Any, Optional

try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False
    import hashlib

import jwt

JWT_SECRET = os.environ.get("JWT_SECRET", "super_secret_gym_jwt_key_change_in_production_min_32_chars!")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.environ.get("JWT_EXPIRES_IN_HOURS", "24"))

# Ambiguous characters (0, O, 1, I) excluded to prevent transcribing errors at the gym door
CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
CODE_LENGTH = 6

def hash_password(password: str) -> str:
    """Hashes a password with salt using bcrypt or PBKDF2-HMAC-SHA256."""
    if HAS_BCRYPT:
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
        return hashed.decode("utf-8")
    else:
        salt = secrets.token_hex(16)
        h = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 600000)
        return f"pbkdf2_sha256${salt}${h.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the stored hash."""
    if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
        if HAS_BCRYPT:
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        return False
    elif hashed_password.startswith("pbkdf2_sha256$"):
        parts = hashed_password.split("$")
        if len(parts) == 3:
            salt = parts[1]
            stored_hash = parts[2]
            computed = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 600000).hex()
            return secrets.compare_digest(stored_hash, computed)
    return False

def create_access_token(user_id: int, email: str, role: str) -> str:
    """Creates a signed JWT access token."""
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": str(user_id),
        "user_id": user_id,
        "email": email,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + datetime.timedelta(hours=JWT_EXPIRATION_HOURS)).timestamp())
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT token. Returns payload or None if invalid/expired."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None

def generate_check_in_code() -> str:
    """
    Generates a cryptographically secure, unguessable 6-character alphanumeric code.
    30^6 = 729,000,000 combinations.
    """
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def validate_registration_input(name: str, email: str, password: str) -> Optional[str]:
    """Validates registration fields. Returns error message if invalid, None if OK."""
    if not name or len(name.strip()) < 2:
        return "Name must be at least 2 characters long."
    if not email or not EMAIL_REGEX.match(email.strip()):
        return "A valid email address is required."
    if not password or len(password) < 6:
        return "Password must be at least 6 characters long."
    return None
