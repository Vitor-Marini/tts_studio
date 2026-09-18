import os
import time
import threading
import logging
from pathlib import Path
from typing import List, Union, Optional
import torch

from app.config import settings
from app.core.device import get_device, configure_torch_threads

logger = logging.getLogger("tts_engine")
logging.basicConfig(level=logging.INFO)

class TTSEngine:
    _instance: Optional["TTSEngine"] = None
    _lock = threading.Lock()

    def __init__(self):
        self.tts = None
        self.device = get_device(settings.DEVICE)
        self.is_loaded = False
        self._inference_lock = threading.Lock()

        if self.device == "cpu":
            configure_torch_threads()

    @classmethod
    def get_instance(cls) -> "TTSEngine":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def load_model(self):
        """Carrega o modelo XTTS v2 no dispositivo apropriado."""
        if self.is_loaded:
            return

        with self._inference_lock:
            if self.is_loaded:
                return

            logger.info(f"Carregando modelo {settings.MODEL_NAME} no dispositivo '{self.device}'...")
            t0 = time.time()
            from TTS.api import TTS
            
            self.tts = TTS(settings.MODEL_NAME)
            self.tts.to(self.device)
            self.is_loaded = True
            elapsed = time.time() - t0
            logger.info(f"Modelo carregado com sucesso em {elapsed:.2f}s no dispositivo {self.device}.")

    def synthesize(
        self,
        text: str,
        speaker_wavs: Union[str, List[str]],
        output_path: Union[str, Path],
        language: str = "pt",
        speed: float = 1.0,
        temperature: float = 0.2
    ) -> float:
        """
        Sintetiza texto para áudio de forma thread-safe.
        Retorna o tempo de inferência em segundos.
        """
        if not self.is_loaded:
            self.load_model()

        # Validação das referências
        if isinstance(speaker_wavs, list):
            if len(speaker_wavs) == 0:
                raise ValueError("Nenhum áudio de referência fornecido.")
            valid_refs = [str(ref) for ref in speaker_wavs if os.path.exists(ref)]
            if len(valid_refs) == 0:
                raise FileNotFoundError(f"Nenhum dos áudios de referência foi encontrado no disco: {speaker_wavs}")
            target_speaker_wav = valid_refs if len(valid_refs) > 1 else valid_refs[0]
        else:
            if not os.path.exists(speaker_wavs):
                raise FileNotFoundError(f"Áudio de referência não encontrado: {speaker_wavs}")
            target_speaker_wav = str(speaker_wavs)

        output_path = str(output_path)
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        with self._inference_lock:
            t0 = time.time()
            self.tts.tts_to_file(
                text=text.strip(),
                speaker_wav=target_speaker_wav,
                language=language,
                speed=speed,
                temperature=temperature,
                file_path=output_path,
                split_sentences=True
            )
            elapsed = time.time() - t0
            logger.info(f"Áudio gerado em {elapsed:.2f}s -> {output_path}")
            return elapsed

engine = TTSEngine.get_instance()
