import hashlib
import hmac
import secrets

ITERATIONS = 600_000


def derive_key(password: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS).hex()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    return f"pbkdf2_sha256${salt.hex()}${derive_key(password, salt)}"


def verify_password(password: str, stored_hash: str) -> bool:
    parts = stored_hash.split("$")
    if len(parts) == 3 and parts[0] == "pbkdf2_sha256":
        _, salt, expected_key = parts
        return hmac.compare_digest(derive_key(password, bytes.fromhex(salt)), expected_key)

    # Use comparable work for missing accounts and passwords from the old format.
    derive_key(password, bytes(16))
    return False


def reset_password(email: str) -> None:
    from getpass import getpass

    from .database import DATABASE_PATH, connect

    if not DATABASE_PATH.is_file():
        raise SystemExit("SQLite database not found.")

    password = getpass("New password: ")
    if not 8 <= len(password) <= 128:
        raise SystemExit("Use 8 to 128 characters.")
    if password != getpass("Confirm password: "):
        raise SystemExit("Passwords do not match.")

    email = email.strip().casefold()
    password_hash = hash_password(password)
    with connect(DATABASE_PATH) as db, db:
        result = db.execute(
            "UPDATE users SET password_hash = ? WHERE email = ?",
            (password_hash, email),
        )
        if result.rowcount == 0:
            raise SystemExit("Account not found.")
        db.execute(
            "DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)",
            (email,),
        )
    print("Password updated. You can now log in.")


if __name__ == "__main__":
    from argparse import ArgumentParser

    parser = ArgumentParser(description="Reset a password in the local PitStop database.")
    parser.add_argument("email")
    reset_password(parser.parse_args().email)
