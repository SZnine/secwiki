"""Initialize the SecWiki database schema."""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "secwiki.db")


def get_db():
    """Get a database connection with Row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db():
    """Initialize the database with schema."""
    conn = get_db()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS domains (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                sort_order INTEGER DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS object_categories (
                id TEXT NOT NULL,
                domain_id TEXT NOT NULL,
                name TEXT NOT NULL,
                definition TEXT DEFAULT '',
                description TEXT DEFAULT '',
                sort_order INTEGER DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (domain_id, id),
                FOREIGN KEY (domain_id) REFERENCES domains(id)
            );

            CREATE TABLE IF NOT EXISTS terms (
                term_id TEXT PRIMARY KEY,
                domain_id TEXT NOT NULL,
                object_id TEXT NOT NULL,
                slug TEXT NOT NULL,
                title TEXT NOT NULL,
                subtitle TEXT DEFAULT '',
                aliases_json TEXT DEFAULT '[]',
                summary TEXT DEFAULT '',
                common_locations TEXT DEFAULT '',
                tags_json TEXT DEFAULT '[]',
                status TEXT DEFAULT 'draft',
                content_json TEXT DEFAULT '{}',
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (domain_id) REFERENCES domains(id),
                FOREIGN KEY (domain_id, object_id) REFERENCES object_categories(domain_id, id)
            );

            CREATE TABLE IF NOT EXISTS term_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                term_id TEXT NOT NULL,
                version_no INTEGER NOT NULL,
                content_json TEXT NOT NULL,
                change_note TEXT DEFAULT '',
                changed_by TEXT DEFAULT 'local-user',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (term_id) REFERENCES terms(term_id)
            );

            CREATE INDEX IF NOT EXISTS idx_terms_domain ON terms(domain_id);
            CREATE INDEX IF NOT EXISTS idx_terms_object ON terms(domain_id, object_id);
            CREATE INDEX IF NOT EXISTS idx_term_versions_tid ON term_versions(term_id);
        """)
        conn.commit()
    finally:
        conn.close()
