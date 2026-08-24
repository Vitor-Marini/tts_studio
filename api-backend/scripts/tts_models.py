# tts_models.py
# Abstraction layer for TTS model implementations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional
import os


class TTSModelInterface(ABC):
    """Base interface that all TTS models must implement."""

    @abstractmethod
    def load_model(self, base_dir: Path) -> None:
        """Load the model into memory."""
        ...

    @abstractmethod
    def unload_model(self) -> None:
        """Unload the model to free memory."""
        ...

    @abstractmethod
    def generate(
        self,
        text: str,
        voice_name: str,
        params: dict,
        output_path: str,
        base_dir: Optional[Path] = None,
    ) -> str:
        """Generate audio from text. Returns the output file path."""
        ...

    @abstractmethod
    def clone_voice(
        self,
        audio_file_path: str,
        voice_name: str,
        ref_text: str = "",
    ) -> str:
        """Clone a voice from an audio file. Returns the saved voice file path."""
        ...

    @abstractmethod
    def list_voices(self) -> list[str]:
        """Return list of available voice names."""
        ...

    @abstractmethod
    def get_voice_path(self, voice_name: str) -> Optional[str]:
        """Return the file path for a given voice name."""
        ...

    @abstractmethod
    def delete_voice(self, voice_name: str) -> bool:
        """Delete a voice by name. Returns True if successful."""
        ...

    @abstractmethod
    def rename_voice(self, old_name: str, new_name: str) -> bool:
        """Rename a voice. Returns True if successful."""
        ...
