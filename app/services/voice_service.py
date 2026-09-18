import os
import json
import shutil
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from app.config import settings
from app.utils.audio import is_valid_audio_filename

class VoiceSample(BaseModel):
    filename: str
    url: str
    size_bytes: int

class VoiceModel(BaseModel):
    name: str
    default_speed: float = 1.0
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    samples: List[VoiceSample] = []

class VoiceService:
    def __init__(self):
        self.voices_dir = settings.VOICES_DIR
        self.voices_dir.mkdir(parents=True, exist_ok=True)
        self._seed_default_voice_if_empty()

    def _seed_default_voice_if_empty(self):
        """Se não houver nenhuma voz cadastrada e houver referências no repositório tetsTTS, inicializa uma voz padrão."""
        existing = self.list_voices()
        if not existing:
            # Procura por referências em tetsTTS para facilitar o teste inicial
            test_tts_dir = settings.BASE_DIR.parent / "tetsTTS"
            ref_files = list(test_tts_dir.glob("reference*.wav"))
            if ref_files:
                default_voice_dir = self.voices_dir / "Voz_Padrao"
                default_voice_dir.mkdir(parents=True, exist_ok=True)
                for f in ref_files[:3]:
                    shutil.copy(f, default_voice_dir / f.name)
                meta = {
                    "name": "Voz_Padrao",
                    "default_speed": 1.0,
                    "created_at": datetime.now().isoformat()
                }
                with open(default_voice_dir / "voice.json", "w", encoding="utf-8") as meta_file:
                    json.dump(meta, meta_file, indent=2)

    def _clean_name(self, name: str) -> str:
        clean = re.sub(r'[^a-zA-Z0-9_\- ]', '', name).strip()
        clean = clean.replace(" ", "_")
        if not clean:
            raise ValueError("Nome de voz inválido.")
        return clean

    def list_voices(self) -> List[VoiceModel]:
        voices = []
        if not self.voices_dir.exists():
            return voices

        for item in sorted(self.voices_dir.iterdir()):
            if item.is_dir():
                voice = self.get_voice(item.name)
                if voice:
                    voices.append(voice)
        return voices

    def get_voice(self, name: str) -> Optional[VoiceModel]:
        voice_dir = self.voices_dir / name
        if not voice_dir.is_dir():
            return None

        meta_file = voice_dir / "voice.json"
        default_speed = 1.0
        created_at = datetime.now().isoformat()

        if meta_file.exists():
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    default_speed = data.get("default_speed", 1.0)
                    created_at = data.get("created_at", created_at)
            except Exception:
                pass

        samples = []
        for file in sorted(voice_dir.iterdir()):
            if file.is_file() and is_valid_audio_filename(file.name):
                samples.append(VoiceSample(
                    filename=file.name,
                    url=f"/api/voices/{name}/samples/{file.name}",
                    size_bytes=file.stat().st_size
                ))

        return VoiceModel(
            name=name,
            default_speed=default_speed,
            created_at=created_at,
            samples=samples
        )

    def create_voice(self, name: str, default_speed: float = 1.0) -> VoiceModel:
        clean = self._clean_name(name)
        voice_dir = self.voices_dir / clean
        if voice_dir.exists():
            raise ValueError(f"Já existe uma voz com o nome '{clean}'.")

        voice_dir.mkdir(parents=True, exist_ok=True)
        meta = {
            "name": clean,
            "default_speed": default_speed,
            "created_at": datetime.now().isoformat()
        }
        with open(voice_dir / "voice.json", "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        return self.get_voice(clean)

    def update_voice(self, name: str, default_speed: Optional[float] = None, new_name: Optional[str] = None) -> VoiceModel:
        voice = self.get_voice(name)
        if not voice:
            raise FileNotFoundError(f"Voz '{name}' não encontrada.")

        current_dir = self.voices_dir / name
        target_name = name

        if new_name and new_name != name:
            clean_new = self._clean_name(new_name)
            target_dir = self.voices_dir / clean_new
            if target_dir.exists():
                raise ValueError(f"Já existe uma voz com o nome '{clean_new}'.")
            shutil.move(str(current_dir), str(target_dir))
            current_dir = target_dir
            target_name = clean_new

        meta_file = current_dir / "voice.json"
        meta = {
            "name": target_name,
            "default_speed": default_speed if default_speed is not None else voice.default_speed,
            "created_at": voice.created_at
        }
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        return self.get_voice(target_name)

    def add_sample(self, voice_name: str, filename: str, content: bytes) -> VoiceSample:
        voice_dir = self.voices_dir / voice_name
        if not voice_dir.is_dir():
            raise FileNotFoundError(f"Voz '{voice_name}' não encontrada.")

        if not is_valid_audio_filename(filename):
            raise ValueError(f"Arquivo de áudio inválido: {filename}. Use .wav, .mp3, .ogg ou .flac.")

        clean_filename = re.sub(r'[^a-zA-Z0-9_\-\.]', '', filename).strip()
        target_path = voice_dir / clean_filename

        # Evita sobrescrever com mesmo nome gerando sufixo
        counter = 1
        stem = target_path.stem
        suffix = target_path.suffix
        while target_path.exists():
            target_path = voice_dir / f"{stem}_{counter}{suffix}"
            counter += 1

        with open(target_path, "wb") as f:
            f.write(content)

        return VoiceSample(
            filename=target_path.name,
            url=f"/api/voices/{voice_name}/samples/{target_path.name}",
            size_bytes=len(content)
        )

    def delete_sample(self, voice_name: str, sample_filename: str) -> bool:
        voice_dir = self.voices_dir / voice_name
        if not voice_dir.is_dir():
            raise FileNotFoundError(f"Voz '{voice_name}' não encontrada.")

        sample_path = voice_dir / sample_filename
        if not sample_path.is_file():
            raise FileNotFoundError(f"Amostra '{sample_filename}' não encontrada.")

        sample_path.unlink()
        return True

    def delete_voice(self, name: str) -> bool:
        voice_dir = self.voices_dir / name
        if not voice_dir.is_dir():
            raise FileNotFoundError(f"Voz '{name}' não encontrada.")

        shutil.rmtree(voice_dir)
        return True

    def get_reference_paths(self, name: str) -> List[str]:
        voice = self.get_voice(name)
        if not voice:
            raise FileNotFoundError(f"Voz '{name}' não encontrada.")

        voice_dir = self.voices_dir / name
        paths = []
        for sample in voice.samples:
            p = voice_dir / sample.filename
            if p.is_file():
                paths.append(str(p))

        if not paths:
            raise ValueError(f"A voz '{name}' não possui nenhuma amostra de áudio cadastrada.")

        return paths

voice_service = VoiceService()
