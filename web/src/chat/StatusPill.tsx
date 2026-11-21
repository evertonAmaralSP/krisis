import type { TurnState } from './useTurno.ts';
import styles from './Chat.module.css';

const LABEL: Record<TurnState, string> = {
  pronto: 'Pronto. Responda por texto ou, na próxima etapa, por voz.',
  gravando: 'Gravando…',
  transcrevendo: 'Transcrevendo sua fala…',
  pensando: 'O entrevistador está pensando…',
  falando: 'Entrevistador falando',
  erro: 'Não foi possível obter a resposta.',
};

export function StatusPill({ state }: { state: TurnState }) {
  return (
    <span role="status" aria-live="polite" className={styles.status} data-state={state}>
      <span className={styles.statusDot} />
      {LABEL[state]}
    </span>
  );
}
