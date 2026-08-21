# XTTS Studio API - Documentacao Pratica

## Visao Geral

A API XTTS fornece síntese de voz (Text-to-Speech) e clonagem de voz usando o modelo Coqui XTTS v2. Executa em `http://localhost:8000` via FastAPI/Uvicorn.

**Requisitos:** Python 3.10+, PyTorch, CUDA (recomendado), ffmpeg

**Instalar dependências:**
```bash
cd api-backend
pip install -r ../requirements.txt
```

**Iniciar o servidor:**
```bash
python main.py
# ou
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Documentação interativa (Swagger):**
```
http://localhost:8000/docs
```

---

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DEVICE` | `cuda` (se disponível) | Dispositivo de computação: `cuda` ou `cpu` |
| `MODEL_SOURCE` | `local` | Fonte do modelo: `local` ou `api` |
| `LOWVRAM_MODE` | `true` | Model fica na CPU e vai para GPU só na inferência |
| `MODEL_VERSION` | `v2.0.2` | Versão do modelo XTTS |

---

## Endpoints

### 1. Sintetizar Voz (TTS)

**`POST /api/tts`**

O endpoint principal. Gera áudio a partir de texto.

**Request Body (JSON):**
```json
{
  "text": "Olá, bem-vindo ao XTTS Studio!",
  "language": "pt",
  "voice": "ADA",
  "temperature": 0.2,
  "speed": 1.0,
  "length_penalty": -3.5,
  "repetition_penalty": 6.5,
  "top_k": 56,
  "top_p": 0.89,
  "use_fixed_seed": true,
  "seed": 99,
  "split_sentences": true,
  "format": "mp3",
  "bitrate": "192k"
}
```

**Parâmetros:**

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `text` | string | *obrigatório* | Texto para sintetizar |
| `language` | string | `"pt"` | Idioma (17 suportados: `pt`, `en`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh`, `ar`, `cs`, `nl`, `pl`, `ru`, `tr`, `hu`, `hi`) |
| `voice` | string | `"ADA"` | Nome da voz (arquivo em `voices/` sem extensão) |
| `temperature` | float | `0.2` | Aleatoriedade da geração (0.0-1.0). Menor = mais estável |
| `speed` | float | `1.0` | Velocidade da fala (0.5-2.0) |
| `length_penalty` | float | `-3.5` | Penalidade de comprimento (-10.0 a 10.0) |
| `repetition_penalty` | float | `6.5` | Penalidade de repetição (1.0-20.0) |
| `top_k` | int | `56` | Top-K sampling (1-100) |
| `top_p` | float | `0.89` | Nucleus sampling (0.0-1.0) |
| `use_fixed_seed` | bool | `true` | Usar seed fixa para reprodutibilidade |
| `seed` | int | `99` | Valor da seed |
| `split_sentences` | bool | `true` | Dividir texto em frases automaticamente |
| `format` | string | `"mp3"` | Formato de saída: `mp3` ou `wav` |
| `bitrate` | string | `"192k"` | Bitrate para MP3: `128k` ou `192k` |

**Response:**
```json
{
  "status": "success",
  "audio_url": "http://localhost:8000/api/audio/tts_20260820_143021_a1b2c3d4.mp3"
}
```

**Exemplo com `curl`:**
```bash
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Esta é uma teste de síntese de voz.",
    "language": "pt",
    "voice": "ADA",
    "format": "mp3"
  }'
```

**Exemplo com Python `requests`:**
```python
import requests

response = requests.post("http://localhost:8000/api/tts", json={
    "text": "Olá, mundo!",
    "language": "pt",
    "voice": "ADA",
    "format": "mp3"
})

data = response.json()
print(data["audio_url"])  # URL para baixar o áudio
```

---

### 2. Clonar Voz

**`POST /api/clone`**

Clona uma voz a partir de um arquivo de áudio (WAV, MP3, etc.). Salva apenas os embeddings (.pth), descartando o áudio original.

**Request Body (multipart/form-data):**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `voice_name` | string | Sim | Nome para a voz clonada |
| `file` | file | Sim | Arquivo de áudio (WAV, MP3, OGG, etc.) |

**Exemplo com `curl`:**
```bash
curl -X POST http://localhost:8000/api/clone \
  -F "voice_name=minha_voz" \
  -F "file=@minha_voz_referencia.wav"
```

**Exemplo com Python `requests`:**
```python
import requests

with open("minha_voz.wav", "rb") as f:
    response = requests.post(
        "http://localhost:8000/api/clone",
        files={"file": f},
        data={"voice_name": "minha_voz"}
    )

print(response.json())
# {"status": "success", "message": "Voz 'minha_voz' clonada! Embeddings salvos como minha_voz.pth."}
```

**Response:**
```json
{
  "status": "success",
  "message": "Voz 'minha_voz' clonada! Embeddings salvos como minha_voz.pth.",
  "file": "/home/user/tts_studio/api-backend/voices/minha_voz.pth"
}
```

---

### 3. Baixar Áudio

**`GET /api/audio/{filename}`**

Baixa um arquivo de áudio gerado.

```bash
# Download direto
curl -O http://localhost:8000/api/audio/tts_20260820_143021_a1b2c3d4.mp3

# Python
import requests
r = requests.get("http://localhost:8000/api/audio/tts_20260820_143021_a1b2c3d4.mp3")
with open("audio.mp3", "wb") as f:
    f.write(r.content)
```

---

### 4. Download ZIP (Múltiplos Áudios)

**`POST /api/audio/zip`**

Empacota vários áudios em um ZIP para download.

**Request Body (JSON):**
```json
[
  {"filename": "tts_20260820_143021_a1b2c3d4.mp3", "name": "Frase 1"},
  {"filename": "tts_20260820_143055_e5f6g7h8.mp3", "name": "Frase 2"}
]
```

**Exemplo com `curl`:**
```bash
curl -X POST http://localhost:8000/api/audio/zip \
  -H "Content-Type: application/json" \
  -d '[{"filename":"tts_20260820_143021_a1b2c3d4.mp3","name":"Audio 1"}]' \
  --output audios.zip
```

---

### 5. Listar Presets

**`GET /api/presets`**

Retorna todos os presets salvos.

```bash
curl http://localhost:8000/api/presets
```

**Response:**
```json
{
  "Default preset": {
    "nome": "Default preset",
    "temperatura": 0.2,
    "velocidade": 1.0,
    "comprimento_penalidade": -3.5,
    "repeticao_penalidade": 6.5,
    "top_k": 56,
    "top_p": 0.89,
    "usar_seed_fixa": true,
    "seed": 99,
    "dividir_frases": true,
    "formato": "mp3",
    "bitrate": "192k"
  }
}
```

---

### 6. Salvar Preset

**`POST /api/presets`**

**Request Body:**
```json
{
  "name": "Meu Preset",
  "temperature": 0.15,
  "speed": 1.0,
  "length_penalty": -3.5,
  "repetition_penalty": 6.5,
  "top_k": 56,
  "top_p": 0.89,
  "use_fixed_seed": true,
  "seed": 42,
  "split_sentences": true,
  "format": "mp3",
  "bitrate": "192k"
}
```

```bash
curl -X POST http://localhost:8000/api/presets \
  -H "Content-Type: application/json" \
  -d '{"name":"Meu Preset","temperature":0.15,"speed":1.0,"length_penalty":-3.5,"repetition_penalty":6.5,"top_k":56,"top_p":0.89,"use_fixed_seed":true,"seed":42,"split_sentences":true,"format":"mp3","bitrate":"192k"}'
```

---

### 7. Renomear Preset

**`PATCH /api/presets/{name}`**

```bash
curl -X PATCH http://localhost:8000/api/presets/Meu+Preset \
  -H "Content-Type: application/json" \
  -d '{"new_name":"Preset Atualizado"}'
```

---

### 8. Atualizar Parâmetros do Preset

**`PUT /api/presets/{name}`**

```bash
curl -X PUT http://localhost:8000/api/presets/Preset+Atualizado \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Preset Atualizado",
    "temperatura": 0.3,
    "velocidade": 1.1,
    "comprimento_penalidade": -4.0,
    "repeticao_penalidade": 7.0,
    "top_k": 60,
    "top_p": 0.92,
    "usar_seed_fixa": true,
    "seed": 42,
    "dividir_frases": true,
    "formato": "mp3",
    "bitrate": "192k"
  }'
```

---

### 9. Deletar Preset

**`DELETE /api/presets/{name}`**

```bash
curl -X DELETE http://localhost:8000/api/presets/Meu+Preset
```

---

### 10. Listar Vozes

**`GET /api/voices`**

```bash
curl http://localhost:8000/api/voices
```

**Response:**
```json
{
  "voices": ["ADA", "minha_voz", "outra_voz"]
}
```

---

### 11. Renomear Voz

**`PATCH /api/voices/{name}`**

```bash
curl -X PATCH http://localhost:8000/api/voices/minha_voz \
  -H "Content-Type: application/json" \
  -d '{"new_name":"nova_voz"}'
```

---

### 12. Deletar Voz

**`DELETE /api/voices/{name}`**

```bash
curl -X DELETE http://localhost:8000/api/voices/minha_voz
```

---

## Fluxo Típico de Uso

### Sintetizar voz com configurações personalizadas

```python
import requests

API = "http://localhost:8000"

# 1. Listar vozes disponíveis
voices = requests.get(f"{API}/api/voices").json()
print(voices["voices"])

# 2. Gerar áudio
resp = requests.post(f"{API}/api/tts", json={
    "text": "Bem-vindo ao XTTS Studio, a melhor plataforma de síntese de voz.",
    "language": "pt",
    "voice": "ADA",
    "temperature": 0.2,
    "speed": 1.0,
    "format": "mp3"
})
audio_url = resp.json()["audio_url"]

# 3. Baixar o áudio
audio = requests.get(audio_url)
with open("output.mp3", "wb") as f:
    f.write(audio.content)
print("Áudio salvo!")
```

### Clonar voz e usar na síntese

```python
import requests

API = "http://localhost:8000"

# 1. Clonar voz a partir de áudio
with open("referencia.wav", "rb") as f:
    clone_resp = requests.post(
        f"{API}/api/clone",
        files={"file": f},
        data={"voice_name": "meu_clone"}
    )
print(clone_resp.json()["message"])

# 2. Usar a voz clonada
tts_resp = requests.post(f"{API}/api/tts", json={
    "text": "Esta voz foi clonada a partir de um áudio de referência.",
    "language": "pt",
    "voice": "meu_clone"
})

audio = requests.get(tts_resp.json()["audio_url"])
with open("clone_output.mp3", "wb") as f:
    f.write(audio.content)
```

### Gerenciar presets

```python
import requests

API = "http://localhost:8000"

# Criar preset
requests.post(f"{API}/api/presets", json={
    "name": "Narração",
    "temperature": 0.1,
    "speed": 0.9,
    "length_penalty": -4.0,
    "repetition_penalty": 8.0,
    "top_k": 50,
    "top_p": 0.85,
    "use_fixed_seed": True,
    "seed": 123,
    "split_sentences": True,
    "format": "mp3",
    "bitrate": "192k"
})

# Listar presets
presets = requests.get(f"{API}/api/presets").json()

# Deletar preset
requests.delete(f"{API}/api/presets/Narração")
```

---

## Estrutura de Diretórios

```
api-backend/
├── main.py              # Aplicação FastAPI
├── scripts/
│   ├── tts_funcs.py     # TTSWrapper - lógica central de TTS
│   └── modeldownloader.py # Download automático do modelo XTTS
├── voices/              # Arquivos de voz (.wav, .mp3, .pth)
├── presets/             # Presets salvos (.json)
├── models/              # Checkpoints do modelo XTTS
├── outputs/             # Áudios gerados
└── backend.log          # Log do servidor
```

---

## Tipos de Voz

| Extensão | Descrição | Uso na API |
|----------|-----------|------------|
| `.wav` | Áudio de referência | Latents extraídos em tempo real |
| `.mp3` | Áudio de referência | Mesmo fluxo do .wav |
| `.pth` | Embeddings pré-computados | Inferência direta (mais rápido) |

---

## Notas Importantes

- **CORS** habilitado para todas as origens (`*`)
- **Low VRAM** ativado por padrão: o modelo fica na CPU e vai para GPU apenas durante a inferência
- Áudios gerados ficam em `outputs/` com formato `tts_{data}_{hora}_{id}.{ext}`
- O modelo XTTS v2 é baixado automaticamente do HuggingFace na primeira execução
- A conversão para MP3 usa `ffmpeg` (deve estar instalado no sistema)
- Sistemas operacionais suportados: Linux, Windows, macOS
