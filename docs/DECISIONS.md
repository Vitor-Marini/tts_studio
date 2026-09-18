# Decisões de Arquitetura

## 2026-09-18 — Refatoração do TTS Studio v2.0

### 1. Eliminação do Node.js em Produção e Adoção de Porta Única (8000)
- **Problema anterior**: A v1 executava um container com dois servidores concorrentes (FastAPI na porta 8000 e Next.js na porta 3000), gerenciados por um script supervisor bash com loops de `curl`, complexidade desnecessária e potenciais conflitos de portas.
- **Decisão**: Compilar o frontend como uma Single Page Application (SPA) estática moderna com Vite + React + TypeScript (~58 KB gzipped) e servi-lo diretamente pelo FastAPI na raiz `/`. O runtime de produção roda 100% em Python, com porta única (8000), sem Node.js e sem problemas de CORS.

### 2. Abandono de Arquivos `.pth` e Adoção de Vozes Multi-Referência
- **Problema anterior**: A v1 convertia uma única amostra de áudio em um tensor de pesos `.pth` descartando o áudio original, o que impedia melhorias futuras e causava quebras com PyTorch 2.6+.
- **Decisão**: Tratar a Voz como uma entidade persistida em `data/voices/<Nome_da_Voz>/` contendo os áudios originais (`.wav`, `.mp3`) e um `voice.json` de metadados. O XTTS v2 sintetiza utilizando todas as amostras conjuntamente, resultando em maior fidelidade vocal. Amostras podem ser adicionadas, reproduzidas e removidas individualmente na interface.

### 3. Síntese Estocástica Sem Cache de Áudio
- **Decisão**: Remover o cache de áudio no backend. Cada solicitação sintetiza um take novo e único, permitindo que o usuário gere a mesma frase repetidas vezes até obter a entonação e ritmo ideais.

### 4. Gestão Automática de Armazenamento (Auto-Prune FIFO)
- **Decisão**: Implementar monitoramento contínuo do espaço ocupado em `/app/data` limitado pela variável de ambiente `MAX_STORAGE_MB` (padrão 5 GB). Se o limite for excedido, o sistema executa rotação automática removendo áudios e lotes antigos em ordem FIFO, impedindo estouro de disco em servidores.

---

## 2026-08-24 — Remoção do F5-TTS
- Revertido para suporte exclusivo ao XTTS v2 devido a limitações de idioma e lentidão em CPU do modelo base F5-TTS.
