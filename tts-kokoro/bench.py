"""
Mede o tempo de síntese em CPU e grava amostras de cada voz.

Uso:  uv run python bench.py [pasta_saida]
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")  # nunca baixa nada: só arquivos locais conferidos

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
import torch  # noqa: E402

from engine import KokoroEngine, SAMPLE_RATE  # noqa: E402

TEXT = (
    "Interessante. Qual foi a maior dificuldade técnica nessa migração "
    "e como você chegou à arquitetura final? Me conte também como mediu o resultado."
)
SENTENCES = [
    "Interessante.",
    "Qual foi a maior dificuldade técnica nessa migração e como você chegou à arquitetura final?",
    "Me conte também como mediu o resultado.",
]


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "amostras")
    out.mkdir(parents=True, exist_ok=True)
    print(f"torch {torch.__version__} · threads {torch.get_num_threads()}")

    t0 = time.perf_counter()
    engine = KokoroEngine()
    print(f"carga do modelo: {time.perf_counter() - t0:.2f} s")

    for voice in ("pf_dora", "pm_alex"):
        engine.synthesize("Aquecendo.", voice)  # primeira chamada carrega a voz e aquece
        times = []
        for _ in range(3):
            t = time.perf_counter()
            audio = engine.synthesize(TEXT, voice)
            times.append(time.perf_counter() - t)
        dur = len(audio) / SAMPLE_RATE
        best, avg = min(times), sum(times) / len(times)
        print(f"{voice}: texto inteiro {avg:.2f} s em média (melhor {best:.2f} s) para {dur:.1f} s de áudio · fator {avg / dur:.2f}x")

        first = time.perf_counter()
        engine.synthesize(SENTENCES[0], voice)
        print(f"{voice}: primeira frase sozinha {time.perf_counter() - first:.2f} s")

        sf.write(out / f"{voice}.wav", audio.astype(np.float32), SAMPLE_RATE)
    print(f"amostras em {out.resolve()}")


if __name__ == "__main__":
    main()
