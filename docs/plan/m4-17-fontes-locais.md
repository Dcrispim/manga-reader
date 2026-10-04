# M4-17 — Fontes locais (pastas do aparelho via SAF)

**Marco:** mobile v1 · **Depende de:** M4-16 (spike aprovado ou M4-16b concluído), M4-09, M4-14

## Objetivo
O usuário adiciona uma pasta do aparelho no formato `título/capítulo/imagens` como fonte de dados. O app a varre com progresso, sem bloquear o uso, mescla os títulos dela ao catálogo e lê as páginas direto da pasta, com prioridade máxima. Tudo somente leitura e fora da gestão de espaço.

## Contexto mínimo
- O adapter `safFs.ts` (M4-16) implementa o `FsAdapter`. O scanner é o `scanLibrary(fs, root, { since, onProgress, signal })` do `@manga/core`, que devolve `{ titles: TitleScan[], allTitleNames, scannedAt }` com `TitleScan = { name, mtimeMs, metaMtimeMs, thumbMtimeMs, metadata, chapters: [{ id, number, pages, mtimeMs }], ignored[] }`.
- Tabelas (M4-03):
  - `sources(id, kind='saf', root /* URI da árvore */, label, status 'ok'|'unavailable'|'scanning', last_scan_at, scan_cursor, ignored_json)`;
  - `chapter_sources(title, chapter, source_id, location /* URI da pasta do capítulo */, pages, mtime_ms)`;
  - `titles`.
- Regras:
  - **somente leitura**: nunca escrever, mover ou apagar na pasta;
  - fora da evicção e do cache transitório;
  - título com o mesmo nome do servidor = **o mesmo título** (chave `titles.name`);
  - metadados: os do servidor prevalecem se existirem; senão, os do `.meta` local;
  - capa: a local (`.thumb/<t>.jpg`, ou a 1ª página do capítulo de menor número) só se não houver capa do servidor.
- Varredura:
  - a primeira é completa;
  - tela de progresso com títulos e capítulos encontrados, e os botões **Cancelar** e **Continuar em segundo plano**;
  - sair da tela não cancela a varredura;
  - os títulos já processados aparecem no catálogo à medida que a varredura avança;
  - retomada: `scan_cursor` guarda o último título concluído (a varredura processa os títulos em ordem alfabética), então uma varredura interrompida (app fechado) continua dali;
  - as seguintes são incrementais (`since = last_scan_at`): ao abrir o app e pelo botão "Varrer de novo".
- Pasta indisponível (permissão revogada ou cartão removido): `status='unavailable'`, e os capítulos dessa fonte deixam de ser oferecidos (o resolvedor ignora a fonte). Sem erro: um aviso na tela de fontes, com a ação "Escolher a pasta de novo".
- Pastas fora do padrão: vão para `ignored_json`, e a tela mostra "N pastas ignoradas" com a lista.
- Remoções: os títulos e capítulos que sumiram da pasta perdem as linhas `chapter_sources` daquela fonte.

## Início
- M4-16 concluído com o critério aprovado.

## Meio
1. `apps/mobile/src/sources/repo.ts`: `addSafSource` (pede a permissão pelo seletor e persiste a URI), `removeSource` (apaga as linhas `chapter_sources` da fonte; o `titles` órfão é removido se não tiver outra fonte, download nem histórico) e `listSources`.
2. `apps/mobile/src/sources/scan.ts`: `scanSource(sourceId, { full })`, com grava por título numa transação, atualização do `scan_cursor`, `AbortController`, um store de progresso observável e a captura de qualquer erro (que vira `status='unavailable'` ou entra em `ignored`).
3. Ligar ao resolvedor: implementar o `localPageProvider` de M4-09, que lista as imagens da pasta do capítulo pelo `safFs` com `sortImageFiles`/`isImageFile` do core e devolve URIs `content://` (o `expo-image` aceita).
4. Ligar ao ciclo (M4-13): a varredura incremental de todas as fontes `ok` ao abrir o app, **somente em primeiro plano**.
5. Telas: `app/sources/index.tsx` (lista de fontes com status, última varredura, ignoradas e os botões Adicionar, Varrer de novo e Remover) e `app/sources/scan/[id].tsx` (o progresso).
6. Testes, usando o `memoryFs` do core no lugar do `safFs`:
   - a primeira varredura popula as tabelas;
   - interrupção no meio e retomada pelo cursor;
   - incremental (só o título alterado);
   - título com o mesmo nome do servidor mesclado, com a capa do servidor preservada;
   - fonte indisponível;
   - removeSource;
   - o resolvedor dá prioridade ao local sobre o download.

## Fim
- Testes passando.
- No aparelho: adicionar `/sdcard/Download/manga-spike` (de M4-16), sair da tela durante a varredura, ver os títulos aparecendo no Início, ler um capítulo local **com o servidor desligado** e revogar a permissão (Configurações do Android): a fonte aparece como indisponível, sem crash.

## Arquivos
- Criar: `apps/mobile/src/sources/{repo.ts,scan.ts}`, `apps/mobile/app/sources/index.tsx`, `apps/mobile/app/sources/scan/[id].tsx`, `apps/mobile/src/sources/__tests__/*`
- Modificar: `apps/mobile/src/reader/resolve.ts`, `apps/mobile/src/sync/cycle.ts`

## Fora do escopo
Escrita em pastas locais. Fontes locais em segundo plano.

## Commit
`Add read-only local library sources via SAF`
