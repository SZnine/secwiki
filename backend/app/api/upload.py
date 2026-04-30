import os
import re
import httpx
from urllib.parse import quote, urlparse
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

    base_name = safe_filename(term_slug) if term_slug else "image"
    filename = f"{base_name}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(content)

    encoded_filename = quote(filename)
    relative_path = f"/uploads/images/{encoded_filename}"
    return JSONResponse({"url": relative_path, "path": relative_path, "filename": filename})


@router.post("/images/from-url")
async def download_image(
    url: str,
    term_slug: str = Form(""),
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Validate URL
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netlock:
        raise HTTPException(400, "无效的 URL")
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "仅支持 http/https 链接")

    # Check host allowlist (basic SSRF protection)
    blocked_hosts = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}
    if parsed.netloc.lower() in blocked_hosts:
        raise HTTPException(400, "不允许的域名")

    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            resp = client.get(url)
    except Exception as e:
        raise HTTPException(400, f"无法下载图片: {e}")

    if resp.status_code != 200:
        raise HTTPException(400, f"下载失败: HTTP {resp.status_code}")

    content = resp.content
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, f"图片大小超过限制 (最大 {MAX_FILE_SIZE // 1024 // 1024}MB)")

    # Detect extension from Content-Type header or URL
    ext = ""
    content_type = resp.headers.get("content-type", "").lower()
    if "image/png" in content_type:
        ext = ".png"
    elif "image/jpeg" in content_type or "image/jpg" in content_type:
        ext = ".jpg"
    elif "image/gif" in content_type:
        ext = ".gif"
    elif "image/webp" in content_type:
        ext = ".webp"
    elif "image/svg" in content_type:
        ext = ".svg"
    elif "image/bmp" in content_type:
        ext = ".bmp"

    if not ext:
        # Try from URL path
        url_ext = os.path.splitext(parsed.path or "")[1].lower()
        if url_ext in ALLOWED_EXTENSIONS:
            ext = url_ext
        else:
            ext = ".png"  # default fallback

    base_name = safe_filename(term_slug) if term_slug else "image"
    filename = f"{base_name}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(content)

    encoded_filename = quote(filename)
    relative_path = f"/uploads/images/{encoded_filename}"
    return JSONResponse({"url": relative_path, "path": relative_path, "filename": filename})