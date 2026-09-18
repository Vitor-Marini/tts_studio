# TTS Studio v2.0 — API Reference

**Documentação interativa Swagger:** `http://localhost:8000/docs`  
**OpenAPI JSON:** `http://localhost:8000/openapi.json`

---

## 1. Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DEVICE` | `cuda` | Dispositivo de inferência (`cuda` ou `cpu`). Faz fallback automático para `cpu` se CUDA não estiver disponível. |
| `DATA_DIR` | `/app/data` | Diretório raiz de persistência de dados (modelos, vozes, saídas e lotes). |
| `MAX_STORAGE_MB` | `5120` | Limite máximo de armazenamento em disco em MB (5 GB padrão). |
| `COQUI_TOS_AGREED` | `1` | Aceite dos termos da licença Coqui. |

---

## 2. Endpoints da API

### Síntese Individual
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/tts` | Sintetizar áudio a partir de texto com parâmetros de voz, formato (`mp3` ou `wav`) e velocidade. |

### Gerenciamento de Vozes (Multi-Referência)
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/voices` | Listar todas as vozes cadastradas com suas amostras e metadados. |
| `POST` | `/api/voices` | Criar nova voz (multipart: `name`, `default_speed` e arquivos de áudio de referência). |
| `GET` | `/api/voices/{name}` | Obter detalhes e lista de amostras de uma voz específica. |
| `PUT` | `/api/voices/{name}` | Atualizar configurações da voz (ex: velocidade padrão). |
| `DELETE` | `/api/voices/{name}` | Excluir uma voz e todas as suas amostras do disco. |
| `POST` | `/api/voices/{name}/samples` | Adicionar uma nova amostra de áudio de referência a uma voz existente. |
| `DELETE` | `/api/voices/{name}/samples/{filename}` | Remover uma amostra de áudio específica de uma voz. |
| `GET` | `/api/voices/{name}/samples/{filename}` | Obter/reproduzir o arquivo de áudio de uma amostra de referência. |

### Processamento em Lote (Batch CSV/TXT)
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/batch` | Iniciar novo processamento em lote via upload de arquivo (`.csv` ou `.txt`). |
| `GET` | `/api/batch/{job_id}` | Obter status, progresso em tempo real e lista de itens de um lote. |
| `POST` | `/api/batch/{job_id}/regenerate/{filename}` | Regerar áudio específico de um lote (com suporte a texto editado). |
| `GET` | `/api/batch/{job_id}/download` | Baixar arquivo ZIP contendo os áudios gerados e o relatório CSV do lote. |
| `GET` | `/api/batch/history` | Listar histórico de lotes processados e salvos no disco. |
| `DELETE` | `/api/batch/{job_id}` | Excluir pasta do lote e seus arquivos gerados. |

### Armazenamento e Áudios
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/audios` | Listar áudios gerados individualmente no servidor. |
| `GET` | `/api/audio/{filename}` | Reproduzir ou baixar arquivo de áudio sintetizado (`.mp3` ou `.wav`). |
| `DELETE` | `/api/audio/{filename}` | Excluir um áudio específico do servidor. |
| `DELETE` | `/api/audios` | Excluir todos os áudios avulsos do servidor. |
| `POST` | `/api/audio/zip` | Empacotar e baixar múltiplos áudios selecionados em um arquivo ZIP. |
| `GET` | `/api/storage/stats` | Obter estatísticas de uso de disco e limite de armazenamento. |

### Verificação de Saúde
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Status de integridade do serviço, dispositivo ativo e estado do modelo. |

---

## 3. Exemplos de Uso via cURL

### Sintetizar Áudio
```bash
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Olá mundo! Este é um teste do TTS Studio v2.",
    "voice": "MinhaVoz",
    "output_format": "mp3",
    "speed": 1.0
  }'
```

### Criar uma Nova Voz com Múltiplas Referências
```bash
curl -X POST http://localhost:8000/api/voices \
  -F "name=Narrador" \
  -F "default_speed=1.0" \
  -F "samples=@amostra1.wav" \
  -F "samples=@amostra2.wav"
```

### Baixar Áudio Sintetizado
```bash
curl -O http://localhost:8000/api/audio/tts_20260918_173542_a6b38e74.mp3
```
