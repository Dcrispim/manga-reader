# 0004 — Gestão de espaço com evicção

**Data:** 2026-10-04 · **Status:** Aceito

## Contexto

Dispositivos móveis têm espaço limitado. Precisamos suportar até ~30 GB de biblioteca local (≈2.000 capítulos), com teto de downloads (2 GB) e cache transitório (300 MB).

## Decisão

**Downloads** (5 capítulos/título, 100 globais, teto 2 GB, piso 1 GB livre). **Evicção**: lidos primeiro, depois não lidos, cada grupo por `savedAt` mais antigo. Nunca evicta recém-salvo ou em leitura. **Cache transitório** (300 MB, LRU) separado dos downloads. Evicção roda também offline.

## Consequências

- **Espaço previsível**: 2 GB de downloads + 300 MB de cache = 2.3 GB máximo, com 1 GB de piso livre.
- **UX degradada previsível**: Usuário sabe quais capítulos estão baixados; nenhuma surpresa de "arquivo desapareceu".
- **Leitura contínua**: Capítulos em leitura nunca são evictados; cache transitório reutiliza-se.
- **Offline completo**: Evicção roda sem rede, garantindo espaço para sync quando reconectar.
