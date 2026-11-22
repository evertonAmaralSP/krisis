import type { v1 } from '@krisis/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { api } from '../api/client.ts';
import { appendTurn } from '../api/queries.ts';
import { MIN_RECORDING_SECONDS, RecorderError, SILENCE_PEAK, useRecorder, type Recording } from './useRecorder.ts';

/**
 * Estados do turno:
 *   texto: pronto → pensando → pronto
 *   voz:   pronto → gravando → transcrevendo → pensando → pronto
 * Depois da resposta, a voz toca (estado "falando", controlado pelo useSpeech).
 * Qualquer passo pode ir para "erro".
 */
export type TurnState = 'pronto' | 'gravando' | 'transcrevendo' | 'pensando' | 'falando' | 'erro';

/** Fala do candidato ainda não confirmada pelo servidor. */
export interface PendingSpeech {
  content: string | null; // null enquanto transcreve
  inputMode: v1.InputMode;
  audioSeconds?: number;
  sttMs?: number;
}

interface Failure {
  message: string;
  /** Onde parou, para o "Tentar de novo" retomar do ponto certo. */
  retry: (() => void) | null;
}

export function useTurno(interviewId: string, options: { onReply?: (interviewerMessageId: string) => void } = {}) {
  const qc = useQueryClient();
  const [state, setState] = useState<TurnState>('pronto');
  const [pending, setPending] = useState<PendingSpeech | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const finishRef = useRef<() => void>(() => {});
  const onReplyRef = useRef(options.onReply);
  onReplyRef.current = options.onReply;
  // Entrevista aberta agora: uma resposta que chega depois de trocar de entrevista não toca.
  const currentIdRef = useRef(interviewId);
  currentIdRef.current = interviewId;
  const recorder = useRecorder(() => finishRef.current());

  const fail = (message: string, retry: Failure['retry']) => {
    setFailure({ message, retry });
    setState('erro');
  };

  const send = useCallback(
    async (speech: PendingSpeech & { content: string }) => {
      setPending(speech);
      setFailure(null);
      setState('pensando');
      try {
        const turn = await api.sendMessage(interviewId, {
          content: speech.content,
          inputMode: speech.inputMode,
          ...(speech.audioSeconds !== undefined && { audioSeconds: speech.audioSeconds }),
          ...(speech.sttMs !== undefined && { sttMs: speech.sttMs }),
        });
        appendTurn(qc, interviewId, turn);
        setPending(null);
        setState('pronto');
        if (currentIdRef.current === interviewId) onReplyRef.current?.(turn.interviewerMessage.id);
      } catch (err) {
        fail((err as Error).message, () => void send(speech));
      }
    },
    [interviewId, qc],
  );

  const transcribe = useCallback(
    async (rec: Recording) => {
      setPending({ content: null, inputMode: 'voice', audioSeconds: rec.seconds });
      setFailure(null);
      setState('transcrevendo');
      let result: v1.TranscriptionResponse;
      try {
        result = await api.transcribe(interviewId, rec.blob, rec.filename);
      } catch (err) {
        // Sem fala reconhecível: não há o que reenviar, só gravar de novo.
        const noSpeech = (err as { code?: string }).code === 'NO_SPEECH';
        if (noSpeech) setPending(null);
        fail((err as Error).message, noSpeech ? null : () => void transcribe(rec));
        return;
      }
      await send({ content: result.text, inputMode: 'voice', audioSeconds: rec.seconds, sttMs: result.sttMs });
    },
    [interviewId, send],
  );

  const finishRecording = useCallback(async () => {
    let rec: Recording;
    try {
      rec = await recorder.stop();
    } catch (err) {
      fail((err as Error).message, null);
      return;
    }
    if (rec.seconds < MIN_RECORDING_SECONDS) {
      setPending(null);
      fail('Gravação muito curta. Fale por pelo menos um segundo.', null);
      return;
    }
    if (rec.peak < SILENCE_PEAK) {
      setPending(null);
      fail('Não ouvi nada. Confira se o microfone certo está selecionado e se não está mudo.', null);
      return;
    }
    await transcribe(rec);
  }, [recorder, transcribe]);
  finishRef.current = () => void finishRecording();

  const startRecording = useCallback(async () => {
    setFailure(null);
    setPending(null);
    try {
      await recorder.start();
      setState('gravando');
    } catch (err) {
      fail(err instanceof RecorderError ? err.message : 'Não foi possível iniciar a gravação.', null);
    }
  }, [recorder]);

  const cancelRecording = useCallback(() => {
    recorder.cancel();
    setState('pronto');
  }, [recorder]);

  return {
    state,
    pending,
    error: failure?.message ?? null,
    canRetry: Boolean(failure?.retry),
    recordingSeconds: recorder.seconds,
    levels: recorder.levels,
    sendText: (content: string) => void send({ content, inputMode: 'text' }),
    startRecording,
    finishRecording,
    cancelRecording,
    retry: () => failure?.retry?.(),
    /** Descarta a fala que falhou e volta ao estado pronto. */
    discard: () => {
      setPending(null);
      setFailure(null);
      setState('pronto');
    },
  };
}
