# M4-07 — Política de espaço no core (evicção e projeção)

**Marco:** mobile v1 · **Depende de:** marco 1.2.0 (`packages/core` existe)

## Objetivo
Implementar em `@manga/core`, como funções puras e testadas, as regras de gestão de espaço dos downloads: limites, ordem de evicção, projeção de tamanho e admissão de novos downloads.

## Contexto mínimo
Regras decididas (não reabrir):
- Limites: `maxPerTitle` = 5 capítulos, `maxGlobal` = 100 capítulos, `maxBytes` = 2 GB, piso de disco livre `minFreeBytes` = 1 GB. Vale o que estourar primeiro.
- Ordem de evicção: primeiro os capítulos **lidos** (presentes no histórico mesclado), do `savedAt` mais antigo ao mais novo; depois os **não lidos**, também do mais antigo ao mais novo.
- Nunca evictar o capítulo recém-salvo nem o capítulo aberto no leitor (`protectedIds`).
- A evicção roda também offline.
- Projeção "cega": 1 MB por página; capítulo sem contagem de páginas conhecida = 15 páginas.
- Admissão: um download só começa se `freeDisk - projected >= minFreeBytes`. Se não couber, o job fica **pausado** (não falha).
- O cache transitório (300 MB, LRU) usa a mesma ideia, mas com uma função própria e mais simples.
- O core é TS puro (regra de lint em `packages/core/eslint.config.mjs`).

## Início
- `pnpm --filter @manga/core test` passa.

## Meio
1. `packages/core/src/space/policy.ts`:
   ```ts
   export type StoredChapter = { id: string; title: string; bytes: number; savedAt: number; isRead: boolean }
   export type Limits = { maxPerTitle: number; maxGlobal: number; maxBytes: number }
   export const DEFAULT_LIMITS: Limits & { minFreeBytes: number; transientMaxBytes: number }
   export const BLIND_PAGE_BYTES = 1_000_000
   export const BLIND_CHAPTER_PAGES = 15
   export function projectChapterBytes(pages: number | null): number
   export function planEviction(chapters: StoredChapter[], limits: Limits, protectedIds: string[]): string[] // ids in eviction order
   export function canAdmit(freeDiskBytes: number, projectedBytes: number, minFreeBytes: number): boolean
   export function planLruEviction(items: { id: string; bytes: number; lastAccess: number }[], maxBytes: number, protectedIds: string[]): string[]
   ```
   `planEviction` aplica primeiro o limite por título (para cada título acima do limite, remove na ordem lidos-antigos e depois não-lidos-antigos daquele título), depois o global por contagem e depois o global por bytes, sempre com a mesma ordem e pulando os protegidos. Se só restarem protegidos, para (aceita ficar acima do limite).
2. `packages/core/src/space/policy.test.ts`:
   - por título: com 7 capítulos de um título, remove 2, sendo os lidos primeiro;
   - global por contagem;
   - global por bytes;
   - protegidos nunca aparecem na lista;
   - todos protegidos: lista vazia;
   - um capítulo não lido antigo sai **depois** de um lido novo;
   - projeção com `null` e com a contagem real;
   - `canAdmit` exatamente no limite;
   - LRU.
   - **Propriedade:** depois de aplicar o plano, os limites são respeitados, ou só sobram protegidos acima deles.
3. Exportar em `packages/core/src/index.ts`.

## Fim
- `pnpm --filter @manga/core test lint typecheck` passa.

## Arquivos
- Criar: `packages/core/src/space/policy.ts`, `packages/core/src/space/policy.test.ts`
- Modificar: `packages/core/src/index.ts`

## Fora do escopo
Aplicar a política no app (M4-08). Mudar o comportamento do web (o web continua com a lógica própria dele).

## Commit
`Add download space policy to @manga/core`
