# Bot de WhatsApp — n8n + Evolution API + XTTS Studio

> Documento de ideia/planejamento. **Nada implementado ainda.**

## Objetivo

Permitir que usuários interajam com o XTTS Studio pelo WhatsApp: enviar um texto e receber o áudio sintetizado com a voz escolhida (e, futuramente, clonar a própria voz a partir de uma amostra enviada pelo chat).

Stack alvo:

- **n8n** — orquestração do fluxo (webhook, chamadas de API, envio de mídia).
- **Evolution API** — ponte com o WhatsApp (recebe mensagens via webhook, envia áudio como mídia).
- **XTTS Studio (api-backend)** — síntese de voz (TTS) e clonagem.

## Fluxo simples (primeira interação vem do usuário)

```
1. Usuário envia mensagem no WhatsApp
      ↓ (webhook Evolution → n8n Webhook Trigger)
2. n8n recebe o texto ("Oi", texto a sintetizar, comando, etc.)
      ↓
3. n8n interpreta a intenção:
      • saudação/help → responde com instruções de uso
      • "/voz <nome>"  → troca a voz ativa (GET /api/voices)
      • texto comum    → sintetiza
      • áudio enviado  → (futuro) clona a voz (POST /api/clone)
      ↓
4. Para sintetizar: n8n chama POST /api/tts com { text, voice, ... }
      ↓
5. n8n obtém audio_url (e baixa o arquivo via GET /api/audio/{file})
      ↓
6. n8n envia o áudio ao usuário via Evolution API
      POST /message/sendMedia/{instance}  (mediaUrl ou media base64)
      ↓
7. Usuário recebe o áudio. Fim.
```

Regra de negócio mínima:

- Primeira mensagem do usuário → n8n responde com saudação + instruções ("Envie o texto que quer que eu fale. Use /voz <nome> para trocar a voz.").
- Mensagens seguintes sem comando → consideradas texto a ser sintetizado.

## Endpoints atuais do backend usados

| Endpoint | Uso no bot |
|---|---|
| `POST /api/tts` | Sintetizar texto → retorna `audio_url` |
| `GET /api/audio/{filename}` | Baixar o arquivo de áudio gerado |
| `GET /api/voices` | Listar vozes disponíveis (comando `/voz`) |
| `POST /api/clone` | (futuro) Clonar voz a partir de áudio enviado no chat |

Exemplo de payload do `POST /api/tts`:

```json
{
  "text": "Olá, esta é uma mensagem de teste",
  "language": "pt",
  "voice": "ADA",
  "temperature": 0.2,
  "speed": 1.0,
  "length_penalty": -3.5,
  "repetition_penalty": 6.5,
  "top_k": 56,
  "top_p": 0.89,
  "use_fixed_seed": true,
  "seed": 99,
  "split_sentences": true,
  "format": "mp3",
  "bitrate": "192k"
}
```

## Ressalvas e pontos de atenção

1. **URL pública do áudio** — o `audio_url` retornado usa `http://localhost:8000/...`. A Evolution API só consegue baixar o arquivo se estiver na mesma máquina (ou por túnel ngrok/cloudflared). Se a Evolution for remota/cloud, o backend precisa de URL pública configurável (ex.: base URL via variável de ambiente).
2. **Concorrência** — o modelo XTTS é uma instância global única, sem lock. Se o usuário do site e o bot solicitarem TTS ao mesmo tempo, podem conflitar. Ideal adicionar `threading.Lock` no `/api/tts` (ou fila).
3. **Sincronismo / latência** — geração em CPU demora (dezenas de segundos em textos longos). O n8n deve avisar o usuário ("⏳ Gerando, aguarde...") e usar timeout generoso.
4. **Custo/depreciação** — mensagens longas geram áudios maiores; limitar tamanho do texto por mensagem.

## Melhorias futuras no backend (para viabilizar o bot)

- [ ] Tornar a base URL do `audio_url` configurável (variável de ambiente).
- [ ] Adicionar lock/serialização na geração de TTS.
- [ ] (Opcional) Endpoint de limpeza dos arquivos antigos de `output/`.

## Roadmap de implementação

1. Backend: base URL configurável + lock de concorrência.
2. Instalar/configurar Evolution API e n8n.
3. Criar fluxo no n8n: Webhook Trigger → interpretação → `/api/tts` → download do áudio → `sendMedia`.
4. Adicionar comandos de voz (`/voz`) e mensagens de status.
5. (Futuro) Clonagem de voz via áudio do WhatsApp.