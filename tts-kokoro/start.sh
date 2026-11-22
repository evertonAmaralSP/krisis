#!/usr/bin/env bash
# Sobe o serviço de voz se ele estiver instalado; senão explica como instalar e sai sem derrubar o resto.
set -uo pipefail
cd "$(dirname "$0")"

# Lê do .env da raiz só as variáveis da voz (sem "source": o hash da senha tem $).
if [ -f ../.env ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      TTS_ENGINE|TTS_THREADS|KOKORO_PORT|KOKORO_BASE_URL) [ -z "${!key:-}" ] && export "$key=${value//[\"\']/}" ;;
    esac
  done < <(grep -E '^(TTS_ENGINE|TTS_THREADS|KOKORO_PORT|KOKORO_BASE_URL)=' ../.env)
fi
# A porta vem do mesmo KOKORO_BASE_URL que a API usa (KOKORO_PORT só sobrescreve, se definida).
URL_PORT="$(printf '%s' "${KOKORO_BASE_URL:-}" | sed -nE 's#^https?://[^/:]+:([0-9]+).*#\1#p')"
PORT="${KOKORO_PORT:-${URL_PORT:-8880}}"

if [ "${TTS_ENGINE:-kokoro}" != "kokoro" ]; then
  echo "[voz] TTS_ENGINE=${TTS_ENGINE}: serviço Kokoro não será iniciado."
  exit 0
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "[voz] 'uv' não encontrado. Instale (https://docs.astral.sh/uv/) e rode: npm run tts:setup"
  exit 0
fi
if [ ! -f models/kokoro-v1_0.pth ]; then
  echo "[voz] Modelo não instalado. Rode uma vez: npm run tts:setup"
  exit 0
fi
exec uv run uvicorn app:app --host 127.0.0.1 --port "$PORT" --log-level warning
