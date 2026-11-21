---
paths:
  - "**/test/**"
  - "**/tests/**"
  - "**/*.test.*"
  - "**/*_test.*"
---

# Testes

- Teste prova **comportamento observável**, não implementação.
- Teste que não falha quando você quebra o código de propósito não é teste.
- Credencial vem do ambiente de execução, **nunca por argv** e nunca impressa.
- Um teste novo acompanha toda correção de bug: ele deve falhar antes do fix.
- Motores (STT, LLM, TTS) são testados com as versões falsas de `server/src/infra/engines/fake/`: nenhum teste chama fornecedor real nem precisa de chave.
- Banco nos testes: `SqliteDataSource(':memory:')` ou `buildInMemoryApp()` de `server/src/testing/inMemoryApp.ts`.
