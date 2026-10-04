# M4-18 — Telas de armazenamento, fila, bind e diagnóstico

**Marco:** mobile v1 · **Depende de:** M4-10, M4-12, M4-13, M4-14

## Objetivo
Dar ao usuário visibilidade e controle sobre o espaço usado, a fila de downloads, a conexão de progresso (bind) e o log de diagnóstico, completando as Configurações.

## Contexto mínimo
- Settings e padrões (`DEFAULTS` em `apps/mobile/src/settings/repo.ts` e `DEFAULT_LIMITS` em `@manga/core`):
  - `space.maxPerTitle=5`, `space.maxGlobal=100`, `space.maxBytes=2GB`, `space.minFreeBytes=1GB`, `space.transientMaxBytes=300MB`;
  - `downloads.autoNext=false`, `downloads.highRes=false`.
- Funções existentes:
  - `enforceSpace`, `deleteChapter`, `deleteTitle` e `deleteAll` (M4-08);
  - `clearTransient` (M4-09);
  - `enqueue`, `cancel` e `listActive` (M4-10);
  - `createBind`, `connectBind`, `disconnectBind` e `syncBind` (M4-12);
  - `runCycle` (M4-13);
  - `FileStore.freeDiskBytes()`;
  - tabela `diag_log`.
- Mudar um limite para baixo aplica `enforceSpace` na hora.
- "Limpar catálogo" apaga `titles` e `chapter_sources` da fonte `server`, as capas e o cursor `catalog.since=0`, mas mantém downloads, histórico e fontes locais. O próximo ciclo ressincroniza.
- Exportar o log: gerar um `.txt` em `cacheDirectory` e abrir o compartilhamento do Android (`expo-sharing`).

## Início
- M4-14 commitado.

## Meio
1. `app/settings/index.tsx` (já existe, de M4-05): acrescentar as seções e links para Armazenamento, Fila de downloads, Fontes locais (M4-17), Sincronizar progresso e Diagnóstico, mais um botão "Sincronizar agora" (`runCycle('foreground')`).
2. `app/settings/storage.tsx`:
   - uso de downloads (capítulos e bytes, contra os limites, em barras), do cache transitório, das capas do catálogo e do espaço livre no disco;
   - editores dos limites, com validação de mínimos;
   - os toggles de auto-download do próximo e de baixar em high-res;
   - lista de títulos baixados com o tamanho e o botão Remover; "Remover todos os downloads" com confirmação; "Limpar cache de leitura"; "Limpar catálogo" com confirmação.
3. `app/settings/queue.tsx`: os jobs ativos, com estado (na fila, baixando x/y, aguardando servidor, aguardando espaço, falhou) e a ação Cancelar. Live query sobre `jobs`.
4. `app/settings/bind.tsx`:
   - sem código: "Gerar código" (`createBind`, e mostra o código grande) ou "Conectar com código" (campo de 6 caracteres, maiúsculo; `connectBind`; com `not_found`, mostra a mensagem neutra "Código não encontrado");
   - com código: mostra o código, a última sincronização e o botão Desconectar.
5. `app/settings/diagnostics.tsx`: as últimas 200 linhas do `diag_log` (filtro por nível) e os botões Exportar e Limpar.
6. `apps/mobile/src/settings/format.ts`: formatação de bytes e datas relativas em pt-BR (pura, testada).
7. Testes:
   - `format.ts`;
   - baixar um limite dispara `enforceSpace` (com fakes);
   - "Limpar catálogo" preserva downloads e histórico (`testDb`);
   - a validação dos limites.

## Fim
- Testes passando.
- No emulador: ver os números de uso mudarem depois de baixar um capítulo; baixar o `maxPerTitle` para 1 e ver a evicção imediata (os lidos primeiro); gerar um código de bind no app e conectá-lo no web do PC (`http://localhost:3993`, painel Connect), ler um capítulo no web e ver o progresso aparecer no app após "Sincronizar agora"; exportar o log.

## Arquivos
- Criar: `apps/mobile/app/settings/{storage,queue,bind,diagnostics}.tsx`, `apps/mobile/src/settings/format.ts`, `apps/mobile/src/settings/__tests__/*`
- Modificar: `apps/mobile/app/settings/index.tsx`, `apps/mobile/package.json` (`expo-sharing`)

## Fora do escopo
Mudar o comportamento do web.

## Commit
`Add storage, queue, bind and diagnostics settings screens`
