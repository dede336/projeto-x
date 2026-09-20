# Instruções para análise e migração por IA

## Ordem recomendada de leitura

1. `artifacts/omega-dx10/app/_layout.tsx`
2. `artifacts/omega-dx10/context/GameContext.tsx`
3. `artifacts/omega-dx10/constants/gameData.ts`
4. `artifacts/omega-dx10/utils/gameEngine.ts`
5. `artifacts/omega-dx10/utils/battleEngine.ts`
6. todas as rotas em `artifacts/omega-dx10/app/`
7. componentes em `artifacts/omega-dx10/components/`
8. `artifacts/api-server/src/`
9. `lib/db/src/schema/`
10. `lib/api-spec/openapi.yaml`

## Regras de migração

- Não substituir os assets por placeholders.
- Preservar nomes e caminhos relativos de `artifacts/omega-dx10/assets/`.
- Mapear primeiro o estado global e as regras do jogo; depois migrar as telas.
- Separar dados estáticos, persistência, autenticação, rede e renderização.
- Implementar testes para batalha, evolução, fusão, dano, atributos e salvamento.
- Confirmar a paridade de cada tela antes de remover o código original.
- O código atual é React Native/Expo/TypeScript; ele é a referência funcional, não código Java compilável.

## Limite de contexto

Se o arquivo for grande, analisar por módulos e manter um inventário das funções, tipos, rotas, tabelas e assets já migrados. Não resumir ou descartar `seed.ts`, `gameData.ts`, `extendedCharacters.ts` ou os arquivos de assets: eles carregam grande parte do conteúdo do jogo.
