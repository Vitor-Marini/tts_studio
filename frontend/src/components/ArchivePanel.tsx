import React, { useState, useEffect } from 'react';
import { AudioFileItem, StorageStats, BatchSummary } from '../types';
import { api } from '../services/api';
import { AudioPlayer } from './AudioPlayer';

export const ArchivePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'batches' | 'audios'>('batches');
  const [audios, setAudios] = useState<AudioFileItem[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [audiosRes, batchesRes, storageRes] = await Promise.all([
        api.listAudios().catch(() => ({ audios: [], total: 0 })),
        api.listBatches().catch(() => []),
        api.getStorageStats().catch(() => null),
      ]);
      setAudios(audiosRes.audios || []);
      setBatches(batchesRes || []);
      setStorage(storageRes);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const filteredAudios = audios.filter(a => a.filename.toLowerCase().includes(search.toLowerCase()));
  const filteredBatches = batches.filter(b => b.id.toLowerCase().includes(search.toLowerCase()) || b.voice_name.toLowerCase().includes(search.toLowerCase()));

  const toggleSelectAudio = (filename: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  const selectAllAudios = () => {
    if (selected.size === filteredAudios.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredAudios.map(a => a.filename)));
    }
  };

  const handleDeleteSelectedAudios = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} áudio(s) selecionado(s)?`)) return;
    for (const filename of selected) {
      await api.deleteAudio(filename);
    }
    setSelected(new Set());
    fetchData();
  };

  const handleDeleteAllAudios = async () => {
    if (audios.length === 0) return;
    if (!confirm('Excluir TODOS os áudios individuais gerados?')) return;
    await api.deleteAllAudios();
    setSelected(new Set());
    fetchData();
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm(`Excluir permanentemente o lote '${batchId}' e todos os seus áudios?`)) return;
    try {
      await api.deleteBatch(batchId);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir lote.');
    }
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
        <h2>Gerenciador de Armazenamento e Arquivos</h2>
        <p>Acompanhe o espaço ocupado no servidor, recupere lotes anteriores e gerencie áudios salvos.</p>
      </header>

      {/* Barra de Progresso de Armazenamento */}
      {storage && (
        <div
          className="glass-panel"
          style={{
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            border: storage.used_percentage > 85 ? '1px solid rgba(255,107,107,0.4)' : '1px solid rgba(255,255,255,0.08)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.2rem' }}>💾</span>
              <div>
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Espaço em Disco: {formatSize(storage.used_bytes)} / {formatSize(storage.max_bytes)} ({storage.used_percentage}%)
                </span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {formatSize(storage.batches_bytes)} em lotes · {formatSize(storage.outputs_bytes)} em sínteses · {formatSize(storage.cache_bytes)} em cache
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  background: 'rgba(105, 240, 174, 0.1)',
                  color: 'var(--success-color)',
                  border: '1px solid rgba(105, 240, 174, 0.2)'
                }}
              >
                ✓ Rotação Automática Ativa (FIFO)
              </span>
              <button
                className="btn-secondary"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                onClick={fetchData}
                title="Atualizar métricas"
              >
                🔄 Atualizar
              </button>
            </div>
          </div>

          {/* Barra visual */}
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${Math.min(storage.used_percentage, 100)}%`,
                height: '100%',
                background:
                  storage.used_percentage > 90
                    ? 'var(--error-color)'
                    : storage.used_percentage > 75
                    ? 'var(--warning-color)'
                    : 'linear-gradient(90deg, var(--accent-primary), #ff944d)',
                borderRadius: '4px',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
        </div>
      )}

      {/* Navegação entre Lotes Salvos e Sínteses Individuais */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('batches')}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            background: activeTab === 'batches' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.04)',
            color: activeTab === 'batches' ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.2s ease'
          }}
        >
          📁 Lotes Salvos ({batches.length})
        </button>

        <button
          onClick={() => setActiveTab('audios')}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            background: activeTab === 'audios' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.04)',
            color: activeTab === 'audios' ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.2s ease'
          }}
        >
          🎵 Sínteses Individuais ({audios.length})
        </button>
      </div>

      {/* Painel de Conteúdo */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Barra de Busca e Ações */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input-base"
            placeholder={activeTab === 'batches' ? 'Buscar lote por ID ou voz...' : 'Buscar por nome do áudio...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />

          {activeTab === 'audios' && (
            <>
              <button className="btn-secondary" onClick={selectAllAudios}>
                {selected.size === filteredAudios.length && filteredAudios.length > 0 ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
              {selected.size > 0 && (
                <>
                  <button className="btn-primary" onClick={handleDownloadSelectedZip}>
                    Baixar Selecionados ({selected.size} .zip)
                  </button>
                  <button className="btn-danger" onClick={handleDeleteSelectedAudios}>
                    Excluir ({selected.size})
                  </button>
                </>
              )}
              {audios.length > 0 && (
                <button className="btn-secondary" style={{ color: '#ff6b6b' }} onClick={handleDeleteAllAudios}>
                  Limpar Todos os Áudios
                </button>
              )}
            </>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            <span className="spinner"></span>
            <span>Carregando dados...</span>
          </div>
        ) : activeTab === 'batches' ? (
          /* Lista de Lotes Salvos */
          filteredBatches.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>Nenhum lote salvo no momento.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
              {filteredBatches.map(batch => (
                <div
                  key={batch.id}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {batch.id}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          background:
                            batch.status === 'completed'
                              ? 'rgba(105, 240, 174, 0.15)'
                              : batch.status === 'running'
                              ? 'rgba(255, 107, 0, 0.2)'
                              : 'rgba(255, 255, 255, 0.1)',
                          color:
                            batch.status === 'completed'
                              ? 'var(--success-color)'
                              : batch.status === 'running'
                              ? 'var(--accent-primary)'
                              : 'var(--text-secondary)',
                          fontWeight: 600
                        }}
                      >
                        {batch.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span>🎙️ Voz: <strong style={{ color: 'var(--text-primary)' }}>{batch.voice_name}</strong></span>
                      <span>📊 {batch.completed_items}/{batch.total_items} áudios ({batch.format.toUpperCase()})</span>
                      <span>💾 {formatSize(batch.size_bytes)}</span>
                      <span>🕒 {formatDate(batch.created_at)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {batch.has_zip && (
                      <a
                        href={`/api/batch/${batch.id}/download`}
                        className="btn-primary"
                        style={{
                          textDecoration: 'none',
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                        download
                      >
                        ⬇️ Baixar ZIP ({batch.zip_size_bytes ? formatSize(batch.zip_size_bytes) : ''})
                      </a>
                    )}

                    <button
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: '#ff6b6b' }}
                      onClick={() => handleDeleteBatch(batch.id)}
                      title="Excluir lote completo do disco"
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Lista de Áudios Individuais */
          filteredAudios.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>Nenhum áudio individual encontrado.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
              {filteredAudios.map(audio => (
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
                    onChange={() => toggleSelectAudio(audio.filename)}
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
                      fetchData();
                    }}
                    style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem' }}
                    title="Excluir arquivo"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
