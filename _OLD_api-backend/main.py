import os
import io
import json
import glob
import datetime
import zipfile
import time
from pathlib import Path
from typing import List
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import torch
import torchaudio
import uuid

import shutil
import subprocess

# FIX: PyTorch > 2.6 defaults weights_only=True which breaks XTTS loading.
# Fazemos um Monkey Patch no torch.load para forçar weights_only=False de forma nativa
original_torch_load = torch.load
def safe_torch_load(*args, **kwargs):
    if "weights_only" not in kwargs:
        kwargs["weights_only"] = False
    return original_torch_load(*args, **kwargs)
torch.load = safe_torch_load

from scripts.tts_funcs import TTSWrapper

app = FastAPI(title="XTTS Production API", version="1.0.0")

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

os.makedirs(PRESETS_DIR, exist_ok=True)
os.makedirs(VOICES_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

DEFAULT_PRESET = {
    "Default preset": {
        "nome": "Default preset",
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
    }
}

def ensure_default_presets():
    for name, data in DEFAULT_PRESET.items():
        filepath = os.path.join(PRESETS_DIR, f"{name}.json")
        if not os.path.isfile(filepath):
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

ensure_default_presets()

# -----------------
# INIT XTTS MODEL
# -----------------
DEVICE = os.getenv('DEVICE', "cuda" if torch.cuda.is_available() else "cpu")
MODEL_SOURCE = os.getenv("MODEL_SOURCE", "local")
# Ativado LOWVRAM_MODE por padrao: Ele mantem o modelo na RAM (CPU) e joga para VRAM (GPU) apenas no momento de inferencia!
LOWVRAM_MODE = os.getenv("LOWVRAM_MODE", "true").lower() == 'true'
MODEL_VERSION = os.getenv("MODEL_VERSION", "v2.0.2")
AUDIO_MAX_COUNT = int(os.getenv("AUDIO_MAX_COUNT", "50"))

# Instancia o TTSWrapper usando as vozes da nossa nova arquitetura
XTTS = TTSWrapper(
    output_folder=OUTPUT_DIR, 
    speaker_folder=VOICES_DIR, 
    lowvram=LOWVRAM_MODE,
    model_source=MODEL_SOURCE, 
    model_version=MODEL_VERSION, 
    device=DEVICE
)

print(f"Loading XTTS Model {MODEL_VERSION} on {DEVICE}...")
XTTS.load_model(Path(BASE_DIR))
print("Model loaded successfully!")


# ----------------------
# AUDIO CLEANUP & LISTING
# ----------------------

def cleanup_old_audios():
    """Remove oldest audios when count exceeds AUDIO_MAX_COUNT."""
    if AUDIO_MAX_COUNT <= 0:
        return
    files = []
    for ext in ("*.wav", "*.mp3"):
        for f in glob.glob(os.path.join(OUTPUT_DIR, ext)):
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

@app.get("/api/audios")
async def list_audios():
    """List all audio files in the outputs directory with metadata."""
    audios = []
    for ext in ("*.wav", "*.mp3"):
        for filepath in glob.glob(os.path.join(OUTPUT_DIR, ext)):
            stat = os.stat(filepath)
            filename = os.path.basename(filepath)
            audios.append(AudioFile(
                filename=filename,
                name=filename,
                size_bytes=stat.st_size,
                created_at=datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                url=f"/api/audio/{filename}"
            ))
    audios.sort(key=lambda a: a.created_at, reverse=True)
    return {"audios": audios, "total": len(audios)}


class TTSRequest(BaseModel):
    text: str
    language: str = "pt"
    voice: str = "ADA"
    temperature: float = 0.2
    speed: float = 1.0
    length_penalty: float = -3.5
    repetition_penalty: float = 6.5
    top_k: int = 56
    top_p: float = 0.89
    use_fixed_seed: bool = True
    seed: int = 99
    split_sentences: bool = True
    format: str = "mp3"
    bitrate: str = "192k"

@app.get("/api/presets")
async def get_presets():
    presets = {}
    for filepath in glob.glob(os.path.join(PRESETS_DIR, "*.json")):
        filename = os.path.basename(filepath).replace(".json", "")
        with open(filepath, "r", encoding="utf-8") as f:
            presets[filename] = json.load(f)
    return presets

@app.get("/api/voices")
async def get_voices():
    # Lista unica de vozes por nome (sem extensao), preferindo .wav
    seen = {}
    for filepath in glob.glob(os.path.join(VOICES_DIR, "*")):
        ext = os.path.splitext(filepath)[1].lower()
        if ext not in (".wav", ".mp3", ".pth"):
            continue
        name = os.path.splitext(os.path.basename(filepath))[0]
        # .wav tem prioridade; so adiciona .mp3 se .wav nao existir ainda
        if name not in seen or ext == ".wav":
            seen[name] = filepath
    return {"voices": sorted(seen.keys())}

class PresetRequest(BaseModel):
    name: str
    temperature: float
    speed: float
    length_penalty: float
    repetition_penalty: float
    top_k: int
    top_p: float
    use_fixed_seed: bool
    seed: int
    split_sentences: bool
    format: str
    bitrate: str

@app.post("/api/presets")
async def save_preset(req: PresetRequest):
    try:
        filepath = os.path.join(PRESETS_DIR, f"{req.name}.json")
        data = {
            "nome": req.name,
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
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return {"status": "success", "message": f"Preset '{req.name}' salvo com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tts")
async def generate_tts(req: TTSRequest, request: Request):
    try:
        if req.use_fixed_seed:
            torch.manual_seed(req.seed)
            if torch.cuda.is_available():
                torch.cuda.manual_seed_all(req.seed)
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        short_id = uuid.uuid4().hex[:8]
        output_filename = f"tts_{timestamp}_{short_id}.wav"
        output_path = os.path.join(OUTPUT_DIR, output_filename)

        options = {
            "temperature": req.temperature,
            "length_penalty": req.length_penalty,
            "repetition_penalty": req.repetition_penalty,
            "top_k": req.top_k,
            "top_p": req.top_p,
            "speed": req.speed
        }

        pth_path = os.path.join(VOICES_DIR, req.voice + ".pth")
        if os.path.isfile(pth_path):
            # Voz salva como embeddings (.pth) -> inferencia direta com latents pre-computados
            latents = torch.load(pth_path, map_location="cpu")
            if req.voice not in latents:
                raise HTTPException(status_code=400, detail=f"Embeddings da voz '{req.voice}' nao encontrados no arquivo .pth.")
            voice_data = latents[req.voice]
            gpt_cond_latent = voice_data["gpt_cond_latent"].to(XTTS.device)
            speaker_embedding = voice_data["speaker_embedding"].to(XTTS.device)

            XTTS.switch_model_device()  # Move para GPU se lowvram (no-op em CPU)
            try:
                clear_text = XTTS.clean_text(req.text)
                out = XTTS.model.inference(
                    clear_text,
                    req.language,
                    gpt_cond_latent=gpt_cond_latent,
                    speaker_embedding=speaker_embedding,
                    temperature=req.temperature,
                    length_penalty=req.length_penalty,
                    repetition_penalty=req.repetition_penalty,
                    top_k=req.top_k,
                    top_p=req.top_p,
                    enable_text_splitting=True,
                    speed=req.speed
                )
            finally:
                XTTS.switch_model_device()  # Volta para CPU se lowvram (no-op em CPU)

            torchaudio.save(output_path, torch.tensor(out["wav"]).unsqueeze(0), 24000)
        else:
            # Resolve o caminho real do arquivo de voz (.wav/.mp3)
            # get_speaker_path so entende .wav; procuramos o arquivo manualmente
            speaker_wav = None
            for ext in (".wav", ".mp3"):
                candidate = os.path.join(VOICES_DIR, req.voice + ext)
                if os.path.isfile(candidate):
                    speaker_wav = candidate
                    break

            if speaker_wav is None:
                raise HTTPException(status_code=400, detail=f"Voz '{req.voice}' nao encontrada em voices/. Adicione um arquivo .wav, .mp3 ou .pth com esse nome.")
            
            # Passamos o caminho absoluto do .wav diretamente
            XTTS.process_tts_to_file(
                this_dir=Path(BASE_DIR),
                text=req.text,
                language=req.language,
                ref_speaker_wav=speaker_wav,
                options=options,
                file_name_or_path=output_path
            )

        if req.format == "mp3":
            mp3_filename = os.path.splitext(output_filename)[0] + ".mp3"
            mp3_path = os.path.join(OUTPUT_DIR, mp3_filename)
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", output_path, "-b:a", req.bitrate, mp3_path],
                capture_output=True, text=True
            )
            os.unlink(output_path)
            if result.returncode != 0:
                raise HTTPException(status_code=500, detail=f"Erro ao converter para MP3: {result.stderr}")
            output_filename = mp3_filename

        cleanup_old_audios()

        return {
            "status": "success", 
            "audio_url": f"{request.base_url}api/audio/{output_filename}",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    file_path = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(file_path):
        ext = os.path.splitext(filename)[1].lower()
        media_type = "audio/mpeg" if ext == ".mp3" else "audio/wav"
        return FileResponse(file_path, media_type=media_type)
    raise HTTPException(status_code=404, detail="Audio file not found")

@app.delete("/api/audio/{filename}")
async def delete_audio(filename: str):
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    os.remove(file_path)
    return {"status": "success", "message": f"Audio '{filename}' deletado."}

@app.delete("/api/audios")
async def delete_all_audios():
    deleted = 0
    for ext in ("*.wav", "*.mp3"):
        for filepath in glob.glob(os.path.join(OUTPUT_DIR, ext)):
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
            path = os.path.join(OUTPUT_DIR, base)
            if os.path.isfile(path):
                arcname = os.path.basename(item.name) or base
                base_ext = os.path.splitext(base)[1]
                if base_ext and os.path.splitext(arcname)[1] == "":
                    arcname = arcname + base_ext
                zf.write(path, arcname)
                added += 1
    if added == 0:
        raise HTTPException(status_code=404, detail="Nenhum arquivo de áudio encontrado.")
    buf.seek(0)
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    headers = {"Content-Disposition": f'attachment; filename="tts_audios_{stamp}.zip"'}
    return StreamingResponse(buf, media_type="application/zip", headers=headers)

@app.post("/api/clone")
async def clone_voice(voice_name: str = Form(...), file: UploadFile = File(...)):
    """
    Recebe o audio via FormData, extrai os embeddings (latents) da voz usando o modelo XTTS
    e salva apenas o .pth com os embeddings em voices/. O audio original nao e mantido.
    """
    try:
        import tempfile

        # Salva o arquivo temporariamente com a extensao original
        orig_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".wav"
        with tempfile.NamedTemporaryFile(suffix=orig_ext, delete=False) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as work:
            wav_path = work.name

        if orig_ext == ".wav":
            # ja e wav, so move para o temporario de trabalho
            shutil.move(tmp_path, wav_path)
        else:
            # converte mp3/ogg/etc para wav com ffmpeg
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_path, "-ar", "22050", "-ac", "1", wav_path],
                capture_output=True, text=True
            )
            os.unlink(tmp_path)
            if result.returncode != 0:
                raise HTTPException(status_code=500, detail=f"Erro ao converter audio: {result.stderr}")

        # Computa os embeddings da voz (latents)
        try:
            XTTS.switch_model_device()  # Move para GPU se lowvram (no-op em CPU)
            gpt_cond_latent, speaker_embedding = XTTS.model.get_conditioning_latents(wav_path)
        finally:
            XTTS.switch_model_device()  # Volta para CPU se lowvram (no-op em CPU)

        # Salva apenas os embeddings no formato do speakers_xtts.pth
        pth_path = os.path.join(VOICES_DIR, f"{voice_name}.pth")
        torch.save({
            voice_name: {
                "gpt_cond_latent": gpt_cond_latent.cpu(),
                "speaker_embedding": speaker_embedding.cpu()
            }
        }, pth_path)

        # Cache em memoria para nao recarregar do disco
        XTTS.latents_cache[voice_name] = (gpt_cond_latent.cpu(), speaker_embedding.cpu())

        # Limpa o audio de trabalho e qualquer versao antiga em audio da mesma voz
        for ext in (".wav", ".mp3"):
            old = os.path.join(VOICES_DIR, voice_name + ext)
            if os.path.isfile(old):
                os.remove(old)
        if os.path.exists(wav_path):
            os.remove(wav_path)

        return {"status": "success", "message": f"Voz '{voice_name}' clonada! Embeddings salvos como {voice_name}.pth.", "file": pth_path}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────
# GERENCIAMENTO DE VOZES (Marco 4)
# ─────────────────────────────────────────

def find_voice_file(name: str):
    """Encontra o arquivo de voz pelo nome (sem extensão), priorizando .wav."""
    for ext in (".wav", ".mp3", ".pth"):
        p = os.path.join(VOICES_DIR, name + ext)
        if os.path.isfile(p):
            return p
    return None

@app.delete("/api/voices/{name}")
async def delete_voice(name: str):
    path = find_voice_file(name)
    if not path:
        raise HTTPException(status_code=404, detail=f"Voz '{name}' não encontrada.")
    os.remove(path)
    # Limpa latents em cache se existir
    if name in XTTS.latents_cache:
        del XTTS.latents_cache[name]
    return {"status": "success", "message": f"Voz '{name}' deletada."}

class RenameRequest(BaseModel):
    new_name: str

class PresetParamsRequest(BaseModel):
    nome: str
    temperatura: float
    velocidade: float
    comprimento_penalidade: float
    repeticao_penalidade: float
    top_k: int
    top_p: float
    usar_seed_fixa: bool
    seed: int
    dividir_frases: bool
    formato: str
    bitrate: str

@app.patch("/api/voices/{name}")
async def rename_voice(name: str, req: RenameRequest):
    path = find_voice_file(name)
    if not path:
        raise HTTPException(status_code=404, detail=f"Voz '{name}' não encontrada.")
    ext = os.path.splitext(path)[1]
    new_path = os.path.join(VOICES_DIR, req.new_name + ext)
    if os.path.exists(new_path):
        raise HTTPException(status_code=409, detail=f"Já existe uma voz com o nome '{req.new_name}'.")
    if ext == ".pth":
        # Atualiza a chave interna dos embeddings para o novo nome
        data = torch.load(path, map_location="cpu")
        if name in data:
            data[req.new_name] = data.pop(name)
            torch.save(data, path)
    os.rename(path, new_path)
    # Atualiza cache de latents
    if name in XTTS.latents_cache:
        XTTS.latents_cache[req.new_name] = XTTS.latents_cache.pop(name)
    return {"status": "success", "message": f"Voz renomeada para '{req.new_name}'."}

# ─────────────────────────────────────────
# GERENCIAMENTO DE PRESETS (Marco 4)
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
    # Atualiza o campo "nome" dentro do JSON também
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["nome"] = req.new_name
    with open(new_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.remove(path)
    return {"status": "success", "message": f"Preset renomeado para '{req.new_name}'."}

@app.put("/api/presets/{name}")
async def update_preset_params(name: str, req: PresetParamsRequest):
    path = os.path.join(PRESETS_DIR, name + ".json")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"Preset '{name}' não encontrado.")
    data = {
        "nome": req.nome,
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
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return {"status": "success", "message": f"Preset '{name}' atualizado com sucesso!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
