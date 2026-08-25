# Decisões de Arquitetura

## 2026-08-24 — Remoção do F5-TTS

### Contexto

O F5-TTS foi implementado como segundo modelo de TTS (ao lado do XTTS v2) com suporte a variante PT-BR (`firstpixel/F5-TTS-pt-br`). Após testes, foram identificados dois problemas fundamentais:

### Problemas

1. **Geração em português não funcionava** — O modelo base F5-TTS (`F5TTS_v1_Base`) suporta apenas inglês e chinês. A variante PT-BR (`firstpixel/F5-TTS-pt-br`) é um fine-tuning separado que, mesmo após integração correta via `ckpt_file`, não gerava áudio em português de forma confiável.

2. **Performance insatisfatória em CPU** — O F5-TTS é significativamente mais lento que o XTTS v2 em processamento CPU. O tempo de geração era proibitivo para uso prático, mesmo com configurações reduzidas de `nfe_step`.

### Decisão

Reverter para a versão XTTS-only (commit `492160b`), criando a branch `stable-xtts` como referência da última versão estável anterior ao F5-TTS.

### Branches

- **`prod`** — Código atual com F5-TTS (mantido no remote para referência futura)
- **`stable-xtts`** — Versão estável XTTS-only (`492160b`)

### Código F5-TTS removido

- `api-backend/scripts/f5_tts_model.py` — Classe `F5TTSModel`
- `api-backend/main.py` — Model registry, variant support, endpoints F5-TTS
- `web-app/src/app/page.tsx` — Seletor de modelo, seletor de idioma, presets F5-TTS
- `docker/Dockerfile` — Download do modelo F5-TTS e dependências

### Futuras considerações

- F5-TTS pode ser reconsiderado quando houver suporte nativo a português no modelo base
- Para uso em GPU, o desempenho do F5-TTS pode ser aceitável
- O XTTS v2 continua sendo a melhor opção para CPU com suporte nativo a 17 idiomas
