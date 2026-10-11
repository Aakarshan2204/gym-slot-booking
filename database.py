"""
Database Layer for Gym Slot Booking System.
SQLite with Write-Ahead Logging (WAL), foreign keys, and strict ACID transaction semantics.
"""

import os
import sqlite3
from typing import Generator
from contextlib import contextmanager

DB_PATH = os.environ.get("DATABASE_URL", "gym_booking.db")

def get_db_connection() -> sqlite3.Connection:
    """Creates and configures a SQLite connection."""
    conn = sqlite3.connect(DB_PATH, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn

@contextmanager
def get_db():
    """Context manager for normal database access."""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()

@contextmanager
def immediate_transaction(conn: sqlite3.Connection) -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager that acquires an IMMEDIATE exclusive write lock in SQLite.
    Prevents race conditions by locking immediately upon transaction start.
    """
    conn.execute("BEGIN IMMEDIATE;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise

def init_db():
    """Initializes schema tables and indexes."""
    with get_db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('member', 'admin')) DEFAULT 'member',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            start_hour INTEGER NOT NULL CHECK(start_hour >= 0 AND start_hour <= 23),
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            capacity INTEGER NOT NULL DEFAULT 20,
            created_by INTEGER NOT NULL REFERENCES users(id),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(date, start_hour)
        );

        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status TEXT NOT NULL CHECK(status IN ('confirmed', 'cancelled')) DEFAULT 'confirmed',
            check_in_code TEXT NOT NULL UNIQUE,
            checked_in_at TEXT DEFAULT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS waitlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status TEXT NOT NULL CHECK(status IN ('waiting', 'promoted', 'cancelled')) DEFAULT 'waiting',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Partial unique indexes:
        -- 1. A member can have only one ACTIVE confirmed booking per session
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking 
        ON bookings(session_id, user_id) 
        WHERE status = 'confirmed';

        -- 2. A member cannot be on the waitlist twice for the same session
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_waitlist 
        ON waitlist(session_id, user_id) 
        WHERE status = 'waiting';

        -- Index for fast code lookups during check-in
        CREATE INDEX IF NOT EXISTS idx_bookings_code ON bookings(check_in_code);
        
        -- Index for fast session query filtering
        CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
        CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
        """)
        conn.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
