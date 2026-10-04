# 0005 — Catálogo incremental e health

**Data:** 2026-10-04 · **Status:** Aceito

## Contexto

Servidor pode servir até 200 títulos × 400 capítulos. Catálogo completo ocuparia espaço precioso no app; sincronização precisa ser eficiente.

## Decisão

Catálogo sincroniza ativo via **`GET /api/catalog?since=<timestamp>`** (incremental). Fora do orçamento de espaço. **`GET /api/health`** retorna `{ serverId?, version, features: string[] }`. `serverId` em arquivo `SERVER_ID_PATH` (padrão `<MANGA_ROOT>/.server-id`).

## Consequências

- **Sincronização eficiente**: Só novas/mudanças desde `since` trafegam. Sem limite de catálogo.
- **Identificação do servidor**: `serverId` permite rastrear "qual servidor estou conectado"; útil para sync descentralizada futura.
- **Health check simples**: `/api/health` é o primeiro GET para validar conexão.
- **Catálogo não consome quota**: Pode ser recriado a qualquer momento; apenas metadados sobre títulos sincronizam.

## Medições do `GET /api/catalog` (M3-03)

Biblioteca sintética 200 títulos × 400 capítulos × 15 páginas (1,2 mi de arquivos `.jpg` vazios), em btrfs (NVMe), arquivos recém-criados (cache de diretórios quente), via `buildCatalog` (`PERF=1`, `test/perf/catalog.perf.test.ts`):

| Chamada | Tempo | Meta |
| --- | --- | --- |
| Completa (`since=0`) | ~9,0 s | < 60 s |
| Incremental (`since=serverTime`) | ~6 ms | < 300 ms |

Tamanho da resposta completa: 5.274.242 B (JSON) → **383.488 B (~375 KB) com gzip**. Medido em Node (`zlib.gzipSync` sobre o JSON), não via HTTP/`curl --compressed`.

Notas:
- Cache em memória por título (chave = mtimes da pasta, `.metadata` e `.thumb`): dois clientes com `since=0` não recontam páginas de títulos inalterados. Como o scanner, não enxerga páginas adicionadas dentro de um capítulo existente até o servidor reiniciar.
- `serverTime` é capturado antes da varredura, então mudanças durante ela aparecem na próxima chamada.
- A varredura completa a frio (cache de diretórios do SO frio) pode ser bem mais lenta que a medida acima.

## Medições contra a biblioteca real (M3-04)

Imagem `manga-reader:monorepo-test` em container efêmero (porta 3994, biblioteca real `/mnt/d/manga` somente leitura, 59 títulos), via `scripts/smoke.sh --new-only` (curl, sem compressão):

| Chamada | Tempo |
| --- | --- |
| `since=0`, primeira chamada (cache do servidor frio) | ~6,2 s |
| `since=0`, segunda chamada (cache por título quente) | ~0,03 s |
| `since=<serverTime>` | ~0,012–0,016 s |
