import os
import csv
import json
import uuid
import time
import zipfile
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

from app.config import settings
from app.core.engine import engine
from app.services.voice_service import voice_service
from app.utils.csv_helper import inspect_csv, sanitize_filename, detect_encoding_and_delimiter
from app.utils.audio import convert_wav_to_mp3, get_audio_duration

class BatchItem(BaseModel):
    index: int
    filename: str
    text: str
    status: str = "pending"  # pending, processing, completed, skipped, failed
    error: Optional[str] = None
    duration_seconds: Optional[float] = None
    elapsed_time: Optional[float] = None

class BatchJob(BaseModel):
    id: str
    voice_name: str
    format: str = "mp3"
    speed: float = 1.0
    skip_existing: bool = True
    status: str = "queued"  # queued, running, completed, cancelled, failed
    total_items: int = 0
    completed_items: int = 0
    failed_items: int = 0
    current_item: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    finished_at: Optional[str] = None
    items: List[BatchItem] = []

class BatchService:
    def __init__(self):
        self.batches_dir = settings.BATCHES_DIR
        self.batches_dir.mkdir(parents=True, exist_ok=True)
        self.jobs: Dict[str, BatchJob] = {}
        self.cancel_flags: Dict[str, bool] = {}

    def save_temp_csv(self, content: bytes) -> Dict[str, Any]:
        """Salva o CSV temporariamente e retorna a análise de colunas e dados."""
        token = uuid.uuid4().hex[:12]
        temp_path = self.batches_dir / f"temp_{token}.csv"
        with open(temp_path, "wb") as f:
            f.write(content)

        info = inspect_csv(temp_path)
        info["token"] = token
        return info

    def start_batch(
        self,
        token: str,
        voice_name: str,
        filename_column: str,
        text_column: str,
        format: str = "mp3",
        speed: Optional[float] = None,
        skip_existing: bool = True
    ) -> BatchJob:
        temp_path = self.batches_dir / f"temp_{token}.csv"
        if not temp_path.exists():
            raise FileNotFoundError("Arquivo CSV temporário expirado ou não encontrado.")

        voice = voice_service.get_voice(voice_name)
        if not voice:
            raise FileNotFoundError(f"Voz '{voice_name}' não encontrada.")

        effective_speed = float(speed) if speed is not None else float(voice.default_speed)
        encoding, delimiter = detect_encoding_and_delimiter(temp_path)

        items: List[BatchItem] = []
        with open(temp_path, "r", encoding=encoding) as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            for idx, row in enumerate(reader, start=1):
                clean_row = {k.strip(): (v.strip() if v else "") for k, v in row.items() if k}
                raw_filename = clean_row.get(filename_column, f"audio_{idx}")
                raw_text = clean_row.get(text_column, "")

                if not raw_text:
                    continue  # Pula linhas sem texto

                sanitized_file = sanitize_filename(raw_filename, target_format=format)
                items.append(BatchItem(
                    index=idx,
                    filename=sanitized_file,
                    text=raw_text,
                    status="pending"
                ))

        if not items:
            raise ValueError("Nenhuma linha com texto válido encontrada no CSV.")

        batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        job_dir = self.batches_dir / batch_id
        job_dir.mkdir(parents=True, exist_ok=True)

        # Move o CSV para a pasta do lote
        csv_dest = job_dir / "input.csv"
        temp_path.rename(csv_dest)

        job = BatchJob(
            id=batch_id,
            voice_name=voice_name,
            format=format.lower(),
            speed=effective_speed,
            skip_existing=skip_existing,
            status="queued",
            total_items=len(items),
            items=items
        )

        self.jobs[batch_id] = job
        self.cancel_flags[batch_id] = False

        # Inicia thread de processamento sequencial
        thread = threading.Thread(target=self._run_batch, args=(batch_id,), daemon=True)
        thread.start()

        return job

    def _run_batch(self, batch_id: str):
        job = self.jobs.get(batch_id)
        if not job:
            return

        job_dir = self.batches_dir / batch_id
        audios_dir = job_dir / "audios"
        audios_dir.mkdir(parents=True, exist_ok=True)

        job.status = "running"

        try:
            speaker_wavs = voice_service.get_reference_paths(job.voice_name)
        except Exception as e:
            job.status = "failed"
            job.finished_at = datetime.now().isoformat()
            for it in job.items:
                it.status = "failed"
                it.error = str(e)
            return

        for item in job.items:
            if self.cancel_flags.get(batch_id, False):
                item.status = "cancelled"
                continue

            job.current_item = item.filename
            item.status = "processing"

            final_file_path = audios_dir / item.filename
            wav_temp_path = audios_dir / (Path(item.filename).stem + ".wav")

            # Checkpoint: se configurado para pular existentes e arquivo já existe
            if job.skip_existing and final_file_path.exists() and final_file_path.stat().st_size > 1000:
                item.status = "skipped"
                item.duration_seconds = get_audio_duration(final_file_path)
                job.completed_items += 1
                continue

            try:
                # Síntese direta
                t0 = time.time()
                elapsed = engine.synthesize(
                    text=item.text,
                    speaker_wavs=speaker_wavs,
                    output_path=wav_temp_path,
                    language="pt",
                    speed=job.speed
                )

                if job.format == "mp3":
                    mp3_path = audios_dir / item.filename
                    success = convert_wav_to_mp3(wav_temp_path, mp3_path)
                    if success and mp3_path.exists():
                        try:
                            wav_temp_path.unlink()
                        except OSError:
                            pass
                    else:
                        # Se ffmpeg falhou, mantém wav
                        if wav_temp_path.exists():
                            wav_temp_path.rename(mp3_path)

                item.status = "completed"
                item.elapsed_time = round(elapsed, 2)
                item.duration_seconds = round(get_audio_duration(final_file_path), 2)
                job.completed_items += 1

            except Exception as e:
                item.status = "failed"
                item.error = str(e)
                job.failed_items += 1

        if self.cancel_flags.get(batch_id, False):
            job.status = "cancelled"
        else:
            job.status = "completed"

        job.current_item = None
        job.finished_at = datetime.now().isoformat()

        # Gera o relatório CSV e compacta em ZIP
        self._generate_report_and_zip(job, job_dir, audios_dir)

    def _generate_report_and_zip(self, job: BatchJob, job_dir: Path, audios_dir: Path):
        report_path = job_dir / "relatorio.csv"
        with open(report_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["index", "filename", "text", "status", "error", "duration_seconds", "elapsed_time"])
            for it in job.items:
                writer.writerow([it.index, it.filename, it.text, it.status, it.error or "", it.duration_seconds or "", it.elapsed_time or ""])

        # Cria ZIP com áudios e relatório
        zip_path = job_dir / f"{job.id}.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            if report_path.exists():
                zf.write(report_path, "relatorio.csv")
            for audio_file in audios_dir.iterdir():
                if audio_file.is_file():
                    zf.write(audio_file, audio_file.name)

    def cancel_batch(self, batch_id: str) -> bool:
        if batch_id in self.jobs and self.jobs[batch_id].status == "running":
            self.cancel_flags[batch_id] = True
            return True
        return False

    def get_job(self, batch_id: str) -> Optional[BatchJob]:
        return self.jobs.get(batch_id)

    def get_zip_path(self, batch_id: str) -> Optional[Path]:
        job_dir = self.batches_dir / batch_id
        zip_path = job_dir / f"{batch_id}.zip"
        if zip_path.exists():
            return zip_path
        return None

batch_service = BatchService()
