from fastapi import APIRouter, HTTPException
from ..db import get_db
from ..schemas import TaxonomyOut, DomainOut, ObjectCategoryOut, TermIndex

router = APIRouter()


def _build_terms(conn, domain_id: str, object_id: str) -> list[TermIndex]:
    rows = conn.execute(
        "SELECT term_id, title, slug, subtitle, summary, status FROM terms WHERE domain_id = ? AND object_id = ? AND status != 'archived' ORDER BY slug",
        (domain_id, object_id),
    ).fetchall()
    return [TermIndex(**dict(t)) for t in rows]


def _build_object(conn, orow) -> ObjectCategoryOut:
    return ObjectCategoryOut(
        id=orow["id"],
        domain_id=orow["domain_id"],
        name=orow["name"],
        definition=orow["definition"] or "",
        description=orow["description"] or "",
        sort_order=orow["sort_order"],
        terms=_build_terms(conn, orow["domain_id"], orow["id"]),
    )


def _build_objects(conn, domain_id: str) -> list[ObjectCategoryOut]:
    rows = conn.execute(
        "SELECT * FROM object_categories WHERE domain_id = ? ORDER BY sort_order, id",
        (domain_id,),
    ).fetchall()
    return [_build_object(conn, orow) for orow in rows]


@router.get("", response_model=TaxonomyOut)
def get_taxonomy():
    conn = get_db()
    try:
        domains_rows = conn.execute(
            "SELECT * FROM domains ORDER BY sort_order, id"
        ).fetchall()
        domains = []
        for dr in domains_rows:
            domains.append(DomainOut(
                id=dr["id"],
                name=dr["name"],
                description=dr["description"] or "",
                sort_order=dr["sort_order"],
                objects=_build_objects(conn, dr["id"]),
            ))
        return TaxonomyOut(domains=domains)
    finally:
        conn.close()


@router.get("/domains/{domain_id}", response_model=DomainOut)
def get_domain(domain_id: str):
    conn = get_db()
    try:
        dr = conn.execute("SELECT * FROM domains WHERE id = ?", (domain_id,)).fetchone()
        if not dr:
            raise HTTPException(404, {"ok": False, "error": {"code": "DOMAIN_NOT_FOUND"}})

        return DomainOut(
            id=dr["id"],
            name=dr["name"],
            description=dr["description"] or "",
            sort_order=dr["sort_order"],
            objects=_build_objects(conn, domain_id),
        )
    finally:
        conn.close()


@router.get("/domains/{domain_id}/objects/{object_id}", response_model=ObjectCategoryOut)
def get_object_category(domain_id: str, object_id: str):
    conn = get_db()
    try:
        orow = conn.execute(
            "SELECT * FROM object_categories WHERE domain_id = ? AND id = ?",
            (domain_id, object_id),
        ).fetchone()
        if not orow:
            raise HTTPException(404, {"ok": False, "error": {"code": "OBJECT_NOT_FOUND"}})

        return _build_object(conn, orow)
    finally:
        conn.close()
