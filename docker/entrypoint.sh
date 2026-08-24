#!/bin/bash
set -e

echo "============================================"
echo "  TTS Studio - Iniciando servicos..."
echo "============================================"

# Funcao para cleanup ao receber sinal
cleanup() {
    echo "Encerrando servicos..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGTERM SIGINT

# Criar diretorios necessarios
mkdir -p /app/api-backend/outputs/xtts
mkdir -p /app/api-backend/outputs/f5-tts
mkdir -p /app/api-backend/voices/xtts
mkdir -p /app/api-backend/voices/f5-tts
mkdir -p /app/api-backend/presets

# Verificar se o modelo existe, se não, baixar
if [ ! -f "/app/api-backend/models/v2.0.2/model.pth" ]; then
    echo "Modelo XTTS não encontrado. Baixando..."
    cd /app/api-backend
    python -c "from scripts.modeldownloader import download_model; from pathlib import Path; download_model(Path('.'), 'v2.0.2')"
    echo "Modelo baixado com sucesso!"
fi

# Iniciar Backend (FastAPI) na porta 8000
echo "[1/2] Iniciando Backend (FastAPI) na porta 8000..."
cd /app/api-backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1 &
BACKEND_PID=$!

# Aguardar backend iniciar (mais tempo para carregar modelo)
echo "Aguardando backend inicializar..."
sleep 10

# Verificar se o backend esta rodando (aumentado para 60 tentativas = 120 segundos)
echo "Aguardando backend ficar pronto..."
for i in {1..60}; do
    if curl -s http://localhost:8000/api/voices > /dev/null 2>&1; then
        echo "Backend OK!"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "ERRO: Backend não inicializou em 120 segundos"
        exit 1
    fi
    echo "Aguardando backend... ($i/60)"
    sleep 2
done

# Iniciar Frontend (Next.js) na porta 3000
echo "[2/2] Iniciando Frontend (Next.js) na porta 3000..."
cd /app
PORT=3000 HOSTNAME="0.0.0.0" node server.js &
FRONTEND_PID=$!

echo "============================================"
echo "  TTS Studio rodando!"
echo "  Backend API:  http://0.0.0.0:8000"
echo "  Frontend:     http://0.0.0.0:3000"
echo "============================================"

# Aguardar processos
wait $BACKEND_PID $FRONTEND_PID
