import sys
import os
import json
import glob
from pathlib import Path
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import torch
import uuid

import shutil

# FIX: PyTorch > 2.6 defaults weights_only=True which breaks XTTS loading.
# Fazemos um Monkey Patch no torch.load para forçar weights_only=False de forma nativa
original_torch_load = torch.load
def safe_torch_load(*args, **kwargs):
    if "weights_only" not in kwargs:
        kwargs["weights_only"] = False
    return original_torch_load(*args, **kwargs)
torch.load = safe_torch_load

# Adicionando o diretório original para poder importar scripts.tts_funcs
XTTS_WEBUI_DIR = "/home/vitorsynkar/codes/tts/webui/xtts-webui"
if XTTS_WEBUI_DIR not in sys.path:
    sys.path.append(XTTS_WEBUI_DIR)

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

os.makedirs(PRESETS_DIR, exist_ok=True)
os.makedirs(VOICES_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# -----------------
# INIT XTTS MODEL
# -----------------
DEVICE = os.getenv('DEVICE', "cuda" if torch.cuda.is_available() else "cpu")
MODEL_SOURCE = os.getenv("MODEL_SOURCE", "local")
# Ativado LOWVRAM_MODE por padrao: Ele mantem o modelo na RAM (CPU) e joga para VRAM (GPU) apenas no momento de inferencia!
LOWVRAM_MODE = os.getenv("LOWVRAM_MODE", "true").lower() == 'true'
MODEL_VERSION = os.getenv("MODEL_VERSION", "v2.0.2")

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
XTTS.load_model(Path(XTTS_WEBUI_DIR))
print("Model loaded successfully!")


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
async def generate_tts(req: TTSRequest):
    try:
        if req.use_fixed_seed:
            torch.manual_seed(req.seed)
            if torch.cuda.is_available():
                torch.cuda.manual_seed_all(req.seed)
        
        output_filename = f"{uuid.uuid4().hex}.wav"
        output_path = os.path.join(OUTPUT_DIR, output_filename)
        
        # Resolve o caminho real do arquivo de voz (.wav)
        # get_speaker_path so entende .wav; procuramos o arquivo manualmente
        speaker_wav = None
        for ext in (".wav", ".mp3"):
            candidate = os.path.join(VOICES_DIR, req.voice + ext)
            if os.path.isfile(candidate):
                speaker_wav = candidate
                break
        
        if speaker_wav is None:
            raise HTTPException(status_code=400, detail=f"Voz '{req.voice}' nao encontrada em voices/. Adicione um arquivo .wav ou .mp3 com esse nome.")
        
        options = {
            "temperature": req.temperature,
            "length_penalty": req.length_penalty,
            "repetition_penalty": req.repetition_penalty,
            "top_k": req.top_k,
            "top_p": req.top_p,
            "speed": req.speed
        }
        
        # Passamos o caminho absoluto do .wav diretamente
        XTTS.process_tts_to_file(
            this_dir=Path(XTTS_WEBUI_DIR),
            text=req.text,
            language=req.language,
            ref_speaker_wav=speaker_wav,
            options=options,
            file_name_or_path=output_path
        )
        
        return {
            "status": "success", 
            "audio_url": f"http://localhost:8000/api/audio/{output_filename}",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    file_path = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="audio/wav")
    raise HTTPException(status_code=404, detail="Audio file not found")

@app.post("/api/clone")
async def clone_voice(voice_name: str = Form(...), file: UploadFile = File(...)):
    """
    Recebe o audio via FormData, converte para .wav se necessario e salva na pasta voices/.
    O XTTS exige .wav como referencia de voz.
    """
    try:
        import tempfile
        import subprocess
        
        # Salva o arquivo temporariamente com a extensao original
        orig_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".wav"
        with tempfile.NamedTemporaryFile(suffix=orig_ext, delete=False) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        wav_path = os.path.join(VOICES_DIR, f"{voice_name}.wav")
        
        if orig_ext == ".wav":
            # ja e wav, so move
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
            
        return {"status": "success", "message": f"Voz '{voice_name}' salva como {voice_name}.wav!", "file": wav_path}
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

@app.patch("/api/voices/{name}")
async def rename_voice(name: str, req: RenameRequest):
    path = find_voice_file(name)
    if not path:
        raise HTTPException(status_code=404, detail=f"Voz '{name}' não encontrada.")
    ext = os.path.splitext(path)[1]
    new_path = os.path.join(VOICES_DIR, req.new_name + ext)
    if os.path.exists(new_path):
        raise HTTPException(status_code=409, detail=f"Já existe uma voz com o nome '{req.new_name}'.")
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
