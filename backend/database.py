import os
import sqlite3
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATABASE_PATH = Path(os.environ.get("PITSTOP_DB_PATH", ROOT / "data" / "pitstop.sqlite3"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    nickname TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year BETWEEN 1886 AND 2100),
    mileage INTEGER NOT NULL CHECK (mileage >= 0),
    plate TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS vehicles_owner ON vehicles(user_id);

CREATE TABLE IF NOT EXISTS maintenance (
    id INTEGER PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('completed', 'scheduled')),
    service_date TEXT NOT NULL,
    mileage INTEGER NOT NULL CHECK (mileage >= 0),
    cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
    notes TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS maintenance_vehicle ON maintenance(vehicle_id);
"""


def connect(path):
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return closing(connection)


def initialize(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.execute("PRAGMA journal_mode = WAL")
        db.executescript(SCHEMA)
