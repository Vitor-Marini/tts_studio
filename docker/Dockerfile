# syntax=docker/dockerfile:1.4
# ============================================
# Stage 1: Build do Frontend Next.js
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/web-app

# Copiar package.json e instalar dependências
COPY web-app/package.json web-app/package-lock.json ./
RUN npm ci --prefer-offline

# Copiar código fonte e buildar
COPY web-app/ ./
RUN npm run build

# ============================================
# Stage 2: Backend Python + Frontend estático
# ============================================
FROM python:3.11-slim AS production

# Instalar dependências do sistema (incluindo Node.js para Next.js standalone)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /app

# Copiar requirements e instalar dependências Python
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install F5-TTS separately (--no-deps to avoid gradio conflict with TTS)
# Then install only the minimal deps needed for f5_tts.api inference
RUN pip install --no-cache-dir f5-tts --no-deps && \
    pip install --no-cache-dir accelerate click datasets transformers_stream_generator \
    conformer ema_pytorch vocos cached_path torchdiffeq hydra-core omegaconf \
    soundfile x_transformers rjieba pypinyin unidecode wandb

# Copiar código do backend
COPY api-backend/ ./api-backend/

# Copiar frontend buildado do stage anterior
# standalone vai para /app/ (contém server.js, .next/ server-side, node_modules/)
COPY --from=frontend-builder /app/web-app/.next/standalone ./
# static e public precisam ficar ao lado de server.js (em /app/)
COPY --from=frontend-builder /app/web-app/.next/static ./.next/static
COPY --from=frontend-builder /app/web-app/public ./public

# Criar diretórios necessários
RUN mkdir -p api-backend/outputs/xtts api-backend/outputs/f5-tts api-backend/voices/xtts api-backend/voices/f5-tts api-backend/presets

# Pré-baixar o modelo XTTS v2.0.2 (opcional - comente se quiser baixar na primeira execução)
RUN cd api-backend && python -c "from scripts.modeldownloader import download_model; from pathlib import Path; download_model(Path('.'), 'v2.0.2')" || echo "XTTS model download deferred to runtime"

# Pré-baixar o modelo F5-TTS v1 Base (~1.5GB)
RUN python -c "from f5_tts.api import F5TTS; F5TTS(model='F5TTS_v1_Base', device='cpu')" || echo "F5-TTS model download deferred to runtime"

# Variáveis de ambiente para CPU
ENV DEVICE=cpu
ENV LOWVRAM_MODE=true
ENV MODEL_SOURCE=local
ENV MODEL_VERSION=v2.0.2

# Portas do sistema
# 8000 = API Backend (FastAPI)
# 3000 = Frontend (Next.js)
EXPOSE 8000 3000

# Health check (aumentado start-period para download do modelo)
HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=3 \
    CMD curl -f http://localhost:8000/api/voices || exit 1

# Copiar script de entrypoint (por último para melhorar cache)
COPY --chmod=755 docker/entrypoint.sh ./

# Entry point
ENTRYPOINT ["./entrypoint.sh"]
