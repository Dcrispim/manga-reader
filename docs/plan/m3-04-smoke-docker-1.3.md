# M3-04 — Smoke do Docker com os endpoints novos

**Marco:** 1.3.0 (fecha o marco) · **Depende de:** M3-03, M1-06

## Objetivo
Provar que a imagem com `/api/health` e `/api/catalog` funciona contra a biblioteca real (somente leitura) e que todas as rotas antigas continuam idênticas às do container estável.

## Contexto mínimo
- `scripts/smoke.sh <baseA> <baseB>` compara as rotas GET antigas (M1-06).
- O comando do container efêmero está no `00-contexto.md`, item 6. Ele já define `SERVER_ID_PATH` num tmpfs, porque a biblioteca é `:ro`.
- O container estável (3993) **não** tem `/api/health` nem `/api/catalog`, então esses endpoints são verificados só no 3994.

## Início
- M3-03 commitado.

## Meio
1. Acrescentar a `scripts/smoke.sh` uma flag `--new-only <base>` que verifica só na instância nova:
   - `/api/health`: `version` não vazio, `features` contém `catalog`, `serverId` presente;
   - `/api/catalog?since=0`: `allTitleNames` com a mesma quantidade de itens que `/api/list`, e cada título com `chapters` não vazio;
   - `/api/catalog?since=<serverTime>`: `titles` vazio;
   - imprimir o tempo das duas chamadas de catálogo.
2. `docker build -t manga-reader:monorepo-test .`
3. Subir o container efêmero e esperar ele responder.
4. `scripts/smoke.sh http://localhost:3993 http://localhost:3994` (comparação das rotas antigas).
5. `scripts/smoke.sh --new-only http://localhost:3994`.
6. `docker stop manga-reader-monorepo-test`.

## Fim
- Os passos 4 e 5 saem com código 0.
- O container de teste foi parado e o estável continua respondendo no 3993.
- Os tempos do catálogo contra a biblioteca real ficam registrados no ADR 0005.

## Arquivos
- Modificar: `scripts/smoke.sh`, `docs/adr/0005-catalogo-incremental.md`

## Fora do escopo
Qualquer coisa no container estável.

## Commit
`Extend smoke checks to /api/health and /api/catalog`

> Fim do marco 1.3.0. O app passa a exigir um servidor com `features` contendo `catalog` (senão, modo degradado).
