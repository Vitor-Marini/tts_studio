import React, { useState } from 'react';
import { Voice } from '../types';
import { api } from '../services/api';
import { AudioPlayer } from './AudioPlayer';
import { IconMic, IconAlertTriangle, IconEdit, IconX } from './Icons';

interface VoicePanelProps {
  voices: Voice[];
  onRefresh: () => void;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({ voices, onRefresh }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newVoiceName, setNewVoiceName] = useState('');
  const [newVoiceSpeed, setNewVoiceSpeed] = useState<number>(1.0);
  const [newVoiceFiles, setNewVoiceFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [editingSpeedVoice, setEditingSpeedVoice] = useState<string | null>(null);
  const [tempSpeed, setTempSpeed] = useState<number>(1.0);

  const handleCreateVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoiceName.trim()) {
      setErrorMsg('Informe o nome da voz.');
      return;
    }
    if (newVoiceFiles.length === 0) {
      setErrorMsg('Selecione pelo menos um arquivo de áudio de referência (.wav ou .mp3).');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await api.createVoice(newVoiceName.trim(), newVoiceSpeed, newVoiceFiles);
      setNewVoiceName('');
      setNewVoiceSpeed(1.0);
      setNewVoiceFiles([]);
      setShowCreateModal(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar voz.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSamples = async (voiceName: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      await api.addVoiceSamples(voiceName, Array.from(files));
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao adicionar amostras.');
    }
  };

  const handleDeleteSample = async (voiceName: string, sampleFilename: string) => {
    if (!confirm(`Remover a amostra '${sampleFilename}' da voz '${voiceName}'?`)) return;
    try {
      await api.deleteVoiceSample(voiceName, sampleFilename);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao remover amostra.');
    }
  };

  const handleDeleteVoice = async (voiceName: string) => {
    if (!confirm(`Excluir permanentemente a voz '${voiceName}' e todas as suas referências?`)) return;
    try {
      await api.deleteVoice(voiceName);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir voz.');
    }
  };

  const handleSaveSpeed = async (voiceName: string) => {
    try {
      await api.updateVoice(voiceName, tempSpeed);
      setEditingSpeedVoice(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar velocidade padrão.');
    }
  };

  return (
    <div className="panel-wrapper">
      <header className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Gerenciador de Vozes</h2>
          <p>Cadastre e gerencie vozes com múltiplos áudios de referência para maior fidelidade.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nova Voz
        </button>
      </header>

      {/* Modal de Criação de Voz */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '520px',
              maxWidth: '100%',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--accent-primary)',
              padding: '2rem'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <IconMic size={22} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.3rem', color: '#fff', margin: 0 }}>Cadastrar Nova Voz</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Envie um ou mais áudios de referência. Múltiplos áudios resultam em uma clonagem mais estável.
            </p>

            <form onSubmit={handleCreateVoice} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label>Nome da Voz</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="Ex: Locutor_Institucional, Narrador_Audiobook"
                  value={newVoiceName}
                  onChange={e => setNewVoiceName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label>Velocidade Padrão</label>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{newVoiceSpeed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={newVoiceSpeed}
                  onChange={e => setNewVoiceSpeed(parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Áudios de Referência (.wav ou .mp3)</label>
                <div
                  className="upload-dropzone"
                  style={{ padding: '1.5rem 1rem' }}
                  onClick={() => document.getElementById('voice-file-input')?.click()}
                >
                  <input
                    id="voice-file-input"
                    type="file"
                    accept="audio/wav,audio/mpeg,audio/flac,audio/ogg"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => {
                      if (e.target.files) {
                        setNewVoiceFiles(Array.from(e.target.files));
                      }
                    }}
                  />
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {newVoiceFiles.length > 0 ? (
                    <p style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                      {newVoiceFiles.length} arquivo(s) selecionado(s)
                    </p>
                  ) : (
                    <>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Clique para selecionar arquivos</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Recomendado: 2 a 5 amostras limpas de 5 a 15 segundos
                      </span>
                    </>
                  )}
                </div>
              </div>

              {errorMsg && (
                <div style={{ color: '#ff8c8c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <IconAlertTriangle size={14} color="var(--error-color)" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Salvar Voz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista de Vozes Cadastradas */}
      {voices.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p style={{ margin: 0 }}>Nenhuma voz cadastrada. Clique no botão acima para criar sua primeira voz clonada.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem', width: '100%' }}>
          {voices.map(voice => (
            <div key={voice.name} className="card" style={{ height: '100%' }}>
              <div className="card-header">
                <div>
                  <h3 className="card-title" style={{ fontSize: '1.1rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
                    </svg>
                    {voice.name}
                  </h3>
                  <span className="card-subtitle">
                    Cadastrada em {new Date(voice.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <button
                  className="btn-danger"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                  onClick={() => handleDeleteVoice(voice.name)}
                >
                  Excluir Voz
                </button>
              </div>

              <div className="card-body" style={{ flex: 1 }}>
                {/* Velocidade Padrão */}
                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Velocidade Padrão:</span>
                  {editingSpeedVoice === voice.name ? (
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        step="0.05"
                        min="0.5"
                        max="2.0"
                        value={tempSpeed}
                        onChange={e => setTempSpeed(parseFloat(e.target.value))}
                        style={{ width: '60px', padding: '0.2rem', background: 'var(--bg-primary)', border: '1px solid var(--accent-primary)', color: '#fff', borderRadius: '4px', textAlign: 'center' }}
                      />
                      <button className="btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleSaveSpeed(voice.name)}>
                        OK
                      </button>
                      <button className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center' }} onClick={() => setEditingSpeedVoice(null)}>
                        <IconX size={12} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ color: 'var(--accent-primary)', fontSize: '0.9rem' }}>{voice.default_speed}x</strong>
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        onClick={() => {
                          setEditingSpeedVoice(voice.name);
                          setTempSpeed(voice.default_speed);
                        }}
                        title="Editar velocidade"
                      >
                        <IconEdit size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Lista de Referências */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Amostras de Referência ({voice.samples.length})
                    </label>
                    <label
                      htmlFor={`add-sample-${voice.name}`}
                      style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      + Adicionar Áudio
                    </label>
                    <input
                      id={`add-sample-${voice.name}`}
                      type="file"
                      accept="audio/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={e => handleAddSamples(voice.name, e.target.files)}
                    />
                  </div>

                  {voice.samples.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#ff8c8c', fontStyle: 'italic', padding: '0.5rem 0' }}>
                      Nenhum áudio anexado. A voz precisa de pelo menos uma amostra para funcionar.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
                      {voice.samples.map(sample => (
                        <div
                          key={sample.filename}
                          style={{
                            background: 'rgba(0,0,0,0.2)',
                            padding: '0.5rem 0.6rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.3rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }} title={sample.filename}>
                              {sample.filename}
                            </span>
                            <button
                              onClick={() => handleDeleteSample(voice.name, sample.filename)}
                              style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.7 }}
                              title="Remover amostra"
                            >
                              <IconX size={12} />
                            </button>
                          </div>
                          <AudioPlayer src={sample.url} fileName={sample.filename} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
