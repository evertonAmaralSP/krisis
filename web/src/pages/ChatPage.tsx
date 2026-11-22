import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { v1 } from '@krisis/contracts';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client.ts';
import { keys, useInterview, useVoices } from '../api/queries.ts';
import logo from '../assets/krisis-logo-128.png';
import { IconMic, IconPlay, IconSend, IconStop } from '../components/icons.tsx';
import { StatusPill } from '../chat/StatusPill.tsx';
import { useSpeech } from '../chat/useSpeech.ts';
import { useTurno, type TurnState } from '../chat/useTurno.ts';
import { formatDuration, KIND_LABEL, LEVEL_LABEL, timingLine } from '../lib/format.ts';
import styles from '../chat/Chat.module.css';

export function ChatPage() {
  const { id = '' } = useParams();
  const interview = useInterview(id);
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  // Tempo da voz chega no cabeçalho da primeira frase: atualiza a mensagem na tela.
  const speech = useSpeech((messageId, ms) =>
    qc.setQueryData<v1.Interview>(keys.interview(id), (old) =>
      old
        ? {
            ...old,
            messages: old.messages.map((m) => (m.id === messageId ? { ...m, timings: { ...m.timings, ttsMs: ms } } : m)),
          }
        : old,
    ),
  );
  const voices = useVoices();
  const turno = useTurno(id, { onReply: (messageId) => void speech.play(messageId) });

  // Primeira pergunta de uma entrevista recém-criada: fala sozinha uma vez.
  const autoplay = (location.state as { autoplay?: string } | null)?.autoplay;
  useEffect(() => {
    if (!autoplay) return;
    void speech.play(autoplay);
    navigate(location.pathname, { replace: true, state: null });
  }, [autoplay]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trocar de entrevista para a voz.
  const { stop: stopSpeech } = speech;
  useEffect(() => stopSpeech, [id, stopSpeech]);
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
  // Quem decide se há voz é o servidor (404 TTS_DISABLED desliga os controles).
  const voiceOn = !speech.disabled;
  // "falando" é a voz tocando com o turno livre: dá para interromper falando ou digitando.
  const shownState: TurnState = state === 'pronto' && speech.playingId ? 'falando' : state;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy || recording || finished) return;
    if (state === 'erro') turno.discard();
    speech.stop();
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
    else {
      speech.stop(); // interromper o entrevistador para responder
      void turno.startRecording();
    }
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
              {data.engines.tts && ` · Voz: ${data.engines.tts}`}
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
                  <div className={styles.metaRow}>
                    {voiceOn && (
                      <span className={styles.voiceGroup} role="group" aria-label="Ouvir esta fala com a voz">
                        <span className={styles.voiceGroupLabel}>Ouvir:</span>
                        {(voices.data?.voices ?? []).map((v) => {
                          const isDefault = v.id === voices.data?.default;
                          // Reprodução automática (sem voz pedida) acende o botão da voz padrão.
                          const active =
                            speech.playingId === m.id && (speech.playingVoice ?? voices.data?.default) === v.id;
                          const name = v.label.split(' (')[0];
                          return active ? (
                            <button key={v.id} type="button" className={styles.audioButtonActive} onClick={speech.stop}>
                              <IconStop size={12} /> {name}
                            </button>
                          ) : (
                            <button
                              key={v.id}
                              type="button"
                              className={styles.audioButton}
                              title={`${v.label}${isDefault ? ' · voz padrão' : ''}`}
                              aria-label={`Ouvir com a voz ${v.label}${isDefault ? ', padrão' : ''}`}
                              onClick={() => void speech.play(m.id, isDefault ? undefined : v.id)}
                            >
                              <IconPlay size={12} /> {name}
                              {isDefault && <span className={styles.defaultDot} aria-hidden="true" />}
                            </button>
                          );
                        })}
                      </span>
                    )}
                    <span className={styles.meta}>{timingLine(m)}</span>
                  </div>
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
          {speech.error && (
            <p className={styles.speechError} role="status">
              {speech.error}
            </p>
          )}
          <div className={styles.statusRow}>
            <StatusPill state={shownState} seconds={turno.recordingSeconds} />
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
