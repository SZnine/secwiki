import json
import re
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from ..db import get_db
from ..schemas import TermDocument, TermCreate, TermUpdate

TERM_ID_RE = re.compile(r"^[a-zA-Z0-9_\-一-鿿]+/[a-zA-Z0-9_\-一-鿿]+/[a-zA-Z0-9_\-一-鿿]+$")

router = APIRouter()


def _row_to_term(row) -> TermDocument:
    content = json.loads(row["content_json"] or "{}")
    blocks = content.get("blocks", [])
    metadata = json.loads(row["metadata_json"] or "{}")
    aliases = json.loads(row["aliases_json"] or "[]")
    return TermDocument(
        term_id=row["term_id"],
        domain_id=row["domain_id"],
        object_id=row["object_id"],
        slug=row["slug"],
        title=row["title"],
        subtitle=row["subtitle"] or "",
        aliases=aliases,
        summary=row["summary"] or "",
        status=row["status"],
        metadata=metadata,
        blocks=blocks,
        updated_at=row["updated_at"],
    )


def save_version(conn, term_id: str, content_json: str, change_note: str = ""):
    row = conn.execute(
        "SELECT COALESCE(MAX(version_no), 0) as v FROM term_versions WHERE term_id = ?",
        (term_id,),
    ).fetchone()
    version_no = row["v"] + 1
    conn.execute(
        "INSERT INTO term_versions (term_id, version_no, content_json, change_note) VALUES (?, ?, ?, ?)",
        (term_id, version_no, content_json, change_note),
    )
    return version_no


@router.get("/{term_id:path}", response_model=TermDocument)
def get_term(term_id: str):
    if not TERM_ID_RE.match(term_id):
        raise HTTPException(400, {"ok": False, "error": {"code": "INVALID_TERM_ID"}})
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM terms WHERE term_id = ?", (term_id,)).fetchone()
        if not row:
            raise HTTPException(404, {"ok": False, "error": {"code": "TERM_NOT_FOUND"}})
        return _row_to_term(row)
    finally:
        conn.close()


@router.post("")
def create_term(payload: TermCreate):
    conn = get_db()
    try:
        existing = conn.execute("SELECT 1 FROM terms WHERE term_id = ?", (payload.term_id,)).fetchone()
        if existing:
            raise HTTPException(409, {"ok": False, "error": {"code": "TERM_ALREADY_EXISTS"}})

        content_json = json.dumps({"blocks": [b.model_dump() for b in payload.blocks]})
        now = datetime.now(timezone.utc).isoformat()

        conn.execute(
            """INSERT INTO terms (term_id, domain_id, object_id, slug, title, subtitle, aliases_json, summary, status, content_json, metadata_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                payload.term_id,
                payload.domain_id,
                payload.object_id,
                payload.slug,
                payload.title,
                payload.subtitle,
                json.dumps(payload.aliases),
                payload.summary,
                payload.status,
                content_json,
                json.dumps(payload.metadata),
                now,
                now,
            ),
        )
        save_version(conn, payload.term_id, content_json, "Initial creation")
        conn.commit()
        return {"ok": True, "term_id": payload.term_id}
    finally:
        conn.close()


@router.put("/{term_id:path}")
def update_term(term_id: str, payload: TermUpdate):
    if not TERM_ID_RE.match(term_id):
        raise HTTPException(400, {"ok": False, "error": {"code": "INVALID_TERM_ID"}})
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM terms WHERE term_id = ?", (term_id,)).fetchone()
        if not row:
            raise HTTPException(404, {"ok": False, "error": {"code": "TERM_NOT_FOUND"}})

        now = datetime.now(timezone.utc).isoformat()
        content_json = json.dumps({"blocks": [b.model_dump() for b in payload.blocks]})

        conn.execute(
            """UPDATE terms SET
                title = COALESCE(NULLIF(?, ''), title),
                subtitle = ?,
                aliases_json = ?,
                summary = ?,
                status = ?,
                content_json = ?,
                metadata_json = ?,
                updated_at = ?
            WHERE term_id = ?""",
            (
                payload.title,
                payload.subtitle,
                json.dumps(payload.aliases),
                payload.summary,
                payload.status,
                content_json,
                json.dumps(payload.metadata),
                now,
                term_id,
            ),
        )

        version_no = save_version(conn, term_id, content_json, payload.change_note)
        conn.commit()
        return {"ok": True, "term_id": term_id, "version_no": version_no, "updated_at": now}
    finally:
        conn.close()


@router.delete("/{term_id:path}")
def archive_term(term_id: str):
    if not TERM_ID_RE.match(term_id):
        raise HTTPException(400, {"ok": False, "error": {"code": "INVALID_TERM_ID"}})
    conn = get_db()
    try:
        row = conn.execute("SELECT 1 FROM terms WHERE term_id = ?", (term_id,)).fetchone()
        if not row:
            raise HTTPException(404, {"ok": False, "error": {"code": "TERM_NOT_FOUND"}})

        now = datetime.now(timezone.utc).isoformat()
        conn.execute("UPDATE terms SET status = 'archived', updated_at = ? WHERE term_id = ?", (now, term_id))
        conn.commit()
        return {"ok": True, "term_id": term_id, "status": "archived"}
    finally:
        conn.close()
