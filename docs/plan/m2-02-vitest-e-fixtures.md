# M2-02 — Vitest no servidor e gerador de biblioteca sintética

**Marco:** 1.2.0 · **Depende de:** M2-01

## Objetivo
Ter `pnpm --filter @manga/server test` rodando com Vitest, incluindo o teste PSRT que já existe, mais um helper que cria bibliotecas de mangá sintéticas em diretórios temporários.

## Contexto mínimo
- Existe um único teste, `apps/server/src/services/psrt/parserPSRT.test.ts`, escrito no estilo Jest (`describe`/`it`/`expect` globais) e sem runner configurado.
- O formato da biblioteca está em `00-contexto.md`. As raízes vêm de `MANGA_ROOT`/`MANGA_XL_ROOT` (M2-01).
- O alias `@/*` aponta para `apps/server/src/*` (no `tsconfig.json`).

## Início
- M2-01 commitado.

## Meio
1. `pnpm --filter @manga/server add -D vitest vite-tsconfig-paths`.
2. `apps/server/vitest.config.ts`: plugin `vite-tsconfig-paths`, `test.globals: true`, `test.environment: 'node'`, `include: ['src/**/*.test.ts', 'test/**/*.test.ts']`.
3. Scripts em `apps/server/package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`.
4. `apps/server/test/fixtures/makeLibrary.ts` exportando `makeLibrary(spec): Promise<{ root: string; xlRoot: string; cleanup(): Promise<void> }>`, que cria a estrutura em `os.tmpdir()`. O `spec` padrão (exportado como `DEFAULT_SPEC`) precisa cobrir:
   - título `Alpha` com os capítulos `1` (3 páginas `1.jpg 2.jpg 10.jpg`), `2` (2 páginas `.png`), `566` (2 páginas) **e** `0566` (4 páginas, o mais completo), um arquivo `notes.txt` dentro do capítulo 1 e uma pasta não numérica `extras/`;
   - título `Beta` com os capítulos `01` e `1.5`, `.thumb/Beta.jpg` e `.meta/Beta.metadata` contendo `categories=action, Comedy`, `authors=Fulano`, `sinopse=Texto`, uma linha de comentário `#` e uma linha `description=a=b` (valor com `=`);
   - título `.hidden` (precisa ser ignorado);
   - as imagens são arquivos JPEG/PNG mínimos **válidos** (gerar com `sharp`, 1×1 px, cor derivada do índice da página, para que cada página tenha um hash diferente).
5. `apps/server/test/fixtures/makeLibrary.test.ts`: um teste que cria e limpa a biblioteca e confere a contagem de diretórios.

## Fim
- `pnpm --filter @manga/server test` passa, incluindo os testes do `parserPSRT.test.ts` e o `makeLibrary.test.ts`.
- `pnpm test` na raiz também passa.

## Arquivos
- Criar: `apps/server/vitest.config.ts`, `apps/server/test/fixtures/makeLibrary.ts`, `apps/server/test/fixtures/makeLibrary.test.ts`
- Modificar: `apps/server/package.json`, `pnpm-lock.yaml`

## Fora do escopo
Testes de rota (M2-03).

## Commit
`Set up Vitest for the server with a synthetic library fixture`
