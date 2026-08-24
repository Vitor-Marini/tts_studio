# tts_funcs.py — XTTS Model Implementation

import torch
import torchaudio

from TTS.api import TTS
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
from pathlib import Path

from scripts.modeldownloader import download_model, check_tts_version
from scripts.tts_models import TTSModelInterface

from loguru import logger
import os
import glob
import time
import re

USE_DEEPSPEED = os.getenv("DEEPSPEED") == 'true'

# List of supported language codes
supported_languages = {
    "ar": "Arabic",
    "pt": "Brazilian Portuguese",
    "zh-cn": "Chinese",
    "cs": "Czech",
    "nl": "Dutch",
    "en": "English",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pl": "Polish",
    "ru": "Russian",
    "es": "Spanish",
    "tr": "Turkish",
    "ja": "Japanese",
    "ko": "Korean",
    "hu": "Hungarian",
    "hi": "Hindi"
}

reversed_supported_languages = {
    name: code for code, name in supported_languages.items()}

# Inbuild Speakers
inbuild_speakers = ['Claribel Dervla', 'Daisy Studious', 'Gracie Wise', 'Tammie Ema', 'Alison','Dietlinde', 'Ana Florence', 'Annmarie Nele', 'Asya Anara', 'Brenda Stern', 'Gitta Nikolina', 'Henriette Usha', 'Sofia Hellen', 'Tammy Grit', 'Tanja Adelina', 'Vjollca Johnnie', 'Andrew Chipper', 'Badr Odhiambo', 'Dionisio Schuyler', 'Royston Min', 'Viktor Eka', 'Abrahan Mack', 'Adde Michal', 'Baldur Sanjin', 'Craig Gutsy', 'Damien Black', 'Gilberto Mathias', 'Ilkin Urbano', 'Kazuhiko Atallah', 'Ludvig Milivoj', 'Suad Qasim', 'Torcull Diarmuid', 'Viktor Menelaos', 'Zacharie Aimilios', 'Nova Hogarth', 'Maja Ruoho', 'Uta Obando', 'Lidiya Szekeres', 'Chandra MacFarland', 'Szofi Granger', 'Camilla Holmström', 'Lilya Stainthorpe', 'Zofija Kendrick', 'Narelle Moon', 'Barbora MacLean', 'Alexandra Hisakawa', 'Alma María', 'Rosemary Okafor', 'Ige Behringer', 'Filip Traverse', 'Damjan Chapman', 'Wulf Carlevaro', 'Aaron Dreschner', 'Kumar Dahl', 'Eugenio Mataracı', 'Ferran Simen', 'Xavier Hayasaka', 'Luis Moray', 'Marcos Rudaski']


class XTTSModel(TTSModelInterface):
    def __init__(self, output_folder="./output", speaker_folder="./speakers", lowvram=False, model_source="local", model_version="2.0.2", device="cpu"):
        self.device = 'cpu' if lowvram else device
        self.lowvram = lowvram
        self.latents_cache = {}
        self.model_source = model_source
        self.model_version = model_version
        self.speaker_folder = speaker_folder
        self.output_folder = output_folder
        self.model_loaded = False
        self.model = None
        self.language = "en"
        self.speaker_wav = ""
        self.available_model_versions = ["v2.0.3", "v2.0.2", "v2.0.1", "v2.0.0", "main"]
        self._create_directories()
        check_tts_version()

    def _create_directories(self):
        for d in [self.output_folder, self.speaker_folder]:
            absolute_path = os.path.abspath(os.path.normpath(d))
            if not os.path.exists(absolute_path):
                os.makedirs(absolute_path)
                logger.info(f"Folder created: {absolute_path}")

    # ─────────────────────────────────────────
    # TTSModelInterface Implementation
    # ─────────────────────────────────────────

    def load_model(self, base_dir: Path) -> None:
        if self.model_source == "api":
            if self.model_version in self.available_model_versions:
                download_model(base_dir, self.model_version)
            config_path = base_dir / 'models' / f'{self.model_version}' / 'config.json'
            checkpoint_dir = base_dir / 'models' / f'{self.model_version}'
            self.model = TTS(model_path=checkpoint_dir, config_path=config_path).to(self.device)

        if self.model_source == "local":
            self._load_local_model(base_dir)
            if not self.lowvram:
                logger.info("Pre-create latents for all current speakers")
                self._create_latents_for_all()

        self.model_loaded = True
        logger.info("XTTS model successfully loaded")

    def _load_local_model(self, base_dir: Path):
        if self.model_version in self.available_model_versions:
            download_model(base_dir, self.model_version)
        config = XttsConfig()
        config_path = base_dir / 'models' / f'{self.model_version}' / 'config.json'
        checkpoint_dir = base_dir / 'models' / f'{self.model_version}'
        speaker_file = base_dir / 'models' / f'{self.model_version}' / 'speakers_xtts.pth'
        if not os.path.exists(speaker_file):
            logger.info("No speaker file found")
            speaker_file = None
        config.load_json(str(config_path))
        self.model = Xtts.init_from_config(config)
        self.model.load_checkpoint(config, use_deepspeed=USE_DEEPSPEED, speaker_file_path=speaker_file, checkpoint_dir=str(checkpoint_dir))
        self.model.to(self.device)

    def unload_model(self) -> None:
        self.model = None
        self.model_loaded = False
        logger.info("XTTS model unloaded")

    def generate(self, text: str, voice_name: str, params: dict, output_path: str, base_dir: Path = None) -> str:
        if not self.model_loaded and base_dir:
            self.load_model(base_dir)

        clear_text = self.clean_text(text)
        self.switch_model_device()
        try:
            # Check if voice is an inbuild speaker
            if voice_name in inbuild_speakers:
                gpt_cond_latent, speaker_embedding = self.model.speaker_manager.speakers[voice_name].values()
            else:
                speaker_wav = self.get_speaker_path(voice_name)
                if speaker_wav is None:
                    raise ValueError(f"Voice '{voice_name}' not found")
                gpt_cond_latent, speaker_embedding = self._get_or_create_latents(voice_name, speaker_wav)

            out = self.model.inference(
                clear_text,
                params.get("language", "pt"),
                gpt_cond_latent=gpt_cond_latent,
                speaker_embedding=speaker_embedding,
                temperature=params.get("temperature", 0.2),
                length_penalty=params.get("length_penalty", -3.5),
                repetition_penalty=params.get("repetition_penalty", 6.5),
                top_k=params.get("top_k", 50),
                top_p=params.get("top_p", 0.85),
                enable_text_splitting=params.get("split_sentences", True),
                speed=params.get("speed", 1.0)
            )
        finally:
            self.switch_model_device()

        torchaudio.save(output_path, torch.tensor(out["wav"]).unsqueeze(0), 24000)
        return output_path

    def clone_voice(self, audio_file_path: str, voice_name: str, ref_text: str = "") -> str:
        self.switch_model_device()
        try:
            gpt_cond_latent, speaker_embedding = self.model.get_conditioning_latents(audio_file_path)
        finally:
            self.switch_model_device()

        pth_path = os.path.join(self.speaker_folder, f"{voice_name}.pth")
        torch.save({
            voice_name: {
                "gpt_cond_latent": gpt_cond_latent.cpu(),
                "speaker_embedding": speaker_embedding.cpu()
            }
        }, pth_path)
        self.latents_cache[voice_name] = (gpt_cond_latent.cpu(), speaker_embedding.cpu())
        return pth_path

    def list_voices(self) -> list[str]:
        seen = {}
        for filepath in glob.glob(os.path.join(self.speaker_folder, "*")):
            ext = os.path.splitext(filepath)[1].lower()
            if ext not in (".wav", ".mp3", ".pth"):
                continue
            name = os.path.splitext(os.path.basename(filepath))[0]
            if name not in seen or ext == ".wav":
                seen[name] = filepath
        return sorted(seen.keys())

    def get_voice_path(self, voice_name: str) -> str | None:
        for ext in (".wav", ".mp3", ".pth"):
            p = os.path.join(self.speaker_folder, voice_name + ext)
            if os.path.isfile(p):
                return p
        return None

    def delete_voice(self, voice_name: str) -> bool:
        path = self.get_voice_path(voice_name)
        if not path:
            return False
        os.remove(path)
        if voice_name in self.latents_cache:
            del self.latents_cache[voice_name]
        return True

    def rename_voice(self, old_name: str, new_name: str) -> bool:
        path = self.get_voice_path(old_name)
        if not path:
            return False
        ext = os.path.splitext(path)[1]
        new_path = os.path.join(self.speaker_folder, new_name + ext)
        if os.path.exists(new_path):
            return False
        if ext == ".pth":
            data = torch.load(path, map_location="cpu")
            if old_name in data:
                data[new_name] = data.pop(old_name)
                torch.save(data, path)
        os.rename(path, new_path)
        if old_name in self.latents_cache:
            self.latents_cache[new_name] = self.latents_cache.pop(old_name)
        return True

    # ─────────────────────────────────────────
    # XTTS-specific helper methods
    # ─────────────────────────────────────────

    def switch_model_device(self):
        if self.lowvram and torch.cuda.is_available() and self.device != "cpu":
            with torch.no_grad():
                if self.device == "cuda":
                    self.device = "cpu"
                else:
                    self.device = "cuda"
                self.model.to(self.device)
            if self.device == 'cpu':
                torch.cuda.empty_cache()

    def _get_or_create_latents(self, speaker_name, speaker_wav):
        if speaker_name not in self.latents_cache:
            logger.info(f"Creating latents for {speaker_name}: {speaker_wav}")
            gpt_cond_latent, speaker_embedding = self.model.get_conditioning_latents(speaker_wav)
            self.latents_cache[speaker_name] = (gpt_cond_latent, speaker_embedding)
        return self.latents_cache[speaker_name]

    def _create_latents_for_all(self):
        speakers = self._get_speakers_internal()
        for speaker in speakers:
            self._get_or_create_latents(speaker['speaker_name'], speaker['speaker_wav'])
        logger.info(f"Latents created for all {len(speakers)} speakers.")

    def _get_speakers_internal(self):
        speakers = []
        for f in os.listdir(self.speaker_folder):
            full_path = os.path.join(self.speaker_folder, f)
            if os.path.isdir(full_path):
                subdir_files = [s for s in os.listdir(full_path) if s.endswith('.wav')]
                if len(subdir_files) == 0:
                    continue
                speaker_wav = [os.path.join(full_path, s) for s in subdir_files]
                speakers.append({'speaker_name': f, 'speaker_wav': speaker_wav})
            elif f.endswith('.wav'):
                speaker_name = os.path.splitext(f)[0]
                speakers.append({'speaker_name': speaker_name, 'speaker_wav': full_path})
        return speakers

    def get_speaker_path(self, speaker_name_or_path):
        if speaker_name_or_path.endswith('.wav'):
            if os.path.isabs(speaker_name_or_path):
                return speaker_name_or_path
            return os.path.join(self.speaker_folder, speaker_name_or_path)

        full_path = os.path.join(self.speaker_folder, speaker_name_or_path)
        wav_file = f"{full_path}.wav"
        if os.path.isdir(full_path):
            wav_files = [s for s in os.listdir(full_path) if s.endswith('.wav')]
            if len(wav_files) == 0:
                return None
            return [os.path.join(full_path, w) for w in wav_files]
        elif os.path.isfile(wav_file):
            return wav_file
        return None

    def clean_text(self, text):
        text = re.sub(r'[\*\r\n]', '', text)
        text = re.sub(r'"\s?(.*?)\s?"', r"'\1'", text)
        return text

    def get_inbuild_voices(self):
        return inbuild_speakers

    def list_languages(self):
        return reversed_supported_languages


# Backward compatibility alias
TTSWrapper = XTTSModel


if __name__ == "__main__":
    print("XTTSModel module loaded")
