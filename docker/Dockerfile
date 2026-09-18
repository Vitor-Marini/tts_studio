# ============================================
# Stage 1: Build do Frontend (Vite + React)
# ============================================
FROM node:20-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ============================================
# Stage 2: Runtime de Produção (100% Python)
# ============================================
FROM python:3.10-slim AS production

# Dependências do sistema (apenas ffmpeg para conversão MP3 e curl para healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências Python
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copia a aplicação backend
COPY app/ ./app/

# Copia os arquivos estáticos compilados do frontend diretamente para app/static
COPY --from=frontend-builder /app/static ./app/static

# Variáveis de ambiente padrão
ENV DATA_DIR=/app/data
ENV TTS_HOME=/app/data/models
ENV COQUI_TOS_AGREED=1
ENV PYTHONUNBUFFERED=1

# Garante a estrutura de diretórios para o volume de dados
RUN mkdir -p /app/data/models /app/data/voices /app/data/outputs /app/data/batches

# Porta única da aplicação (FastAPI serve a API e o Frontend estático)
EXPOSE 8000

# Health check nativo
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Inicialização direta do Uvicorn em 0.0.0.0 (acessível por rede local ou VPN)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
