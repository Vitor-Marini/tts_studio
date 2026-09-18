import React, { useState, useEffect } from 'react';
import { Voice } from './types';
import { api } from './services/api';
import { TTSPanel } from './components/TTSPanel';
import { BatchPanel } from './components/BatchPanel';
import { VoicePanel } from './components/VoicePanel';
import { ArchivePanel } from './components/ArchivePanel';
import './App.css';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tts' | 'batch' | 'voices' | 'archive'>('tts');
  const [voices, setVoices] = useState<Voice[]>([]);

  const fetchVoices = async () => {
    try {
      const data = await api.listVoices();
      setVoices(data);
    } catch {
      console.warn('Backend offline ou aguardando inicialização.');
    }
  };

  useEffect(() => {
    fetchVoices();
  }, []);

  return (
    <div className="app-container">
      {/* Barra Lateral de Navegação */}
      <aside className="sidebar">
        <div className="logo-area">
          <div className="logo-icon">🔊</div>
          <h1 className="logo-text">TTS<span>Studio</span></h1>
        </div>

        <nav className="nav">
          <button
            className={`nav-item ${activeTab === 'tts' ? 'active' : ''}`}
            onClick={() => setActiveTab('tts')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            Sintetizador (TTS)
          </button>

          <button
            className={`nav-item ${activeTab === 'batch' ? 'active' : ''}`}
            onClick={() => setActiveTab('batch')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Lote CSV (Batch)
          </button>

          <button
            className={`nav-item ${activeTab === 'voices' ? 'active' : ''}`}
            onClick={() => setActiveTab('voices')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
            </svg>
            Gerenciar Vozes
          </button>

          <button
            className={`nav-item ${activeTab === 'archive' ? 'active' : ''}`}
            onClick={() => setActiveTab('archive')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            Arquivo de Áudios
          </button>
        </nav>
      </aside>

      {/* Conteúdo Principal */}
      <main className="main-content">
        {activeTab === 'tts' && (
          <TTSPanel voices={voices} onGoToVoices={() => setActiveTab('voices')} />
        )}
        {activeTab === 'batch' && (
          <BatchPanel voices={voices} />
        )}
        {activeTab === 'voices' && (
          <VoicePanel voices={voices} onRefresh={fetchVoices} />
        )}
        {activeTab === 'archive' && (
          <ArchivePanel />
        )}
      </main>
    </div>
  );
};
