# 0001 — App Android Nativo

**Data:** 2026-10-04 · **Status:** Aceito

## Contexto

Optamos entre uma aplicação web nativa (PWA, HTTPS com service workers) e um app Android nativo com React Native + Expo.

## Decisão

Implementar um **app Android nativo** (Expo + React Native, offline-first) em vez de PWA em HTTPS.

## Consequências

- **Acesso ao filesystem local**: SAF (Storage Access Framework) para importar bibliotecas locais; offline-first com SQLite.
- **Play Store**: Distribuição via Play Store após v1 (APK local em v1).
- **Rede controlada**: App controla requisições HTTP; UI lê sempre do SQLite local, nunca diretamente da rede.
- **Segurança**: PWA não funciona em contexto sem HTTPS; Android descarta a aba sem secure context (impossível em rede local). Nativo evita essa restrição.
