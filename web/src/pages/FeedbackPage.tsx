import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client.ts';
import { useFeedback, useInterview } from '../api/queries.ts';
import { formatLongDate, formatMs, formatSpan, KIND_LABEL, LEVEL_LABEL, STAGE_LABEL } from '../lib/format.ts';
import styles from './FeedbackPage.module.css';

export function FeedbackPage() {
  const { id = '' } = useParams();
  const interview = useInterview(id);
  const feedback = useFeedback(id);

  if (interview.isPending || feedback.isPending) {
    return (
      <div className={styles.center} aria-busy="true">
        <p className={styles.muted}>Carregando feedback…</p>
      </div>
    );
  }
  if (interview.isError || feedback.isError) {
    const err = (interview.error ?? feedback.error) as Error;
    const notYet = feedback.error instanceof ApiError && feedback.error.status === 404 && interview.data;
    return (
      <div className={styles.center}>
        <p className="error-text">{notYet ? 'Esta entrevista ainda não tem feedback. Encerre-a no chat.' : err.message}</p>
        <Link to={interview.data ? `/entrevistas/${id}` : '/'} className="btn-secondary">
          Voltar
        </Link>
      </div>
    );
  }

  const i = interview.data;
  const f = feedback.data;
  const questions = i.messages.filter((m) => m.author === 'candidate').length;
  const meta = [
    KIND_LABEL[i.kind],
    i.company,
    formatLongDate(i.createdAt),
    `${questions} ${questions === 1 ? 'resposta' : 'respostas'}`,
    formatSpan(i.createdAt, i.finishedAt),
  ].filter(Boolean);

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link to={`/entrevistas/${id}`} className="btn-secondary">
          Ver transcrição
        </Link>
        <Link to="/entrevistas/nova" className="btn-primary">
          Treinar de novo
        </Link>
      </header>

      <div className={styles.inner}>
        <div>
          <div className="eyebrow">Feedback da entrevista</div>
          <h1 className={styles.title}>
            {i.role} · {LEVEL_LABEL[i.level]}
          </h1>
          <p className={styles.muted}>{meta.join(' · ')}</p>
        </div>

        <section className={`card ${styles.summary}`} aria-labelledby="resumo">
          <span className={styles.brandBar} aria-hidden="true" />
          <h2 id="resumo" className={styles.h2}>
            Resumo
          </h2>
          <p className={styles.text}>{f.summary}</p>
        </section>

        <div className={styles.twoCols}>
          <section className="card" aria-labelledby="fortes">
            <h2 id="fortes" className={styles.h2Icon}>
              <span className={styles.iconOk} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              </span>
              Pontos fortes
            </h2>
            {f.strengths.length ? (
              <ul className={styles.list} data-tone="ok">
                {f.strengths.map((s, n) => (
                  <li key={n}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>Nenhum ponto forte identificado nesta entrevista.</p>
            )}
          </section>
          <section className="card" aria-labelledby="melhorar">
            <h2 id="melhorar" className={styles.h2Icon}>
              <span className={styles.iconWarn} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M6 11l6-6 6 6" />
                </svg>
              </span>
              Pontos a melhorar
            </h2>
            {f.improvements.length ? (
              <ul className={styles.list} data-tone="warn">
                {f.improvements.map((s, n) => (
                  <li key={n}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>Nenhum ponto a melhorar identificado nesta entrevista.</p>
            )}
          </section>
        </div>

        {f.suggestions.length > 0 && (
          <section className={styles.suggestions} aria-labelledby="como-responder">
            <h2 id="como-responder" className={styles.h2Big}>
              Como responder melhor
            </h2>
            <p className={styles.muted}>As perguntas em que você teve mais espaço para melhorar, com uma sugestão de resposta.</p>
            {f.suggestions.map((s, n) => (
              <article key={n} className={`card ${styles.suggestion}`}>
                <div className={styles.questionRow}>
                  <span className={styles.number}>{String(n + 1).padStart(2, '0')}</span>
                  <h3 className={styles.question}>{s.question}</h3>
                </div>
                <div className={styles.pair}>
                  <div className={styles.yours}>
                    <span className={styles.label}>Sua resposta</span>
                    <p>{s.answer}</p>
                  </div>
                  <div className={styles.better}>
                    <span className={styles.labelAccent}>Sugestão</span>
                    <p>{s.suggestion}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        <section className="card" aria-labelledby="tempos">
          <div className={styles.timingHead}>
            <h2 id="tempos" className={styles.h2}>
              Tempos por etapa
            </h2>
            <span className={styles.muted}>
              Motores: {[i.engines.stt, i.engines.llm, i.engines.tts].filter(Boolean).join(' · ')}
            </span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Etapa</th>
                  <th scope="col">Média</th>
                  <th scope="col">Mais lenta</th>
                  <th scope="col">Medições</th>
                </tr>
              </thead>
              <tbody>
                {f.timings.map((t) => (
                  <tr key={t.stage} data-highlight={t.stage === 'text' || undefined}>
                    <th scope="row">{STAGE_LABEL[t.stage]}</th>
                    <td>{formatMs(t.avgMs) ?? '—'}</td>
                    <td>{formatMs(t.maxMs) ?? '—'}</td>
                    <td>{t.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.footnote}>
            "Até o texto aparecer" soma transcrição e modelo de cada turno (sem o tempo de rede). "Voz (início)" é a
            síntese do primeiro trecho de cada resposta. Feedback gerado por {f.model} em {formatMs(f.llmMs)}.
          </p>
        </section>
      </div>
    </div>
  );
}
