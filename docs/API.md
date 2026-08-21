# XTTS Studio API

**Documentação interativa:** http://localhost:8000/docs (Swagger)

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DEVICE` | `cuda` | Dispositivo: `cuda` ou `cpu` |
| `MODEL_SOURCE` | `local` | Fonte do modelo: `local` ou `api` |
| `LOWVRAM_MODE` | `true` | Modelo fica na CPU, vai para GPU só na inferência |
| `MODEL_VERSION` | `v2.0.2` | Versão do modelo XTTS |
| `AUDIO_MAX_COUNT` | `0` | Limite de áudios no outputs/ (0 = ilimitado) |

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/tts` | Sintetizar voz a partir de texto |
| `POST` | `/api/clone` | Clonar voz (multipart: `voice_name` + `file`) |
| `GET` | `/api/audios` | Listar áudios no host com metadados |
| `GET` | `/api/audio/{filename}` | Baixar arquivo de áudio |
| `DELETE` | `/api/audio/{filename}` | Deletar um áudio |
| `DELETE` | `/api/audios` | Deletar todos os áudios |
| `POST` | `/api/audio/zip` | Empacotar vários áudios em ZIP |
| `GET` | `/api/presets` | Listar presets |
| `POST` | `/api/presets` | Salvar preset |
| `PUT` | `/api/presets/{name}` | Atualizar parâmetros do preset |
| `PATCH` | `/api/presets/{name}` | Renomear preset |
| `DELETE` | `/api/presets/{name}` | Deletar preset |
| `GET` | `/api/voices` | Listar vozes |
| `PATCH` | `/api/voices/{name}` | Renomear voz |
| `DELETE` | `/api/voices/{name}` | Deletar voz |

## Exemplos Rápidos

### Sintetizar voz
```bash
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Olá, mundo!","language":"pt","voice":"ADA","format":"mp3"}'
```

### Clonar voz
```bash
curl -X POST http://localhost:8000/api/clone \
  -F "voice_name=minha_voz" \
  -F "file=@referencia.wav"
```

### Listar áudios no host
```bash
curl http://localhost:8000/api/audios
```

## Iniciar o servidor

```bash
cd api-backend
python main.py
# ou
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
