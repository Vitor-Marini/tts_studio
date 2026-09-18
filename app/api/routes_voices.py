import os
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional

from app.config import settings
from app.services.voice_service import voice_service, VoiceModel

router = APIRouter(prefix="/api/voices", tags=["Voices"])

class UpdateVoiceRequest(BaseModel):
    default_speed: Optional[float] = None
    new_name: Optional[str] = None

@router.get("", response_model=List[VoiceModel])
async def list_voices():
    return voice_service.list_voices()

@router.get("/{name}", response_model=VoiceModel)
async def get_voice(name: str):
    voice = voice_service.get_voice(name)
    if not voice:
        raise HTTPException(status_code=404, detail=f"Voz '{name}' não encontrada.")
    return voice

@router.post("", response_model=VoiceModel)
async def create_voice(
    name: str = Form(...),
    default_speed: float = Form(1.0),
    files: List[UploadFile] = File([])
):
    try:
        voice = voice_service.create_voice(name=name, default_speed=default_speed)
        # Salva amostras enviadas
        for file in files:
            if file.filename:
                content = await file.read()
                voice_service.add_sample(voice.name, file.filename, content)
        return voice_service.get_voice(voice.name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{name}", response_model=VoiceModel)
async def update_voice(name: str, req: UpdateVoiceRequest):
    try:
        return voice_service.update_voice(
            name=name,
            default_speed=req.default_speed,
            new_name=req.new_name
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/samples")
async def add_samples(name: str, files: List[UploadFile] = File(...)):
    try:
        voice = voice_service.get_voice(name)
        if not voice:
            raise HTTPException(status_code=404, detail=f"Voz '{name}' não encontrada.")

        added = []
        for file in files:
            if file.filename:
                content = await file.read()
                sample = voice_service.add_sample(name, file.filename, content)
                added.append(sample)
        return {"status": "success", "added_samples": added}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{name}/samples/{filename}")
async def delete_sample(name: str, filename: str):
    try:
        voice_service.delete_sample(name, filename)
        return {"status": "success", "message": f"Amostra '{filename}' removida."}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{name}")
async def delete_voice(name: str):
    try:
        voice_service.delete_voice(name)
        return {"status": "success", "message": f"Voz '{name}' deletada com sucesso."}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}/samples/{filename}")
async def get_sample_audio(name: str, filename: str):
    sample_path = settings.VOICES_DIR / name / filename
    if not sample_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo de áudio não encontrado.")
    media_type = "audio/mpeg" if sample_path.suffix.lower() == ".mp3" else "audio/wav"
    return FileResponse(str(sample_path), media_type=media_type)
