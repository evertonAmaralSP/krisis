import { useEffect, useRef, type ReactNode } from 'react';
import styles from './ConfirmDialog.module.css';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Texto do botão enquanto a ação roda. */
  busyLabel?: string;
  busy?: boolean;
  /** danger (padrão) para apagar; primary para confirmar uma ação comum. */
  tone?: 'danger' | 'primary';
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação com o <dialog> nativo: modal de verdade (foco preso, Esc fecha,
 * fundo inerte) sem biblioteca. O foco inicial vai para "Cancelar", a opção segura.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busyLabel = 'Aguarde…',
  busy,
  tone = 'danger',
  error,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(e) => {
        // Clique no fundo (fora da caixa) cancela.
        if (e.target === ref.current && !busy) onCancel();
      }}
    >
      <div className={styles.box}>
        <h2 id="confirm-title" className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button ref={cancelRef} type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className={tone === 'danger' ? styles.danger : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
