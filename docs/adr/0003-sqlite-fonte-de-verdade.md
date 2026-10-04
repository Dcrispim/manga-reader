# 0003 — SQLite como fonte de verdade

**Data:** 2026-10-04 · **Status:** Aceito

## Contexto

O app mobile precisa funcionar offline. Sincronização com servidor é eventual e pode falhar. A UI deve sempre responder sem erros de rede.

## Decisão

A **UI lê sempre do SQLite local**. Requisições HTTP ficam isoladas em **sync engines**; o cliente HTTP **nunca lança erro** para a UI.

## Consequências

- **Offline-first garantido**: UI não quebra se servidor cair ou rede desaparecer.
- **Erro controlado**: Sync engines lidam com falhas de rede internamente (retry, fila, timeout). UI vê apenas resultado final (sucesso ou UI degradada).
- **Sincronização eventual**: Catálogo, downloads, progresso sincronizam via engines. Falhas de sync não bloqueiam o usuário.
- **Arquitetura limpa**: Separação clara entre estado local (SQLite) e estado remoto (servidor). UI depende apenas do local.
