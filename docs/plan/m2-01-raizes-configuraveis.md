# M2-01 — Raízes da biblioteca configuráveis por variável de ambiente

**Marco:** 1.2.0 (extração do core, sem mudança funcional) · **Depende de:** marco 1.1.0 concluído

## Objetivo
Trocar os caminhos fixos `/mnt/d/manga` e `/mnt/d/manga-xl`, espalhados pelo código, por um módulo único que lê variáveis de ambiente com esses mesmos padrões. Isso permite testes contra bibliotecas sintéticas.

## Contexto mínimo
Constantes fixas em `apps/server/src/`:
- `ROOT_PATH = "/mnt/d/manga"` em: `app/api/list/route.ts`, `app/api/read/[title]/route.ts`, `app/api/read/[title]/[chapter]/route.ts`, `app/api/read/[title]/[chapter]/[index]/route.ts`, `app/api/read/[title]/[chapter]/thumb/route.ts`, `app/api/metadata/[title]/route.ts`, `app/api/bind/route.ts`, `app/api/bind/[code]/route.ts`, `services/metadata.ts` (lá também há `META_PATH`), `services/searchIndex.ts`.
- `ROOT_PATH = "/mnt/d/manga-xl"` em: `app/api/read/[title]/[chapter]/xl/[index]/route.ts`, `app/api/read/[title]/[chapter]/xl/[index]/[slice]/route.ts`.
- Conferir também `services/upscale.ts` e `services/xlSlices.ts` (podem ter caminhos próprios).

## Início
- Branch `milestone/1.2.0` criada a partir de `main` (com 1.1.0 mergeado).
- `grep -rn "/mnt/d/manga" apps/server/src | wc -l` ≥ 12.

## Meio
1. Criar `apps/server/src/utils/paths.server.ts`:
   ```ts
   // Library roots come from env so tests can point at synthetic libraries;
   // defaults match the production container's volume mounts.
   export const MANGA_ROOT = process.env.MANGA_ROOT || '/mnt/d/manga'
   export const MANGA_XL_ROOT = process.env.MANGA_XL_ROOT || '/mnt/d/manga-xl'
   export const META_DIR = path.join(MANGA_ROOT, '.meta')
   export const THUMB_DIR = path.join(MANGA_ROOT, '.thumb')
   export const BINDS_DIR = path.join(MANGA_ROOT, '.binds')
   ```
   Detalhe: ler o env **no momento do import** é suficiente, porque os testes definem o env antes de importar as rotas.
2. Em cada arquivo listado, apagar a constante local e importar de `@/utils/paths.server`. Substituir os `path.join(ROOT_PATH, '.thumb', …)`, `'.binds'` e `'.meta'` pelas constantes correspondentes.
3. `pnpm --filter @manga/server build`.
4. Rodar o servidor no host na porta 3994 (`pnpm --filter @manga/server exec next start -p 3994`) e executar `scripts/smoke.sh http://localhost:3993 http://localhost:3994`. Encerrar o servidor depois.

## Fim
- `grep -rn "/mnt/d/manga" apps/server/src` só encontra `utils/paths.server.ts`.
- O build passa.
- O smoke sai com código 0.

## Arquivos
- Criar: `apps/server/src/utils/paths.server.ts`
- Modificar: os 12 arquivos listados, mais `services/upscale.ts` e `services/xlSlices.ts` se tiverem caminhos fixos

## Fora do escopo
Mudar qualquer lógica de rota.

## Commit
`Read library roots from MANGA_ROOT/MANGA_XL_ROOT env`
