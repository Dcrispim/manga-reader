# 0006 — Fontes locais via SAF

**Data:** 2026-10-04 · **Status:** Aceito

## Contexto

Usuários querem ler mangás de cartorios locais (micro SD, USB). Android exige Storage Access Framework (SAF) para acesso a volumes não-primários; é requisito da Play Store.

## Decisão

Implementar **SAF (Storage Access Framework)** para importar bibliotecas locais **somente leitura**. Fora da gestão de espaço. Prioridade de leitura: local > baixado > cache > servidor. Spike previsto: 60 segundos para listar fontes na primeira execução.

## Consequências

- **Play Store compatível**: Sem acesso direto a `/sdcard/Download` (deprecated); SAF é o padrão moderno.
- **Sem cota**: Bibliotecas locais não consomem espaço gerenciado (2 GB downloads + 300 MB cache).
- **Leitura unificada**: Mesmo título em várias fontes = um título; prioridade evita duplicação.
- **Latência aceitável**: Listagem lenta (60s) na primeira execução; cache local reduz hits seguintes.
