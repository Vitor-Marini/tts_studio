# Decisoes de Arquitetura

## 2026-08-24 — Remocao do F5-TTS

### Contexto

O F5-TTS foi implementado como segundo modelo de TTS (ao lado do XTTS v2) com suporte a variante PT-BR (`firstpixel/F5-TTS-pt-br`). Apos testes, foram identificados dois problemas fundamentais:

### Problemas

1. **Geracao em portugues nao funcionava** — O modelo base F5-TTS (`F5TTS_v1_Base`) suporta apenas ingles e chines. A variante PT-BR e um fine-tuning separado que, mesmo apos integracao correta via `ckpt_file`, nao gerava audio em portugues de forma confiavel.

2. **Performance insatisfatoria em CPU** — O F5-TTS e significativamente mais lento que o XTTS v2 em processamento CPU. O tempo de geracao era proibitivo para uso pratico, mesmo com configuracoes reduzidas de `nfe_step`.

### Decisao

Reverter para a versao XTTS-only (commit `492160b`), criando a branch `stable-xtts` como referencia da ultima versao estavel anterior ao F5-TTS.

### Branches

- **`prod`** — Codigo com F5-TTS (mantido no remote para referencia futura)
- **`stable-xtts`** — Versao estavel XTTS-only

### Futuras consideracoes

- F5-TTS pode ser reconsiderado quando houver suporte nativo a portugues no modelo base
- Para uso em GPU, o desempenho do F5-TTS pode ser aceitavel
- O XTTS v2 continua sendo a melhor opcao para CPU com suporte nativo a 17 idiomas
