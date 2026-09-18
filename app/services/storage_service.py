import os
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import datetime
import json

from app.config import settings

logger = logging.getLogger("tts_storage")

class StorageStats(BaseModel):
    used_bytes: int
    used_mb: float
    max_bytes: int
    max_mb: float
    used_percentage: float
    outputs_bytes: int
    batches_bytes: int
    cache_bytes: int
    total_audios: int
    total_batches: int

class BatchSummary(BaseModel):
    id: str
    voice_name: str
    created_at: str
    status: str
    total_items: int
    completed_items: int
    format: str
    size_bytes: int
    has_zip: bool
    zip_size_bytes: Optional[int] = None

class StorageService:
    def __init__(self):
        self.outputs_dir = settings.OUTPUTS_DIR
        self.batches_dir = settings.BATCHES_DIR
        self.cache_dir = settings.CACHE_DIR
        self.max_mb = float(settings.MAX_STORAGE_MB)
        self.max_bytes = int(self.max_mb * 1024 * 1024)

    def _get_dir_size(self, path: Path) -> int:
        """Calcula o tamanho total em bytes de um diretório ou arquivo."""
        if not path.exists():
            return 0
        if path.is_file():
            try:
                return path.stat().st_size
            except OSError:
                return 0
        total = 0
        try:
            for entry in path.rglob("*"):
                if entry.is_file():
                    try:
                        total += entry.stat().st_size
                    except OSError:
                        pass
        except OSError:
            pass
        return total

    def get_storage_stats(self) -> StorageStats:
        """Retorna estatísticas detalhadas sobre o uso de armazenamento."""
        outputs_bytes = self._get_dir_size(self.outputs_dir)
        batches_bytes = self._get_dir_size(self.batches_dir)
        cache_bytes = self._get_dir_size(self.cache_dir)

        used_bytes = outputs_bytes + batches_bytes + cache_bytes
        used_mb = round(used_bytes / (1024 * 1024), 2)
        used_pct = round((used_bytes / self.max_bytes) * 100, 1) if self.max_bytes > 0 else 0.0

        # Contagem de áudios individuais
        total_audios = 0
        if self.outputs_dir.exists():
            total_audios = len(list(self.outputs_dir.glob("*.mp3"))) + len(list(self.outputs_dir.glob("*.wav")))

        # Contagem de lotes
        batches = self.list_batches()
        total_batches = len(batches)

        return StorageStats(
            used_bytes=used_bytes,
            used_mb=used_mb,
            max_bytes=self.max_bytes,
            max_mb=self.max_mb,
            used_percentage=min(used_pct, 100.0),
            outputs_bytes=outputs_bytes,
            batches_bytes=batches_bytes,
            cache_bytes=cache_bytes,
            total_audios=total_audios,
            total_batches=total_batches
        )

    def list_batches(self) -> List[BatchSummary]:
        """Lista todos os lotes salvos no diretório de dados, ordenados por data."""
        if not self.batches_dir.exists():
            return []

        summaries = []
        for batch_folder in self.batches_dir.iterdir():
            if not batch_folder.is_dir() or batch_folder.name.startswith("temp_"):
                continue

            batch_id = batch_folder.name
            size_bytes = self._get_dir_size(batch_folder)

            # Procura job.json
            job_file = batch_folder / "job.json"
            voice_name = "Voz_Padrao"
            status = "completed"
            total_items = 0
            completed_items = 0
            file_format = "mp3"
            created_at = datetime.datetime.fromtimestamp(batch_folder.stat().st_mtime).isoformat()

            if job_file.exists():
                try:
                    with open(job_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        voice_name = data.get("voice_name", voice_name)
                        status = data.get("status", status)
                        total_items = data.get("total_items", 0)
                        completed_items = data.get("completed_items", 0)
                        file_format = data.get("format", file_format)
                        created_at = data.get("created_at") or created_at
                except Exception:
                    pass
            else:
                # Fallback: inspeciona audios/
                audios_dir = batch_folder / "audios"
                if audios_dir.exists():
                    audio_files = list(audios_dir.glob("*.mp3")) + list(audios_dir.glob("*.wav"))
                    total_items = len(audio_files)
                    completed_items = total_items
                    if audio_files:
                        file_format = audio_files[0].suffix.lstrip(".").lower()

            # Verifica existência do zip
            zip_file = batch_folder / f"{batch_id}.zip"
            has_zip = zip_file.is_file()
            zip_size = zip_file.stat().st_size if has_zip else None

            summaries.append(BatchSummary(
                id=batch_id,
                voice_name=voice_name,
                created_at=created_at,
                status=status,
                total_items=total_items,
                completed_items=completed_items,
                format=file_format,
                size_bytes=size_bytes,
                has_zip=has_zip,
                zip_size_bytes=zip_size
            ))

        summaries.sort(key=lambda b: b.created_at, reverse=True)
        return summaries

    def delete_batch(self, batch_id: str) -> bool:
        """Deleta completamente um lote do disco."""
        batch_folder = self.batches_dir / batch_id
        if not batch_folder.exists() or not batch_folder.is_dir():
            return False
        shutil.rmtree(batch_folder, ignore_errors=True)
        return True

    def enforce_storage_limit(self, target_ratio: float = 0.85):
        """
        Verifica se o uso de armazenamento ultrapassou o limite máximo e,
        se necessário, remove arquivos e lotes mais antigos até atingir target_ratio.
        """
        stats = self.get_storage_stats()
        if stats.used_bytes <= self.max_bytes:
            return

        logger.warning(
            f"Uso de disco excedeu o limite: {stats.used_mb}MB / {stats.max_mb}MB ({stats.used_percentage}%). "
            f"Iniciando rotação automática de arquivos antigos..."
        )

        target_bytes = int(self.max_bytes * target_ratio)

        # 1. Limpa cache mais antigo
        if self.cache_dir.exists():
            cache_files = list(self.cache_dir.glob("*.wav")) + list(self.cache_dir.glob("*.mp3"))
            cache_files.sort(key=lambda f: f.stat().st_mtime)
            for cf in cache_files:
                if self._get_total_used() <= target_bytes:
                    return
                try:
                    cf.unlink()
                except OSError:
                    pass

        # 2. Deleta lotes mais antigos (mantendo pelo menos o mais recente se possível)
        batches = self.list_batches()
        # Ordena do mais antigo para o mais novo
        batches.sort(key=lambda b: b.created_at)
        while len(batches) > 1 and self._get_total_used() > target_bytes:
            oldest = batches.pop(0)
            logger.info(f"Removendo lote antigo '{oldest.id}' ({round(oldest.size_bytes / 1048576, 1)}MB)...")
            self.delete_batch(oldest.id)

        # 3. Deleta áudios individuais mais antigos se ainda necessário
        if self.outputs_dir.exists():
            audio_files = list(self.outputs_dir.glob("*.mp3")) + list(self.outputs_dir.glob("*.wav"))
            audio_files.sort(key=lambda f: f.stat().st_mtime)
            for af in audio_files:
                if self._get_total_used() <= target_bytes:
                    return
                try:
                    af.unlink()
                except OSError:
                    pass

    def _get_total_used(self) -> int:
        return self._get_dir_size(self.outputs_dir) + self._get_dir_size(self.batches_dir) + self._get_dir_size(self.cache_dir)

storage_service = StorageService()
