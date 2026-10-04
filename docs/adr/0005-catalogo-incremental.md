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
