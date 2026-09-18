import React, { useState, useEffect, useRef } from 'react';
import { Voice, BatchJob, CSVInspectResult } from '../types';
import { api } from '../services/api';
import { AudioPlayer } from './AudioPlayer';
import { IconAlertTriangle, IconEdit, IconRefresh, IconInfo } from './Icons';

interface BatchPanelProps {
  voices: Voice[];
}

export const BatchPanel: React.FC<BatchPanelProps> = ({ voices }) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [inspectData, setInspectData] = useState<CSVInspectResult | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  // Mapeamento e Parâmetros
  const [filenameCol, setFilenameCol] = useState('');
  const [textCol, setTextCol] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [format, setFormat] = useState('mp3');
  const [speed, setSpeed] = useState(1.0);
  const [skipExisting, setSkipExisting] = useState(true);

  // Execução
  const [activeJob, setActiveJob] = useState<BatchJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const pollingRef = useRef<any>(null);

  useEffect(() => {
    if (voices.length > 0 && !selectedVoice) {
      setSelectedVoice(voices[0].name);
      setSpeed(voices[0].default_speed || 1.0);
    }
  }, [voices, selectedVoice]);

  const handleVoiceChange = (vName: string) => {
    setSelectedVoice(vName);
    const v = voices.find(v => v.name === vName);
    if (v) setSpeed(v.default_speed || 1.0);
  };

  const handleFileSelect = async (file: File) => {
    setCsvFile(file);
    setErrorMsg('');
    setIsInspecting(true);
    try {
      const data = await api.inspectCSV(file);
      setInspectData(data);

      if (data.is_txt || data.columns.length === 1) {
        setTextCol(data.columns[0]);
        setFilenameCol('__auto__');
      } else {
        // Auto-detecção inteligente de colunas comuns
        const lowerCols = data.columns.map(c => c.toLowerCase());
        const fIdx = lowerCols.findIndex(c => c.includes('file') || c.includes('nome') || c.includes('audio') || c.includes('name'));
        const tIdx = lowerCols.findIndex(c => c.includes('text') || c.includes('texto') || c.includes('portuguese') || c.includes('frase') || c.includes('sentence') || c.includes('prompt'));

        if (fIdx !== -1) setFilenameCol(data.columns[fIdx]);
        else setFilenameCol('__auto__');

        if (tIdx !== -1) setTextCol(data.columns[tIdx]);
        else if (data.columns.length > 1) setTextCol(data.columns[1]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao ler o arquivo.');
      setCsvFile(null);
      setInspectData(null);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleStartBatch = async () => {
    if (!inspectData || !textCol || !selectedVoice) {
      setErrorMsg('Selecione a coluna de texto e uma voz para iniciar.');
      return;
    }

    setErrorMsg('');
    setIsStarting(true);
    try {
      const job = await api.startBatch({
        token: inspectData.token,
        voice: selectedVoice,
        filename_column: filenameCol || '__auto__',
        text_column: textCol,
        format,
        speed,
        skip_existing: skipExisting,
      });
      setActiveJob(job);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao iniciar o lote.');
    } finally {
      setIsStarting(false);
    }
  };

  // Polling de progresso quando o job está em execução
  useEffect(() => {
    if (!activeJob || (activeJob.status !== 'running' && activeJob.status !== 'queued')) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const updated = await api.getBatchStatus(activeJob.id);
        setActiveJob(updated);
      } catch {}
    }, 1500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeJob?.id, activeJob?.status]);

  const handleCancel = async () => {
    if (!activeJob) return;
    try {
      await api.cancelBatch(activeJob.id);
    } catch (err: any) {
      alert(err.message || 'Erro ao cancelar.');
    }
  };

  const handleDownloadZip = () => {
    if (!activeJob) return;
    window.location.href = `/api/batch/${activeJob.id}/download`;
  };

  const handleReset = () => {
    setActiveJob(null);
    setCsvFile(null);
    setInspectData(null);
  };

  const progressPercent = activeJob && activeJob.total_items > 0
    ? Math.round((activeJob.completed_items / activeJob.total_items) * 100)
    : 0;

  const [editingTexts, setEditingTexts] = useState<Record<number, string>>({});
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [cacheBusters, setCacheBusters] = useState<Record<number, number>>({});

  const handleRegenerateItem = async (index: number) => {
    if (!activeJob) return;
    setRegeneratingIndex(index);
    try {
      const textToUse = editingTexts[index] !== undefined
        ? editingTexts[index]
        : activeJob.items.find(i => i.index === index)?.text;
      const updatedItem = await api.regenerateBatchItem(activeJob.id, index, textToUse);
      setActiveJob(prev => {
        if (!prev) return null;
        return {
          ...prev,
          items: prev.items.map(it => it.index === index ? updatedItem : it),
        };
      });
      setCacheBusters(prev => ({ ...prev, [index]: Date.now() }));
    } catch (err: any) {
      alert(err.message || 'Erro ao regerar áudio.');
    } finally {
      setRegeneratingIndex(null);
    }
  };

  return (
    <div className="panel-wrapper">
      <header className="panel-header">
        <h2>Processamento em Lote (CSV)</h2>
        <p>Sintetize centenas de frases a partir de uma planilha com nomes customizados e controle total.</p>
      </header>

      {/* Se não há job em andamento/exibição: Tela de Upload e Mapeamento */}
      {!activeJob && (
        <div className="layout-grid">
          {/* Coluna 1: Upload e Prévia do Arquivo */}
          <div className="left-col">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Arquivo de Entrada
                  </h3>
                  <p className="card-subtitle">Selecione uma planilha CSV ou lista TXT com as frases</p>
                </div>
                {inspectData && (
                  <button className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={handleReset}>
                    Trocar Arquivo
                  </button>
                )}
              </div>

              <div className="card-body">
                {!inspectData ? (
                  <div
                    className="upload-dropzone"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileSelect(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => document.getElementById('csv-upload-input')?.click()}
                  >
                    <input
                      id="csv-upload-input"
                      type="file"
                      accept=".csv,.tsv,.txt"
                      style={{ display: 'none' }}
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileSelect(e.target.files[0]);
                        }
                      }}
                    />
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    {isInspecting ? (
                      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Analisando colunas do arquivo...</p>
                    ) : (
                      <>
                        <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                          Arraste seu arquivo CSV ou TXT aqui
                        </p>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          ou clique para selecionar (.csv, .tsv ou .txt com uma frase por linha)
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ padding: '0.85rem 1rem', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{csvFile?.name}</h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {inspectData.total_rows} frases detectadas · {inspectData.is_txt ? 'Formato: Lista TXT' : `Separador: '${inspectData.delimiter}'`} · Encoding: <strong>{inspectData.encoding}</strong>
                      </span>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em' }}>
                        Prévia dos Dados (Primeiras Linhas):
                      </label>
                      <div className="data-table-container" style={{ marginTop: '0.5rem', maxHeight: '280px' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              {filenameCol === '__auto__' && <th style={{ width: '130px' }}>Nome Gerado</th>}
                              {inspectData.columns.map(c => (
                                <th key={c}>{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {inspectData.preview.map((row, i) => (
                              <tr key={i}>
                                {filenameCol === '__auto__' && (
                                  <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                    audio_{String(i + 1).padStart(3, '0')}.{format}
                                  </td>
                                )}
                                {inspectData.columns.map(c => (
                                  <td key={c} className="truncate" style={{ maxWidth: '240px' }}>
                                    {row[c]}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coluna 2: Mapeamento e Parâmetros */}
          <div className="right-col">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="4" y1="21" x2="4" y2="14" />
                      <line x1="4" y1="10" x2="4" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12" y2="3" />
                      <line x1="20" y1="21" x2="20" y2="16" />
                      <line x1="20" y1="12" x2="20" y2="3" />
                      <line x1="1" y1="14" x2="7" y2="14" />
                      <line x1="9" y1="8" x2="15" y2="8" />
                      <line x1="17" y1="16" x2="23" y2="16" />
                    </svg>
                    Mapeamento e Parâmetros
                  </h3>
                  <p className="card-subtitle">Associe colunas e configure a locução em lote</p>
                </div>
              </div>

              <div className="card-body">
                {/* Instruções diretas e simples de formatação */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-md)', padding: '0.85rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    <IconInfo size={14} />
                    <span>Instruções de Formatação dos Arquivos:</span>
                  </div>
                  <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem', lineHeight: '1.4' }}>
                    <li>
                      <strong style={{ color: 'var(--text-primary)' }}>Arquivos TXT:</strong> Texto simples com <u>uma frase por linha</u>. Nomes automáticos sequenciais gerados pelo sistema (<code>audio_001.mp3</code>...).
                    </li>
                    <li>
                      <strong style={{ color: 'var(--text-primary)' }}>Arquivos CSV / TSV:</strong> Cabeçalho na primeira linha. Selecione a coluna do texto. A coluna de nomes é opcional.
                    </li>
                  </ul>
                </div>

                {inspectData ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                      <label>Coluna do Nome do Arquivo</label>
                      <select
                        className="input-base"
                        value={filenameCol}
                        onChange={e => setFilenameCol(e.target.value)}
                      >
                        <option value="__auto__">Gerar nomes automaticamente (audio_001, audio_002...)</option>
                        {inspectData.columns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Coluna do Texto a Sintetizar</label>
                      <select
                        className="input-base"
                        value={textCol}
                        onChange={e => setTextCol(e.target.value)}
                      >
                        {inspectData.columns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Voz para Locução</label>
                      <select
                        className="input-base"
                        value={selectedVoice}
                        onChange={e => handleVoiceChange(e.target.value)}
                      >
                        {voices.map(v => (
                          <option key={v.name} value={v.name}>{v.name}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label>Formato</label>
                        <select className="input-base" value={format} onChange={e => setFormat(e.target.value)}>
                          <option value="mp3">.MP3</option>
                          <option value="wav">.WAV</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <label>Velocidade</label>
                          <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{speed.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.05"
                          value={speed}
                          onChange={e => setSpeed(parseFloat(e.target.value))}
                        />
                      </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={skipExisting}
                        onChange={e => setSkipExisting(e.target.checked)}
                      />
                      <span>Pular áudios já gerados (Retomada rápida)</span>
                    </label>

                    {errorMsg && (
                      <div style={{ color: '#ff8c8c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <IconAlertTriangle size={14} color="var(--error-color)" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    <button
                      className="btn-primary"
                      style={{ width: '100%', marginTop: '0.5rem', padding: '0.85rem' }}
                      onClick={handleStartBatch}
                      disabled={isStarting}
                    >
                      {isStarting ? 'Iniciando lote...' : 'Iniciar Processamento em Lote'}
                    </button>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0, padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-md)' }}>
                    Faça o upload de um arquivo CSV ou TXT ao lado para configurar os parâmetros de locução.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Se há um lote ativo/concluído: Tela de Monitoramento de Progresso */}
      {activeJob && (
        <div className="card">
          {/* Header do Status do Lote */}
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <h3 className="card-title" style={{ fontSize: '1.25rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  Lote: {activeJob.id}
                </h3>
                <span className={`badge badge-${activeJob.status}`}>
                  {activeJob.status === 'running' && 'Em Processamento'}
                  {activeJob.status === 'queued' && 'Na Fila'}
                  {activeJob.status === 'completed' && 'Concluído'}
                  {activeJob.status === 'cancelled' && 'Cancelado'}
                  {activeJob.status === 'failed' && 'Erro'}
                </span>
              </div>
              <span className="card-subtitle">
                Voz: <strong>{activeJob.voice_name}</strong> · Formato: <strong>{activeJob.format.toUpperCase()}</strong> · Velocidade: <strong>{activeJob.speed}x</strong>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {activeJob.status === 'running' && (
                <button className="btn-danger" onClick={handleCancel}>
                  Interromper Lote
                </button>
              )}
              {(activeJob.status === 'completed' || activeJob.status === 'cancelled') && (
                <>
                  <button className="btn-primary" onClick={handleDownloadZip}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Baixar Resultados (.zip)
                  </button>
                  <button className="btn-secondary" onClick={handleReset}>
                    Novo Lote
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="card-body">
            {/* Barra de Progresso e Métricas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <span>Progresso Geral: <strong style={{ color: 'var(--text-primary)' }}>{activeJob.completed_items} / {activeJob.total_items}</strong> ({progressPercent}%)</span>
                {activeJob.current_item && (
                  <span style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                    <span className="spinner" style={{ width: 12, height: 12 }}></span>
                    Gerando agora: <strong>{activeJob.current_item}</strong>
                  </span>
                )}
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    background: activeJob.status === 'failed' ? 'var(--error-color)' : 'var(--accent-primary)',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
            </div>

            {/* Tabela de Itens com colunas de largura fixa */}
            <div className="data-table-container" style={{ maxHeight: '520px' }}>
              <table className="data-table">
                <thead>
                  <tr style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                    <th style={{ width: '45px' }}>#</th>
                    <th style={{ width: '160px' }}>Arquivo</th>
                    <th>Texto (Editável para Fine-Tuning)</th>
                    <th style={{ width: '110px' }}>Status</th>
                    <th style={{ width: '310px' }}>Áudio & Regeração</th>
                  </tr>
                </thead>
                <tbody>
                  {activeJob.items.map(item => {
                    const currentText = editingTexts[item.index] !== undefined ? editingTexts[item.index] : item.text;
                    const isModified = editingTexts[item.index] !== undefined && editingTexts[item.index] !== item.text;
                    const isRegeneratingThis = regeneratingIndex === item.index;

                    return (
                      <tr key={item.index}>
                        <td style={{ color: 'var(--text-secondary)' }}>{item.index}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">{item.filename}</td>
                        
                        {/* Célula de Texto Editável */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <textarea
                              className="input-base"
                              style={{
                                padding: '0.4rem 0.6rem',
                                fontSize: '0.85rem',
                                minHeight: '44px',
                                background: isModified ? 'rgba(255, 107, 0, 0.08)' : 'rgba(0, 0, 0, 0.25)',
                                borderColor: isModified ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
                                lineHeight: '1.3'
                              }}
                              value={currentText}
                              onChange={e => {
                                const val = e.target.value;
                                setEditingTexts(prev => ({ ...prev, [item.index]: val }));
                              }}
                              placeholder="Texto da frase..."
                            />
                            {isModified && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                <IconEdit size={12} />
                                <span>Texto alterado · clique em <strong>Regerar</strong> para aplicar</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <span className={`badge badge-${item.status}`}>
                            {item.status}
                          </span>
                        </td>

                        {/* Célula de Áudio e Botão Regerar */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {(item.status === 'completed' || item.status === 'skipped') && (
                                <AudioPlayer
                                  key={`${item.filename}-${cacheBusters[item.index] || '0'}`}
                                  src={`/api/batch/${activeJob.id}/audio/${item.filename}?t=${cacheBusters[item.index] || '0'}`}
                                  fileName={item.filename}
                                />
                              )}
                              {item.status === 'failed' && (
                                <span style={{ color: '#ff8c8c', fontSize: '0.75rem', display: 'block' }}>{item.error}</span>
                              )}
                              {item.status === 'processing' && (
                                <span style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>Processando...</span>
                              )}
                              {item.status === 'pending' && (
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>Aguardando</span>
                              )}
                            </div>

                            <button
                              className="btn-secondary"
                              style={{
                                padding: '0.4rem 0.6rem',
                                fontSize: '0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                borderColor: isModified ? 'var(--accent-primary)' : 'rgba(255,107,0,0.4)',
                                background: isModified ? 'rgba(255,107,0,0.15)' : 'transparent',
                                color: 'var(--accent-primary)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                              onClick={() => handleRegenerateItem(item.index)}
                              disabled={isRegeneratingThis || activeJob.status === 'running'}
                              title={activeJob.status === 'running' ? 'Aguarde o lote terminar para regerar' : 'Regerar áudio com o texto atual'}
                            >
                              {isRegeneratingThis ? (
                                <>
                                  <span className="spinner" style={{ width: 10, height: 10 }}></span>
                                  <span>Gerando...</span>
                                </>
                              ) : (
                                <>
                                  <IconRefresh size={12} />
                                  <span>Regerar</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
