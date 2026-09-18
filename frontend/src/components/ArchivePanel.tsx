import React, { useState, useEffect } from 'react';
import { AudioFileItem, StorageStats, BatchSummary } from '../types';
import { api } from '../services/api';
import { AudioPlayer } from './AudioPlayer';
import {
  IconHardDrive,
  IconFolder,
  IconMusic,
  IconMic,
  IconChart,
  IconClock,
  IconTrash,
  IconDownload,
  IconCheck,
  IconRefresh,
  IconSearch,
} from './Icons';

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
  const filteredBatches = batches.filter(
    b => b.id.toLowerCase().includes(search.toLowerCase()) || b.voice_name.toLowerCase().includes(search.toLowerCase())
  );

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
    if (!confirm(`Excluir permanentemente o lote '${batchId}' e todos os seus arquivos?`)) return;
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
    <div className="panel-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <header className="panel-header">
        <h2>Gerenciador de Armazenamento e Arquivos</h2>
        <p>Acompanhe o espaço ocupado no servidor, recupere lotes anteriores e gerencie arquivos gerados.</p>
      </header>

      {/* Seção 1: Monitor de Armazenamento e Métricas */}
      {storage && (
        <section
          className="glass-panel"
          style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            border: storage.used_percentage > 85 ? '1px solid rgba(255,107,107,0.4)' : '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Cabeçalho do Card de Armazenamento */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(255, 107, 0, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                }}
              >
                <IconHardDrive size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>
                  Armazenamento em Disco
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Capacidade total configurada: {formatSize(storage.max_bytes)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '20px',
                  background: 'rgba(105, 240, 174, 0.1)',
                  color: 'var(--success-color)',
                  border: '1px solid rgba(105, 240, 174, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 500,
                }}
              >
                <IconCheck size={13} />
                <span>Rotação Automática Ativa (FIFO)</span>
              </span>

              <button
                className="btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={fetchData}
                title="Atualizar métricas de disco"
              >
                <IconRefresh size={13} />
                <span>Atualizar</span>
              </button>
            </div>
          </div>

          {/* Barra de Progresso Visual */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>Espaço Ocupado</span>
              <strong style={{ color: storage.used_percentage > 85 ? 'var(--error-color)' : 'var(--accent-primary)' }}>
                {formatSize(storage.used_bytes)} ({storage.used_percentage}%)
              </strong>
            </div>
            <div
              style={{
                width: '100%',
                height: '10px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: '5px',
                overflow: 'hidden',
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
                  borderRadius: '5px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          {/* Mini-Cards com Distribuição de Espaço */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <IconFolder size={13} />
                <span>Lotes Processados</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatSize(storage.batches_bytes)}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {storage.total_batches} {storage.total_batches === 1 ? 'lote gravado' : 'lotes gravados'}
              </span>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <IconMusic size={13} />
                <span>Sínteses Avulsas</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatSize(storage.outputs_bytes)}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {storage.total_audios} {storage.total_audios === 1 ? 'áudio avulso' : 'áudios avulsos'}
              </span>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <IconHardDrive size={13} />
                <span>Espaço Livre Estimado</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--success-color)' }}>
                {formatSize(Math.max(0, storage.max_bytes - storage.used_bytes))}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {(100 - storage.used_percentage).toFixed(1)}% disponível
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Seção 2: Abas de Seleção de Conteúdo */}
      <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <button
          onClick={() => setActiveTab('batches')}
          style={{
            padding: '0.6rem 1.4rem',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            background: activeTab === 'batches' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.04)',
            color: activeTab === 'batches' ? '#fff' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease',
          }}
        >
          <IconFolder size={16} />
          <span>Lotes Salvos ({batches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audios')}
          style={{
            padding: '0.6rem 1.4rem',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            background: activeTab === 'audios' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.04)',
            color: activeTab === 'audios' ? '#fff' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease',
          }}
        >
          <IconMusic size={16} />
          <span>Sínteses Individuais ({audios.length})</span>
        </button>
      </div>

      {/* Seção 3: Conteúdo Principal com Barra de Ações Separada */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Barra de Busca e Filtros */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <input
              type="text"
              className="input-base"
              placeholder={activeTab === 'batches' ? 'Buscar lote por identificador ou voz...' : 'Buscar áudio por nome de arquivo...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: '2.5rem' }}
            />
            <div style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
              <IconSearch size={16} />
            </div>
          </div>

          {/* Botões de Ação para Sínteses Individuais */}
          {activeTab === 'audios' && (
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }} onClick={selectAllAudios}>
                {selected.size === filteredAudios.length && filteredAudios.length > 0 ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>

              {selected.size > 0 && (
                <>
                  <button
                    className="btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={handleDownloadSelectedZip}
                  >
                    <IconDownload size={14} />
                    <span>Baixar Selecionados ({selected.size} .zip)</span>
                  </button>

                  <button
                    className="btn-danger"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={handleDeleteSelectedAudios}
                  >
                    <IconTrash size={14} />
                    <span>Excluir ({selected.size})</span>
                  </button>
                </>
              )}

              {audios.length > 0 && (
                <button
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem', color: '#ff6b6b' }}
                  onClick={handleDeleteAllAudios}
                >
                  Limpar Todos os Áudios
                </button>
              )}
            </div>
          )}
        </div>

        {/* Listagem */}
        {loading ? (
          <div style={{ padding: '3.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem', color: 'var(--text-secondary)' }}>
            <span className="spinner"></span>
            <span>Carregando arquivos do servidor...</span>
          </div>
        ) : activeTab === 'batches' ? (
          /* Lista de Lotes Salvos */
          filteredBatches.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>Nenhum lote de processamento encontrado.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
              {filteredBatches.map(batch => (
                <div
                  key={batch.id}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1.25rem',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Informações do Lote */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '260px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {batch.id}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background:
                            batch.status === 'completed'
                              ? 'rgba(105, 240, 174, 0.15)'
                              : batch.status === 'running'
                              ? 'rgba(255, 107, 0, 0.2)'
                              : 'rgba(255, 255, 255, 0.08)',
                          color:
                            batch.status === 'completed'
                              ? 'var(--success-color)'
                              : batch.status === 'running'
                              ? 'var(--accent-primary)'
                              : 'var(--text-secondary)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {batch.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <IconMic size={14} color="var(--accent-primary)" />
                        <span>Voz: <strong style={{ color: 'var(--text-primary)' }}>{batch.voice_name}</strong></span>
                      </span>

                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <IconChart size={14} />
                        <span>{batch.completed_items}/{batch.total_items} áudios ({batch.format.toUpperCase()})</span>
                      </span>

                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <IconHardDrive size={14} />
                        <span>{formatSize(batch.size_bytes)}</span>
                      </span>

                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <IconClock size={14} />
                        <span>{formatDate(batch.created_at)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Ações do Lote */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                    {batch.has_zip && (
                      <a
                        href={`/api/batch/${batch.id}/download`}
                        className="btn-primary"
                        style={{
                          textDecoration: 'none',
                          padding: '0.45rem 0.9rem',
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                        }}
                        download
                      >
                        <IconDownload size={14} />
                        <span>Baixar ZIP {batch.zip_size_bytes ? `(${formatSize(batch.zip_size_bytes)})` : ''}</span>
                      </a>
                    )}

                    <button
                      className="btn-secondary"
                      style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', color: '#ff6b6b', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                      onClick={() => handleDeleteBatch(batch.id)}
                      title="Excluir este lote permanentemente"
                    >
                      <IconTrash size={14} />
                      <span>Excluir</span>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
              {filteredAudios.map(audio => (
                <div
                  key={audio.filename}
                  style={{
                    background: selected.has(audio.filename) ? 'rgba(255,107,0,0.08)' : 'rgba(255,255,255,0.02)',
                    border: selected.has(audio.filename) ? '1px solid rgba(255,107,0,0.3)' : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    padding: '0.9rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(audio.filename)}
                    onChange={() => toggleSelectAudio(audio.filename)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                  />

                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {audio.filename}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
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
                    style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', opacity: 0.65, display: 'flex', alignItems: 'center', padding: '0.4rem' }}
                    title="Excluir áudio"
                  >
                    <IconTrash size={16} />
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
