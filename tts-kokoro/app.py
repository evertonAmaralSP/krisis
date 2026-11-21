"""
Serviço local de voz do KRISIS: Kokoro-82M exposto no formato da OpenAI.

    POST /v1/audio/speech   {"model": "kokoro", "input": "...", "voice": "pf_dora",
                             "response_format": "wav", "speed": 1.0}   →  audio/wav (24 kHz, 16 bits, mono)
    GET  /health            →  {"status": "ok", "voices": [...]}

Escuta só em 127.0.0.1. Uma síntese por vez, sempre na MESMA thread: em CPU, duas em paralelo só
disputam os núcleos, e trocar de thread faz o PyTorch reconfigurar o paralelismo a cada chamada (lento).

Rodar:  uv run uvicorn app:app --host 127.0.0.1 --port 8880
"""

from __future__ import annotations

import io
import logging
import os
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import Literal

import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from engine import SAMPLE_RATE, VOICES, KokoroEngine

log = logging.getLogger("tts-kokoro")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

MAX_INPUT_CHARS = 2000
_engine: KokoroEngine | None = None
_worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="kokoro")


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _engine
    started = time.perf_counter()

    def load() -> KokoroEngine:
        torch.set_num_threads(int(os.environ.get("TTS_THREADS", "8")))
        engine = KokoroEngine()
        for voice in VOICES:  # aquece cada voz: a primeira resposta não paga a carga
            engine.synthesize("Pronto.", voice)
        return engine

    _engine = await asyncio.get_running_loop().run_in_executor(_worker, load)
    log.info("Kokoro pronto em %.1f s · threads %d", time.perf_counter() - started, int(os.environ.get("TTS_THREADS", "8")))
    yield
    _worker.shutdown(wait=False)


app = FastAPI(title="KRISIS · voz local (Kokoro)", lifespan=lifespan)


class SpeechRequest(BaseModel):
    model: str = "kokoro"
    input: str = Field(min_length=1, max_length=MAX_INPUT_CHARS)
    voice: str = "pf_dora"
    response_format: Literal["wav"] = "wav"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


def _synthesize(req: SpeechRequest) -> tuple[bytes, float]:
    assert _engine is not None
    started = time.perf_counter()
    audio = _engine.synthesize(req.input, req.voice, req.speed)
    elapsed = time.perf_counter() - started
    buf = io.BytesIO()
    sf.write(buf, audio, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    return buf.getvalue(), elapsed


@app.post("/v1/audio/speech")
async def speech(req: SpeechRequest) -> Response:
    if req.voice not in VOICES:
        raise HTTPException(400, f"Voz desconhecida: {req.voice}. Disponíveis: {', '.join(VOICES)}.")
    if _engine is None:
        raise HTTPException(503, "Modelo ainda carregando.")
    wav, elapsed = await asyncio.get_running_loop().run_in_executor(_worker, _synthesize, req)
    log.info("voz=%s chars=%d síntese=%.0f ms", req.voice, len(req.input), elapsed * 1000)
    return Response(content=wav, media_type="audio/wav")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok" if _engine else "carregando", "voices": list(VOICES)}
