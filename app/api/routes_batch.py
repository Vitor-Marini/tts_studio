import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from app.services.batch_service import batch_service, BatchJob
from app.config import settings

router = APIRouter(prefix="/api/batch", tags=["Batch"])

class StartBatchRequest(BaseModel):
    token: str
    voice: str
    filename_column: str
    text_column: str
    format: str = "mp3"
    speed: Optional[float] = None
    skip_existing: bool = True

@router.post("/inspect")
async def inspect_batch_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".csv", ".tsv", ".txt")):
        raise HTTPException(status_code=400, detail="O arquivo deve ser um CSV (.csv).")
    try:
        content = await file.read()
        return batch_service.save_temp_csv(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar CSV: {str(e)}")

@router.post("/start", response_model=BatchJob)
async def start_batch(req: StartBatchRequest):
    try:
        return batch_service.start_batch(
            token=req.token,
            voice_name=req.voice,
            filename_column=req.filename_column,
            text_column=req.text_column,
            format=req.format,
            speed=req.speed,
            skip_existing=req.skip_existing
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao iniciar processamento em lote: {str(e)}")

@router.get("/{batch_id}", response_model=BatchJob)
async def get_batch_status(batch_id: str):
    job = batch_service.get_job(batch_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Lote '{batch_id}' não encontrado.")
    return job

@router.post("/{batch_id}/cancel")
async def cancel_batch(batch_id: str):
    success = batch_service.cancel_batch(batch_id)
    if not success:
        raise HTTPException(status_code=400, detail="O lote já foi finalizado ou não pôde ser cancelado.")
    return {"status": "success", "message": "Cancelamento solicitado com sucesso."}

@router.get("/{batch_id}/download")
async def download_batch_zip(batch_id: str):
    zip_path = batch_service.get_zip_path(batch_id)
    if not zip_path or not zip_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo ZIP de resultados ainda não está disponível.")
    return FileResponse(
        str(zip_path),
        media_type="application/zip",
        filename=f"{batch_id}.zip"
    )

@router.get("/{batch_id}/audio/{filename}")
async def get_batch_audio(batch_id: str, filename: str):
    audio_path = settings.BATCHES_DIR / batch_id / "audios" / filename
    if not audio_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo de áudio do lote não encontrado.")
    media_type = "audio/mpeg" if audio_path.suffix.lower() == ".mp3" else "audio/wav"
    return FileResponse(str(audio_path), media_type=media_type)

class ItemTextRequest(BaseModel):
    text: str

class RegenerateItemRequest(BaseModel):
    text: Optional[str] = None

@router.put("/{batch_id}/items/{item_index}/text")
async def update_batch_item_text(batch_id: str, item_index: int, req: ItemTextRequest):
    try:
        item = batch_service.update_item_text(batch_id, item_index, req.text)
        return item
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{batch_id}/items/{item_index}/regenerate")
async def regenerate_batch_item(batch_id: str, item_index: int, req: RegenerateItemRequest):
    try:
        item = batch_service.regenerate_item(batch_id, item_index, req.text)
        return item
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao regerar item: {str(e)}")

