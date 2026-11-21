import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client.ts';
import { useInterview } from '../api/queries.ts';
import logo from '../assets/krisis-logo-128.png';
import { IconMic, IconSend, IconStop } from '../components/icons.tsx';
import { StatusPill } from '../chat/StatusPill.tsx';
import { useTurno } from '../chat/useTurno.ts';
import { formatDuration, KIND_LABEL, LEVEL_LABEL, timingLine } from '../lib/format.ts';
import styles from '../chat/Chat.module.css';

export function ChatPage() {
  const { id = '' } = useParams();
  const interview = useInterview(id);
  const turno = useTurno(id);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const messageCount = interview.data?.messages.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messageCount, turno.pending, turno.state]);

  // Se o envio falhou, devolve a fala ao campo para editar e reenviar (como texto).
  const failedContent = turno.state === 'erro' ? turno.pending?.content : null;
  useEffect(() => {
    if (failedContent) setDraft((d) => d || failedContent);
  }, [failedContent]);

  // Esc cancela a gravação em andamento.
  const { state, cancelRecording } = turno;
  useEffect(() => {
    if (state !== 'gravando') return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') cancelRecording();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, cancelRecording]);

  if (interview.isPending) return <div className={styles.loading} aria-busy="true" />;
  if (interview.isError) {
    const notFound = interview.error instanceof ApiError && interview.error.status === 404;
    return (
      <div className={styles.loading}>
        <p className="error-text">{notFound ? 'Entrevista não encontrada.' : interview.error.message}</p>
        <Link to="/entrevistas/nova" className="btn-secondary">
          Nova entrevista
        </Link>
      </div>
    );
  }

  const data = interview.data;
  const finished = data.status === 'finished';
  const busy = state === 'transcrevendo' || state === 'pensando';
  const recording = state === 'gravando';

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy || recording || finished) return;
    if (state === 'erro') turno.discard();
    turno.sendText(text);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onMic = () => {
    if (recording) void turno.finishRecording();
    else void turno.startRecording();
  };

  const pending = turno.pending;

  return (
    <div className={styles.chat}>
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <h1 className={styles.title}>{data.role}</h1>
          <div className={styles.chips}>
            <span className={styles.chip}>{LEVEL_LABEL[data.level]}</span>
            <span className={styles.chip}>{KIND_LABEL[data.kind]}</span>
            <span className={styles.chip}>{data.company}</span>
            <span className={styles.chipOutline}>
              {data.engines.stt && `Transcrição: ${data.engines.stt} · `}Modelo: {data.engines.llm}
            </span>
          </div>
        </div>
      </header>

      <section className={styles.messages} aria-label="Conversa">
        <div className={styles.messagesInner}>
          {data.messages.map((m) =>
            m.author === 'interviewer' ? (
              <article key={m.id} className={styles.interviewer}>
                <div className={styles.avatar}>
                  <img src={logo} alt="" width={22} height={22} />
                </div>
                <div className={styles.stack}>
                  <span className={styles.author}>Entrevistador</span>
                  <div className={styles.bubble}>{m.content}</div>
                  <span className={styles.meta}>{timingLine(m)}</span>
                </div>
              </article>
            ) : (
              <article key={m.id} className={styles.candidate}>
                <span className={styles.author}>Você</span>
                <div className={styles.bubbleMine}>{m.content}</div>
                <span className={styles.meta}>{timingLine(m)}</span>
              </article>
            ),
          )}

          {pending && (
            <article className={styles.candidate} aria-busy={busy}>
              <span className={styles.author}>Você</span>
              <div className={`${styles.bubbleMine} ${state === 'erro' ? styles.failed : ''}`}>
                {pending.content ?? <span className={styles.transcribing}>Transcrevendo sua fala…</span>}
              </div>
              {pending.inputMode === 'voice' && state !== 'erro' && (
                <span className={styles.meta}>Voz · {formatDuration(pending.audioSeconds ?? null)}</span>
              )}
            </article>
          )}

          {state === 'erro' && turno.error && (
            <div className={styles.retryRow} role="alert">
              <span className={styles.errorMsg}>{turno.error}</span>
              {turno.canRetry && (
                <button type="button" className="btn-secondary" onClick={turno.retry}>
                  Tentar de novo
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={turno.discard}>
                {pending ? 'Descartar' : 'Ok'}
              </button>
            </div>
          )}

          {state === 'pensando' && (
            <div className={styles.interviewer} aria-label="O entrevistador está pensando">
              <div className={styles.avatar}>
                <img src={logo} alt="" width={22} height={22} />
              </div>
              <div className={styles.typing}>
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </section>

      <footer className={styles.composer}>
        <div className={styles.composerInner}>
          <div className={styles.statusRow}>
            <StatusPill state={state} seconds={turno.recordingSeconds} />
          </div>
          <div className={styles.inputRow}>
            <button
              type="button"
              className={`${styles.mic} ${recording ? styles.micRecording : ''}`}
              onClick={onMic}
              disabled={busy || finished}
              aria-label={recording ? 'Terminei de falar' : busy ? 'Aguarde' : 'Falar'}
            >
              <span className={styles.micIcon}>{recording ? <IconStop /> : <IconMic />}</span>
              {recording ? 'Terminei de falar' : busy ? 'Aguarde' : 'Falar'}
            </button>

            {recording ? (
              <div className={styles.recordingRow}>
                <div className={styles.wave} aria-hidden="true">
                  {turno.levels.map((l, i) => (
                    <span key={i} style={{ height: `${Math.round(6 + l * 34)}px` }} />
                  ))}
                </div>
                <button type="button" className="btn-secondary" onClick={turno.cancelRecording}>
                  Cancelar
                </button>
              </div>
            ) : (
              <form className={styles.textForm} onSubmit={submit}>
                <label htmlFor="resposta" className="visually-hidden">
                  Responder por texto
                </label>
                <textarea
                  id="resposta"
                  rows={1}
                  placeholder={
                    finished ? 'Entrevista encerrada.' : 'Ou digite sua resposta… (Enter envia, Shift+Enter quebra linha)'
                  }
                  value={draft}
                  disabled={finished}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                />
                <button
                  type="submit"
                  className={styles.send}
                  aria-label="Enviar resposta"
                  disabled={!draft.trim() || busy || finished}
                >
                  <IconSend />
                </button>
              </form>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
