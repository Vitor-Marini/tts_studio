import os
import io
import glob
import zipfile
import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import List

from app.config import settings
from app.services.storage_service import storage_service, StorageStats

router = APIRouter(prefix="/api", tags=["Audios"])

@router.get("/storage/stats", response_model=StorageStats, tags=["Storage"])
async def get_storage_stats():
    return storage_service.get_storage_stats()

class AudioItem(BaseModel):
    filename: str
    size_bytes: int
    created_at: str
    url: str

class ZipItem(BaseModel):
    filename: str

@router.get("/audios")
async def list_audios():
    audios = []
    outputs_dir = settings.OUTPUTS_DIR
    if outputs_dir.exists():
        for ext in ("*.wav", "*.mp3"):
            for filepath in outputs_dir.glob(ext):
                stat = filepath.stat()
                filename = filepath.name
                audios.append(AudioItem(
                    filename=filename,
                    size_bytes=stat.st_size,
                    created_at=datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    url=f"/api/audio/{filename}"
                ))
    audios.sort(key=lambda a: a.created_at, reverse=True)
    return {"audios": audios, "total": len(audios)}

@router.get("/audio/{filename}")
async def get_audio(filename: str):
    file_path = settings.OUTPUTS_DIR / filename
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo de áudio não encontrado.")
    ext = file_path.suffix.lower()
    media_type = "audio/mpeg" if ext == ".mp3" else "audio/wav"
    return FileResponse(str(file_path), media_type=media_type)

@router.delete("/audio/{filename}")
async def delete_audio(filename: str):
    file_path = settings.OUTPUTS_DIR / filename
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo de áudio não encontrado.")
    file_path.unlink()
    return {"status": "success", "message": f"Áudio '{filename}' deletado."}

@router.delete("/audios")
async def delete_all_audios():
    deleted = 0
    outputs_dir = settings.OUTPUTS_DIR
    if outputs_dir.exists():
        for ext in ("*.wav", "*.mp3"):
            for filepath in outputs_dir.glob(ext):
                try:
                    filepath.unlink()
                    deleted += 1
                except OSError:
                    pass
    return {"status": "success", "message": f"{deleted} áudios deletados.", "deleted": deleted}

@router.post("/audio/zip")
async def download_audio_zip(items: List[ZipItem]):
    buf = io.BytesIO()
    added = 0
    outputs_dir = settings.OUTPUTS_DIR
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in items:
            clean_name = Path(item.filename).name
            file_path = outputs_dir / clean_name
            if file_path.is_file():
                zf.write(str(file_path), clean_name)
                added += 1

    if added == 0:
        raise HTTPException(status_code=404, detail="Nenhum arquivo válido encontrado para empacotar.")

    buf.seek(0)
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    headers = {"Content-Disposition": f'attachment; filename="tts_audios_{stamp}.zip"'}
    return StreamingResponse(buf, media_type="application/zip", headers=headers)
