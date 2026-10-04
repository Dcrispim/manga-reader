# M4-11 — Jobs de upgrade para high-res

**Marco:** mobile v1 · **Depende de:** M4-10

## Objetivo
Quando o setting `downloads.highRes` estiver ligado, cada capítulo baixado gera um job `upgrade` que pede o upscale ao servidor, acompanha o status **sem teto de tentativas** (persistido na fila, não num loop em memória) e, quando o upscale fica pronto, troca as páginas pela versão xl.

## Contexto mínimo
- Servidor:
  - `POST /api/read/<t>/<n>/upscale` → `{ status: 'pending'|'processing'|'done'|'error'|null, alreadyUpscaled? }`; `GET` na mesma rota devolve o status;
  - `GET /api/read/<t>/<n>/xl` → `{ images: string[] }` (relativas), ou 404;
  - as páginas xl ficam em `/api/read/<t>/<n>/xl/<i>`.
- A fila de upscale do servidor é uma GPU com **1 job rodando + 1 esperando**, e um pedido novo **desbanca** o que estava esperando. Por isso o app **não** pode ficar repostando: POST só na primeira tentativa, ou quando o GET devolver `null` (o pedido foi desbancado ou perdido), e no máximo uma vez a cada 30 min por capítulo. Nas outras tentativas, só GET.
- O job `upgrade` usa a mesma tabela `jobs` e o mesmo drain (M4-10). O agendamento entre checagens é de 5 min enquanto `pending`/`processing`. Com `error`, o próximo POST só sai depois de 6 h.
- Para trocar as páginas: baixar o xl para `<chapter>.xl.tmp/` e chamar `replaceChapterImages` (M4-08), que preserva o `saved_at` e devolve `false` se o capítulo foi apagado. Nesse caso o job é concluído sem efeito.
- Se o número de páginas xl for diferente do original, aceitar o conjunto xl (ele é a fonte de verdade da versão upscaled) e registrar no `diag_log`.
- O capítulo apagado enquanto o job existe faz o job ser cancelado no próximo ciclo.

## Início
- M4-10 commitado.

## Meio
1. `apps/mobile/src/jobs/upgradeWorker.ts`: `runUpgradeJob(job, deps)`, com a máquina de estados acima. Grava `last_post_at` em `last_error`, ou acrescenta uma coluna `meta_json` em `jobs` com uma migração nova do drizzle (preferível).
2. `commitChapter` (M4-08): se `downloads.highRes` estiver ligado e a qualidade for `original`, chama `enqueue(db, 'upgrade', ...)`.
3. Registrar o worker no `drain.ts`.
4. Testes:
   - fluxo feliz (pending → processing → done → troca);
   - `null` provoca novo POST só depois de 30 min;
   - `error` só tenta de novo depois de 6 h;
   - capítulo apagado no meio: sem ressurreição;
   - falha ao baixar xl/i: mantém o original e reagenda;
   - POSTs contados no fake nunca excedem a regra.

## Fim
- `pnpm --filter @manga/mobile test` passa.

## Arquivos
- Criar: `apps/mobile/src/jobs/upgradeWorker.ts`, `apps/mobile/src/jobs/__tests__/upgradeWorker.test.ts`, uma nova migração em `apps/mobile/drizzle/` (se adicionar `meta_json`)
- Modificar: `apps/mobile/src/db/schema.ts`, `apps/mobile/src/jobs/drain.ts`, `apps/mobile/src/storage/downloads.ts`

## Fora do escopo
Pedir upscale manual pela UI (fora da v1).

## Commit
`Add background high-res upgrade jobs`
