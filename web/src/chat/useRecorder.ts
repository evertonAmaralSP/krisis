import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_RECORDING_SECONDS = 5 * 60;
export const MIN_RECORDING_SECONDS = 1;
/** Abaixo disso a gravação é tratada como silêncio e nem é enviada. */
export const SILENCE_PEAK = 0.06;
const BARS = 16;

export interface Recording {
  blob: Blob;
  mimeType: string;
  filename: string;
  seconds: number;
  /** Maior nível de som percebido (0–1). Perto de 0 = silêncio ou microfone mudo. */
  peak: number;
}

/** Formatos em ordem de preferência. Chrome/Firefox: webm/opus; Safari: mp4. */
const CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

function extensionOf(mimeType: string) {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

export class RecorderError extends Error {}

function explain(err: unknown): RecorderError {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new RecorderError(
      'O navegador não liberou o microfone. Clique no ícone de cadeado na barra de endereço, permita o microfone e tente de novo.',
    );
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new RecorderError('Nenhum microfone encontrado. Conecte um microfone e tente de novo.');
  }
  if (name === 'NotReadableError') {
    return new RecorderError('O microfone está em uso por outro programa. Feche-o e tente de novo.');
  }
  return new RecorderError('Não foi possível iniciar a gravação.');
}

/**
 * Encapsula getUserMedia + MediaRecorder. Expõe o tempo gravado e o nível
 * do som em barras (para as ondas da tela). Para sozinho no limite máximo.
 */
export function useRecorder(onAutoStop?: () => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.08));

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const peakRef = useRef(0);
  const analysedRef = useRef(false);
  const stopPromiseRef = useRef<Promise<Recording> | null>(null);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const autoStopRef = useRef(onAutoStop);
  autoStopRef.current = onAutoStop;

  const release = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    timerRef.current = null;
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    setLevels(Array(BARS).fill(0.08));
  }, []);

  useEffect(() => release, [release]);

  const start = useCallback(async () => {
    const mimeType = pickMimeType();
    if (!navigator.mediaDevices?.getUserMedia || !mimeType) {
      throw new RecorderError('Este navegador não grava áudio. Use o Chrome, o Edge ou o Firefox atualizados.');
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (err) {
      throw explain(err);
    }
    streamRef.current = stream;
    chunksRef.current = [];
    peakRef.current = 0;
    analysedRef.current = false;
    stopPromiseRef.current = null;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start(250);
    } catch {
      // Não deixa o microfone aberto se o gravador não iniciar.
      release();
      throw new RecorderError('Este navegador não conseguiu iniciar a gravação. Tente o Chrome ou o Edge atualizados.');
    }
    startedAtRef.current = performance.now();
    setSeconds(0);
    setRecording(true);

    timerRef.current = window.setInterval(() => {
      const s = (performance.now() - startedAtRef.current) / 1000;
      setSeconds(Math.floor(s));
      if (s >= MAX_RECORDING_SECONDS) {
        // Dispara uma vez só.
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;
        autoStopRef.current?.();
      }
    }, 250);

    // Nível do som para as ondas (só visual; não afeta o arquivo).
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      // Depois da janela de permissão o contexto pode nascer pausado (Safari, política de autoplay).
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let last = 0;
      const tick = (t: number) => {
        rafRef.current = requestAnimationFrame(tick);
        if (t - last < 80) return;
        last = t;
        // Contexto pausado devolve zeros: não conta como análise, para não acusar silêncio falso.
        if (ctx.state !== 'running') return;
        analyser.getByteFrequencyData(data);
        analysedRef.current = true;
        const step = Math.floor(data.length / BARS);
        setLevels(
          Array.from({ length: BARS }, (_, i) => {
            let sum = 0;
            for (let j = 0; j < step; j++) sum += data[i * step + j]!;
            const level = Math.min(1, sum / step / 160);
            if (level > peakRef.current) peakRef.current = level;
            return Math.max(0.08, level);
          }),
        );
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      /* sem visualização: a gravação continua */
    }
  }, []);

  /** Para e devolve o arquivo. */
  const stop = useCallback((): Promise<Recording> => {
    // Clique duplo ou parada automática junto com o clique: devolve a mesma parada.
    if (stopPromiseRef.current) return stopPromiseRef.current;
    const promise = new Promise<Recording>((resolve, reject) => {
        const recorder = recorderRef.current;
        if (!recorder) return reject(new RecorderError('Nenhuma gravação em andamento.'));
        const elapsed = (performance.now() - startedAtRef.current) / 1000;
        recorder.onstop = () => {
          const mimeType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: mimeType });
          release();
          resolve({
            blob,
            mimeType,
            filename: `fala.${extensionOf(mimeType)}`,
            seconds: Math.round(elapsed * 10) / 10,
            // Sem análise disponível, não bloqueia: assume que houve som.
            peak: analysedRef.current ? peakRef.current : 1,
          });
        };
        recorder.stop();
      });
    stopPromiseRef.current = promise;
    return promise;
  }, [release]);

  /** Descarta a gravação em andamento. */
  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
    }
    release();
  }, [release]);

  return { recording, seconds, levels, start, stop, cancel };
}
