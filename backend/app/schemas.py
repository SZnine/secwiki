from pydantic import BaseModel
from typing import Optional


# ── Taxonomy ──

class TermIndex(BaseModel):
    term_id: str
    title: str
    slug: str
    subtitle: str = ""
    summary: str = ""
    status: str = "draft"


class ObjectCategoryOut(BaseModel):
    id: str
    domain_id: str
    name: str
    definition: str = ""
    description: str = ""
    sort_order: int = 0
    terms: list[TermIndex] = []


class DomainOut(BaseModel):
    id: str
    name: str
    description: str = ""
    sort_order: int = 0
    objects: list[ObjectCategoryOut] = []


class TaxonomyOut(BaseModel):
    domains: list[DomainOut]


# ── Term Document ──

class Block(BaseModel):
    type: str
    id: str
    title: str = ""
    content: str = ""
    items: list = []
    mode: str = ""
    svg: str = ""

    model_config = {"extra": "allow"}


class TermDocument(BaseModel):
    term_id: str
    domain_id: str
    object_id: str
    slug: str
    title: str
    subtitle: str = ""
    aliases: list[str] = []
    summary: str = ""
    status: str = "draft"
    metadata: dict = {}
    blocks: list[Block] = []
    updated_at: str = ""


class TermCreate(BaseModel):
    term_id: str
    domain_id: str
    object_id: str
    slug: str
    title: str
    subtitle: str = ""
    aliases: list[str] = []
    summary: str = ""
    status: str = "draft"
    metadata: dict = {}
    blocks: list[Block] = []


class TermUpdate(BaseModel):
    title: str = ""
    subtitle: str = ""
    aliases: list[str] = []
    summary: str = ""
    status: str = "draft"
    metadata: dict = {}
    blocks: list[Block] = []
    change_note: str = ""


# ── Version ──

class VersionSummary(BaseModel):
    version_no: int
    changed_by: str
    change_note: str
    created_at: str


class VersionDetail(BaseModel):
    term_id: str
    version_no: int
    content: dict
    created_at: str


# ── Search ──

class SearchResult(BaseModel):
    term_id: str
    title: str
    subtitle: str = ""
    domain_name: str = ""
    object_name: str = ""
    summary: str = ""
    matched_fields: list[str] = []


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]


# ── Import / Export ──

class ImportPayload(BaseModel):
    mode: str = "merge"
    payload: dict = {}

    @classmethod
    def validate_term_entry(cls, term_id: str, data: dict):
        if not term_id or "/" not in term_id:
            raise ValueError(f"Invalid term_id format: {term_id}")
        parts = term_id.split("/")
        if len(parts) < 3:
            raise ValueError(f"term_id must have at least 3 segments: {term_id}")


class ImportResult(BaseModel):
    ok: bool
    mode: str
    summary: dict = {}


class ExportData(BaseModel):
    version: int = 2
    taxonomy: dict = {}
    terms: dict = {}
