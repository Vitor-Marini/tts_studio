from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.services.tts_service import tts_service

router = APIRouter(prefix="/api", tags=["TTS"])

class TTSRequest(BaseModel):
    text: str = Field(..., description="Texto a ser sintetizado")
    voice: str = Field(..., description="Nome da voz cadastrada")
    format: str = Field("mp3", description="Formato de saída ('mp3' ou 'wav')")
    speed: Optional[float] = Field(None, description="Velocidade da fala (ex: 1.0)")
    language: str = Field("pt", description="Código do idioma (padrão 'pt')")

@router.post("/tts")
async def generate_tts(req: TTSRequest):
    try:
        result = tts_service.synthesize(
            text=req.text,
            voice_name=req.voice,
            speed=req.speed,
            format=req.format,
            language=req.language
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno de síntese: {str(e)}")
