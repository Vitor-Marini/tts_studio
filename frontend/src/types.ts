export interface VoiceSample {
  filename: string;
  url: string;
  size_bytes: number;
}

export interface Voice {
  name: string;
  default_speed: number;
  created_at: string;
  samples: VoiceSample[];
}

export interface TTSResponse {
  id: string;
  filename: string;
  audio_url: string;
  duration_seconds: number;
  elapsed_time: number;
  voice: string;
  speed: number;
  format: string;
}

export interface BatchItem {
  index: number;
  filename: string;
  text: string;
  status: 'pending' | 'processing' | 'completed' | 'skipped' | 'failed' | 'cancelled';
  error?: string;
  duration_seconds?: number;
  elapsed_time?: number;
}

export interface BatchJob {
  id: string;
  voice_name: string;
  format: string;
  speed: number;
  skip_existing: boolean;
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
  total_items: number;
  completed_items: number;
  failed_items: number;
  current_item?: string;
  created_at: string;
  finished_at?: string;
  items: BatchItem[];
}

export interface AudioFileItem {
  filename: string;
  size_bytes: number;
  created_at: string;
  url: string;
}

export interface CSVInspectResult {
  token: string;
  delimiter: string;
  encoding: string;
  columns: string[];
  total_rows: number;
  preview: Record<string, string>[];
  is_txt?: boolean;
}

export interface StorageStats {
  used_bytes: number;
  used_mb: number;
  max_bytes: number;
  max_mb: number;
  used_percentage: number;
  outputs_bytes: number;
  batches_bytes: number;
  cache_bytes: number;
  total_audios: number;
  total_batches: number;
}

export interface BatchSummary {
  id: string;
  voice_name: string;
  created_at: string;
  status: string;
  total_items: number;
  completed_items: number;
  format: string;
  size_bytes: number;
  has_zip: boolean;
  zip_size_bytes?: number;
}
