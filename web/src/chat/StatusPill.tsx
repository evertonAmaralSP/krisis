import { formatDuration } from '../lib/format.ts';
import type { TurnState } from './useTurno.ts';
import styles from './Chat.module.css';

const LABEL: Record<TurnState, string> = {
  pronto: 'Pronto. Clique em Falar ou digite sua resposta.',
  gravando: 'Gravando',
  transcrevendo: 'Transcrevendo sua fala…',
  pensando: 'O entrevistador está pensando…',
  falando: 'Entrevistador falando',
  erro: 'Veja o aviso acima.',
};

export function StatusPill({ state, seconds }: { state: TurnState; seconds: number }) {
  return (
    <span role="status" aria-live="polite" className={styles.status} data-state={state}>
      <span className={styles.statusDot} />
      {state === 'gravando' ? `${LABEL.gravando} · ${formatDuration(seconds)} · Esc cancela` : LABEL[state]}
    </span>
  );
}
