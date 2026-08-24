"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import styles from './page.module.css';

function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
}

const FALLBACK_PRESETS: Record<string, PresetData> = {
  'Default XTTS': {
    nome: "Default XTTS",
    modelo: "xtts",
    variant: "base",
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
  },
  'Default F5-TTS': {
    nome: "Default F5-TTS",
    modelo: "f5-tts",
    variant: "base",
    velocidade: 1.0,
    nfe_step: 32,
    cfg_strength: 2.0,
    sway_sampling_coef: -1.0,
    formato: "wav",
    bitrate: "192k",
    temperatura: 0,
    comprimento_penalidade: 0,
    repeticao_penalidade: 0,
    top_k: 0,
    top_p: 0,
    usar_seed_fixa: false,
    seed: 0,
    dividir_frases: false,
  },
  'Default F5-TTS PT-BR': {
    nome: "Default F5-TTS PT-BR",
    modelo: "f5-tts",
    variant: "pt-br",
    velocidade: 1.0,
    nfe_step: 32,
    cfg_strength: 2.0,
    sway_sampling_coef: -1.0,
    formato: "wav",
    bitrate: "192k",
    temperatura: 0,
    comprimento_penalidade: 0,
    repeticao_penalidade: 0,
    top_k: 0,
    top_p: 0,
    usar_seed_fixa: false,
    seed: 0,
    dividir_frases: false,
  }
};

interface PresetData {
  nome: string;
  modelo: string;
  variant?: string;
  // XTTS
  temperatura?: number;
  velocidade: number;
  comprimento_penalidade?: number;
  repeticao_penalidade?: number;
  top_k?: number;
  top_p?: number;
  usar_seed_fixa?: boolean;
  seed?: number;
  dividir_frases?: boolean;
  formato: string;
  bitrate: string;
  // F5-TTS
  nfe_step?: number;
  cfg_strength?: number;
  sway_sampling_coef?: number;
}

type GeneratedAudio = { serverFile: string; name: string; url: string };

interface AudioArchiveItem {
  filename: string;
  name: string;
  size_bytes: number;
  created_at: string;
  url: string;
}

const AUDIO_MAX_COUNT = 50;

export default function Home() {
  const [activeTab, setActiveTab] = useState<'tts' | 'clone' | 'manage' | 'archive'>('tts');
  const [presets, setPresets] = useState<Record<string, PresetData>>(FALLBACK_PRESETS);
  const [audios, setAudios] = useState<GeneratedAudio[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = useState<string>("");
  const [draftName, setDraftName] = useState("");
  const [voices, setVoices] = useState<string[]>([]);

  const fetchPresets = () => {
    fetch(`${getApiUrl()}/api/presets`)
      .then(res => res.json())
      .then(data => { if (Object.keys(data).length > 0) setPresets(data); })
      .catch(() => console.log("Backend offline. Usando Fallback para presets."));
  };

  const fetchVoices = (modelo?: string) => {
    const params = modelo ? `?modelo=${modelo}` : '';
    fetch(`${getApiUrl()}/api/voices${params}`)
      .then(res => res.json())
      .then(data => { if (data.voices) setVoices(data.voices); })
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
          <h1 className={styles.logoText}>TTS<span>Studio</span></h1>
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
          <button className={`${styles.navItem} ${activeTab === 'archive' ? styles.active : ''}`} onClick={() => setActiveTab('archive')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg> Arquivo de Áudios
          </button>
        </nav>
      </aside>
      <main className={styles.mainContent}>
        {activeTab === 'tts' && <TTSPanel presets={presets} voices={voices} fetchVoices={fetchVoices} onSavePreset={fetchPresets} audios={audios} setAudios={setAudios} selected={selected} setSelected={setSelected} editingKey={editingKey} setEditingKey={setEditingKey} draftName={draftName} setDraftName={setDraftName} />}
        {activeTab === 'clone' && <ClonePanel onCloned={fetchVoices} />}
        {activeTab === 'manage' && <ManagePanel onChanged={() => { fetchVoices(); fetchPresets(); }} />}
        {activeTab === 'archive' && <AudioArchivePanel />}
      </main>
    </div>
  );
}

function CustomPlayer({ src, fileName, autoPlay = false }: { src: string; fileName?: string; autoPlay?: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState("0:00");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (autoPlay && audioRef.current) {
      audioRef.current.play().catch(e => console.log(e));
      setIsPlaying(true);
    }
  }, [src, autoPlay]);

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

  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extMatch = src.match(/\.(mp3|wav|ogg|flac)(\?|$)/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : (blob.type.includes('mpeg') ? 'mp3' : 'wav');
      a.download = fileName || ('voz_gerada.' + ext);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Falha ao baixar o áudio.");
    }
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

      <button onClick={handleDownload} className={styles.downloadBtn}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
        Baixar
      </button>
    </div>
  );
}

function SavePresetModal({ onSave, onClose, currentModel, currentParams }: { onSave: (name: string) => void, onClose: () => void, currentModel: string, currentParams: { temperature: number, speed: number, repetitionPenalty: number, lengthPenalty: number, topK: number, topP: number, seed: number, format: string, nfeStep: number, cfgStrength: number, swaySamplingCoef: number } }) {
  const [name, setName] = useState("");
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={onClose}>
      <div style={{background:'#1a1a1a',border:'1px solid rgba(255,107,0,0.4)',borderRadius:'16px',padding:'2rem',width:'420px',maxWidth:'90vw'}} onClick={e=>e.stopPropagation()}>
        <h3 style={{fontSize:'1.3rem',marginBottom:'0.5rem',color:'#fff'}}>Salvar Preset Atual</h3>
        <p style={{color:'rgba(255,255,255,0.5)',fontSize:'0.85rem',marginBottom:'1.5rem'}}>Parâmetros do modelo <strong style={{color:'#ff6b00'}}>{currentModel.toUpperCase()}</strong> serão salvos.</p>
        <div style={{background:'rgba(255,255,255,0.05)',borderRadius:'8px',padding:'1rem',marginBottom:'1.5rem',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem',fontSize:'0.8rem',color:'rgba(255,255,255,0.6)'}}>
          {currentModel === 'xtts' ? (
            <>
              <span>Temperatura: <strong style={{color:'#ff6b00'}}>{currentParams.temperature}</strong></span>
              <span>Velocidade: <strong style={{color:'#ff6b00'}}>{currentParams.speed}</strong></span>
              <span>Rep. Penalidade: <strong style={{color:'#ff6b00'}}>{currentParams.repetitionPenalty}</strong></span>
              <span>Comp. Penalidade: <strong style={{color:'#ff6b00'}}>{currentParams.lengthPenalty}</strong></span>
              <span>Top K: <strong style={{color:'#ff6b00'}}>{currentParams.topK}</strong></span>
              <span>Top P: <strong style={{color:'#ff6b00'}}>{currentParams.topP}</strong></span>
              <span>Seed: <strong style={{color:'#ff6b00'}}>{currentParams.seed}</strong></span>
              <span>Formato: <strong style={{color:'#ff6b00'}}>{currentParams.format.toUpperCase()}</strong></span>
            </>
          ) : (
            <>
              <span>Velocidade: <strong style={{color:'#ff6b00'}}>{currentParams.speed}</strong></span>
              <span>NFE Steps: <strong style={{color:'#ff6b00'}}>{currentParams.nfeStep}</strong></span>
              <span>CFG Strength: <strong style={{color:'#ff6b00'}}>{currentParams.cfgStrength}</strong></span>
              <span>Sway Sampling: <strong style={{color:'#ff6b00'}}>{currentParams.swaySamplingCoef}</strong></span>
              <span>Formato: <strong style={{color:'#ff6b00'}}>{currentParams.format.toUpperCase()}</strong></span>
            </>
          )}
        </div>
        <label style={{display:'block',marginBottom:'0.5rem',fontSize:'0.8rem',color:'rgba(255,255,255,0.6)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Nome do Preset</label>
        <input
          autoFocus
          type="text"
          placeholder="Ex: ADA Expressiva, Narrador..."
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

function TTSPanel({ presets, voices, fetchVoices, onSavePreset, audios, setAudios, selected, setSelected, editingKey, setEditingKey, draftName, setDraftName }: { presets: Record<string, PresetData>, voices: string[], fetchVoices: (modelo?: string) => void, onSavePreset: () => void, audios: GeneratedAudio[], setAudios: React.Dispatch<React.SetStateAction<GeneratedAudio[]>>, selected: Set<string>, setSelected: React.Dispatch<React.SetStateAction<Set<string>>>, editingKey: string, setEditingKey: React.Dispatch<React.SetStateAction<string>>, draftName: string, setDraftName: React.Dispatch<React.SetStateAction<string>> }) {
  const [text, setText] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("xtts");
  const [activePreset, setActivePreset] = useState("Default XTTS");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [f5Variant, setF5Variant] = useState<"base" | "pt-br">("base");
  
  // Voz efetiva: usa selectedVoice se válido, senão primeira da lista, senão vazio
  const effectiveVoice = voices.length > 0
    ? (selectedVoice && voices.includes(selectedVoice) ? selectedVoice : voices[0])
    : "";

  // Re-fetch voices when model changes
  useEffect(() => {
    fetchVoices(selectedModel);
    setSelectedVoice("");
  }, [selectedModel]);
  
  // XTTS params
  const defaultPreset = presets['Default XTTS'];
  const [speed, setSpeed] = useState(defaultPreset?.velocidade ?? 1.0);
  const [temperature, setTemperature] = useState(defaultPreset?.temperatura ?? 0.2);
  const [lengthPenalty, setLengthPenalty] = useState(defaultPreset?.comprimento_penalidade ?? -3.5);
  const [repetitionPenalty, setRepetitionPenalty] = useState(defaultPreset?.repeticao_penalidade ?? 6.5);
  const [topK, setTopK] = useState(defaultPreset?.top_k ?? 56);
  const [topP, setTopP] = useState(defaultPreset?.top_p ?? 0.89);
  const [useFixedSeed, setUseFixedSeed] = useState(defaultPreset?.usar_seed_fixa ?? true);
  const [seed, setSeed] = useState(defaultPreset?.seed ?? 99);
  const [splitSentences, setSplitSentences] = useState(defaultPreset?.dividir_frases ?? true);
  const [format, setFormat] = useState(defaultPreset?.formato ?? "mp3");
  const [bitrate, setBitrate] = useState(defaultPreset?.bitrate ?? "192k");
  // F5-TTS params
  const [nfeStep, setNfeStep] = useState(32);
  const [cfgStrength, setCfgStrength] = useState(2.0);
  const [swaySamplingCoef, setSwaySamplingCoef] = useState(-1.0);
  // Estado da geração
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [genElapsed, setGenElapsed] = useState(0);

  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => setGenElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const applyPreset = useCallback((presetKey: string) => {
    const p = presets[presetKey];
    if (p) {
      setSpeed(p.velocidade);
      setFormat(p.formato);
      setBitrate(p.bitrate);
      if (p.modelo === 'f5-tts') {
        setSelectedModel('f5-tts');
        setF5Variant((p.variant as "base" | "pt-br") ?? "base");
        setNfeStep(p.nfe_step ?? 32);
        setCfgStrength(p.cfg_strength ?? 2.0);
        setSwaySamplingCoef(p.sway_sampling_coef ?? -1.0);
      } else {
        setSelectedModel('xtts');
        setTemperature(p.temperatura ?? 0.2);
        setLengthPenalty(p.comprimento_penalidade ?? -3.5);
        setRepetitionPenalty(p.repeticao_penalidade ?? 6.5);
        setTopK(p.top_k ?? 56);
        setTopP(p.top_p ?? 0.89);
        setUseFixedSeed(p.usar_seed_fixa ?? true);
        setSeed(p.seed ?? 99);
        setSplitSentences(p.dividir_frases ?? true);
      }
    }
    setActivePreset(presetKey);
  }, [presets]);

  const handleSaveNewPreset = async (name: string) => {
    try {
      const base: Record<string, unknown> = { name, modelo: selectedModel, speed, format, bitrate, variant: selectedModel === 'f5-tts' ? f5Variant : 'base' };
      if (selectedModel === 'f5-tts') {
        base.nfe_step = nfeStep;
        base.cfg_strength = cfgStrength;
        base.sway_sampling_coef = swaySamplingCoef;
      } else {
        base.temperature = temperature;
        base.length_penalty = lengthPenalty;
        base.repetition_penalty = repetitionPenalty;
        base.top_k = topK;
        base.top_p = topP;
        base.use_fixed_seed = useFixedSeed;
        base.seed = seed;
        base.split_sentences = splitSentences;
      }
      const response = await fetch(`${getApiUrl()}/api/presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(base)
      });
      const data = await response.json();
      if (data.status === 'success') {
        setSaveStatus("✅ Preset '" + name + "' salvo!");
        onSavePreset();
        setActivePreset(name);
        setTimeout(() => setSaveStatus(""), 3000);
      }
    } catch {
      setSaveStatus("❌ Erro ao salvar o Preset.");
    } finally {
      setShowSaveModal(false);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return alert("Digite um texto!");
    if (!effectiveVoice) return alert("Selecione uma voz!");
    setGenElapsed(0);
    setIsGenerating(true);
    try {
        const payload: Record<string, unknown> = {
            text,
            modelo: selectedModel,
            voice: effectiveVoice,
            speed,
            format,
            bitrate,
        };
        if (selectedModel === 'f5-tts') {
          payload.nfe_step = nfeStep;
          payload.cfg_strength = cfgStrength;
          payload.sway_sampling_coef = swaySamplingCoef;
          payload.variant = f5Variant;
        } else {
          payload.language = "pt";
          payload.temperature = temperature;
          payload.length_penalty = lengthPenalty;
          payload.repetition_penalty = repetitionPenalty;
          payload.top_k = topK;
          payload.top_p = topP;
          payload.use_fixed_seed = useFixedSeed;
          payload.seed = seed;
          payload.split_sentences = splitSentences;
        }
        const response = await fetch(`${getApiUrl()}/api/tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.audio_url) {
            const serverFile = data.audio_url.split('/').pop() || 'audio';
            setAudios(prev => [...prev, { serverFile, name: serverFile, url: data.audio_url }]);
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

  const toggleSelect = (serverFile: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(serverFile)) next.delete(serverFile); else next.add(serverFile);
      return next;
    });
  };

  const startEdit = (audio: { serverFile: string; name: string }) => {
    setEditingKey(audio.serverFile);
    setDraftName(audio.name);
  };

  const commitRename = () => {
    if (!editingKey) return;
    const trimmed = draftName.trim();
    setAudios(prev => prev.map(a => {
      if (a.serverFile !== editingKey) return a;
      const ext = a.serverFile.includes('.') ? a.serverFile.substring(a.serverFile.lastIndexOf('.')) : '';
      const finalName = trimmed || a.serverFile;
      const finalWithExt = /\.\w+$/.test(finalName) ? finalName : finalName + ext;
      return { ...a, name: finalWithExt };
    }));
    setEditingKey("");
    setDraftName("");
  };

  const downloadUrl = async (url: string, name: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const blob = await response.blob();
    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlObj;
    const extMatch = url.match(/\.(mp3|wav|ogg|flac)(\?|$)/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : (blob.type.includes('mpeg') ? 'mp3' : 'wav');
    a.download = name || ('audio.' + ext);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(urlObj);
  };

  const handleDownloadSelected = async () => {
    const items = audios.filter(a => selected.has(a.serverFile));
    if (items.length === 0) return alert("Selecione ao menos um áudio.");
    for (let i = 0; i < items.length; i++) {
      try {
        await downloadUrl(items[i].url, items[i].name);
        await new Promise(r => setTimeout(r, 400));
      } catch (err) {
        console.error(err);
        alert("Falha ao baixar '" + items[i].name + "'.");
      }
    }
  };

  const handleDownloadAllZip = async () => {
    if (audios.length === 0) return;
    try {
      const response = await fetch(`${getApiUrl()}/api/audio/zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(audios.map(a => ({ filename: a.serverFile, name: a.name })))
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const blob = await response.blob();
      const urlObj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObj;
      a.download = 'tts_audios.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(urlObj);
    } catch (err) {
      console.error(err);
      alert("Falha ao baixar o ZIP.");
    }
  };

  const clearList = () => { setAudios([]); setSelected(new Set()); setEditingKey(""); setDraftName(""); };

  const genEstimate = Math.max(8, Math.round(text.trim().length * 0.8));
  const genRemaining = Math.max(0, genEstimate - genElapsed);

  return (
    <div className={styles.panelWrapper}>
      <header className={styles.panelHeader}>
        <h2>Sintetizador de Texto</h2>
        <p>Geração via XTTS ou F5-TTS.</p>
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
            <textarea className="input-base" rows={8} placeholder="Escreva aqui sua frase..." value={text} onChange={(e) => setText(e.target.value)}></textarea>
          </div>
          
          <div className={styles.actionRow}>
            <select className="input-base" style={{width: '90px'}} value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="mp3">.MP3</option><option value="wav">.WAV</option>
            </select>
            <select className="input-base" style={{width: '90px'}} value={bitrate} onChange={(e) => setBitrate(e.target.value)}>
              <option value="128k">128k</option><option value="192k">192k</option>
            </select>
            <button className="btn-primary" style={{flex: 1}} onClick={handleGenerate} disabled={isGenerating || !effectiveVoice}>
              {isGenerating ? (
                <><span className={styles.spinner} style={{width:16,height:16}}></span> Gerando...</>
              ) : "Gerar Áudio"}
            </button>
          </div>

          <div className={styles.playerContainer} style={{ padding: audios.length ? '0' : '1.5rem', border: audios.length ? 'none' : '', display: 'block' }}>
             {audios.length > 0 ? (
                <div className={styles.audioListWrap}>
                  <div className={styles.audioListHeader}>
                    <span className={styles.audioListTitle}>Áudios gerados ({audios.length})</span>
                    <div className={styles.audioListActions}>
                      <button onClick={handleDownloadSelected} className={styles.audioBtn}>Baixar selecionados</button>
                      <button onClick={handleDownloadAllZip} className={styles.audioBtn}>Baixar todos (.zip)</button>
                      <button onClick={clearList} className={styles.audioBtn}>Limpar lista</button>
                    </div>
                  </div>
                  <div className={styles.audioList}>
                    {audios.map(a => (
                      <div
                        key={a.serverFile}
                        className={`${styles.audioItem}${selected.has(a.serverFile) ? ' ' + styles.audioItemSelected : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(a.serverFile)}
                          onChange={() => toggleSelect(a.serverFile)}
                          className={styles.audioCheckbox}
                          title="Selecionar para download"
                        />
                        <div className={styles.audioItemBody}>
                          <div className={styles.audioNameRow}>
                            {editingKey === a.serverFile ? (
                              <>
                                <input
                                  autoFocus
                                  className={styles.audioNameInput}
                                  value={draftName}
                                  onChange={e => setDraftName(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditingKey(""); setDraftName(""); } }}
                                  onBlur={commitRename}
                                />
                                <button className={`${styles.audioNameAction} ${styles.audioNameActionVisible}`} onClick={commitRename} title="Confirmar">✔</button>
                                <button className={`${styles.audioNameAction} ${styles.audioNameActionVisible}`} onMouseDown={e => e.preventDefault()} onClick={() => { setEditingKey(""); setDraftName(""); }} title="Cancelar">✕</button>
                              </>
                            ) : (
                              <>
                                <span className={styles.audioName} title={a.name} onDoubleClick={() => startEdit(a)}>{a.name}</span>
                                <button className={styles.audioNameAction} onClick={() => startEdit(a)} title="Renomear">✏️</button>
                              </>
                            )}
                          </div>
                          <CustomPlayer src={a.url} fileName={a.name} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {isGenerating && (
                    <span className={styles.loadingRow} style={{ padding: '0.75rem' }}>
                      <span className={styles.spinner}></span>
                      <span>
                        Gerando novo áudio... <strong>{genElapsed}s</strong> decorridos
                        {genRemaining > 0 && <> · ~<strong>{genRemaining}s</strong> restantes (estimativa)</>}
                      </span>
                    </span>
                  )}
                </div>
             ) : isGenerating ? (
                <span className={styles.loadingRow}>
                  <span className={styles.spinner}></span>
                  <span>
                    Processando no modelo... <strong>{genElapsed}s</strong> decorridos
                    {genRemaining > 0 && <> · ~<strong>{genRemaining}s</strong> restantes (estimativa)</>}
                  </span>
                </span>
             ) : (
                <span className={styles.playerPlaceholder}>Nenhum áudio gerado.</span>
             )}
          </div>
        </div>

        <div className={`${styles.rightCol} glass-panel ${styles.scrollableCol}`}>
          
          {showSaveModal && (
            <SavePresetModal
              onClose={() => setShowSaveModal(false)}
              onSave={handleSaveNewPreset}
              currentModel={selectedModel}
              currentParams={{ temperature, speed, repetitionPenalty: repetitionPenalty, lengthPenalty, topK, topP, seed, format, nfeStep, cfgStrength, swaySamplingCoef }}
            />
          )}

          <div className={styles.formGroup}>
            <label>Modelo de IA</label>
            <select className="input-base" value={selectedModel} onChange={(e) => {
              const m = e.target.value;
              setSelectedModel(m);
              const defaultKey = m === 'f5-tts' ? 'Default F5-TTS' : 'Default XTTS';
              applyPreset(defaultKey);
            }}>
              <option value="xtts">XTTS v2</option>
              <option value="f5-tts">F5-TTS</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.4rem'}}>
              <label style={{margin:0}}>Preset de Configuração</label>
            </div>
            {saveStatus && <span style={{fontSize:'0.8rem',color:'#69f0ae'}}>{saveStatus}</span>}
            <select className="input-base" value={activePreset} onChange={(e) => applyPreset(e.target.value)}>
              {Object.keys(presets).filter(k => {
                const p = presets[k];
                if (p.modelo !== selectedModel) return false;
                if (selectedModel === 'f5-tts' && p.variant && p.variant !== f5Variant) return false;
                return true;
              }).map(k => (
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
              <select className="input-base" value={effectiveVoice} onChange={(e) => setSelectedVoice(e.target.value)}>
                {voices.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
          </div>

          <div className={styles.divider}></div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3 className={styles.sectionTitle} style={{margin:0}}>
              {selectedModel === 'f5-tts' ? 'Ajustes Finos (F5-TTS)' : 'Ajustes Finos (XTTS)'}
            </h3>
            <button
              onClick={() => setShowSaveModal(true)}
              style={{fontSize:'0.75rem',padding:'0.3rem 0.75rem',background:'rgba(255,107,0,0.15)',border:'1px solid rgba(255,107,0,0.4)',color:'#ff8c42',borderRadius:'6px',cursor:'pointer',transition:'all 0.2s'}}
              onMouseOver={e => e.currentTarget.style.background='rgba(255,107,0,0.25)'}
              onMouseOut={e => e.currentTarget.style.background='rgba(255,107,0,0.15)'}
            >Salvar como Preset</button>
          </div>

          {selectedModel === 'xtts' ? (
            <>
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
                    <div className={styles.labelRow}>
                      <label>Top K</label>
                      <input type="number" className={styles.numberInput} value={topK} step="1" onChange={(e) => setTopK(parseInt(e.target.value) || 0)} />
                    </div>
                    <input type="range" min="1" max="100" step="1" value={topK} onChange={(e) => setTopK(parseInt(e.target.value))} />
                 </div>
                 <div className={styles.formGroup}>
                    <div className={styles.labelRow}>
                      <label>Top P</label>
                      <input type="number" className={styles.numberInput} value={topP} step="0.01" onChange={(e) => setTopP(parseFloat(e.target.value))} />
                    </div>
                    <input type="range" min="0.0" max="1.0" step="0.01" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} />
                 </div>
              </div>

              <div className={styles.formGroup}>
                <div className={styles.checkboxRow} style={{marginBottom: '0.5rem', marginTop: '0.5rem'}}>
                  <input type="checkbox" checked={useFixedSeed} onChange={(e) => setUseFixedSeed(e.target.checked)} id="fixedSeed" />
                  <label htmlFor="fixedSeed" style={{textTransform: 'none', fontWeight: 'bold'}}>Usar Seed Fixa (Consistência)</label>
                </div>
                {useFixedSeed && <input type="number" className="input-base" value={seed} onChange={(e) => setSeed(parseInt(e.target.value))} />}
              </div>
            </>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label>Idioma / Language</label>
                <select className="input-base" value={f5Variant} onChange={(e) => setF5Variant(e.target.value as "base" | "pt-br")}>
                  <option value="base">Inglês (Base)</option>
                  <option value="pt-br">Português BR (Fine-tuned)</option>
                </select>
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
                  <label>NFE Steps</label>
                  <input type="number" className={styles.numberInput} value={nfeStep} step="1" onChange={(e) => setNfeStep(parseInt(e.target.value) || 16)} />
                </div>
                <input type="range" min="16" max="64" step="1" value={nfeStep} onChange={(e) => setNfeStep(parseInt(e.target.value))} />
              </div>

              <div className={styles.formGroup}>
                <div className={styles.labelRow}>
                  <label>CFG Strength</label>
                  <input type="number" className={styles.numberInput} value={cfgStrength} step="0.1" onChange={(e) => setCfgStrength(parseFloat(e.target.value))} />
                </div>
                <input type="range" min="0.0" max="5.0" step="0.1" value={cfgStrength} onChange={(e) => setCfgStrength(parseFloat(e.target.value))} />
              </div>

              <div className={styles.formGroup}>
                <div className={styles.labelRow}>
                  <label>Sway Sampling</label>
                  <input type="number" className={styles.numberInput} value={swaySamplingCoef} step="0.1" onChange={(e) => setSwaySamplingCoef(parseFloat(e.target.value))} />
                </div>
                <input type="range" min="-2.0" max="2.0" step="0.1" value={swaySamplingCoef} onChange={(e) => setSwaySamplingCoef(parseFloat(e.target.value))} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ClonePanel({ onCloned }: { onCloned: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [selectedModel, setSelectedModel] = useState("xtts");
  const [refText, setRefText] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: "", type: "" });

  const fileUrl = useMemo(() => {
    if (file) {
      return URL.createObjectURL(file);
    }
    return "";
  }, [file]);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    setStatusMsg({ text: "", type: "" });
    if (!file) return setStatusMsg({ text: "Selecione um arquivo de áudio de referência.", type: "error" });
    if (!voiceName) return setStatusMsg({ text: "Dê um nome para a sua nova voz.", type: "error" });
    if (selectedModel === 'f5-tts' && !refText.trim()) return setStatusMsg({ text: "Para F5-TTS, insira o texto de referência (transcrição do áudio).", type: "error" });

    setIsCloning(true);
    setStatusMsg({ text: "Processando...", type: "info" });
    const formData = new FormData();
    formData.append("voice_name", voiceName);
    formData.append("modelo", selectedModel);
    formData.append("ref_text", refText);
    formData.append("file", file);

    try {
      const res = await fetch(`${getApiUrl()}/api/clone`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        const modelLabel = selectedModel === 'f5-tts' ? 'F5-TTS (áudio + transcrição)' : 'XTTS (embeddings .pth)';
        setStatusMsg({ text: `Voz clonada com ${modelLabel}! A lista do Sintetizador foi atualizada.`, type: "success" });
        setFile(null);
        setVoiceName("");
        setRefText("");
        onCloned();
      } else {
        setStatusMsg({ text: "Erro da API: " + data.message, type: "error" });
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ text: "Falha ao comunicar com o Backend na porta 8000.", type: "error" });
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className={styles.panelWrapper}>
      <header className={styles.panelHeader}>
        <h2>Clonagem de Voz</h2>
        <p>Crie vozes a partir de amostras de áudio usando XTTS ou F5-TTS.</p>
      </header>
      
      <div className={styles.layoutGrid}>
         <div className={`${styles.leftCol} glass-panel`}>
           <div className={styles.formGroup}>
             <label>Modelo</label>
             <select className="input-base" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
               <option value="xtts">XTTS v2 (extrai embeddings .pth)</option>
               <option value="f5-tts">F5-TTS (salva áudio + transcrição)</option>
             </select>
           </div>

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
               <CustomPlayer src={fileUrl} autoPlay />
             </div>
           )}

           <div className={styles.formGroup} style={{marginTop: '1.5rem'}}>
             <label>Nome da Nova Voz</label>
             <input type="text" className="input-base" placeholder="Ex: Narrador Podcast Oficial" value={voiceName} onChange={(e) => setVoiceName(e.target.value)} />
           </div>

           {selectedModel === 'f5-tts' && (
             <div className={styles.formGroup} style={{marginTop: '0.75rem'}}>
               <label>Texto de Referência (obrigatório para F5-TTS)</label>
               <textarea className="input-base" rows={3} placeholder="Transcreva o que está sendo dito no áudio de referência..." value={refText} onChange={(e) => setRefText(e.target.value)} />
               <p style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.35)',marginTop:'0.25rem'}}>A transcrição exata do áudio melhora a qualidade da clonagem.</p>
             </div>
           )}

           <button className="btn-primary" style={{width: '100%', marginTop: '1rem'}} onClick={handleUpload} disabled={isCloning}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
             {isCloning ? "Processando..." : "Criar Nova Voz"}
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
           {selectedModel === 'xtts' ? (
             <p className={styles.helperText}>
               O modelo XTTS extrai os embeddings (latents) da voz diretamente do áudio de referência usando a técnica <i>Zero-Shot</i>, sem fine-tuning. Esses embeddings são salvos em um arquivo <strong>.pth</strong> — o áudio original não é armazenado.
             </p>
           ) : (
             <p className={styles.helperText}>
               O F5-TTS funciona com áudio de referência + transcrição. O áudio é salvo em <strong>.wav</strong> 24kHz junto com a transcrição em JSON. Na geração, o modelo usa esses dois arquivos para clonar a voz.
             </p>
           )}
           <ul style={{color: 'var(--text-secondary)', fontSize: '0.95rem', paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem'}}>
             <li>Use amostras curtas: <strong>5 a 30 segundos</strong> de duração.</li>
             <li>Evite ruídos: O áudio deve estar <strong>limpo</strong>, sem música de fundo ou eco.</li>
             {selectedModel === 'xtts' ? (
               <li>Somente os embeddings são salvos como .pth — o áudio de amostra é descartado (privacidade).</li>
             ) : (
               <li>O áudio de referência (WAV 24kHz) e a transcrição (JSON) são salvos no servidor.</li>
             )}
             <li>A voz fica instantaneamente disponível no seletor de vozes da aba <strong>TTS</strong>.</li>
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
  presetData?: PresetData;
  onChanged: () => void;
}

const PARAM_FIELDS: { key: keyof PresetData; label: string; min: number; max: number; step: number; int: boolean }[] = [
  { key: 'temperatura', label: 'Temperatura', min: 0, max: 1, step: 0.05, int: false },
  { key: 'velocidade', label: 'Velocidade', min: 0.5, max: 2, step: 0.1, int: false },
  { key: 'repeticao_penalidade', label: 'Rep. Penalidade', min: 1, max: 10, step: 0.5, int: false },
  { key: 'comprimento_penalidade', label: 'Comp. Penalidade', min: -5, max: 5, step: 0.5, int: false },
  { key: 'top_k', label: 'Top K', min: 1, max: 100, step: 1, int: true },
  { key: 'top_p', label: 'Top P', min: 0, max: 1, step: 0.01, int: false },
];

const fieldInputStyle: React.CSSProperties = {
  width: '64px', padding: '0.2rem 0.4rem', background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--accent-primary)',
  fontWeight: 'bold', textAlign: 'center', fontSize: '0.8rem', outline: 'none',
};

function ResourceCard({ name, type, presetData, onChanged }: ResourceCardProps) {
  const [mode, setMode] = useState<'idle' | 'rename' | 'confirm-delete' | 'edit'>('idle');
  const [newName, setNewName] = useState(name);
  const [editParams, setEditParams] = useState<Partial<PresetData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const icon = type === 'voices' ? '🎤' : '📋';

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === name) { setMode('idle'); return; }
    setIsLoading(true); setError('');
    try {
      const res = await fetch(`${getApiUrl()}/api/${type}/${encodeURIComponent(name)}`, {
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
      const res = await fetch(`${getApiUrl()}/api/${type}/${encodeURIComponent(name)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Erro ao deletar'); setIsLoading(false); return; }
      onChanged();
    } catch { setError('Falha de conexão'); setIsLoading(false); }
  };

  const openEdit = () => {
    setEditParams({ ...(presetData || {}) });
    setMode('edit');
    setError('');
  };

  const setParam = (key: keyof PresetData, value: string | number | boolean) => setEditParams(p => ({ ...p, [key]: value }));

  const handleSaveParams = async () => {
    setIsLoading(true); setError('');
    try {
      const res = await fetch(`${getApiUrl()}/api/presets/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editParams)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Erro ao salvar preset'); setIsLoading(false); return; }
      setMode('idle');
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
          <span style={{flex:1,fontSize:'0.85rem',color:'#ff8c8c'}}>Deletar <strong>&quot;{name}&quot;</strong>?</span>
          <button onClick={handleDelete} disabled={isLoading} style={{padding:'0.4rem 0.8rem',background:'rgba(220,50,50,0.7)',border:'none',borderRadius:'6px',color:'#fff',cursor:'pointer',fontSize:'0.8rem',fontWeight:'600'}}>
            {isLoading ? '...' : '🗑️ Deletar'}
          </button>
          <button onClick={() => { setMode('idle'); setError(''); }} style={{padding:'0.4rem 0.7rem',background:'rgba(255,255,255,0.08)',border:'none',borderRadius:'6px',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:'0.8rem'}}>
            Cancelar
          </button>
        </div>
      ) : mode === 'edit' && type === 'presets' ? (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
            <span style={{color:'#ff8c42',fontSize:'0.85rem',fontWeight:'600'}}>Editando &quot;{name}&quot;</span>
            <button onClick={() => setMode('idle')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:'0.9rem'}}>✕</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem 0.75rem'}}>
            {PARAM_FIELDS.map(f => (
              <div key={f.key} style={{display:'flex',flexDirection:'column',gap:'0.2rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <label style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.6)',textTransform:'uppercase'}}>{f.label}</label>
                  <input type="number" step={f.step} value={Number(editParams[f.key] ?? 0)}
                    onChange={e => setParam(f.key as keyof PresetData, f.int ? (parseInt(e.target.value) || 0) : (parseFloat(e.target.value) || 0))}
                    style={fieldInputStyle}
                  />
                </div>
                <input type="range" min={f.min} max={f.max} step={f.step} value={Number(editParams[f.key] ?? 0)}
                  onChange={e => setParam(f.key as keyof PresetData, f.int ? parseInt(e.target.value) : parseFloat(e.target.value))}
                />
              </div>
            ))}
            <div style={{display:'flex',flexDirection:'column',gap:'0.2rem'}}>
              <label style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.6)',textTransform:'uppercase'}}>Seed</label>
              <input type="number" value={editParams.seed ?? 0} onChange={e => setParam('seed', parseInt(e.target.value) || 0)} style={fieldInputStyle} />
            </div>
            <div style={{display:'flex',alignItems:'flex-end',gap:'0.4rem'}}>
              <label style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.6)',textTransform:'uppercase',flex:1}}>Formato</label>
              <select value={editParams.formato || 'mp3'} onChange={e => setParam('formato', e.target.value)} style={fieldInputStyle}>
                <option value="mp3">.MP3</option><option value="wav">.WAV</option>
              </select>
              <select value={editParams.bitrate || '192k'} onChange={e => setParam('bitrate', e.target.value)} style={fieldInputStyle}>
                <option value="128k">128k</option><option value="192k">192k</option>
              </select>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:'0.4rem',fontSize:'0.8rem',color:'#fff',cursor:'pointer'}}>
              <input type="checkbox" checked={!!editParams.usar_seed_fixa} onChange={e => setParam('usar_seed_fixa', e.target.checked)} /> Usar seed fixa
            </label>
            <label style={{display:'flex',alignItems:'center',gap:'0.4rem',fontSize:'0.8rem',color:'#fff',cursor:'pointer'}}>
              <input type="checkbox" checked={!!editParams.dividir_frases} onChange={e => setParam('dividir_frases', e.target.checked)} /> Dividir frases
            </label>
          </div>
          <div style={{display:'flex',gap:'0.5rem',marginTop:'0.75rem'}}>
            <button onClick={handleSaveParams} disabled={isLoading} style={{flex:1,padding:'0.5rem',background:'var(--accent-primary)',border:'none',borderRadius:'6px',color:'#fff',cursor:'pointer',fontSize:'0.85rem',fontWeight:'600'}}>
              {isLoading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <button onClick={() => setMode('idle')} style={{padding:'0.5rem 1rem',background:'rgba(255,255,255,0.08)',border:'none',borderRadius:'6px',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:'0.85rem'}}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
          <span style={{fontSize:'1.1rem'}}>{icon}</span>
          <span style={{flex:1,color:'#fff',fontSize:'0.9rem',fontWeight:'500',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
          {type === 'presets' && (
            <button
              onClick={openEdit}
              title="Editar parâmetros"
              style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',fontSize:'1rem',padding:'0.2rem 0.4rem',borderRadius:'4px',transition:'color 0.2s'}}
              onMouseOver={e => e.currentTarget.style.color='#ff8c42'}
              onMouseOut={e => e.currentTarget.style.color='rgba(255,255,255,0.4)'}
            >⚙️</button>
          )}
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

function AudioArchivePanel() {
  const [audios, setAudios] = useState<AudioArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setLoading(true);
    fetch(`${getApiUrl()}/api/audios`)
      .then(r => r.json())
      .then(data => { setAudios(data.audios || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const fetchAudios = useCallback(() => {
    setLoading(true);
    fetch(`${getApiUrl()}/api/audios`)
      .then(r => r.json())
      .then(data => { setAudios(data.audios || []); setLoading(false); })
      .catch(() => setLoading(false));
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
    } catch { return iso; }
  };

  const filtered = audios.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  const totalSize = audios.reduce((acc, a) => acc + a.size_bytes, 0);

  const toggleSelect = (filename: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename); else next.add(filename);
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

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Deletar ${selected.size} áudio(s) selecionado(s)?`)) return;
    for (const filename of selected) {
      await fetch(`${getApiUrl()}/api/audio/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    }
    setSelected(new Set());
    fetchAudios();
  };

  const deleteAll = async () => {
    if (audios.length === 0) return;
    if (!confirm(`Deletar TODOS os ${audios.length} áudios? Esta ação não pode ser desfeita.`)) return;
    await fetch(`${getApiUrl()}/api/audios`, { method: 'DELETE' });
    setSelected(new Set());
    fetchAudios();
  };

  return (
    <div className={styles.panelWrapper}>
      <header className={styles.panelHeader}>
        <h2>Arquivo de Áudios</h2>
        <p>{audios.length} áudio{audios.length !== 1 ? 's' : ''} · {formatSize(totalSize)} ocupados{AUDIO_MAX_COUNT > 0 ? ` · Limite: ${AUDIO_MAX_COUNT}` : ''}</p>
      </header>

      <div className={`${styles.leftCol} glass-panel`} style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input-base"
            placeholder="Buscar áudio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <button onClick={selectAll} className={styles.audioBtn} style={{ padding: '0.5rem 1rem' }}>
            {selected.size === filtered.length ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
          {selected.size > 0 && (
            <button onClick={deleteSelected} className={styles.audioBtn} style={{ padding: '0.5rem 1rem', background: 'rgba(255,50,50,0.15)', borderColor: 'rgba(255,50,50,0.4)', color: '#ff8c8c' }}>
              Excluir selecionados ({selected.size})
            </button>
          )}
          <button onClick={deleteAll} className={styles.audioBtn} style={{ padding: '0.5rem 1rem', background: 'rgba(255,50,50,0.1)', borderColor: 'rgba(255,50,50,0.3)', color: '#ff6b6b' }}>
            Limpar todos
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '2rem', justifyContent: 'center' }}>
            <span className={styles.spinner}></span>
            <span style={{ color: 'var(--text-secondary)' }}>Carregando áudios...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{audios.length === 0 ? 'Nenhum áudio no host.' : 'Nenhum resultado para a busca.'}</p>
            <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>Áudios gerados na aba Sintetizador aparecerão aqui.</p>
          </div>
        ) : (
          <div className={styles.audioList} style={{ maxHeight: 'calc(100vh - 300px)' }}>
            {filtered.map(a => (
              <div
                key={a.filename}
                className={`${styles.audioItem}${selected.has(a.filename) ? ' ' + styles.audioItemSelected : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(a.filename)}
                  onChange={() => toggleSelect(a.filename)}
                  className={styles.audioCheckbox}
                  title="Selecionar"
                />
                <div className={styles.audioItemBody}>
                  <div className={styles.audioNameRow}>
                    <span className={styles.audioName} title={a.name}>{a.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatSize(a.size_bytes)} · {formatDate(a.created_at)}
                    </span>
                  </div>
                  <CustomPlayer src={`${getApiUrl()}${a.url}`} fileName={a.name} />
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Deletar "${a.name}"?`)) return;
                    await fetch(`${getApiUrl()}/api/audio/${encodeURIComponent(a.filename)}`, { method: 'DELETE' });
                    fetchAudios();
                  }}
                  title="Deletar"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,100,100,0.5)', fontSize: '1rem', padding: '0.3rem', borderRadius: '4px', transition: 'color 0.2s', flexShrink: 0 }}
                  onMouseOver={e => e.currentTarget.style.color = '#ff6b6b'}
                  onMouseOut={e => e.currentTarget.style.color = 'rgba(255,100,100,0.5)'}
                >&#128465;</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ManagePanel({ onChanged }: { onChanged: () => void }) {
  const [voices, setVoices] = useState<string[]>([]);
  const [presets, setPresets] = useState<Record<string, PresetData>>({});
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setLoading(true);
    Promise.all([
      fetch(`${getApiUrl()}/api/voices`).then(r => r.json()),
      fetch(`${getApiUrl()}/api/presets`).then(r => r.json()),
    ]).then(([v, p]) => {
      setVoices(v.voices || []);
      setPresets(p || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${getApiUrl()}/api/voices`).then(r => r.json()),
      fetch(`${getApiUrl()}/api/presets`).then(r => r.json()),
    ]).then(([v, p]) => {
      setVoices(v.voices || []);
      setPresets(p || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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
              <span style={{fontSize:'0.8rem',color:'rgba(255,255,255,0.35)'}}>{Object.keys(presets).length} arquivo{Object.keys(presets).length !== 1 ? 's' : ''}</span>
            </div>
            {Object.keys(presets).length === 0 ? (
              <p style={{color:'rgba(255,255,255,0.35)',fontSize:'0.85rem',fontStyle:'italic'}}>Nenhum preset salvo ainda.</p>
            ) : (
              Object.entries(presets).map(([pName, pData]) => <ResourceCard key={pName} name={pName} type="presets" presetData={pData} onChanged={handleChanged} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
