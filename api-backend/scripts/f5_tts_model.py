# f5_tts_model.py — F5-TTS Model Implementation

import os
import json
import glob
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Optional

import torch
import torchaudio
from loguru import logger

from scripts.tts_models import TTSModelInterface


class F5TTSModel(TTSModelInterface):
    def __init__(self, output_folder="./output", speaker_folder="./voices/f5-tts", device="cpu", variant="base"):
        self.device = device
        self.output_folder = output_folder
        self.speaker_folder = speaker_folder
        self.variant = variant
        self.model = None
        self.model_loaded = False
        self._create_directories()

    def _create_directories(self):
        for d in [self.output_folder, self.speaker_folder]:
            absolute_path = os.path.abspath(os.path.normpath(d))
            if not os.path.exists(absolute_path):
                os.makedirs(absolute_path)
                logger.info(f"Folder created: {absolute_path}")

    # ─────────────────────────────────────────
    # TTSModelInterface Implementation
    # ─────────────────────────────────────────

    def load_model(self, base_dir: Path = None, variant: str = None) -> None:
        if variant:
            self.variant = variant
        try:
            from f5_tts.api import F5TTS
            if self.variant == "pt-br":
                # Download and load the Portuguese fine-tuned model
                from huggingface_hub import hf_hub_download
                model_path = hf_hub_download(
                    repo_id="firstpixel/F5-TTS-pt-br",
                    filename="pt-br/model_last.safetensors"
                )
                self.model = F5TTS(model="F5TTS_v1_Base", ckpt_file=model_path, device=self.device)
                logger.info("F5-TTS PT-BR model successfully loaded")
            else:
                self.model = F5TTS(model="F5TTS_v1_Base", device=self.device)
                logger.info("F5-TTS Base model successfully loaded")
            self.model_loaded = True
        except ImportError:
            logger.error("f5-tts package not installed. Run: pip install f5-tts")
            raise
        except Exception as e:
            logger.error(f"Failed to load F5-TTS model: {e}")
            raise

    def unload_model(self) -> None:
        self.model = None
        self.model_loaded = False
        logger.info("F5-TTS model unloaded")

    def generate(self, text: str, voice_name: str, params: dict, output_path: str, base_dir: Path = None) -> str:
        if not self.model_loaded:
            self.load_model(base_dir, variant=params.get("variant", "base"))

        voice_path = self.get_voice_path(voice_name)
        if not voice_path:
            raise ValueError(f"Voice '{voice_name}' not found")

        # Load ref_text from metadata
        ref_text = params.get("ref_text", "")
        if not ref_text:
            meta_path = self._get_meta_path(voice_name)
            if meta_path and os.path.isfile(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                ref_text = meta.get("ref_text", "")

        start_time = time.time()

        wav, sr, spec = self.model.infer(
            ref_file=voice_path,
            ref_text=ref_text,
            gen_text=text,
            file_wave=output_path,
            speed=params.get("speed", 1.0),
            nfe_step=params.get("nfe_step", 32),
            cfg_strength=params.get("cfg_strength", 2.0),
            sway_sampling_coef=params.get("sway_sampling_coef", -1.0),
            seed=params.get("seed"),
        )

        elapsed = time.time() - start_time
        logger.info(f"F5-TTS generation: {elapsed:.2f}s")

        return output_path

    def clone_voice(self, audio_file_path: str, voice_name: str, ref_text: str = "") -> str:
        """Save reference audio as WAV 24kHz + metadata JSON for F5-TTS."""
        output_wav = os.path.join(self.speaker_folder, f"{voice_name}.wav")

        # Convert to WAV 24kHz mono if not already
        temp_wav = None
        ext = os.path.splitext(audio_file_path)[1].lower()
        if ext != ".wav":
            temp_wav = tempfile.mktemp(suffix=".wav")
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", audio_file_path, "-ar", "24000", "-ac", "1", temp_wav],
                capture_output=True, text=True
            )
            if result.returncode != 0:
                raise Exception(f"Error converting audio: {result.stderr}")
            shutil.move(temp_wav, output_wav)
        else:
            # Convert to 24kHz mono WAV
            temp_wav = tempfile.mktemp(suffix=".wav")
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", audio_file_path, "-ar", "24000", "-ac", "1", temp_wav],
                capture_output=True, text=True
            )
            if result.returncode != 0:
                raise Exception(f"Error converting audio: {result.stderr}")
            shutil.move(temp_wav, output_wav)

        # Save metadata with ref_text
        meta_path = self._get_meta_path(voice_name)
        meta = {"name": voice_name, "ref_text": ref_text}
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)

        logger.info(f"F5-TTS voice '{voice_name}' saved to {output_wav}")
        return output_wav

    def list_voices(self) -> list[str]:
        voices = []
        for f in os.listdir(self.speaker_folder):
            if f.endswith('.wav'):
                name = os.path.splitext(f)[0]
                voices.append(name)
        return sorted(voices)

    def get_voice_path(self, voice_name: str) -> str | None:
        wav_path = os.path.join(self.speaker_folder, f"{voice_name}.wav")
        if os.path.isfile(wav_path):
            return wav_path
        return None

    def delete_voice(self, voice_name: str) -> bool:
        wav_path = self.get_voice_path(voice_name)
        if not wav_path:
            return False
        os.remove(wav_path)
        meta_path = self._get_meta_path(voice_name)
        if os.path.isfile(meta_path):
            os.remove(meta_path)
        return True

    def rename_voice(self, old_name: str, new_name: str) -> bool:
        old_wav = self.get_voice_path(old_name)
        if not old_wav:
            return False
        new_wav = os.path.join(self.speaker_folder, f"{new_name}.wav")
        if os.path.exists(new_wav):
            return False
        os.rename(old_wav, new_wav)
        # Rename metadata too
        old_meta = self._get_meta_path(old_name)
        new_meta = self._get_meta_path(new_name)
        if os.path.isfile(old_meta):
            os.rename(old_meta, new_meta)
        return True

    # ─────────────────────────────────────────
    # F5-TTS-specific helper methods
    # ─────────────────────────────────────────

    def _get_meta_path(self, voice_name: str) -> str:
        return os.path.join(self.speaker_folder, f"{voice_name}.json")

    def get_voice_ref_text(self, voice_name: str) -> str:
        """Get the reference text for a voice."""
        meta_path = self._get_meta_path(voice_name)
        if os.path.isfile(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            return meta.get("ref_text", "")
        return ""


if __name__ == "__main__":
    print("F5TTSModel module loaded")
