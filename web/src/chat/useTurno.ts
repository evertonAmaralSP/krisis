import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client.ts';
import { appendTurn } from '../api/queries.ts';

/**
 * Estados do turno. Na etapa 1 só o caminho por texto existe:
 * pronto → pensando → pronto (ou erro). Gravando, transcrevendo e falando
 * entram nas etapas 2 e 3, sem mudar este contrato.
 */
export type TurnState = 'pronto' | 'gravando' | 'transcrevendo' | 'pensando' | 'falando' | 'erro';

export function useTurno(interviewId: string) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: (content: string) => api.sendMessage(interviewId, { content, inputMode: 'text' }),
    onMutate: (content) => setPending(content),
    onSuccess: (turn) => {
      appendTurn(qc, interviewId, turn);
      setPending(null);
    },
  });

  const state: TurnState = send.isPending ? 'pensando' : send.isError ? 'erro' : 'pronto';

  return {
    state,
    /** Fala do candidato ainda não confirmada pelo servidor. */
    pending,
    error: send.error,
    sendText: (content: string) => send.mutate(content),
    retry: () => pending && send.mutate(pending),
    discard: () => {
      setPending(null);
      send.reset();
    },
  };
}
