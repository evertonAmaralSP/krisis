"""
Kokoro carregado só de arquivos locais (models/), conferidos por download_model.py.
Português do Brasil: lang_code 'p', fonemas pelo espeak-ng pt-br.
"""

from __future__ import annotations

import os
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")

import numpy as np  # noqa: E402
import torch  # noqa: E402
from kokoro import KModel, KPipeline  # noqa: E402

MODELS_DIR = Path(__file__).parent / "models"
REPO_ID = "hexgrad/Kokoro-82M"
SAMPLE_RATE = 24_000
VOICES = ("pf_dora", "pm_alex", "pm_santa")


class KokoroEngine:
    def __init__(self, models_dir: Path = MODELS_DIR) -> None:
        config = models_dir / "config.json"
        weights = models_dir / "kokoro-v1_0.pth"
        if not weights.exists():
            raise FileNotFoundError(
                f"Modelo não encontrado em {models_dir}. Rode: uv run python download_model.py"
            )
        self.models_dir = models_dir
        model = KModel(repo_id=REPO_ID, config=str(config), model=str(weights)).to("cpu").eval()
        self.pipeline = KPipeline(lang_code="p", repo_id=REPO_ID, model=model, device="cpu")

    def voice_path(self, voice: str) -> str:
        if voice not in VOICES:
            raise ValueError(f"Voz desconhecida: {voice}. Disponíveis: {', '.join(VOICES)}.")
        return str(self.models_dir / "voices" / f"{voice}.pt")

    @torch.inference_mode()
    def synthesize(self, text: str, voice: str, speed: float = 1.0) -> np.ndarray:
        """Devolve o áudio mono float32 a 24 kHz."""
        chunks = [
            result.audio.cpu().numpy()
            for result in self.pipeline(text, voice=self.voice_path(voice), speed=speed)
            if result.audio is not None
        ]
        if not chunks:
            return np.zeros(0, dtype=np.float32)
        return np.concatenate(chunks).astype(np.float32)
