# 0007 — Bind reutilizado para progresso

**Data:** 2026-10-04 · **Status:** Aceito

## Contexto

Servidor já tem mecanismo de `bind` (compartilhamento de progresso via código de 6 caracteres). App precisa sincronizar progresso. Contrato REST é estável em produção.

## Decisão

**Reutilizar o bind existente** para sincronizar histórico e progresso. Contrato inalterado. **Posição de página adiada** para v1.1+ (fora da v1).

## Consequências

- **Compatibilidade**: Contrato REST não muda; servidor existente funciona sem alteração.
- **Progresso sincronizado**: App push/pull histórico de leitura via bind (mesma API que web).
- **Recurso futuro**: Posição pixel-perfeita de página é nice-to-have; v1 usa apenas "lido" = presente no histórico mesclado.
- **Flexibilidade**: Bind pode evoluir sem quebrar v1 (novos campos são opcionais).
