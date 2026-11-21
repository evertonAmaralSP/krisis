---
paths:
  - "**/values.yaml"
  - "**/deployment.yaml"
  - "**/statefulset.yaml"
---

# Manifestos e charts

- **Probes** (`liveness`, `readiness`, `startup`) são obrigatórios. Sem exceção silenciosa.
- **Limits de CPU e memória** sempre declarados, diferenciados por ambiente.
  Baseie os valores na documentação oficial do componente, não em chute.
- **`securityContext`**: `runAsNonRoot: true` e `capabilities.drop: ["ALL"]`.
- Deployment com volume `RWO` usa `strategy.type: Recreate` — `RollingUpdate`
  trava no attach do disco.
- ConfigMap montado como arquivo quebra app que faz `chown`/escrita no caminho:
  nesse caso use variável de ambiente.
