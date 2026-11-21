#!/usr/bin/env bash
# PreToolUse / matcher "Bash" — bloqueia remoção em massa e curinga em comando destrutivo.
#
# POR QUE UM HOOK E NÃO permissions.deny:
#   regras de permissão casam por PREFIXO ("Bash(git *)"). Elas NÃO enxergam um
#   "--all" no meio do comando ("kubectl delete pods -n <namespace> --all"). O hook lê a
#   linha inteira e casa por regex, então é a única camada que garante a regra.
#
# CONTRATO: recebe o JSON do PreToolUse em stdin; para bloquear, imprime
# hookSpecificOutput.permissionDecision="deny" e sai com 0.
# Requer `jq`.

set -uo pipefail

cmd="$(jq -r '.tool_input.command // empty' 2>/dev/null)"
[ -z "$cmd" ] && exit 0

deny() {
  jq -n --arg r "$1" --arg c "$cmd" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ($r + " Comando: " + $c + " — identifique o recurso NOMINALMENTE e repita sem curinga.")
    }
  }'
  exit 0
}

# 1) rm com curinga (rm *, rm -rf ./algo/*, rm -f *.yaml)
if printf '%s' "$cmd" | grep -qE '(^|[|;&]|\s)rm\s+(-[[:alnum:]-]+\s+)*[^|;&]*\*'; then
  deny "BLOQUEADO: 'rm' com curinga."
fi

# 2) exclusão em massa em kubectl / helm (--all, --all-namespaces)
if printf '%s' "$cmd" | grep -qE '(^|[|;&]|\s)kubectl\s+delete\b[^|;&]*(--all\b|--all-namespaces\b|-A\b)'; then
  deny "BLOQUEADO: 'kubectl delete' com --all/-A."
fi
if printf '%s' "$cmd" | grep -qE '(^|[|;&]|\s)helm\s+(uninstall|delete)\b[^|;&]*--all\b'; then
  deny "BLOQUEADO: 'helm uninstall/delete' com --all."
fi

# 3) DDL destrutivo em banco — so quando ha um CLIENTE de banco na linha, senao
#    'grep -r "drop table"' viraria falso positivo e bloquearia leitura legitima.
if printf '%s' "$cmd" | grep -qE '(^|[|;&]|\s)(psql|mysql|mariadb|sqlcmd|clickhouse-client|trino|beeline|mongosh|sqlite3)\b' \
   && printf '%s' "$cmd" | grep -qiE '\b(drop\s+(database|schema|table)|truncate\s+table)\b'; then
  deny "BLOQUEADO: DDL destrutivo (DROP/TRUNCATE) via cliente de banco."
fi

# 4) terraform destroy
if printf '%s' "$cmd" | grep -qE '(^|[|;&]|\s)terraform\s+destroy\b'; then
  deny "BLOQUEADO: 'terraform destroy'."
fi

# 5) push forçado — --force-with-lease é permitido (não sobrescreve trabalho alheio)
if printf '%s' "$cmd" | grep -qE '(^|[|;&]|\s)git\s+push\b[^|;&]*(\s-f\b|--force([^-]|$))'; then
  deny "BLOQUEADO: 'git push --force'. Use --force-with-lease."
fi

exit 0
