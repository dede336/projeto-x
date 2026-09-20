#!/bin/bash

# Instala dependências se necessário (com lock pra não conflitar)
if [ ! -d /home/runner/workspace/node_modules ]; then
  echo "📦 Instalando dependências (primeira vez, pode demorar)..."
  flock /tmp/.pnpm-install.lock pnpm install -C /home/runner/workspace
fi

echo "🚀 Subindo todos os servidores..."

# API Server
(cd /home/runner/workspace && PORT=5000 NODE_ENV=development pnpm --filter @workspace/api-server run dev) &
PID_API=$!

# Editor de Digimon
(cd /home/runner/workspace && PORT=8080 BASE_PATH=/digimon-manager/ pnpm --filter @workspace/digimon-manager run dev) &
PID_DIGI=$!

# Jogo Pokémon
(cd /home/runner/workspace && PORT=25527 BASE_PATH=/pokemon-game/ pnpm --filter @workspace/pokemon-game run dev) &
PID_POKE=$!

echo "✅ Servidores iniciados! API(:5000) | Digimon(:8080) | Pokémon(:25527)"

# Encerra tudo junto se o script for morto
trap "kill $PID_API $PID_DIGI $PID_POKE 2>/dev/null" EXIT

wait
