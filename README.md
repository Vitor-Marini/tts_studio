# TTS Studio v2.0

Text-to-Speech Studio moderno, modular e otimizado com suporte a clonagem por **múltiplas referências de áudio**, geração individual e **processamento em lote via CSV** com mapeamento flexível de colunas.

Desenvolvido para execução em CPU ou GPU (NVIDIA), com container Docker de porta única e interface acessível na rede local ou VPN.

---

## Principais Funcionalidades

- **Múltiplas Referências de Voz**: Cadastre vozes como entidades compostas por um ou mais arquivos de áudio originais (`.wav`, `.mp3`), proporcionando clonagem mais fiel e sem tensores `.pth` descartando o áudio original.
- **Geração em Lote via CSV (Batch)**: Upload de planilha com detecção automática de delimitador (`,` ou `;`), mapeamento dinâmico de colunas (qualquer nome para arquivo e texto), acompanhamento em tempo real, checkpoint para retomar execuções e download dos resultados em `.zip`.
- **Interface Simplificada**: Sem sobrecarga de parâmetros técnicos. Controle apenas o que importa: **Voz**, **Formato (.mp3 / .wav)** e **Velocidade**.
- **Player de Áudio Integrado**: Pré-visualize amostras de voz e ouça áudios gerados com barra de progresso interativa e download com um clique.
- **Porta Única (8000)**: Frontend compilado servido diretamente pelo FastAPI. Sem Node.js no ambiente de produção, sem problemas de CORS ou conflito de portas.
- **Suporte Híbrido CPU / GPU**: Se executado com GPU (`--gpus all`), acelera a geração em até 6x; caso contrário, executa suavemente na CPU.

---

## Execução Rápida via Docker

### 1. Criar pasta de dados persistente no host
```bash
mkdir -p ~/tts_data/{models,voices,outputs,batches}
```

### 2. Rodar a aplicação

**Com GPU (NVIDIA):**
```bash
docker run -d \
  --name tts-studio \
  --gpus all \
  -p 8000:8000 \
  -v ~/tts_data:/app/data \
  ghcr.io/vitor-marini/tts-studio:latest
```

**Com CPU:**
```bash
docker run -d \
  --name tts-studio \
  -p 8000:8000 \
  -v ~/tts_data:/app/data \
  ghcr.io/vitor-marini/tts-studio:latest
```

### 3. Acessar
- **Aplicação Web:** `http://localhost:8000` (ou `http://<IP_DA_REDE_OU_VPN>:8000`)
- **Documentação Swagger:** `http://localhost:8000/docs`
- **Verificação de Saúde:** `http://localhost:8000/health`

---

## Execução Local (Desenvolvimento)

### Pré-requisitos
- Python 3.10+
- Node.js 20+ (apenas para compilar o frontend)
- FFmpeg instalado no sistema

### 1. Instalar dependências Python
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Compilar o frontend
```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. Iniciar o servidor
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Acesse `http://localhost:8000` no navegador.

---

## Estrutura do Projeto

```
tts_studio/
├── app/
│   ├── main.py              # Entrypoint FastAPI e montagem dos estáticos
│   ├── config.py            # Configurações e caminhos
│   ├── core/
│   │   ├── engine.py        # Singleton do Coqui TTS com Thread-Safe Lock
│   │   └── device.py        # Detecção de CUDA e threads
│   ├── services/
│   │   ├── tts_service.py   # Síntese individual e conversão MP3
│   │   ├── voice_service.py # Gestão do objeto Voz e amostras de áudio
│   │   └── batch_service.py # Motor de lote CSV com relatório e ZIP
│   ├── api/                 # Endpoints REST (/api/tts, /api/voices, /api/batch, /api/audio)
│   └── utils/               # Utilitários de áudio (ffmpeg) e CSV
├── frontend/                # Interface SPA moderna (Vite + React + TypeScript)
├── docker/
│   └── Dockerfile           # Multi-stage build leve
├── requirements.txt         # Dependências limpas
└── _OLD_*/                  # Código da v1 arquivado para referência histórica
```
