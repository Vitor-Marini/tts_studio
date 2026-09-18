import React, { useState, useEffect } from 'react';
import { AudioFileItem } from '../types';
import { api } from '../services/api';
import { AudioPlayer } from './AudioPlayer';

export const ArchivePanel: React.FC = () => {
  const [audios, setAudios] = useState<AudioFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchAudios = async () => {
    setLoading(true);
    try {
      const data = await api.listAudios();
      setAudios(data.audios || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudios();
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const filtered = audios.filter(a => a.filename.toLowerCase().includes(search.toLowerCase()));

  const toggleSelect = (filename: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(a => a.filename)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} áudio(s) selecionado(s)?`)) return;
    for (const filename of selected) {
      await api.deleteAudio(filename);
    }
    setSelected(new Set());
    fetchAudios();
  };

  const handleDeleteAll = async () => {
    if (audios.length === 0) return;
    if (!confirm('Excluir TODOS os áudios gerados? Esta ação não pode ser desfeita.')) return;
    await api.deleteAllAudios();
    setSelected(new Set());
    fetchAudios();
  };

  const handleDownloadSelectedZip = async () => {
    const list = Array.from(selected);
    if (list.length === 0) return alert('Selecione pelo menos um áudio.');
    try {
      const blob = await api.downloadZip(list);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tts_audios_${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Falha ao baixar o arquivo ZIP.');
    }
  };

  return (
    <div className="panel-wrapper">
      <header className="panel-header">
        <h2>Arquivo de Áudios</h2>
        <p>{audios.length} áudio(s) salvos no servidor.</p>
      </header>

      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input-base"
            placeholder="Buscar por nome do áudio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <button className="btn-secondary" onClick={selectAll}>
            {selected.size === filtered.length && filtered.length > 0 ? 'Desmarcar Todos' : 'Selecionar Todos'}
          </button>
          {selected.size > 0 && (
            <>
              <button className="btn-primary" onClick={handleDownloadSelectedZip}>
                Baixar Selecionados ({selected.size} .zip)
              </button>
              <button className="btn-danger" onClick={handleDeleteSelected}>
                Excluir ({selected.size})
              </button>
            </>
          )}
          {audios.length > 0 && (
            <button className="btn-secondary" style={{ color: '#ff6b6b' }} onClick={handleDeleteAll}>
              Limpar Todos
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            <span className="spinner"></span>
            <span>Carregando áudios...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>Nenhum áudio encontrado.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            {filtered.map(audio => (
              <div
                key={audio.filename}
                style={{
                  background: selected.has(audio.filename) ? 'rgba(255,107,0,0.08)' : 'rgba(255,255,255,0.02)',
                  border: selected.has(audio.filename) ? '1px solid rgba(255,107,0,0.3)' : '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(audio.filename)}
                  onChange={() => toggleSelect(audio.filename)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {audio.filename}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {formatSize(audio.size_bytes)} · {formatDate(audio.created_at)}
                    </span>
                  </div>
                  <AudioPlayer src={audio.url} fileName={audio.filename} />
                </div>

                <button
                  onClick={async () => {
                    if (!confirm(`Excluir '${audio.filename}'?`)) return;
                    await api.deleteAudio(audio.filename);
                    fetchAudios();
                  }}
                  style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem' }}
                  title="Excluir arquivo"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
