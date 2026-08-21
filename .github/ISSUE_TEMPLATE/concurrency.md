---
name: Concorrência: Event loop bloqueado por geração TTS
about: Melhorar suporte a múltiplos usuários simultâneos
title: "[FEATURE] Concorrência: event loop bloqueado por geração TTS"
labels: enhancement
---

## Problema

Quando múltiplos usuários acessam o app simultaneamente e solicitam geração de áudio (TTS), as requisições ficam em fila serial. Enquanto uma geração está em execução, **todos os endpoints** ficam bloqueados — incluindo `/api/voices` e `/api/presets`.

## Comportamento Atual

```
User 1: [=====Geração 30s=====]
User 2:              [AGUARDANDO...][=====Geração 30s=====]
User 3:                                      [AGUARDANDO...][=====Geração 30s=====]
```

Tempo total para processar 3 requisições: ~90s (em vez de ~30s cada)

## Causa Raiz

1. **Endpoint async com código síncrono bloqueante**: `generate_tts` é `async def` mas executa `model.inference()`, `torchaudio.save()` e `subprocess.run(ffmpeg)` — todos bloqueantes
2. **1 worker uvicorn**: Processamento serial total
3. **Sem asyncio.Lock**: Race condition no acesso ao modelo compartilhado
4. **torch.manual_seed() global**: Seeds diferentes causam race condition

## Impacto

- Health check do Docker pode falhar durante geração
- Frontend fica irresponsivo para todos os usuários
- Experiência ruim para múltiplos usuários

## Sugestão de Correção

1. Mover `model.inference()` e `subprocess.run(ffmpeg)` para `asyncio.to_thread()`
2. Adicionar `asyncio.Lock()` para serializar acesso ao modelo
3. Manter endpoints de leitura (`/api/voices`, `/api/presets`) responsivos

## Severidade

Média — afeta uso com múltiplos usuários simultâneos. Para uso individual, não há impacto.
