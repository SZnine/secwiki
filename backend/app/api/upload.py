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

    # Detect extension from magic bytes (most reliable)
    ext = _detect_ext_from_bytes(content)
    if not ext:
        # Fallback: Content-Type header
        content_type = resp.headers.get("content-type", "").lower()
        if "png" in content_type:
            ext = ".png"
        elif "jpeg" in content_type or "jpg" in content_type:
            ext = ".jpg"
        elif "gif" in content_type:
            ext = ".gif"
        elif "webp" in content_type:
            ext = ".webp"
        elif "svg" in content_type:
            ext = ".svg"
        elif "bmp" in content_type:
            ext = ".bmp"

    if not ext:
        # Last resort: URL path extension
        url_ext = os.path.splitext(parsed.path or "")[1].lower()
        if url_ext in ALLOWED_EXTENSIONS:
            ext = url_ext
        else:
            ext = ".png"  # safe default

    base_name = safe_filename(term_slug) if term_slug else "image"
    filename = f"{base_name}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(content)

    encoded_filename = quote(filename)
    relative_path = f"/uploads/images/{encoded_filename}"
    return JSONResponse({"url": relative_path, "path": relative_path, "filename": filename})


def _detect_ext_from_bytes(data: bytes) -> str:
    """Detect image format from magic bytes."""
    if len(data) < 12:
        return ""

    # PNG: 89 50 4E 47
    if data[:4] == b'\x89PNG':
        return ".png"

    # JPEG: FF D8 FF
    if data[:3] == b'\xff\xd8\xff':
        return ".jpg"

    # GIF: 47 49 46 38 (GIF8)
    if data[:4] in (b'GIF8', b'GIF7'):
        return ".gif"

    # WebP: 52 49 46 46 .... 57 45 42 50 (RIFF....WEBP)
    if data[:4] == b'RIFF' and len(data) >= 12 and data[8:12] == b'WEBP':
        return ".webp"

    # BMP: 42 4D
    if data[:2] == b'BM':
        return ".bmp"

    # SVG (text)
    if data[:5] == b'<svg ' or data[:6] == b'<?xml':
        # Check if it contains SVG
        try:
            text = data[:1024].decode("utf-8", errors="ignore")
            if "<svg" in text:
                return ".svg"
        except:
            pass

    return ""