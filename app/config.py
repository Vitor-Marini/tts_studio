import os
from pathlib import Path
import torch
from pydantic_settings import BaseSettings

# Aceita automaticamente os termos do Coqui CPML sem bloquear o console
os.environ["COQUI_TOS_AGREED"] = "1"

# Compatibilidade com PyTorch >= 2.6 (onde weights_only passou a ser True por padrão, quebrando checkpoints do XTTS)
original_torch_load = torch.load
def safe_torch_load(*args, **kwargs):
    if "weights_only" not in kwargs:
        kwargs["weights_only"] = False
    return original_torch_load(*args, **kwargs)
torch.load = safe_torch_load

class Settings(BaseSettings):
    # Diretórios
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
    
    @property
    def MODELS_DIR(self) -> Path:
        return self.DATA_DIR / "models"

    @property
    def VOICES_DIR(self) -> Path:
        return self.DATA_DIR / "voices"

    @property
    def OUTPUTS_DIR(self) -> Path:
        return self.DATA_DIR / "outputs"

    @property
    def BATCHES_DIR(self) -> Path:
        return self.DATA_DIR / "batches"

    @property
    def CACHE_DIR(self) -> Path:
        return self.DATA_DIR / "cache"

    @property
    def STATIC_DIR(self) -> Path:
        return self.BASE_DIR / "app" / "static"

    # Configurações de Armazenamento e Limite de Disco (padrão: 5GB / 5120MB)
    MAX_STORAGE_MB: int = int(os.getenv("MAX_STORAGE_MB", "5120"))

    # Configurações do Modelo
    MODEL_NAME: str = "tts_models/multilingual/multi-dataset/xtts_v2"
    DEVICE: str = os.getenv("DEVICE", "cuda")  # Se cuda não estiver disponível, o engine faz fallback
    DEFAULT_LANGUAGE: str = "pt"
    
    # Parâmetros padrão otimizados de geração
    DEFAULT_TEMPERATURE: float = 0.2
    DEFAULT_SPEED: float = 1.0
    DEFAULT_LENGTH_PENALTY: float = -3.5
    DEFAULT_REPETITION_PENALTY: float = 6.5
    DEFAULT_TOP_K: int = 56
    DEFAULT_TOP_P: float = 0.89

    def ensure_directories(self):
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.MODELS_DIR.mkdir(parents=True, exist_ok=True)
        self.VOICES_DIR.mkdir(parents=True, exist_ok=True)
        self.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
        self.BATCHES_DIR.mkdir(parents=True, exist_ok=True)
        self.CACHE_DIR.mkdir(parents=True, exist_ok=True)
        self.STATIC_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings()
settings.ensure_directories()

# Define o TTS_HOME para persistir o modelo baixado no volume de dados se desejado
if "TTS_HOME" not in os.environ:
    os.environ["TTS_HOME"] = str(settings.MODELS_DIR)
