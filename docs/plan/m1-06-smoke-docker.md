# M1-06 — Script de smoke e comparação com o container estável

**Marco:** 1.1.0 · **Depende de:** M1-05

## Objetivo
Criar `scripts/smoke.sh`, que compara as respostas GET de duas instâncias do servidor, e provar que a imagem nova (porta 3994) responde **igual** ao container estável (porta 3993).

## Contexto mínimo
- Container estável: `http://localhost:3993` — **somente GET** (restrição dura).
- Container de teste: ver o comando exato em `00-contexto.md`, item 6 das restrições.
- Rotas GET do servidor: `/api/list`, `/api/categories`, `/api/categories/<id>`, `/api/search?q=<texto>`, `/api/metadata/<título>`, `/api/read/<título>`, `/api/read/<título>/<cap>`, `/api/read/<título>/<cap>/<i>` (imagem), `/api/read/<título>/<cap>/thumb` (imagem), `/api/read/<título>/<cap>/xl` (status), `/api/bind/<code>` (404 é aceitável). A página `/` retorna HTML.
- **Nunca** chamar `POST` em `/upscale`, `/bind` ou `/search/rebuild`.

## Início
- A imagem `manga-reader:monorepo-test` existe (M1-05).
- `curl -sf localhost:3993/api/list` responde.

## Meio
1. Criar `scripts/smoke.sh <baseA> <baseB>` (bash, `set -euo pipefail`, depende só de `curl` e `jq`):
   - Busca `/api/list` em A; escolhe até 3 títulos (o primeiro, o do meio e o último, por nome).
   - Para cada título: `/api/metadata/<t>`, `/api/read/<t>` (e pega o primeiro e o último capítulo da lista), `/api/read/<t>/<cap>` para esses dois, a página 0 de cada um e o thumb.
   - Também `/api/list`, `/api/categories`, a primeira categoria `/api/categories/<id>`, `/api/search?q=<3 primeiras letras do primeiro título>` e `/`.
   - JSON: compara `jq -S .` de A e B. Imagens: compara o status HTTP, o `content-type` e o `sha256sum` do corpo. `/`: compara só o status HTTP.
   - Os títulos vão para a URL com `jq -rn --arg s "$t" '$s|@uri'`.
   - Imprime `OK <rota>` ou `DIFF <rota>` e sai com código 1 se houver qualquer DIFF.
2. Subir o container de teste (comando do contexto), esperar `curl -sf localhost:3994/api/list` responder (até 60 s).
3. `scripts/smoke.sh http://localhost:3993 http://localhost:3994`.
4. `docker stop manga-reader-monorepo-test`.

## Fim
- `scripts/smoke.sh` sai com código 0 (nenhum DIFF).
- `docker ps --filter name=manga-reader-monorepo-test -q` está vazio após o passo 4.
- O container estável continua respondendo: `curl -sf localhost:3993/api/list > /dev/null`.

## Arquivos
- Criar: `scripts/smoke.sh` (executável)

## Fora do escopo
Testar POSTs. Corrigir diferenças de comportamento: se houver DIFF, investigar a causa no Dockerfile/dependências (M1-04/M1-05) e corrigir lá. Se a causa for não determinística no próprio servidor (ex.: um timestamp), ajustar o smoke para ignorar aquele campo e documentar no script.

## Commit
`Add a smoke script comparing two server instances`
