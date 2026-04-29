from fastapi import APIRouter, Query
from ..db import get_db
from ..schemas import SearchResult, SearchResponse

router = APIRouter()

MAX_QUERY_LENGTH = 200


@router.get("")
def search_terms(q: str = Query("", max_length=MAX_QUERY_LENGTH)):
    conn = get_db()
    try:
        query = q.strip().lower()
        if not query:
            return SearchResponse(query=q, results=[])

        rows = conn.execute(
            """SELECT t.term_id, t.title, t.subtitle, t.summary, t.aliases_json, t.tags_json,
                      d.name as domain_name, oc.name as object_name
               FROM terms t
               JOIN domains d ON t.domain_id = d.id
               JOIN object_categories oc ON t.domain_id = oc.domain_id AND t.object_id = oc.id
               WHERE t.status != 'archived'
               AND (
                   LOWER(t.title) LIKE ? OR
                   LOWER(t.subtitle) LIKE ? OR
                   LOWER(t.summary) LIKE ? OR
                   LOWER(t.aliases_json) LIKE ? OR
                   LOWER(t.tags_json) LIKE ? OR
                   LOWER(t.slug) LIKE ?
               )
               ORDER BY t.title
               LIMIT 50""",
            (f"%{query}%", f"%{query}%", f"%{query}%", f"%{query}%", f"%{query}%", f"%{query}%"),
        ).fetchall()

        results = []
        for r in rows:
            matched = []
            if query in (r["title"] or "").lower():
                matched.append("title")
            if query in (r["subtitle"] or "").lower():
                matched.append("subtitle")
            if query in (r["summary"] or "").lower():
                matched.append("summary")
            if query in (r["aliases_json"] or "").lower():
                matched.append("aliases")
            if query in (r["tags_json"] or "").lower():
                matched.append("tags")
            if not matched:
                matched = ["title"]

            results.append(SearchResult(
                term_id=r["term_id"],
                title=r["title"],
                subtitle=r["subtitle"] or "",
                domain_name=r["domain_name"],
                object_name=r["object_name"],
                summary=r["summary"] or "",
                matched_fields=matched,
            ))

        return SearchResponse(query=q, results=results)
    finally:
        conn.close()


@router.get("/suggest")
def suggest_terms(q: str = Query("", max_length=MAX_QUERY_LENGTH)):
    conn = get_db()
    try:
        query = q.strip().lower()
        if not query:
            return {"suggestions": []}

        rows = conn.execute(
            """SELECT term_id, title FROM terms
               WHERE status != 'archived' AND (LOWER(title) LIKE ? OR LOWER(slug) LIKE ?)
               ORDER BY title LIMIT 10""",
            (f"{query}%", f"{query}%"),
        ).fetchall()

        suggestions = [{"label": r["title"], "term_id": r["term_id"], "type": "term"} for r in rows]
        return {"suggestions": suggestions}
    finally:
        conn.close()
