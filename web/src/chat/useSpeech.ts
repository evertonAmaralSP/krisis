import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type SpeechChunk } from '../api/client.ts';

/**
 * Toca a fala do entrevistador frase a frase: pede a parte 0, toca, e enquanto
 * toca já pede a parte seguinte. Como a síntese é mais rápida que a fala,
 * as frases emendam sem silêncio.
 */
export function useSpeech(onFirstPart?: (messageId: string, ms: number) => void) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  /** Voz pedida para a reprodução atual (undefined = padrão). */
  const [playingVoice, setPlayingVoice] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const tokenRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onFirstPartRef = useRef(onFirstPart);
  onFirstPartRef.current = onFirstPart;

  const stop = useCallback(() => {
    tokenRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.dispatchEvent(new Event('ended')); // libera quem espera o fim
    }
    audioRef.current = null;
    setPlayingId(null);
  }, []);

  useEffect(() => stop, [stop]);

  const playBlob = (blob: Blob, token: number) =>
    new Promise<void>((resolve, reject) => {
      if (token !== tokenRef.current) return resolve();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      const done = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.addEventListener('ended', done, { once: true });
      audio.addEventListener('error', done, { once: true });
      audio.play().catch((err) => {
        URL.revokeObjectURL(url);
        reject(err);
      });
    });

  const play = useCallback(
    async (messageId: string, voice?: string) => {
      stop();
      const token = ++tokenRef.current;
      setPlayingId(messageId);
      setPlayingVoice(voice);
      setError(null);
      const fetchPart = (part: number) => {
        const p = api.speech(messageId, part, voice);
        p.catch(() => {}); // pré-busca descartada não vira erro solto
        return p;
      };
      try {
        let part = 0;
        let next: Promise<SpeechChunk> | null = fetchPart(0);
        while (next) {
          const chunk: SpeechChunk = await next;
          if (token !== tokenRef.current) return;
          if (part === 0 && voice === undefined) onFirstPartRef.current?.(messageId, chunk.ms);
          next = part + 1 < chunk.parts ? fetchPart(part + 1) : null;
          await playBlob(chunk.blob, token);
          if (token !== tokenRef.current) return;
          part += 1;
        }
      } catch (err) {
        if (token !== tokenRef.current) return;
        if (err instanceof ApiError && err.code === 'TTS_DISABLED') setDisabled(true);
        else if (err instanceof DOMException && err.name === 'NotAllowedError')
          setError('O navegador bloqueou o som automático. Clique em "Ouvir" na mensagem.');
        else setError(`Voz indisponível: ${(err as Error).message}`);
      } finally {
        if (token === tokenRef.current) {
          audioRef.current = null;
          setPlayingId(null);
        }
      }
    },
    [stop],
  );

  return { playingId, playingVoice, error, disabled, play, stop, clearError: () => setError(null) };
}
