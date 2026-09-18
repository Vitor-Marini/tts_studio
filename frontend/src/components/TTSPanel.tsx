import React, { useState, useEffect } from 'react';
import { Voice, TTSResponse } from '../types';
import { api } from '../services/api';
import { AudioPlayer } from './AudioPlayer';
import { IconAlertTriangle } from './Icons';

interface TTSPanelProps {
  voices: Voice[];
  onGoToVoices: () => void;
}

export const TTSPanel: React.FC<TTSPanelProps> = ({ voices, onGoToVoices }) => {
  const [text, setText] = useState('');
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [format, setFormat] = useState<string>('mp3');
  const [speed, setSpeed] = useState<number>(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<TTSResponse[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Seleciona a primeira voz por padrão se não houver selecionada
  useEffect(() => {
    if (voices.length > 0) {
      const exists = voices.some(v => v.name === selectedVoiceName);
      if (!exists) {
        setSelectedVoiceName(voices[0].name);
        setSpeed(voices[0].default_speed || 1.0);
      }
    }
  }, [voices, selectedVoiceName]);

  const selectedVoice = voices.find(v => v.name === selectedVoiceName);

  // Ao trocar de voz, atualiza a velocidade padrão sugerida pela voz
  const handleVoiceChange = (newVoiceName: string) => {
    setSelectedVoiceName(newVoiceName);
    const v = voices.find(v => v.name === newVoiceName);
    if (v) {
      setSpeed(v.default_speed || 1.0);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setErrorMsg('Por favor, digite um texto para sintetizar.');
      return;
    }
    if (!selectedVoiceName) {
      setErrorMsg('Por favor, selecione uma voz.');
      return;
    }

    setErrorMsg('');
    setIsGenerating(true);
    try {
      const res = await api.synthesize(text, selectedVoiceName, format, speed);
      setHistory(prev => [res, ...prev]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha na geração de áudio.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="panel-wrapper">
      <header className="panel-header">
        <h2>Sintetizador de Voz</h2>
        <p>Gere locuções naturais a partir das suas vozes de referência.</p>
      </header>

      <div className="layout-grid">
        {/* Coluna Principal: Editor de Síntese e Resultados */}
        <div className="left-col">
          {/* Card 1: Editor de Síntese */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  Editor de Síntese
                </h3>
                <p className="card-subtitle">Escreva o texto e ajuste os parâmetros para geração da fala</p>
              </div>
              <span className="char-counter">
                {text.length} caractere{text.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="card-body">
              <div className="form-group">
                <textarea
                  className="input-base"
                  rows={5}
                  placeholder="Digite ou cole aqui o texto que deseja transformar em voz..."
                  value={text}
                  onChange={e => setText(e.target.value)}
                  disabled={isGenerating}
                />
              </div>

              {/* Barra de Parâmetros de Áudio */}
              <div className="param-toolbar">
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem' }}>Formato de Saída</label>
                  <select
                    className="input-base"
                    style={{ padding: '0.55rem 0.8rem', fontSize: '0.85rem' }}
                    value={format}
                    onChange={e => setFormat(e.target.value)}
                    disabled={isGenerating}
                  >
                    <option value="mp3">.MP3 (Compacto)</option>
                    <option value="wav">.WAV (Sem Perdas)</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.75rem' }}>Velocidade</label>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                      {speed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={speed}
                    onChange={e => setSpeed(parseFloat(e.target.value))}
                    disabled={isGenerating}
                  />
                </div>
              </div>

              {errorMsg && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '8px', color: '#ff8c8c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <IconAlertTriangle size={16} color="var(--error-color)" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                className="btn-primary"
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}
                onClick={handleGenerate}
                disabled={isGenerating || !selectedVoiceName}
              >
                {isGenerating ? (
                  <>
                    <span className="spinner"></span>
                    <span>Processando no modelo TTS...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>Gerar Tomada de Áudio</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card 2: Histórico de Tomadas Geradas */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h3 className="card-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Tomadas Desta Sessão
                </h3>
                <span className="badge badge-pending">{history.length}</span>
              </div>
              <p className="card-subtitle">Cada geração produz uma variação estocástica única</p>
            </div>

            <div className="card-body">
              {history.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <p style={{ fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>
                    Nenhuma tomada gerada ainda nesta sessão. Digite uma frase acima e clique em Gerar.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {history.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.85rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="badge badge-completed" style={{ fontSize: '0.7rem' }}>
                            Take #{history.length - idx}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.filename}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Duração: <strong style={{ color: 'var(--text-primary)' }}>{item.duration_seconds}s</strong> · Inferência: <strong>{item.elapsed_time}s</strong>
                        </span>
                      </div>
                      <AudioPlayer src={item.audio_url} fileName={item.filename} autoPlay={idx === 0} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Lateral: Voz Selecionada e Amostras de Referência */}
        <div className="right-col">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
                Perfil da Voz
              </h3>
              <button
                onClick={onGoToVoices}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                + Gerenciar Vozes
              </button>
            </div>

            <div className="card-body">
              <div className="form-group">
                <label>Voz Selecionada</label>
                {voices.length === 0 ? (
                  <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Nenhuma voz encontrada.</p>
                    <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={onGoToVoices}>
                      Criar Nova Voz
                    </button>
                  </div>
                ) : (
                  <select
                    className="input-base"
                    value={selectedVoiceName}
                    onChange={e => handleVoiceChange(e.target.value)}
                    disabled={isGenerating}
                  >
                    {voices.map(v => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.samples.length} referência{v.samples.length !== 1 ? 's' : ''})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedVoice && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ padding: '0.85rem', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Velocidade Sugerida:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{selectedVoice.default_speed}x</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Amostras de Clonagem:</span>
                      <strong style={{ color: 'var(--accent-primary)' }}>{selectedVoice.samples.length} áudio(s)</strong>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.6rem', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Áudios de Referência ({selectedVoice.samples.length}):
                    </h4>
                    {selectedVoice.samples.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: '#ff8c8c', fontStyle: 'italic' }}>
                        Esta voz ainda não possui arquivos de áudio de referência! Vá para a aba Vozes e adicione amostras.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '340px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                        {selectedVoice.samples.map(sample => (
                          <div key={sample.filename} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sample.filename}
                            </span>
                            <AudioPlayer src={sample.url} fileName={sample.filename} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
