import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings
from app.core.engine import engine
from app.api import routes_tts, routes_voices, routes_batch, routes_audios

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("tts_studio")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: garante pastas
    settings.ensure_directories()
    logger.info(f"TTS Studio v2.0 inicializado. Dispositivo configurado: {engine.device}")
    logger.info(f"Diretório de dados: {settings.DATA_DIR}")
    yield
    # Shutdown: cleanup se necessário
    logger.info("Encerrando TTS Studio...")

app = FastAPI(
    title="TTS Studio",
    version="2.0.0",
    description="Text-to-Speech Studio v2.0 com suporte a múltiplas referências de voz e geração em lote via CSV.",
    lifespan=lifespan
)

# Habilita CORS permissivo para permitir acesso via LAN / VPN / proxies
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registra as rotas da API
app.include_router(routes_tts.router)
app.include_router(routes_voices.router)
app.include_router(routes_batch.router)
app.include_router(routes_audios.router)

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "device": engine.device,
        "model_loaded": engine.is_loaded,
        "data_dir": str(settings.DATA_DIR)
    }

# Monta o frontend estático se o diretório static existir
static_dir = settings.STATIC_DIR
if static_dir.exists() and any(static_dir.iterdir()):
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
else:
    @app.get("/")
    async def index():
        return JSONResponse({
            "message": "TTS Studio API v2.0 está rodando!",
            "docs": "/docs",
            "health": "/health"
        })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
