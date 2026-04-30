from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from urllib.parse import unquote
import os

from .db import init_db, get_db
from .api import taxonomy, terms, history, search, import_export, upload

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads", "images")

os.makedirs(UPLOADS_DIR, exist_ok=True)


def auto_seed():
    """Auto-initialize taxonomy if database is empty."""
    try:
        init_db()
        conn = get_db()
        count = conn.execute("SELECT COUNT(*) FROM domains").fetchone()[0]
        conn.close()
        if count == 0:
            from .seed import seed
            seed()
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    auto_seed()
    yield


app = FastAPI(title="SecWiki API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:*", "http://127.0.0.1:*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(taxonomy.router, prefix="/api/v1/taxonomy", tags=["taxonomy"])
app.include_router(history.router, prefix="/api/v1/terms", tags=["history"])
app.include_router(terms.router, prefix="/api/v1/terms", tags=["terms"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(import_export.router, prefix="/api/v1", tags=["import-export"])
app.include_router(upload.router, prefix="/api/v1/uploads", tags=["uploads"])


@app.get("/api/v1/health")
def health():
    return {"ok": True, "version": "1.0.0"}


# Serve frontend static files (JS, CSS)
if os.path.isdir(FRONTEND_DIR):
    FRONTEND_REAL = os.path.realpath(FRONTEND_DIR)
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/{path:path}")
    async def serve_spa(path: str, request: Request):
        # Serve uploaded images (path is already URL-decoded by Starlette)
        if path.startswith("uploads/images/"):
            decoded_path = unquote(path)
            safe_path = os.path.realpath(os.path.join(BASE_DIR, decoded_path))
            if safe_path.startswith(os.path.realpath(UPLOADS_DIR)) and os.path.isfile(safe_path):
                return FileResponse(safe_path)
            raise HTTPException(status_code=404)

        if path.startswith("api/"):
            raise HTTPException(status_code=404)

        file_path = os.path.realpath(os.path.join(FRONTEND_DIR, path))
        if not file_path.startswith(FRONTEND_REAL):
            raise HTTPException(status_code=404)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
