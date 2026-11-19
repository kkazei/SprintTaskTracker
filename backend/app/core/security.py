import bcrypt

# bcrypt only uses the first 72 bytes of a password; longer inputs are rejected by the
# request schemas rather than silently truncated.
BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    encoded = password.encode("utf-8")
    if len(encoded) > BCRYPT_MAX_BYTES:
        return False
    return bcrypt.checkpw(encoded, password_hash.encode("utf-8"))
