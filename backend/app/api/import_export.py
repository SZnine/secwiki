import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from ..db import get_db
from ..schemas import ImportPayload

router = APIRouter()


@router.get("/export")
def export_all():
    conn = get_db()
    try:
        taxonomy_rows = conn.execute("SELECT * FROM domains ORDER BY sort_order").fetchall()
        domains = []
        for dr in taxonomy_rows:
            objects = []
            obj_rows = conn.execute(
                "SELECT * FROM object_categories WHERE domain_id = ? ORDER BY sort_order",
                (dr["id"],),
            ).fetchall()
            for orow in obj_rows:
                objects.append({"id": orow["id"], "name": orow["name"], "definition": orow["definition"] or ""})
            domains.append({"id": dr["id"], "name": dr["name"], "objects": objects})

        term_rows = conn.execute("SELECT * FROM terms WHERE status != 'archived'").fetchall()
        terms = {}
        for tr in term_rows:
            terms[tr["term_id"]] = {
                "term_id": tr["term_id"],
                "domain_id": tr["domain_id"],
                "object_id": tr["object_id"],
                "slug": tr["slug"],
                "title": tr["title"],
                "subtitle": tr["subtitle"] or "",
                "aliases": json.loads(tr["aliases_json"] or "[]"),
                "summary": tr["summary"] or "",
                "status": tr["status"],
                "metadata": json.loads(tr["metadata_json"] or "{}"),
                "blocks": json.loads(tr["content_json"] or "{}").get("blocks", []),
            }

        return {
            "version": 2,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "taxonomy": {"domains": domains},
            "terms": terms,
        }
    finally:
        conn.close()


@router.post("/import")
def import_content(body: ImportPayload):
    terms_data = body.payload.get("terms", {})

    if not terms_data:
        raise HTTPException(400, {"ok": False, "error": {"code": "IMPORT_SCHEMA_ERROR", "message": "No terms in payload"}})

    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()
    created = 0
    updated = 0
    skipped = 0
    errors = []

    try:
        for term_id, tdata in terms_data.items():
            try:
                if not isinstance(tdata, dict):
                    errors.append({"term_id": term_id, "error": "Term data must be an object"})
                    continue

                parts = term_id.split("/")
                if len(parts) < 3:
                    errors.append({"term_id": term_id, "error": "term_id must have at least 3 segments (domain/object/slug)"})
                    continue

                domain_id = tdata.get("domain_id", parts[0])
                object_id = tdata.get("object_id", parts[1])
                slug = tdata.get("slug", parts[-1])
                title = tdata.get("title", slug)
                subtitle = tdata.get("subtitle", "")
                aliases = tdata.get("aliases", [])
                summary = tdata.get("summary", "")
                status = tdata.get("status", "published")
                metadata = tdata.get("metadata", {})
                blocks = tdata.get("blocks", [])
                content_json = json.dumps({"blocks": blocks})

                if not title or not slug:
                    errors.append({"term_id": term_id, "error": "title and slug are required"})
                    continue

                if status not in ("draft", "published", "archived"):
                    errors.append({"term_id": term_id, "error": f"Invalid status: {status}"})
                    continue

                # Auto-create domain if missing
                domain_exists = conn.execute("SELECT 1 FROM domains WHERE id = ?", (domain_id,)).fetchone()
                if not domain_exists:
                    conn.execute(
                        "INSERT INTO domains (id, name, sort_order, created_at, updated_at) VALUES (?, ?, 99, ?, ?)",
                        (domain_id, tdata.get("domain_name", domain_id), now, now),
                    )

                # Auto-create object_category if missing
                obj_exists = conn.execute(
                    "SELECT 1 FROM object_categories WHERE domain_id = ? AND id = ?",
                    (domain_id, object_id),
                ).fetchone()
                if not obj_exists:
                    conn.execute(
                        "INSERT INTO object_categories (id, domain_id, name, definition, sort_order, created_at, updated_at) VALUES (?, ?, ?, '', 99, ?, ?)",
                        (object_id, domain_id, tdata.get("object_name", object_id), now, now),
                    )

                existing = conn.execute("SELECT 1 FROM terms WHERE term_id = ?", (term_id,)).fetchone()

                if existing:
                    if body.mode == "overwrite":
                        conn.execute(
                            """UPDATE terms SET title=?, subtitle=?, aliases_json=?, summary=?, status=?, content_json=?, metadata_json=?, updated_at=?
                               WHERE term_id=?""",
                            (title, subtitle, json.dumps(aliases), summary, status, content_json, json.dumps(metadata), now, term_id),
                        )
                        updated += 1
                    else:
                        skipped += 1
                else:
                    conn.execute(
                        """INSERT INTO terms (term_id, domain_id, object_id, slug, title, subtitle, aliases_json, summary, status, content_json, metadata_json, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (term_id, domain_id, object_id, slug, title, subtitle, json.dumps(aliases), summary, status, content_json, json.dumps(metadata), now, now),
                    )
                    created += 1

            except Exception as e:
                errors.append({"term_id": term_id, "error": str(e)})

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "ok": True,
        "mode": body.mode,
        "summary": {"created": created, "updated": updated, "skipped": skipped, "errors": errors},
    }
