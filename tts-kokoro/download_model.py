"""
Baixa os pesos e as vozes do Kokoro-82M num commit FIXO do Hugging Face e confere o SHA256.

Por que fixo: em 18/11/2026 houve um incidente com a conta que hospeda o modelo
(aviso no README do Kokoro-FastAPI). O commit abaixo é de 10/04/2025, anterior a ele,
e os hashes esperados são os publicados no próprio repositório nesse commit
(model card e VOICES.md). Se algum arquivo não bater, a instalação para.

Uso:  uv run python download_model.py
"""

from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path

REPO = "hexgrad/Kokoro-82M"
REVISION = "f3ff3571791e39611d31c381e3a41a3af07b4987"  # 2025-04-10
MODELS_DIR = Path(__file__).parent / "models"

# Hash completo ou prefixo publicado (VOICES.md traz só os 8 primeiros caracteres).
FILES: dict[str, str] = {
    # Model card: "Model SHA256 Hash"
    "kokoro-v1_0.pth": "496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4",
    # VOICES.md, seção Brazilian Portuguese
    "voices/pf_dora.pt": "07e4ff98",
    "voices/pm_alex.pt": "cf0ba8c5",
    "voices/pm_santa.pt": "d4210316",
    # Sem hash publicado: JSON de configuração (não executável); fixado aqui no primeiro download (21/11/2026).
    "config.json": "5abb01e2403b072bf03d04fde160443e209d7a0dad49a423be15196b9b43c17f",
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(name: str) -> Path:
    dest = MODELS_DIR / name
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://huggingface.co/{REPO}/resolve/{REVISION}/{name}"
    tmp = dest.with_suffix(dest.suffix + ".part")
    print(f"baixando {name} ...", flush=True)
    urllib.request.urlretrieve(url, tmp)
    tmp.rename(dest)
    return dest


def main() -> int:
    ok = True
    for name, expected in FILES.items():
        path = download(name)
        digest = sha256(path)
        if expected and not digest.startswith(expected):
            print(f"ERRO: {name} tem SHA256 {digest}, esperado {expected}…  Arquivo removido.", file=sys.stderr)
            path.unlink()
            ok = False
        else:
            status = "conferido" if expected else "sem hash publicado"
            print(f"ok  {name}  {digest[:16]}…  ({status})")
    if not ok:
        print("Download interrompido: algum arquivo não confere com o hash publicado.", file=sys.stderr)
        return 1
    print(f"Modelo pronto em {MODELS_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
