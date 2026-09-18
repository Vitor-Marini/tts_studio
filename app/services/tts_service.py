import os
import uuid
import time
import shutil
import hashlib
import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from app.config import settings
from app.core.engine import engine
from app.services.voice_service import voice_service
from app.services.storage_service import storage_service
from app.utils.audio import convert_wav_to_mp3, get_audio_duration

class TTSService:
    def __init__(self):
        self.outputs_dir = settings.OUTPUTS_DIR
        self.outputs_dir.mkdir(parents=True, exist_ok=True)

    def synthesize(
        self,
        text: str,
        voice_name: str,
        speed: Optional[float] = None,
        format: str = "mp3",
        language: str = "pt"
    ) -> Dict[str, Any]:
        text = text.strip()
        if not text:
            raise ValueError("O texto para síntese não pode estar vazio.")

        voice = voice_service.get_voice(voice_name)
        if not voice:
            raise FileNotFoundError(f"Voz '{voice_name}' não encontrada.")

        effective_speed = float(speed) if speed is not None else float(voice.default_speed)
        speaker_wavs = voice_service.get_reference_paths(voice_name)

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        short_id = uuid.uuid4().hex[:8]
        target_format = format.lower()

        wav_filename = f"tts_{timestamp}_{short_id}.wav"
        wav_path = self.outputs_dir / wav_filename

        # Executa a síntese no engine sempre fresca (sem cache de áudio para permitir múltiplos takes)
        elapsed = engine.synthesize(
            text=text,
            speaker_wavs=speaker_wavs,
            output_path=wav_path,
            language=language,
            speed=effective_speed
        )

        final_filename = wav_filename
        final_path = wav_path

        # Se solicitado MP3, converte com ffmpeg
        if target_format == "mp3":
            mp3_filename = f"tts_{timestamp}_{short_id}.mp3"
            mp3_path = self.outputs_dir / mp3_filename
            success = convert_wav_to_mp3(wav_path, mp3_path)
            if success and mp3_path.exists():
                final_filename = mp3_filename
                final_path = mp3_path
                try:
                    wav_path.unlink()
                except OSError:
                    pass
            else:
                final_filename = wav_filename
                final_path = wav_path

        duration = get_audio_duration(final_path)

        # Garante limite de armazenamento
        try:
            storage_service.enforce_storage_limit()
        except Exception:
            pass

        return {
            "id": f"tts_{timestamp}_{short_id}",
            "filename": final_filename,
            "audio_url": f"/api/audio/{final_filename}",
            "duration_seconds": round(duration, 2),
            "elapsed_time": round(elapsed, 2),
            "voice": voice_name,
            "speed": effective_speed,
            "format": target_format
        }

tts_service = TTSService()
