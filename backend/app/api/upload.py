import os
import re
from urllib.parse import quote
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "images")

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

router = APIRouter()


def safe_filename(name):
    """Convert a string to a safe filename: keep ASCII, CJK, digits, hyphens."""
    name = re.sub(r'[^\w一-鿿㐀-䶿　-〿＀-￯\-]', '_', name)
    name = re.sub(r'_+', '_', name).strip('_')
    return name or "image"


@router.post("/images")
async def upload_image(
    file: UploadFile = File(...),
    term_slug: str = Form(""),
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"不支持的图片格式: {ext}。支持的格式: {', '.join(ALLOWED_EXTENSIONS)}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, f"图片大小超过限制 (最大 {MAX_FILE_SIZE // 1024 // 1024}MB)")

    # Build filename from slug (ASCII-safe), fallback to "image"
    base_name = safe_filename(term_slug) if term_slug else "image"
    filename = f"{base_name}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(content)

    # URL-encode the path for proper Chinese character support
    encoded_filename = quote(filename)
    relative_path = f"/uploads/images/{encoded_filename}"
    return JSONResponse({"url": relative_path, "path": relative_path, "filename": filename})
