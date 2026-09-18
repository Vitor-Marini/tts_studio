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
        {/* Coluna Principal: Texto e Geração */}
        <div className="left-col glass-panel">
          <div className="form-group">
            <label>Texto para Síntese</label>
            <textarea
              className="input-base"
              rows={6}
              placeholder="Digite ou cole aqui o texto que deseja transformar em voz..."
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Formato de Saída</label>
              <select
                className="input-base"
                value={format}
                onChange={e => setFormat(e.target.value)}
                disabled={isGenerating}
              >
                <option value="mp3">.MP3 (Compacto e Compatível)</option>
                <option value="wav">.WAV (Áudio Sem Perdas)</option>
              </select>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Velocidade da Fala</label>
                <span style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
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
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '8px', color: '#ff8c8c', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconAlertTriangle size={16} color="var(--error-color)" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            className="btn-primary"
            style={{ width: '100%', padding: '0.85rem' }}
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
                <span>Gerar Áudio</span>
              </>
            )}
          </button>

          {/* Histórico recente de áudios gerados */}
          <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Áudios Gerados nesta Sessão ({history.length})
            </h3>
            {history.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                Nenhum áudio gerado ainda. Digite um texto e clique em Gerar.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {history.map(item => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.filename}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Duração: <strong>{item.duration_seconds}s</strong> · Gerado em: <strong>{item.elapsed_time}s</strong>
                      </span>
                    </div>
                    <AudioPlayer src={item.audio_url} fileName={item.filename} autoPlay />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna Lateral: Voz Selecionada e Amostras de Referência */}
        <div className="right-col glass-panel">
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Voz Selecionada</label>
              <button
                onClick={onGoToVoices}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                + Gerenciar Vozes
              </button>
            </div>

            {voices.length === 0 ? (
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Nenhuma voz encontrada.</p>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span>Velocidade Padrão:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedVoice.default_speed}x</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Amostras de Referência:</span>
                  <strong style={{ color: 'var(--accent-primary)' }}>{selectedVoice.samples.length} áudio(s)</strong>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                  Ouvir Referências da Voz:
                </h4>
                {selectedVoice.samples.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#ff8c8c', fontStyle: 'italic' }}>
                    Esta voz ainda não possui arquivos de áudio de referência! Vá para a aba Vozes e adicione amostras.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedVoice.samples.map(sample => (
                      <div key={sample.filename} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sample.filename}</span>
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
  );
};
