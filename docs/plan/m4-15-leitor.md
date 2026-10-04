# M4-15 — Tela do leitor

**Marco:** mobile v1 · **Depende de:** M4-09, M4-10, M4-12, M4-14

## Objetivo
Ler um capítulo com scroll vertical e zoom por pinça, usando a melhor origem de cada página, com fallback limpo por página e a tela "indisponível offline" com a ação "Baixar quando disponível". A tela registra o histórico e navega para o próximo capítulo.

## Contexto mínimo
- `resolveChapterPages({ title, chapter, quality })` (M4-09) devolve `{ pages: PageSource[] }` ou `{ unavailable: true }`. Uma página `remote` deve ser exibida e, em paralelo, gravada no cache transitório com `fetchToTransient`.
- Ao abrir o capítulo:
  - `recordOpen(title, chapter)` (M4-12);
  - definir o capítulo aberto (`reader/openChapter.ts`, M4-08) para protegê-lo da evicção;
  - se `downloads.autoNext` estiver ligado, enfileirar o próximo capítulo (`enqueue`, M4-10).
- Falha de página: placeholder com a proporção 0,7 (ou a última proporção conhecida) e o texto "Toque para tentar de novo". Tentar de novo automaticamente quando o status do servidor mudar para `online`. Nunca toast vermelho nem alerta.
- Toggle "Original / Upscaled": só aparece quando o servidor está online e `GET /xl` tem páginas. Com qualidade `xl` e offline, cair para `original` silenciosamente.
- Próximo capítulo: o próximo número na lista de capítulos do título. Se houver um salto (ex.: 10 → 12), mostrar a confirmação "Pular capítulos 11?", que é o comportamento do web.
- Tela indisponível: "Este capítulo não está disponível offline", com os botões **Baixar quando disponível** (`enqueue`) e **Voltar**. Se o job já existir, mostrar o progresso dele.
- Zoom: `react-native-gesture-handler` + `react-native-reanimated` (pinça e duplo toque), aplicados ao contêiner da lista. Se o zoom por página com `FlatList` ficar instável, usar uma lib consolidada de zoom em listas e registrar a escolha no commit.
- Lista: `FlatList` vertical com `expo-image` (`contentFit="contain"`, largura total e altura pela proporção real após o `onLoad`), `windowSize` baixo para economizar memória.

## Início
- M4-14 commitado.

## Meio
1. `apps/mobile/app/read/[title]/[chapter].tsx`: a tela.
2. `apps/mobile/src/reader/{PageImage.tsx,ZoomableList.tsx,UnavailableChapter.tsx,useChapter.ts,nextChapter.ts}`.
3. `nextChapter.ts` (puro): `nextChapter(chapters: string[], current): { next: string | null; skipped: string[] }`.
4. Testes:
   - `nextChapter` (sequência normal, salto, último capítulo, números decimais como 1.5);
   - `useChapter` com fakes (unavailable, remote → transient, download);
   - `PageImage` mostra o placeholder no `onError` e tenta de novo ao tocar.

## Fim
- Testes passando.
- No emulador:
  - ler online um capítulo não baixado: as páginas aparecem e o capítulo passa a contar como "em cache";
  - desligar o servidor, reabrir o mesmo capítulo: abre pelo cache;
  - abrir um capítulo nunca visto: tela "indisponível" e, ao tocar em "Baixar quando disponível", o job aparece;
  - religar o servidor: o job conclui;
  - pinça funciona;
  - o próximo capítulo com salto pede confirmação.
- Nenhuma tela de erro em nenhum desses casos.

## Arquivos
- Criar: os arquivos dos passos 1 a 3 e `apps/mobile/src/reader/__tests__/*`
- Modificar: `apps/mobile/package.json` (gesture-handler, reanimated, se ainda não houver), `apps/mobile/babel.config.js` (plugin do reanimated, se necessário)

## Fora do escopo
Páginas duplas, deform, PSRT e posição de página (fora da v1).

## Commit
`Add the chapter reader with per-page fallback and offline queueing`
