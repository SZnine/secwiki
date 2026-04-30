import os
import uuid
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "images")

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

router = APIRouter()


@router.post("/images")
async def upload_image(file: UploadFile = File(...)):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"不支持的图片格式: {ext}。支持的格式: {', '.join(ALLOWED_EXTENSIONS)}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, f"图片大小超过限制 (最大 {MAX_FILE_SIZE // 1024 // 1024}MB)")

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    safe_filename = f"{timestamp}_{unique_id}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    relative_path = f"/uploads/images/{safe_filename}"
    return JSONResponse({"url": relative_path, "path": relative_path})
