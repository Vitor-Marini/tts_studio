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
from app.services.storage_service import storage_service, BatchSummary
from app.utils.csv_helper import inspect_csv, sanitize_filename, detect_encoding_and_delimiter, detect_encoding
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

    def save_temp_csv(self, content: bytes, original_filename: str = "") -> Dict[str, Any]:
        """Salva o CSV ou TXT temporariamente e retorna a análise de colunas e dados."""
        token = uuid.uuid4().hex[:12]
        ext = ".txt" if original_filename.lower().endswith(".txt") else ".csv"
        temp_path = self.batches_dir / f"temp_{token}{ext}"
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
            temp_path = self.batches_dir / f"temp_{token}.txt"
        if not temp_path.exists():
            raise FileNotFoundError("Arquivo de lote temporário expirado ou não encontrado.")

        voice = voice_service.get_voice(voice_name)
        if not voice:
            raise FileNotFoundError(f"Voz '{voice_name}' não encontrada.")

        effective_speed = float(speed) if speed is not None else float(voice.default_speed)
        items: List[BatchItem] = []

        if temp_path.suffix.lower() == ".txt":
            encoding = detect_encoding(temp_path)
            with open(temp_path, "r", encoding=encoding) as f:
                lines = [l.strip() for l in f if l.strip()]
            for idx, line in enumerate(lines, start=1):
                sanitized_file = sanitize_filename(f"audio_{idx:03d}", target_format=format, fallback_idx=idx)
                items.append(BatchItem(
                    index=idx,
                    filename=sanitized_file,
                    text=line,
                    status="pending"
                ))
        else:
            encoding, delimiter = detect_encoding_and_delimiter(temp_path)
            with open(temp_path, "r", encoding=encoding) as f:
                reader = csv.DictReader(f, delimiter=delimiter)
                for idx, row in enumerate(reader, start=1):
                    clean_row = {k.strip(): (v.strip() if v else "") for k, v in row.items() if k}
                    if filename_column in ["__auto__", "", None, "none", "null"]:
                        raw_filename = f"audio_{idx:03d}"
                    else:
                        raw_filename = clean_row.get(filename_column, f"audio_{idx:03d}")
                    raw_text = clean_row.get(text_column, "")

                    if not raw_text:
                        continue  # Pula linhas sem texto

                    sanitized_file = sanitize_filename(raw_filename, target_format=format, fallback_idx=idx)
                    items.append(BatchItem(
                        index=idx,
                        filename=sanitized_file,
                        text=raw_text,
                        status="pending"
                    ))

        if not items:
            raise ValueError("Nenhuma linha com texto válido encontrada no arquivo.")

        batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        job_dir = self.batches_dir / batch_id
        job_dir.mkdir(parents=True, exist_ok=True)

        # Move o arquivo para a pasta do lote
        file_dest = job_dir / f"input{temp_path.suffix}"
        temp_path.rename(file_dest)

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
        self._save_job_json(job)

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
        self._save_job_json(job)

    def _save_job_json(self, job: BatchJob):
        try:
            job_dir = self.batches_dir / job.id
            if job_dir.exists():
                with open(job_dir / "job.json", "w", encoding="utf-8") as f:
                    f.write(job.model_dump_json(indent=2))
        except Exception:
            pass

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

        # Garante o limite de armazenamento em disco
        try:
            storage_service.enforce_storage_limit()
        except Exception:
            pass

    def cancel_batch(self, batch_id: str) -> bool:
        if batch_id in self.jobs and self.jobs[batch_id].status == "running":
            self.cancel_flags[batch_id] = True
            return True
        return False

    def get_job(self, batch_id: str) -> Optional[BatchJob]:
        if batch_id in self.jobs:
            return self.jobs[batch_id]

        job_dir = self.batches_dir / batch_id
        job_file = job_dir / "job.json"
        if job_file.exists():
            try:
                with open(job_file, "r", encoding="utf-8") as f:
                    job = BatchJob.model_validate_json(f.read())
                    self.jobs[batch_id] = job
                    return job
            except Exception:
                pass

        report_file = job_dir / "relatorio.csv"
        if report_file.exists():
            try:
                items = []
                with open(report_file, "r", encoding="utf-8-sig") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        items.append(BatchItem(
                            index=int(row["index"]),
                            filename=row["filename"],
                            text=row["text"],
                            status=row.get("status", "completed"),
                            error=row.get("error") or None,
                            duration_seconds=float(row["duration_seconds"]) if row.get("duration_seconds") else None,
                            elapsed_time=float(row["elapsed_time"]) if row.get("elapsed_time") else None,
                        ))
                default_voice = "Voz_Padrao"
                available = voice_service.list_voices()
                if available and not any(v.name == default_voice for v in available):
                    default_voice = available[0].name

                job = BatchJob(
                    id=batch_id,
                    voice_name=default_voice,
                    format="mp3" if items and items[0].filename.endswith(".mp3") else "wav",
                    speed=1.0,
                    status="completed",
                    total_items=len(items),
                    completed_items=len([i for i in items if i.status == "completed"]),
                    items=items
                )
                self.jobs[batch_id] = job
                self._save_job_json(job)
                return job
            except Exception:
                pass
        return None

    def update_item_text(self, batch_id: str, item_index: int, new_text: str) -> BatchItem:
        job = self.get_job(batch_id)
        if not job:
            raise FileNotFoundError(f"Lote '{batch_id}' não encontrado.")

        item = next((it for it in job.items if it.index == item_index), None)
        if not item:
            raise FileNotFoundError(f"Item #{item_index} não encontrado no lote.")

        item.text = new_text.strip()
        self._save_job_json(job)
        return item

    def regenerate_item(self, batch_id: str, item_index: int, new_text: Optional[str] = None) -> BatchItem:
        job = self.get_job(batch_id)
        if not job:
            raise FileNotFoundError(f"Lote '{batch_id}' não encontrado.")

        item = next((it for it in job.items if it.index == item_index), None)
        if not item:
            raise FileNotFoundError(f"Item #{item_index} não encontrado no lote.")

        if new_text and new_text.strip():
            item.text = new_text.strip()

        job_dir = self.batches_dir / batch_id
        audios_dir = job_dir / "audios"
        audios_dir.mkdir(parents=True, exist_ok=True)

        final_file_path = audios_dir / item.filename
        wav_temp_path = audios_dir / (Path(item.filename).stem + "_regen_temp.wav")

        try:
            speaker_wavs = voice_service.get_reference_paths(job.voice_name)
        except FileNotFoundError:
            available = voice_service.list_voices()
            if not available:
                raise FileNotFoundError("Nenhuma voz cadastrada no sistema.")
            job.voice_name = available[0].name
            speaker_wavs = voice_service.get_reference_paths(job.voice_name)

        try:
            t0 = time.time()
            elapsed = engine.synthesize(
                text=item.text,
                speaker_wavs=speaker_wavs,
                output_path=wav_temp_path,
                language="pt",
                speed=job.speed
            )

            if job.format == "mp3":
                success = convert_wav_to_mp3(wav_temp_path, final_file_path)
                if success and final_file_path.exists():
                    try:
                        wav_temp_path.unlink()
                    except OSError:
                        pass
                else:
                    if wav_temp_path.exists():
                        wav_temp_path.rename(final_file_path)
            else:
                if wav_temp_path.exists():
                    wav_temp_path.rename(final_file_path)

            item.status = "completed"
            item.error = None
            item.elapsed_time = round(elapsed, 2)
            item.duration_seconds = round(get_audio_duration(final_file_path), 2)

        except Exception as e:
            item.status = "failed"
            item.error = str(e)
            if wav_temp_path.exists():
                try:
                    wav_temp_path.unlink()
                except OSError:
                    pass
            raise e
        finally:
            self._generate_report_and_zip(job, job_dir, audios_dir)
            self._save_job_json(job)

        return item

    def get_zip_path(self, batch_id: str) -> Optional[Path]:
        job_dir = self.batches_dir / batch_id
        zip_path = job_dir / f"{batch_id}.zip"
        if zip_path.exists():
            return zip_path
        return None

    def list_batches(self) -> List[BatchSummary]:
        """Retorna histórico de lotes armazenados."""
        return storage_service.list_batches()

    def delete_batch(self, batch_id: str) -> bool:
        """Exclui um lote da memória e do disco."""
        if batch_id in self.jobs:
            del self.jobs[batch_id]
        return storage_service.delete_batch(batch_id)

batch_service = BatchService()
