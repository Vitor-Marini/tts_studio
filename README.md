# TTS Studio

Síntese de voz (TTS) e clonagem de voz usando [Coqui XTTS v2](https://github.com/coqui-ai/TTS). Interface web + API REST, otimizado para CPU.

## Quick Start

### 1. Baixar a imagem

```bash
docker pull ghcr.io/vitor-marini/tts-studio:latest
```

### 2. Criar diretórios para dados

```bash
mkdir -p ~/tts-studio/{voices,outputs,presets}
```

### 3. Rodar

```bash
docker run -d \
  --name tts-studio \
  -p 8000:8000 \
  -p 3000:3000 \
  --memory=8g \
  -v ~/tts-studio/voices:/app/api-backend/voices \
  -v ~/tts-studio/outputs:/app/api-backend/outputs \
  -v ~/tts-studio/presets:/app/api-backend/presets \
  ghcr.io/vitor-marini/tts-studio:latest
```

### 4. Acessar

| Serviço | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **API Docs** | http://localhost:8000/docs |

### 5. Acessar de outra máquina na rede

Use o IP do computador que está rodando o container:

```
http://<IP>:3000
```

O frontend detecta automaticamente o endereço da API.

---

## Funcionalidades

- **Síntese de voz** — Gere áudio a partir de texto com configurações personalizáveis
- **Clonagem de voz** — Clone qualquer voz a partir de uma amostra de áudio (zero-shot)
- **Presets** — Salve e gerencie configurações de geração
- **17 idiomas** — Português, inglês, espanhol, francês, alemão, italiano, japonês, coreano, chinês, árabe, tcheco, holandês, polonês, russo, turco, húngaro, hindi

---

## API

Documentação completa da API: [docs/API.md](docs/API.md)

Documentação interativa (Swagger): `http://localhost:8000/docs`

---

## Build da Imagem (opcional)

Se preferir buildar localmente:

```bash
git clone https://github.com/Vitor-Marini/tts_studio.git
cd tts_studio
docker build -f docker/Dockerfile -t tts-studio:cpu .
```

---

## Licença

Veja [LICENSE](LICENSE) para detalhes. Uso livre para qualquer pessoa ou empresa, mas o software não pode ser revendido ou usado como produto pago.
