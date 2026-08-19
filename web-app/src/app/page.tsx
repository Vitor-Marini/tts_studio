"use client";
import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

const FALLBACK_PRESETS = {
  ADA: {
    nome: "Voz ADA (Produto)",
    temperatura: 0.2,
    velocidade: 1.0,
    comprimento_penalidade: -3.5,
    repeticao_penalidade: 6.5,
    top_k: 56,
    top_p: 0.89,
    usar_seed_fixa: true,
    seed: 99,
    dividir_frases: true,
    formato: "mp3",
    bitrate: "192k"
  }
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<'tts' | 'clone' | 'manage'>('tts');
  const [presets, setPresets] = useState<Record<string, any>>(FALLBACK_PRESETS);
  const [voices, setVoices] = useState<string[]>(['ADA']);

  const fetchPresets = () => {
    fetch('http://localhost:8000/api/presets')
      .then(res => res.json())
      .then(data => { if (Object.keys(data).length > 0) setPresets(data); })
      .catch(() => console.log("Backend offline. Usando Fallback para presets."));
  };

  const fetchVoices = () => {
    fetch('http://localhost:8000/api/voices')
      .then(res => res.json())
      .then(data => { if (data.voices) setVoices(data.voices); }) // sempre sobrescreve, mesmo lista vazia
      .catch(() => console.log("Backend offline, sem vozes carregadas."));
  };

  useEffect(() => {
    fetchPresets();
    fetchVoices();
  }, []);

  return (
    <div className={styles.appContainer}>
      <aside className={styles.sidebar}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}></div>
          <h1 className={styles.logoText}>XTTS<span>Studio</span></h1>
        </div>
        <nav className={styles.nav}>
          <button className={`${styles.navItem} ${activeTab === 'tts' ? styles.active : ''}`} onClick={() => setActiveTab('tts')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg> Sintetizador (TTS)
          </button>
          <button className={`${styles.navItem} ${activeTab === 'clone' ? styles.active : ''}`} onClick={() => setActiveTab('clone')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/><path d="M16 22h-8"/></svg> Clonagem de Voz
          </button>
          <button className={`${styles.navItem} ${activeTab === 'manage' ? styles.active : ''}`} onClick={() => setActiveTab('manage')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg> Gerenciar
          </button>
        </nav>
      </aside>
      <main className={styles.mainContent}>
        {activeTab === 'tts' && <TTSPanel presets={presets} voices={voices} onSavePreset={fetchPresets} />}
        {activeTab === 'clone' && <ClonePanel onCloned={fetchVoices} />}
        {activeTab === 'manage' && <ManagePanel onChanged={() => { fetchVoices(); fetchPresets(); }} />}
      </main>
    </div>
  );
}

function CustomPlayer({ src }: { src: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState("0:00");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log(e));
      setIsPlaying(true);
    }
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const dur = audioRef.current.duration;
    if (dur > 0) {
      setProgress((current / dur) * 100);
    }
    setCurrentTime(formatTime(current));
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(formatTime(audioRef.current.duration));
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pos * audioRef.current.duration;
  };

  return (
    <div className={styles.customPlayer}>
      <audio 
        ref={audioRef} 
        src={src} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        style={{ display: 'none' }} 
      />
      
      <button className={styles.playBtn} onClick={togglePlay}>
        {isPlaying ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{marginLeft: '4px'}}><polygon points="5 3 19 12 5 21 5 3"/></svg>
        )}
      </button>

      <div className={styles.progressContainer}>
        <div className={styles.timeDisplay}>
          <span>{currentTime}</span>
          <span>{duration}</span>
        </div>
        <div className={styles.progressBar} onClick={handleProgressClick}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <a href={src} download="voz_gerada.wav" className={styles.downloadBtn}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
        Baixar
      </a>
    </div>
  );
}

function SavePresetModal({ onSave, onClose, currentParams }: { onSave: (name: string) => void, onClose: () => void, currentParams: Record<string, any> }) {
  const [name, setName] = useState("");
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={onClose}>
      <div style={{background:'#1a1a1a',border:'1px solid rgba(255,107,0,0.4)',borderRadius:'16px',padding:'2rem',width:'420px',maxWidth:'90vw'}} onClick={e=>e.stopPropagation()}>
        <h3 style={{fontSize:'1.3rem',marginBottom:'0.5rem',color:'#fff'}}>💾 Salvar Preset Atual</h3>
        <p style={{color:'rgba(255,255,255,0.5)',fontSize:'0.85rem',marginBottom:'1.5rem'}}>Os parâmetros dos sliders serão salvos em um arquivo JSON e aparecerão no menu de presets.</p>
        <div style={{background:'rgba(255,255,255,0.05)',borderRadius:'8px',padding:'1rem',marginBottom:'1.5rem',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem',fontSize:'0.8rem',color:'rgba(255,255,255,0.6)'}}>
          <span>Temperatura: <strong style={{color:'#ff6b00'}}>{currentParams.temperature}</strong></span>
          <span>Velocidade: <strong style={{color:'#ff6b00'}}>{currentParams.speed}</strong></span>
          <span>Rep. Penalidade: <strong style={{color:'#ff6b00'}}>{currentParams.repetitionPenalty}</strong></span>
          <span>Comp. Penalidade: <strong style={{color:'#ff6b00'}}>{currentParams.lengthPenalty}</strong></span>
          <span>Top K: <strong style={{color:'#ff6b00'}}>{currentParams.topK}</strong></span>
          <span>Top P: <strong style={{color:'#ff6b00'}}>{currentParams.topP}</strong></span>
          <span>Seed: <strong style={{color:'#ff6b00'}}>{currentParams.seed}</strong></span>
          <span>Formato: <strong style={{color:'#ff6b00'}}>{currentParams.format.toUpperCase()}</strong></span>
        </div>
        <label style={{display:'block',marginBottom:'0.5rem',fontSize:'0.8rem',color:'rgba(255,255,255,0.6)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Nome do Preset</label>
        <input
          autoFocus
          type="text"
          placeholder="Ex: ADA Rápida, Narrador Podcast..."
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())}
          style={{width:'100%',padding:'0.75rem 1rem',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:'8px',color:'#fff',fontSize:'1rem',outline:'none',boxSizing:'border-box',marginBottom:'1rem'}}
        />
        <div style={{display:'flex',gap:'0.75rem'}}>
          <button onClick={onClose} style={{flex:1,padding:'0.75rem',background:'transparent',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'8px',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:'0.9rem'}}>Cancelar</button>
          <button
            disabled={!name.trim()}
            onClick={() => onSave(name.trim())}
            style={{flex:2,padding:'0.75rem',background: name.trim() ? 'var(--accent-primary)' : 'rgba(255,107,0,0.3)',border:'none',borderRadius:'8px',color:'#fff',cursor: name.trim() ? 'pointer' : 'default',fontSize:'0.9rem',fontWeight:'600'}}
          >Salvar Preset</button>
        </div>
      </div>
    </div>
  );
}

function TTSPanel({ presets, voices, onSavePreset }: { presets: Record<string, any>, voices: string[], onSavePreset: () => void }) {
  const [text, setText] = useState("");
  const [activePreset, setActivePreset] = useState("ADA");
  const [selectedVoice, setSelectedVoice] = useState("ADA");
  
  // Parâmetros
  const [speed, setSpeed] = useState(1.0);
  const [temperature, setTemperature] = useState(0.2);
  const [lengthPenalty, setLengthPenalty] = useState(-3.5);
  const [repetitionPenalty, setRepetitionPenalty] = useState(6.5);
  const [topK, setTopK] = useState(56);
  const [topP, setTopP] = useState(0.89);
  const [useFixedSeed, setUseFixedSeed] = useState(true);
  const [seed, setSeed] = useState(99);
  const [splitSentences, setSplitSentences] = useState(true);
  const [format, setFormat] = useState("mp3");
  const [bitrate, setBitrate] = useState("192k");

  // Estado da geração
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const applyPreset = (presetKey: string) => {
    const p = presets[presetKey];
    if (p) {
      setSpeed(p.velocidade);
      setTemperature(p.temperatura);
      setLengthPenalty(p.comprimento_penalidade);
      setRepetitionPenalty(p.repeticao_penalidade);
      setTopK(p.top_k);
      setTopP(p.top_p);
      setUseFixedSeed(p.usar_seed_fixa);
      setSeed(p.seed);
      setSplitSentences(p.dividir_frases);
      setFormat(p.formato);
      setBitrate(p.bitrate);
    }
    setActivePreset(presetKey);
  };

  useEffect(() => {
    if (presets['ADA']) applyPreset('ADA');
    if (voices.includes('ADA')) setSelectedVoice('ADA');
    else if (voices.length > 0) setSelectedVoice(voices[0]);
  }, [presets, voices]);

  const handleSaveNewPreset = async (name: string) => {
    try {
      const payload = { name, temperature, speed, length_penalty: lengthPenalty, repetition_penalty: repetitionPenalty, top_k: topK, top_p: topP, use_fixed_seed: useFixedSeed, seed, split_sentences: splitSentences, format, bitrate };
      const response = await fetch("http://localhost:8000/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.status === 'success') {
        setSaveStatus("✅ Preset '" + name + "' salvo!");
        onSavePreset();
        setActivePreset(name);
        setTimeout(() => setSaveStatus(""), 3000);
      }
    } catch (err) {
      setSaveStatus("❌ Erro ao salvar o Preset.");
    } finally {
      setShowSaveModal(false);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return alert("Digite um texto!");
    setIsGenerating(true);
    setAudioUrl("");
    try {
        const payload = {
            text,
            language: "pt",
            voice: selectedVoice,
            temperature,
            speed,
            length_penalty: lengthPenalty,
            repetition_penalty: repetitionPenalty,
            top_k: topK,
            top_p: topP,
            use_fixed_seed: useFixedSeed,
            seed,
            split_sentences: splitSentences,
            format,
            bitrate
        };
        const response = await fetch("http://localhost:8000/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.audio_url) {
            setAudioUrl(data.audio_url);
        } else {
            alert("Falha na geração: " + JSON.stringify(data));
        }
    } catch (err) {
        console.error(err);
        alert("Erro de conexão. Certifique-se de que o backend (FastAPI) está rodando na porta 8000.");
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className={styles.panelWrapper}>
      <header className={styles.panelHeader}>
        <h2>Sintetizador de Texto</h2>
        <p>Geração via XTTS Engine. Todos os parâmetros mapeados de forma fiel.</p>
      </header>
      <div className={styles.layoutGrid}>
        <div className={`${styles.leftCol} glass-panel`}>
          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label>Texto para Síntese</label>
              <div className={styles.checkboxRow}>
                <input type="checkbox" checked={splitSentences} onChange={(e) => setSplitSentences(e.target.checked)} id="split" />
                <label htmlFor="split" style={{textTransform: 'none', fontSize: '0.8rem'}}>Dividir Frases</label>
              </div>
            </div>
            <textarea className="input-base" rows={12} value={text} onChange={(e) => setText(e.target.value)}></textarea>
          </div>
          
          <div className={styles.actionRow}>
            <select className="input-base" style={{width: '90px'}} value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="mp3">.MP3</option><option value="wav">.WAV</option>
            </select>
            <select className="input-base" style={{width: '90px'}} value={bitrate} onChange={(e) => setBitrate(e.target.value)}>
              <option value="128k">128k</option><option value="192k">192k</option>
            </select>
            <button className="btn-primary" style={{flex: 1}} onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? "Gerando..." : "Gerar Áudio XTTS"}
            </button>
          </div>

          <div className={styles.playerContainer} style={{ padding: audioUrl ? '0' : '1.5rem', border: audioUrl ? 'none' : '' }}>
             {audioUrl ? (
                <CustomPlayer src={audioUrl} />
             ) : (
                <span className={styles.playerPlaceholder}>{isGenerating ? "Processando no modelo..." : "Nenhum áudio gerado."}</span>
             )}
          </div>
        </div>

        <div className={`${styles.rightCol} glass-panel ${styles.scrollableCol}`}>
          
          {showSaveModal && (
            <SavePresetModal
              onClose={() => setShowSaveModal(false)}
              onSave={handleSaveNewPreset}
              currentParams={{ temperature, speed, repetitionPenalty, lengthPenalty, topK, topP, seed, format }}
            />
          )}

          <div className={styles.formGroup}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.4rem'}}>
              <label style={{margin:0}}>Preset de Configuração</label>
            </div>
            {saveStatus && <span style={{fontSize:'0.8rem',color:'#69f0ae'}}>{saveStatus}</span>}
            <select className="input-base" value={activePreset} onChange={(e) => applyPreset(e.target.value)}>
              {Object.keys(presets).map(k => (
                <option key={k} value={k}>{presets[k].nome || k}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Voz</label>
            {voices.length === 0 ? (
              <p style={{fontSize:'0.85rem',color:'rgba(255,255,255,0.4)',padding:'0.75rem',background:'rgba(255,255,255,0.03)',borderRadius:'8px',border:'1px dashed rgba(255,255,255,0.1)'}}>
                Nenhuma voz encontrada. Vá para <strong>Clonagem de Voz</strong> e adicione uma.
              </p>
            ) : (
              <select className="input-base" value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}>
                {voices.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
          </div>

          <div className={styles.divider}></div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3 className={styles.sectionTitle} style={{margin:0}}>Ajustes Finos (XTTS)</h3>
            <button
              onClick={() => setShowSaveModal(true)}
              style={{fontSize:'0.75rem',padding:'0.3rem 0.75rem',background:'rgba(255,107,0,0.15)',border:'1px solid rgba(255,107,0,0.4)',color:'#ff8c42',borderRadius:'6px',cursor:'pointer',transition:'all 0.2s'}}
              onMouseOver={e => e.currentTarget.style.background='rgba(255,107,0,0.25)'}
              onMouseOut={e => e.currentTarget.style.background='rgba(255,107,0,0.15)'}
            >💾 Salvar como Preset</button>
          </div>
          
          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label>Temperatura</label>
              <input type="number" className={styles.numberInput} value={temperature} step="0.1" onChange={(e) => setTemperature(parseFloat(e.target.value))} />
            </div>
            <input type="range" min="0.0" max="1.0" step="0.05" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label>Velocidade (Speed)</label>
              <input type="number" className={styles.numberInput} value={speed} step="0.1" onChange={(e) => setSpeed(parseFloat(e.target.value))} />
            </div>
            <input type="range" min="0.5" max="2.0" step="0.1" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label>Repetição Penalidade</label>
              <input type="number" className={styles.numberInput} value={repetitionPenalty} step="0.5" onChange={(e) => setRepetitionPenalty(parseFloat(e.target.value))} />
            </div>
            <input type="range" min="1.0" max="10.0" step="0.5" value={repetitionPenalty} onChange={(e) => setRepetitionPenalty(parseFloat(e.target.value))} />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label>Comprimento Penalidade</label>
              <input type="number" className={styles.numberInput} value={lengthPenalty} step="0.5" onChange={(e) => setLengthPenalty(parseFloat(e.target.value))} />
            </div>
            <input type="range" min="-5.0" max="5.0" step="0.5" value={lengthPenalty} onChange={(e) => setLengthPenalty(parseFloat(e.target.value))} />
          </div>

          <div className={styles.grid2Col}>
             <div className={styles.formGroup}>
                <label>Top K</label>
                <input type="number" className="input-base" value={topK} onChange={(e) => setTopK(parseInt(e.target.value))} />
             </div>
             <div className={styles.formGroup}>
                <label>Top P</label>
                <input type="number" className="input-base" step="0.01" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} />
             </div>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.checkboxRow} style={{marginBottom: '0.5rem', marginTop: '0.5rem'}}>
              <input type="checkbox" checked={useFixedSeed} onChange={(e) => setUseFixedSeed(e.target.checked)} id="fixedSeed" />
              <label htmlFor="fixedSeed" style={{textTransform: 'none', fontWeight: 'bold'}}>Usar Seed Fixa (Consistência)</label>
            </div>
            {useFixedSeed && <input type="number" className="input-base" value={seed} onChange={(e) => setSeed(parseInt(e.target.value))} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClonePanel({ onCloned }: { onCloned: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: "", type: "" });
  const [fileUrl, setFileUrl] = useState<string>("");

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFileUrl("");
    }
  }, [file]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    setStatusMsg({ text: "", type: "" });
    if (!file) return setStatusMsg({ text: "⚠️ Selecione um arquivo de áudio de referência.", type: "error" });
    if (!voiceName) return setStatusMsg({ text: "⚠️ Dê um nome para a sua nova voz.", type: "error" });

    setIsCloning(true);
    setStatusMsg({ text: "⏳ Processando embeddings vocais e salvando...", type: "info" });
    const formData = new FormData();
    formData.append("voice_name", voiceName);
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/api/clone", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        setStatusMsg({ text: "✅ Voz processada com sucesso! A lista do Sintetizador foi atualizada.", type: "success" });
        setFile(null);
        setVoiceName("");
        onCloned(); // Atualiza as vozes em background na main tab!
      } else {
        setStatusMsg({ text: "❌ Erro da API: " + data.message, type: "error" });
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ text: "❌ Falha ao comunicar com o Backend na porta 8000.", type: "error" });
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className={styles.panelWrapper}>
      <header className={styles.panelHeader}>
        <h2>Clonagem de Voz Zero-Shot</h2>
        <p>Extraia características vocais de qualquer pessoa usando apenas uma amostra de áudio.</p>
      </header>
      
      <div className={styles.layoutGrid}>
         <div className={`${styles.leftCol} glass-panel`}>
           <div 
             className={styles.uploadArea} 
             onDragOver={(e) => e.preventDefault()} 
             onDrop={handleDrop}
             onClick={() => document.getElementById('audio-upload')?.click()}
           >
             <input 
               type="file" 
               id="audio-upload" 
               accept="audio/wav,audio/mpeg" 
               style={{display: 'none'}} 
               onChange={(e) => {
                 if (e.target.files && e.target.files.length > 0) setFile(e.target.files[0]);
               }}
             />
             <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={file ? "var(--accent-primary)" : "var(--text-secondary)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
             {file ? (
               <p style={{color: 'var(--accent-primary)'}}>{file.name}</p>
             ) : (
               <>
                 <p>Arraste seu arquivo .wav ou .mp3 aqui</p>
                 <span>ou clique para selecionar arquivos locais</span>
               </>
             )}
           </div>

           {fileUrl && (
             <div style={{marginTop: '1rem'}}>
               <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase'}}>Preview da Voz:</p>
               <CustomPlayer src={fileUrl} />
             </div>
           )}

           <div className={styles.formGroup} style={{marginTop: '1.5rem'}}>
             <label>Nome da Nova Voz</label>
             <input type="text" className="input-base" placeholder="Ex: Narrador Podcast Oficial" value={voiceName} onChange={(e) => setVoiceName(e.target.value)} />
           </div>

           <button className="btn-primary" style={{width: '100%', marginTop: '1rem'}} onClick={handleUpload} disabled={isCloning}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
             {isCloning ? "Processando e Salvando..." : "Criar Nova Voz"}
           </button>

           {statusMsg.text && (
             <div style={{
               marginTop: '1rem', 
               padding: '1rem', 
               borderRadius: '8px', 
               fontSize: '0.9rem',
               background: statusMsg.type === 'error' ? 'rgba(255,50,50,0.1)' : statusMsg.type === 'success' ? 'rgba(50,255,100,0.1)' : 'rgba(255,255,255,0.05)',
               color: statusMsg.type === 'error' ? '#ff6b6b' : statusMsg.type === 'success' ? '#69f0ae' : '#fff',
               border: `1px solid ${statusMsg.type === 'error' ? 'rgba(255,50,50,0.3)' : statusMsg.type === 'success' ? 'rgba(50,255,100,0.3)' : 'rgba(255,255,255,0.1)'}`
             }}>
               {statusMsg.text}
             </div>
           )}
         </div>

         <div className={`${styles.rightCol} glass-panel`}>
           <h3 className={styles.sectionTitle}>Como funciona a Clonagem?</h3>
           <p className={styles.helperText}>
             O modelo XTTS extrai os embeddings (latents) diretamente do arquivo de referência usando a técnica <i>Zero-Shot</i> sem precisar de fine-tuning intenso.
           </p>
           <ul style={{color: 'var(--text-secondary)', fontSize: '0.95rem', paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem'}}>
             <li>Use amostras curtas: <strong>10 a 30 segundos</strong> de duração.</li>
             <li>Evite ruídos: O áudio deve estar <strong>limpo</strong>, sem música de fundo ou eco para melhor absorção da estabilidade.</li>
             <li>O arquivo será salvo na pasta <strong>voices/</strong> do seu servidor e ficará instantaneamente disponível no seletor de vozes da aba TTS.</li>
           </ul>
         </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MARCO 4 — Gerenciamento de Recursos
// ─────────────────────────────────────────

type ResourceType = 'voices' | 'presets';

interface ResourceCardProps {
  name: string;
  type: ResourceType;
  onChanged: () => void;
}

function ResourceCard({ name, type, onChanged }: ResourceCardProps) {
  const [mode, setMode] = useState<'idle' | 'rename' | 'confirm-delete'>('idle');
  const [newName, setNewName] = useState(name);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const icon = type === 'voices' ? '🎤' : '📋';

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === name) { setMode('idle'); return; }
    setIsLoading(true); setError('');
    try {
      const res = await fetch(`http://localhost:8000/api/${type}/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_name: newName.trim() })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Erro ao renomear'); setIsLoading(false); return; }
      onChanged();
    } catch { setError('Falha de conexão'); setIsLoading(false); }
  };

  const handleDelete = async () => {
    setIsLoading(true); setError('');
    try {
      const res = await fetch(`http://localhost:8000/api/${type}/${encodeURIComponent(name)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Erro ao deletar'); setIsLoading(false); return; }
      onChanged();
    } catch { setError('Falha de conexão'); setIsLoading(false); }
  };

  const cardBase: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: '10px',
    padding: '0.85rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={cardBase}>
      {mode === 'rename' ? (
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setMode('idle'); }}
            style={{flex:1,padding:'0.4rem 0.7rem',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,107,0,0.5)',borderRadius:'6px',color:'#fff',fontSize:'0.9rem',outline:'none'}}
          />
          <button onClick={handleRename} disabled={isLoading} style={{padding:'0.4rem 0.8rem',background:'var(--accent-primary)',border:'none',borderRadius:'6px',color:'#fff',cursor:'pointer',fontSize:'0.8rem',fontWeight:'600'}}>
            {isLoading ? '...' : 'OK'}
          </button>
          <button onClick={() => { setMode('idle'); setNewName(name); setError(''); }} style={{padding:'0.4rem 0.7rem',background:'rgba(255,255,255,0.08)',border:'none',borderRadius:'6px',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:'0.8rem'}}>
            ✕
          </button>
        </div>
      ) : mode === 'confirm-delete' ? (
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center',flexWrap:'wrap'}}>
          <span style={{flex:1,fontSize:'0.85rem',color:'#ff8c8c'}}>Deletar <strong>"{name}"</strong>?</span>
          <button onClick={handleDelete} disabled={isLoading} style={{padding:'0.4rem 0.8rem',background:'rgba(220,50,50,0.7)',border:'none',borderRadius:'6px',color:'#fff',cursor:'pointer',fontSize:'0.8rem',fontWeight:'600'}}>
            {isLoading ? '...' : '🗑️ Deletar'}
          </button>
          <button onClick={() => { setMode('idle'); setError(''); }} style={{padding:'0.4rem 0.7rem',background:'rgba(255,255,255,0.08)',border:'none',borderRadius:'6px',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:'0.8rem'}}>
            Cancelar
          </button>
        </div>
      ) : (
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
          <span style={{fontSize:'1.1rem'}}>{icon}</span>
          <span style={{flex:1,color:'#fff',fontSize:'0.9rem',fontWeight:'500',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
          <button
            onClick={() => { setMode('rename'); setNewName(name); }}
            title="Renomear"
            style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',fontSize:'1rem',padding:'0.2rem 0.4rem',borderRadius:'4px',transition:'color 0.2s'}}
            onMouseOver={e => e.currentTarget.style.color='#fff'}
            onMouseOut={e => e.currentTarget.style.color='rgba(255,255,255,0.4)'}
          >✏️</button>
          <button
            onClick={() => setMode('confirm-delete')}
            title="Deletar"
            style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,100,100,0.5)',fontSize:'1rem',padding:'0.2rem 0.4rem',borderRadius:'4px',transition:'color 0.2s'}}
            onMouseOver={e => e.currentTarget.style.color='#ff6b6b'}
            onMouseOut={e => e.currentTarget.style.color='rgba(255,100,100,0.5)'}
          >🗑️</button>
        </div>
      )}
      {error && <span style={{fontSize:'0.78rem',color:'#ff8c8c'}}>{error}</span>}
    </div>
  );
}

function ManagePanel({ onChanged }: { onChanged: () => void }) {
  const [voices, setVoices] = useState<string[]>([]);
  const [presets, setPresets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    Promise.all([
      fetch('http://localhost:8000/api/voices').then(r => r.json()),
      fetch('http://localhost:8000/api/presets').then(r => r.json()),
    ]).then(([v, p]) => {
      setVoices(v.voices || []);
      setPresets(Object.keys(p));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const handleChanged = () => { refresh(); onChanged(); };

  const sectionStyle: React.CSSProperties = {
    flex: 1,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    minWidth: 0,
  };

  return (
    <div className={styles.panelWrapper}>
      <header className={styles.panelHeader}>
        <h2>Gerenciar Recursos</h2>
        <p>Renomeie ou delete vozes e presets salvos. As alterações refletem imediatamente no Sintetizador.</p>
      </header>

      {loading ? (
        <p style={{color:'var(--text-secondary)'}}>Carregando...</p>
      ) : (
        <div style={{display:'flex',gap:'2rem',alignItems:'flex-start'}}>
          {/* Vozes */}
          <div style={sectionStyle}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
              <h3 style={{margin:0,fontSize:'1.1rem',color:'#fff'}}>🎤 Vozes</h3>
              <span style={{fontSize:'0.8rem',color:'rgba(255,255,255,0.35)'}}>{voices.length} arquivo{voices.length !== 1 ? 's' : ''}</span>
            </div>
            {voices.length === 0 ? (
              <p style={{color:'rgba(255,255,255,0.35)',fontSize:'0.85rem',fontStyle:'italic'}}>Nenhuma voz. Vá para Clonagem de Voz para adicionar.</p>
            ) : (
              voices.map(v => <ResourceCard key={v} name={v} type="voices" onChanged={handleChanged} />)
            )}
          </div>

          {/* Presets */}
          <div style={sectionStyle}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
              <h3 style={{margin:0,fontSize:'1.1rem',color:'#fff'}}>📋 Presets</h3>
              <span style={{fontSize:'0.8rem',color:'rgba(255,255,255,0.35)'}}>{presets.length} arquivo{presets.length !== 1 ? 's' : ''}</span>
            </div>
            {presets.length === 0 ? (
              <p style={{color:'rgba(255,255,255,0.35)',fontSize:'0.85rem',fontStyle:'italic'}}>Nenhum preset salvo ainda.</p>
            ) : (
              presets.map(p => <ResourceCard key={p} name={p} type="presets" onChanged={handleChanged} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
