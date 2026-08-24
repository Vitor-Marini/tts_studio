import os
import io
import json
import glob
import datetime
import zipfile
import time
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import torch
import torchaudio
import uuid

import shutil
import subprocess

# FIX: PyTorch > 2.6 defaults weights_only=True which breaks XTTS loading.
original_torch_load = torch.load
def safe_torch_load(*args, **kwargs):
    if "weights_only" not in kwargs:
        kwargs["weights_only"] = False
    return original_torch_load(*args, **kwargs)
torch.load = safe_torch_load

from scripts.tts_funcs import XTTSModel
from scripts.f5_tts_model import F5TTSModel
from scripts.tts_models import TTSModelInterface

app = FastAPI(title="TTS Studio API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRESETS_DIR = os.path.join(BASE_DIR, "presets")
VOICES_DIR = os.path.join(BASE_DIR, "voices")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
MODELS_DIR = os.path.join(BASE_DIR, "models")

# Per-model directories
VOICES_XTTS_DIR = os.path.join(VOICES_DIR, "xtts")
VOICES_F5_DIR = os.path.join(VOICES_DIR, "f5-tts")
OUTPUT_XTTS_DIR = os.path.join(OUTPUT_DIR, "xtts")
OUTPUT_F5_DIR = os.path.join(OUTPUT_DIR, "f5-tts")

for d in [PRESETS_DIR, VOICES_DIR, OUTPUT_DIR,
          VOICES_XTTS_DIR, VOICES_F5_DIR, OUTPUT_XTTS_DIR, OUTPUT_F5_DIR]:
    os.makedirs(d, exist_ok=True)

# ─────────────────────────────────────────
# DEFAULT PRESETS (per model)
# ─────────────────────────────────────────

DEFAULT_PRESETS = {
    "Default XTTS": {
        "nome": "Default XTTS",
        "modelo": "xtts",
        "temperatura": 0.2,
        "velocidade": 1.0,
        "comprimento_penalidade": -3.5,
        "repeticao_penalidade": 6.5,
        "top_k": 56,
        "top_p": 0.89,
        "usar_seed_fixa": True,
        "seed": 99,
        "dividir_frases": True,
        "formato": "mp3",
        "bitrate": "192k"
    },
    "Default F5-TTS": {
        "nome": "Default F5-TTS",
        "modelo": "f5-tts",
        "velocidade": 1.0,
        "nfe_step": 32,
        "cfg_strength": 2.0,
        "sway_sampling_coef": -1.0,
        "formato": "wav",
        "bitrate": "192k"
    }
}

def ensure_default_presets():
    for name, data in DEFAULT_PRESETS.items():
        filepath = os.path.join(PRESETS_DIR, f"{name}.json")
        if not os.path.isfile(filepath):
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

ensure_default_presets()

# ─────────────────────────────────────────
# INIT MODELS
# ─────────────────────────────────────────

DEVICE = os.getenv('DEVICE', "cpu")
MODEL_SOURCE = os.getenv("MODEL_SOURCE", "local")
LOWVRAM_MODE = os.getenv("LOWVRAM_MODE", "true").lower() == 'true'
MODEL_VERSION = os.getenv("MODEL_VERSION", "v2.0.2")
AUDIO_MAX_COUNT = int(os.getenv("AUDIO_MAX_COUNT", "50"))

# Model registry
MODELS: dict[str, TTSModelInterface] = {}

# Always init XTTS
XTTS = XTTSModel(
    output_folder=OUTPUT_XTTS_DIR,
    speaker_folder=VOICES_XTTS_DIR,
    lowvram=LOWVRAM_MODE,
    model_source=MODEL_SOURCE,
    model_version=MODEL_VERSION,
    device=DEVICE
)
MODELS["xtts"] = XTTS

# Lazy-init F5-TTS (loaded on first use)
F5TTS_INSTANCE: Optional[F5TTSModel] = None

def get_f5tts() -> F5TTSModel:
    global F5TTS_INSTANCE
    if F5TTS_INSTANCE is None:
        F5TTS_INSTANCE = F5TTSModel(
            output_folder=OUTPUT_F5_DIR,
            speaker_folder=VOICES_F5_DIR,
            device=DEVICE
        )
    return F5TTS_INSTANCE

def get_model(modelo: str) -> TTSModelInterface:
    if modelo == "f5-tts":
        return get_f5tts()
    return XTTS  # default

print(f"Loading XTTS Model {MODEL_VERSION} on {DEVICE}...")
XTTS.load_model(Path(BASE_DIR))
print("XTTS loaded successfully!")

# ─────────────────────────────────────────
# AUDIO CLEANUP & LISTING
# ─────────────────────────────────────────

def cleanup_old_audios(output_dir: str):
    if AUDIO_MAX_COUNT <= 0:
        return
    files = []
    for ext in ("*.wav", "*.mp3"):
        for f in glob.glob(os.path.join(output_dir, ext)):
            files.append(f)
    if len(files) <= AUDIO_MAX_COUNT:
        return
    files.sort(key=lambda f: os.path.getmtime(f))
    to_remove = files[:len(files) - AUDIO_MAX_COUNT]
    for f in to_remove:
        try:
            os.remove(f)
        except OSError:
            pass


class AudioFile(BaseModel):
    filename: str
    name: str
    size_bytes: int
    created_at: str
    url: str
    modelo: str = ""


@app.get("/api/models")
async def get_models():
    """Return available TTS models."""
    available = []
    for name in ["xtts", "f5-tts"]:
        available.append({"id": name, "name": name.upper().replace("-", " "), "loaded": name in MODELS or name == "f5-tts"})
    return {"models": available}


@app.get("/api/audios")
async def list_audios(modelo: Optional[str] = Query(None)):
    """List all audio files with optional model filter."""
    audios = []

    dirs_to_scan = []
    if modelo == "xtts":
        dirs_to_scan = [OUTPUT_XTTS_DIR]
    elif modelo == "f5-tts":
        dirs_to_scan = [OUTPUT_F5_DIR]
    else:
        dirs_to_scan = [OUTPUT_XTTS_DIR, OUTPUT_F5_DIR]

    for scan_dir in dirs_to_scan:
        model_label = "xtts" if scan_dir == OUTPUT_XTTS_DIR else "f5-tts"
        for ext in ("*.wav", "*.mp3"):
            for filepath in glob.glob(os.path.join(scan_dir, ext)):
                stat = os.stat(filepath)
                filename = os.path.basename(filepath)
                audios.append(AudioFile(
                    filename=filename,
                    name=filename,
                    size_bytes=stat.st_size,
                    created_at=datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    url=f"/api/audio/{model_label}/{filename}",
                    modelo=model_label
                ))
    audios.sort(key=lambda a: a.created_at, reverse=True)
    return {"audios": audios, "total": len(audios)}


# ─────────────────────────────────────────
# TTS REQUEST MODEL
# ─────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    modelo: str = "xtts"
    language: str = "pt"
    voice: str = ""
    # Common
    speed: float = 1.0
    format: str = "mp3"
    bitrate: str = "192k"
    # XTTS-only
    temperature: float = 0.2
    length_penalty: float = -3.5
    repetition_penalty: float = 6.5
    top_k: int = 56
    top_p: float = 0.89
    use_fixed_seed: bool = True
    seed: int = 99
    split_sentences: bool = True
    # F5-TTS-only
    cfg_strength: float = 2.0
    nfe_step: int = 32
    sway_sampling_coef: float = -1.0
    ref_text: str = ""


@app.get("/api/presets")
async def get_presets():
    presets = {}
    for filepath in glob.glob(os.path.join(PRESETS_DIR, "*.json")):
        filename = os.path.basename(filepath).replace(".json", "")
        with open(filepath, "r", encoding="utf-8") as f:
            presets[filename] = json.load(f)
    return presets


@app.get("/api/voices")
async def get_voices(modelo: Optional[str] = Query(None)):
    """List voices, optionally filtered by model."""
    seen = {}

    if modelo == "xtts" or modelo is None:
        for filepath in glob.glob(os.path.join(VOICES_XTTS_DIR, "*")):
            ext = os.path.splitext(filepath)[1].lower()
            if ext not in (".wav", ".mp3", ".pth"):
                continue
            name = os.path.splitext(os.path.basename(filepath))[0]
            key = f"xtts:{name}"
            if key not in seen or ext == ".wav":
                seen[key] = {"name": name, "modelo": "xtts"}

    if modelo == "f5-tts" or modelo is None:
        for filepath in glob.glob(os.path.join(VOICES_F5_DIR, "*.wav")):
            name = os.path.splitext(os.path.basename(filepath))[0]
            key = f"f5-tts:{name}"
            seen[key] = {"name": name, "modelo": "f5-tts"}

    result = sorted([v["name"] for v in seen.values()])
    return {"voices": result}


class PresetRequest(BaseModel):
    name: str
    modelo: str = "xtts"
    # XTTS params
    temperature: Optional[float] = 0.2
    speed: float = 1.0
    length_penalty: Optional[float] = -3.5
    repetition_penalty: Optional[float] = 6.5
    top_k: Optional[int] = 56
    top_p: Optional[float] = 0.89
    use_fixed_seed: Optional[bool] = True
    seed: Optional[int] = 99
    split_sentences: Optional[bool] = True
    format: str = "mp3"
    bitrate: str = "192k"
    # F5-TTS params
    nfe_step: Optional[int] = 32
    cfg_strength: Optional[float] = 2.0
    sway_sampling_coef: Optional[float] = -1.0


@app.post("/api/presets")
async def save_preset(req: PresetRequest):
    try:
        filepath = os.path.join(PRESETS_DIR, f"{req.name}.json")
        data = {"nome": req.name, "modelo": req.modelo}

        if req.modelo == "f5-tts":
            data.update({
                "velocidade": req.speed,
                "nfe_step": req.nfe_step,
                "cfg_strength": req.cfg_strength,
                "sway_sampling_coef": req.sway_sampling_coef,
                "formato": req.format,
                "bitrate": req.bitrate
            })
        else:
            data.update({
                "temperatura": req.temperature,
                "velocidade": req.speed,
                "comprimento_penalidade": req.length_penalty,
                "repeticao_penalidade": req.repetition_penalty,
                "top_k": req.top_k,
                "top_p": req.top_p,
                "usar_seed_fixa": req.use_fixed_seed,
                "seed": req.seed,
                "dividir_frases": req.split_sentences,
                "formato": req.format,
                "bitrate": req.bitrate
            })

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return {"status": "success", "message": f"Preset '{req.name}' salvo com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────
# TTS GENERATION
# ─────────────────────────────────────────

@app.post("/api/tts")
async def generate_tts(req: TTSRequest, request: Request):
    try:
        if req.use_fixed_seed and req.modelo == "xtts":
            torch.manual_seed(req.seed)
            if torch.cuda.is_available():
                torch.cuda.manual_seed_all(req.seed)

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        short_id = uuid.uuid4().hex[:8]
        prefix = "f5tts" if req.modelo == "f5-tts" else "xtts"
        output_filename = f"{prefix}_{timestamp}_{short_id}.wav"

        if req.modelo == "f5-tts":
            output_dir = OUTPUT_F5_DIR
        else:
            output_dir = OUTPUT_XTTS_DIR

        output_path = os.path.join(output_dir, output_filename)

        model = get_model(req.modelo)

        if req.modelo == "f5-tts":
            params = {
                "speed": req.speed,
                "nfe_step": req.nfe_step,
                "cfg_strength": req.cfg_strength,
                "sway_sampling_coef": req.sway_sampling_coef,
                "seed": req.seed if req.use_fixed_seed else None,
                "ref_text": req.ref_text,
            }
        else:
            params = {
                "temperature": req.temperature,
                "length_penalty": req.length_penalty,
                "repetition_penalty": req.repetition_penalty,
                "top_k": req.top_k,
                "top_p": req.top_p,
                "speed": req.speed,
                "language": req.language,
                "split_sentences": req.split_sentences,
            }

        model.generate(
            text=req.text,
            voice_name=req.voice,
            params=params,
            output_path=output_path,
            base_dir=Path(BASE_DIR) if req.modelo == "xtts" else None,
        )

        if req.format == "mp3":
            mp3_filename = os.path.splitext(output_filename)[0] + ".mp3"
            mp3_path = os.path.join(output_dir, mp3_filename)
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", output_path, "-b:a", req.bitrate, mp3_path],
                capture_output=True, text=True
            )
            os.unlink(output_path)
            if result.returncode != 0:
                raise HTTPException(status_code=500, detail=f"Error converting to MP3: {result.stderr}")
            output_filename = mp3_filename
            output_dir_final = output_dir
        else:
            output_dir_final = output_dir

        cleanup_old_audios(output_dir_final)

        model_prefix = "f5-tts" if req.modelo == "f5-tts" else "xtts"
        return {
            "status": "success",
            "audio_url": f"{request.base_url}api/audio/{model_prefix}/{output_filename}",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/audio/{modelo}/{filename}")
async def get_audio(modelo: str, filename: str):
    if modelo == "f5-tts":
        file_path = os.path.join(OUTPUT_F5_DIR, filename)
    elif modelo == "xtts":
        file_path = os.path.join(OUTPUT_XTTS_DIR, filename)
    else:
        raise HTTPException(status_code=400, detail="Invalid model")

    if os.path.exists(file_path):
        ext = os.path.splitext(filename)[1].lower()
        media_type = "audio/mpeg" if ext == ".mp3" else "audio/wav"
        return FileResponse(file_path, media_type=media_type)
    raise HTTPException(status_code=404, detail="Audio file not found")


@app.delete("/api/audio/{modelo}/{filename}")
async def delete_audio(modelo: str, filename: str):
    if modelo == "f5-tts":
        file_path = os.path.join(OUTPUT_F5_DIR, filename)
    elif modelo == "xtts":
        file_path = os.path.join(OUTPUT_XTTS_DIR, filename)
    else:
        raise HTTPException(status_code=400, detail="Invalid model")

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    os.remove(file_path)
    return {"status": "success", "message": f"Audio '{filename}' deletado."}


@app.delete("/api/audios")
async def delete_all_audios(modelo: Optional[str] = Query(None)):
    deleted = 0
    dirs = []
    if modelo == "xtts":
        dirs = [OUTPUT_XTTS_DIR]
    elif modelo == "f5-tts":
        dirs = [OUTPUT_F5_DIR]
    else:
        dirs = [OUTPUT_XTTS_DIR, OUTPUT_F5_DIR]

    for scan_dir in dirs:
        for ext in ("*.wav", "*.mp3"):
            for filepath in glob.glob(os.path.join(scan_dir, ext)):
                try:
                    os.remove(filepath)
                    deleted += 1
                except OSError:
                    pass
    return {"status": "success", "message": f"{deleted} audios deletados.", "deleted": deleted}


class ZipItem(BaseModel):
    filename: str
    name: str

@app.post("/api/audio/zip")
async def download_audio_zip(items: List[ZipItem]):
    buf = io.BytesIO()
    added = 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in items:
            base = os.path.basename(item.filename)
            # Search in both dirs
            found = False
            for scan_dir in [OUTPUT_XTTS_DIR, OUTPUT_F5_DIR]:
                path = os.path.join(scan_dir, base)
                if os.path.isfile(path):
                    arcname = os.path.basename(item.name) or base
                    base_ext = os.path.splitext(base)[1]
                    if base_ext and os.path.splitext(arcname)[1] == "":
                        arcname = arcname + base_ext
                    zf.write(path, arcname)
                    added += 1
                    found = True
                    break
    if added == 0:
        raise HTTPException(status_code=404, detail="Nenhum arquivo de áudio encontrado.")
    buf.seek(0)
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    headers = {"Content-Disposition": f'attachment; filename="tts_audios_{stamp}.zip"'}
    return StreamingResponse(buf, media_type="application/zip", headers=headers)


# ─────────────────────────────────────────
# VOICE CLONING
# ─────────────────────────────────────────

@app.post("/api/clone")
async def clone_voice(
    voice_name: str = Form(...),
    modelo: str = Form("xtts"),
    ref_text: str = Form(""),
    file: UploadFile = File(...)
):
    try:
        import tempfile

        # Save uploaded file temporarily
        orig_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".wav"
        with tempfile.NamedTemporaryFile(suffix=orig_ext, delete=False) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as work:
            wav_path = work.name

        if orig_ext == ".wav":
            shutil.move(tmp_path, wav_path)
        else:
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_path, "-ar", "24000", "-ac", "1", wav_path],
                capture_output=True, text=True
            )
            os.unlink(tmp_path)
            if result.returncode != 0:
                raise HTTPException(status_code=500, detail=f"Error converting audio: {result.stderr}")

        model = get_model(modelo)
        saved_path = model.clone_voice(
            audio_file_path=wav_path,
            voice_name=voice_name,
            ref_text=ref_text,
        )

        # Cleanup temp files
        if os.path.exists(wav_path):
            os.remove(wav_path)

        # Clean up old voice files of the same name in the other model's dir (optional)
        for ext in (".wav", ".mp3", ".pth"):
            old = os.path.join(VOICES_DIR, ext)  # legacy path
            # no-op, just cleanup

        return {
            "status": "success",
            "message": f"Voz '{voice_name}' clonada com {modelo.upper()}!",
            "file": saved_path
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────
# VOICE MANAGEMENT
# ─────────────────────────────────────────

@app.delete("/api/voices/{name}")
async def delete_voice(name: str):
    # Search in both voice dirs
    for voice_dir, model_name in [(VOICES_XTTS_DIR, "xtts"), (VOICES_F5_DIR, "f5-tts")]:
        for ext in (".wav", ".mp3", ".pth"):
            p = os.path.join(voice_dir, name + ext)
            if os.path.isfile(p):
                os.remove(p)
                if model_name == "xtts" and name in XTTS.latents_cache:
                    del XTTS.latents_cache[name]
                # Also remove metadata for F5-TTS
                meta = os.path.join(voice_dir, name + ".json")
                if os.path.isfile(meta):
                    os.remove(meta)
                return {"status": "success", "message": f"Voz '{name}' deletada."}

    raise HTTPException(status_code=404, detail=f"Voz '{name}' não encontrada.")


class RenameRequest(BaseModel):
    new_name: str

@app.patch("/api/voices/{name}")
async def rename_voice(name: str, req: RenameRequest):
    # Search in both voice dirs
    for voice_dir, model_name in [(VOICES_XTTS_DIR, "xtts"), (VOICES_F5_DIR, "f5-tts")]:
        for ext in (".wav", ".mp3", ".pth"):
            p = os.path.join(voice_dir, name + ext)
            if os.path.isfile(p):
                new_path = os.path.join(voice_dir, req.new_name + ext)
                if os.path.exists(new_path):
                    raise HTTPException(status_code=409, detail=f"Já existe uma voz com o nome '{req.new_name}'.")
                if ext == ".pth":
                    data = torch.load(p, map_location="cpu")
                    if name in data:
                        data[req.new_name] = data.pop(name)
                        torch.save(data, p)
                os.rename(p, new_path)
                # Rename metadata for F5-TTS
                if model_name == "f5-tts":
                    old_meta = os.path.join(voice_dir, name + ".json")
                    new_meta = os.path.join(voice_dir, req.new_name + ".json")
                    if os.path.isfile(old_meta):
                        os.rename(old_meta, new_meta)
                if model_name == "xtts" and name in XTTS.latents_cache:
                    XTTS.latents_cache[req.new_name] = XTTS.latents_cache.pop(name)
                return {"status": "success", "message": f"Voz renomeada para '{req.new_name}'."}

    raise HTTPException(status_code=404, detail=f"Voz '{name}' não encontrada.")


# ─────────────────────────────────────────
# PRESET MANAGEMENT
# ─────────────────────────────────────────

@app.delete("/api/presets/{name}")
async def delete_preset(name: str):
    path = os.path.join(PRESETS_DIR, name + ".json")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"Preset '{name}' não encontrado.")
    os.remove(path)
    return {"status": "success", "message": f"Preset '{name}' deletado."}


@app.patch("/api/presets/{name}")
async def rename_preset(name: str, req: RenameRequest):
    path = os.path.join(PRESETS_DIR, name + ".json")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"Preset '{name}' não encontrado.")
    new_path = os.path.join(PRESETS_DIR, req.new_name + ".json")
    if os.path.exists(new_path):
        raise HTTPException(status_code=409, detail=f"Já existe um preset com o nome '{req.new_name}'.")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["nome"] = req.new_name
    with open(new_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.remove(path)
    return {"status": "success", "message": f"Preset renomeado para '{req.new_name}'."}


class PresetParamsRequest(BaseModel):
    nome: str
    modelo: str = "xtts"
    # XTTS
    temperatura: Optional[float] = 0.2
    velocidade: float = 1.0
    comprimento_penalidade: Optional[float] = -3.5
    repeticao_penalidade: Optional[float] = 6.5
    top_k: Optional[int] = 56
    top_p: Optional[float] = 0.89
    usar_seed_fixa: Optional[bool] = True
    seed: Optional[int] = 99
    dividir_frases: Optional[bool] = True
    formato: str = "mp3"
    bitrate: str = "192k"
    # F5-TTS
    nfe_step: Optional[int] = 32
    cfg_strength: Optional[float] = 2.0
    sway_sampling_coef: Optional[float] = -1.0


@app.put("/api/presets/{name}")
async def update_preset_params(name: str, req: PresetParamsRequest):
    path = os.path.join(PRESETS_DIR, name + ".json")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"Preset '{name}' não encontrado.")

    data = {"nome": req.nome, "modelo": req.modelo}

    if req.modelo == "f5-tts":
        data.update({
            "velocidade": req.velocidade,
            "nfe_step": req.nfe_step,
            "cfg_strength": req.cfg_strength,
            "sway_sampling_coef": req.sway_sampling_coef,
            "formato": req.formato,
            "bitrate": req.bitrate
        })
    else:
        data.update({
            "temperatura": req.temperatura,
            "velocidade": req.velocidade,
            "comprimento_penalidade": req.comprimento_penalidade,
            "repeticao_penalidade": req.repeticao_penalidade,
            "top_k": req.top_k,
            "top_p": req.top_p,
            "usar_seed_fixa": req.usar_seed_fixa,
            "seed": req.seed,
            "dividir_frases": req.dividir_frases,
            "formato": req.formato,
            "bitrate": req.bitrate
        })

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return {"status": "success", "message": f"Preset '{name}' atualizado com sucesso!"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
