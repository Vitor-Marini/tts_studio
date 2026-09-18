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
}
