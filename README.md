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

## Deploy e Execução via Docker

### 1. Obter a Imagem (Pull ou Build)

**Baixar do repositório (GitHub Packages / GHCR):**
```bash
docker pull ghcr.io/vitor-marini/tts-studio:latest
```

*Ou caso queira compilar a imagem localmente pelo código-fonte:*
```bash
docker build -t tts-studio:latest .
```

---

### 2. Entendendo os Volumes e Persistência

A aplicação centraliza todos os seus dados no diretório do container `/app/data`.
Dentro deste diretório, a estrutura é organizada automaticamente:

- `/app/data/models`: Checkpoints e pesos baixados do modelo XTTS v2 (~2.5GB). O download ocorre apenas na primeira execução; com o volume montado, o modelo é preservado permanentemente entre recriações do container.
- `/app/data/voices`: Perfis de voz cadastrados, suas amostras originais (`.wav`, `.mp3`) e configurações de velocidade (`metadata.json`).
- `/app/data/outputs`: Áudios sintetizados individualmente na interface.
- `/app/data/batches`: Arquivos de lote processados, planilhas originais, checkpoints de progresso e pacotes compactados `.zip`.
- **Limpeza Automática de Disco**: O sistema monitora o espaço ocupado em `/app/data` de acordo com a variável `MAX_STORAGE_MB` (padrão: 5120MB / 5GB), removendo automaticamente os áudios mais antigos caso o limite seja atingido.

Você pode persistir os dados usando um **Volume Nomeado do Docker** (recomendado para produção) ou um **Diretório Local (Bind Mount)**.

---

### 3. Executando o Container (Run)

#### Opção A: Com Volume Nomeado do Docker (Recomendado)

**Criar o volume:**
```bash
docker volume create tts_studio_data
```

**Rodar com GPU NVIDIA:**
```bash
docker run -d \
  --name tts-studio \
  --gpus all \
  --restart unless-stopped \
  -p 8000:8000 \
  -v tts_studio_data:/app/data \
  ghcr.io/vitor-marini/tts-studio:latest
```

**Rodar com CPU (qualquer máquina):**
```bash
docker run -d \
  --name tts-studio \
  --restart unless-stopped \
  -p 8000:8000 \
  -v tts_studio_data:/app/data \
  ghcr.io/vitor-marini/tts-studio:latest
```

#### Opção B: Com Pasta Local no Host (Bind Mount)

```bash
mkdir -p ~/tts_data

docker run -d \
  --name tts-studio \
  --restart unless-stopped \
  -p 8000:8000 \
  -v ~/tts_data:/app/data \
  ghcr.io/vitor-marini/tts-studio:latest
```

---

### 4. Executando com Docker Compose (Alternativa Mais Prática)

O projeto já inclui um arquivo `docker-compose.yml` pré-configurado. Para subir a aplicação:

```bash
# Iniciar em segundo plano
docker compose up -d

# Visualizar logs em tempo real
docker compose logs -f

# Parar o serviço
docker compose down
```

---

### 5. Acesso e Verificação

- **Interface Web:** `http://localhost:8000` (ou `http://<IP_LOCAL_OU_VPN>:8000`)
- **API Docs (Swagger):** `http://localhost:8000/docs`
- **Healthcheck:** `http://localhost:8000/health`

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
├── Dockerfile               # Build de produção de porta única
├── docker-compose.yml       # Orquestração rápida com volumes persistentes
├── requirements.txt         # Dependências Python enxutas
├── data/                    # Volume de dados persistentes (modelos, vozes, outputs, batches)
└── docs/                    # Documentação técnica e decisões de arquitetura
```
