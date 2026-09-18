import os
import subprocess
import soundfile as sf
from pathlib import Path
from typing import Optional, Union

ALLOWED_EXTENSIONS = {".wav", ".mp3", ".ogg", ".flac", ".m4a"}

def is_valid_audio_filename(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return ext in ALLOWED_EXTENSIONS

def get_audio_duration(file_path: Union[str, Path]) -> float:
    try:
        info = sf.info(str(file_path))
        return float(info.duration)
    except Exception:
        # Fallback para ffmpeg se soundfile não conseguir abrir (ex: mp3)
        try:
            cmd = [
                "ffprobe", "-v", "error", "-show_entries",
                "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
                str(file_path)
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return float(result.stdout.strip())
        except Exception:
            return 0.0

def convert_wav_to_mp3(wav_path: str, mp3_path: str, bitrate: str = "192k") -> bool:
    """Converte um arquivo WAV para MP3 usando ffmpeg."""
    try:
        cmd = [
            "ffmpeg", "-y", "-i", str(wav_path),
            "-b:a", bitrate,
            str(mp3_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and os.path.exists(mp3_path):
            return True
        return False
    except Exception:
        return False
