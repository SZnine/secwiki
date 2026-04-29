import json
import re
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from ..db import get_db
from ..schemas import VersionSummary, VersionDetail
from .terms import save_version, TERM_ID_RE

router = APIRouter()


@router.get("/{term_id:path}/history")
def get_history(term_id: str):
    if not TERM_ID_RE.match(term_id):
        raise HTTPException(400, {"ok": False, "error": {"code": "INVALID_TERM_ID"}})
    conn = get_db()
    try:
        existing = conn.execute("SELECT 1 FROM terms WHERE term_id = ?", (term_id,)).fetchone()
        if not existing:
            raise HTTPException(404, {"ok": False, "error": {"code": "TERM_NOT_FOUND"}})

        rows = conn.execute(
            "SELECT version_no, changed_by, change_note, created_at FROM term_versions WHERE term_id = ? ORDER BY version_no DESC",
            (term_id,),
        ).fetchall()

        versions = [VersionSummary(**dict(r)) for r in rows]
        return {"term_id": term_id, "versions": versions}
    finally:
        conn.close()


@router.get("/{term_id:path}/history/{version_no}")
def get_version(term_id: str, version_no: int):
    if not TERM_ID_RE.match(term_id):
        raise HTTPException(400, {"ok": False, "error": {"code": "INVALID_TERM_ID"}})
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM term_versions WHERE term_id = ? AND version_no = ?",
            (term_id, version_no),
        ).fetchone()
        if not row:
            raise HTTPException(404, {"ok": False, "error": {"code": "VERSION_NOT_FOUND"}})

        return VersionDetail(
            term_id=term_id,
            version_no=row["version_no"],
            content=json.loads(row["content_json"]),
            created_at=row["created_at"],
        )
    finally:
        conn.close()


@router.post("/{term_id:path}/history/{version_no}/restore")
def restore_version(term_id: str, version_no: int, body: dict = None):
    if not TERM_ID_RE.match(term_id):
        raise HTTPException(400, {"ok": False, "error": {"code": "INVALID_TERM_ID"}})
    body = body or {}
    conn = get_db()
    try:
        term_row = conn.execute("SELECT 1 FROM terms WHERE term_id = ?", (term_id,)).fetchone()
        if not term_row:
            raise HTTPException(404, {"ok": False, "error": {"code": "TERM_NOT_FOUND"}})

        version_row = conn.execute(
            "SELECT * FROM term_versions WHERE term_id = ? AND version_no = ?",
            (term_id, version_no),
        ).fetchone()
        if not version_row:
            raise HTTPException(404, {"ok": False, "error": {"code": "VERSION_NOT_FOUND"}})

        content_json = version_row["content_json"]
        change_note = body.get("change_note", f"Restored from version {version_no}")

        now = datetime.now(timezone.utc).isoformat()

        conn.execute(
            "UPDATE terms SET content_json = ?, updated_at = ? WHERE term_id = ?",
            (content_json, now, term_id),
        )
        new_version = save_version(conn, term_id, content_json, change_note)
        conn.commit()
        return {"ok": True, "term_id": term_id, "restored_from": version_no, "new_version_no": new_version}
    finally:
        conn.close()
