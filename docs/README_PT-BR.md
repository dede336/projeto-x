# OMEGA DX10 — pacote completo do jogo

Este é o pacote completo do projeto para enviar a outro ChatGPT ou migrar para Java, JavaScript ou Python.

## O que está incluído

- `artifacts/omega-dx10`: jogo Expo/React Native completo
  - todas as telas e rotas
  - batalha, evolução, fusão, coleção, fazenda, gacha, inventário, mapa, chat, amigos e PvP
  - contextos, hooks, componentes, engines e dados
  - catálogo completo de imagens e animações em `assets/`
- `artifacts/api-server`: API Express + Socket.io completa
  - autenticação, saves, Digimons, itens, mapas, tamers, chat, amigos, ranking e overrides
  - seed completo dos dados do jogo
- `lib/db`: schema PostgreSQL/Drizzle
- `lib/api-zod`: tipos e validações compartilhados
- `lib/api-client-react`: cliente da API
- `lib/api-spec`: especificação OpenAPI
- `scripts`: scripts auxiliares
- manifests e lockfile do workspace

## O que não está incluído

- `node_modules/`
- builds gerados (`dist/`, `static-build/`)
- caches e metadados locais do Replit/Expo
- segredos e credenciais reais

Os assets do jogo não foram reduzidos: a pasta `artifacts/omega-dx10/assets/` contém o catálogo completo original, preservando os caminhos.

## Como orientar outro ChatGPT

Envie este ZIP e diga: “Analise o projeto completo. Preserve a lógica e os assets. Quero migrar ou reimplementar o jogo em [Java Android / JavaScript / Python]. Comece fazendo um mapa da arquitetura, telas, dados, regras de batalha e dependências; depois proponha a migração por etapas sem remover funcionalidades.”

## Execução local

1. Instale Node.js e pnpm.
2. Execute `pnpm install` na raiz.
3. Configure `DATABASE_URL` para PostgreSQL e `SESSION_SECRET` para assinatura dos tokens.
4. Para o backend: `pnpm --filter @workspace/api-server run dev`.
5. Para o app: `pnpm --filter @workspace/omega-dx10 run dev`.

As variáveis de ambiente do Expo/servidor podem precisar ser ajustadas ao ambiente de destino.
