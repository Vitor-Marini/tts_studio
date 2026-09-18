import { Voice, TTSResponse, BatchJob, AudioFileItem, CSVInspectResult } from '../types';

export const api = {
  // Vozes
  async listVoices(): Promise<Voice[]> {
    const res = await fetch('/api/voices');
    if (!res.ok) throw new Error('Erro ao listar vozes');
    return res.json();
  },

  async createVoice(name: string, defaultSpeed: number, files: File[]): Promise<Voice> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('default_speed', defaultSpeed.toString());
    files.forEach(f => formData.append('files', f));

    const res = await fetch('/api/voices', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Erro ao criar voz');
    }
    return res.json();
  },

  async updateVoice(name: string, defaultSpeed?: number, newName?: string): Promise<Voice> {
    const res = await fetch(`/api/voices/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_speed: defaultSpeed, new_name: newName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Erro ao atualizar voz');
    }
    return res.json();
  },

  async addVoiceSamples(voiceName: string, files: File[]): Promise<void> {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    const res = await fetch(`/api/voices/${encodeURIComponent(voiceName)}/samples`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Erro ao adicionar amostras');
    }
  },

  async deleteVoiceSample(voiceName: string, filename: string): Promise<void> {
    const res = await fetch(`/api/voices/${encodeURIComponent(voiceName)}/samples/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Erro ao excluir amostra');
  },

  async deleteVoice(name: string): Promise<void> {
    const res = await fetch(`/api/voices/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Erro ao excluir voz');
  },

  // Síntese Individual
  async synthesize(text: string, voice: string, format: string = 'mp3', speed?: number): Promise<TTSResponse> {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, format, speed, language: 'pt' }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Erro ao sintetizar áudio');
    }
    return res.json();
  },

  // Lote / Batch
  async inspectCSV(file: File): Promise<CSVInspectResult> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/batch/inspect', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Erro ao inspecionar CSV');
    }
    return res.json();
  },

  async startBatch(params: {
    token: string;
    voice: string;
    filename_column: string;
    text_column: string;
    format: string;
    speed?: number;
    skip_existing: boolean;
  }): Promise<BatchJob> {
    const res = await fetch('/api/batch/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Erro ao iniciar lote');
    }
    return res.json();
  },

  async getBatchStatus(batchId: string): Promise<BatchJob> {
    const res = await fetch(`/api/batch/${encodeURIComponent(batchId)}`);
    if (!res.ok) throw new Error('Erro ao buscar status do lote');
    return res.json();
  },

  async cancelBatch(batchId: string): Promise<void> {
    const res = await fetch(`/api/batch/${encodeURIComponent(batchId)}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Erro ao cancelar lote');
  },

  // Áudios / Arquivo
  async listAudios(): Promise<{ audios: AudioFileItem[]; total: number }> {
    const res = await fetch('/api/audios');
    if (!res.ok) throw new Error('Erro ao listar áudios');
    return res.json();
  },

  async deleteAudio(filename: string): Promise<void> {
    const res = await fetch(`/api/audio/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Erro ao excluir áudio');
  },

  async deleteAllAudios(): Promise<void> {
    const res = await fetch('/api/audios', { method: 'DELETE' });
    if (!res.ok) throw new Error('Erro ao limpar áudios');
  },

  async downloadZip(filenames: string[]): Promise<Blob> {
    const res = await fetch('/api/audio/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filenames.map(filename => ({ filename }))),
    });
    if (!res.ok) throw new Error('Erro ao baixar ZIP');
    return res.blob();
  },
};
