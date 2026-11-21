import type { v1 } from '@krisis/contracts';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useCreateInterview } from '../api/queries.ts';
import styles from './NewInterviewPage.module.css';

const LEVELS: { id: v1.Level; label: string }[] = [
  { id: 'junior', label: 'Júnior' },
  { id: 'pleno', label: 'Pleno' },
  { id: 'senior', label: 'Sênior' },
];

const KINDS: { id: v1.InterviewKind; label: string; desc: string }[] = [
  { id: 'comportamental', label: 'Comportamental', desc: 'Situações vividas, conflitos, liderança e decisões.' },
  { id: 'tecnica', label: 'Técnica', desc: 'Conhecimento da área, arquitetura e resolução de problemas.' },
  { id: 'mista', label: 'Mista', desc: 'Alterna perguntas técnicas e comportamentais.' },
];

export function NewInterviewPage() {
  const create = useCreateInterview();
  const navigate = useNavigate();
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [level, setLevel] = useState<v1.Level>('pleno');
  const [kind, setKind] = useState<v1.InterviewKind>('mista');
  const [jobDescription, setJobDescription] = useState('');
  const [resume, setResume] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        role,
        company,
        level,
        kind,
        ...(jobDescription.trim() && { jobDescription }),
        ...(resume.trim() && { resume }),
      },
      { onSuccess: (interview) => navigate(`/entrevistas/${interview.id}`) },
    );
  };

  return (
    <div className={styles.page}>
      <form className={styles.form} onSubmit={submit}>
        <div>
          <div className="eyebrow">Nova entrevista</div>
          <h1 className={styles.title}>Para qual vaga vamos treinar?</h1>
          <p className={styles.lead}>
            Esses dados orientam o entrevistador. Quanto mais contexto, mais específicas ficam as perguntas.
          </p>
        </div>

        <div className={`card ${styles.group}`}>
          <div className={styles.twoCols}>
            <div className="field">
              <label htmlFor="vaga">Vaga</label>
              <input
                id="vaga"
                required
                minLength={2}
                placeholder="Ex.: Engenheiro de dados"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="empresa">Empresa</label>
              <input
                id="empresa"
                required
                placeholder="Nome da empresa"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>

          <fieldset className={styles.fieldset}>
            <legend>Nível</legend>
            <div className={styles.pills}>
              {LEVELS.map((l) => (
                <label key={l.id} className={styles.pill}>
                  <input
                    type="radio"
                    name="nivel"
                    value={l.id}
                    checked={level === l.id}
                    onChange={() => setLevel(l.id)}
                  />
                  {l.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Tipo de entrevista</legend>
            <div className={styles.kinds}>
              {KINDS.map((k) => (
                <label key={k.id} className={styles.kind}>
                  <input
                    type="radio"
                    name="tipo"
                    value={k.id}
                    checked={kind === k.id}
                    onChange={() => setKind(k.id)}
                  />
                  <span className={styles.kindLabel}>{k.label}</span>
                  <span className={styles.kindDesc}>{k.desc}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className={`card ${styles.group}`}>
          <div className="field">
            <label htmlFor="descricao">
              Descrição da vaga <span className={styles.optional}>(opcional)</span>
            </label>
            <textarea
              id="descricao"
              rows={5}
              placeholder="Cole aqui o texto do anúncio da vaga."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="curriculo">
              Seu currículo <span className={styles.optional}>(opcional)</span>
            </label>
            <textarea
              id="curriculo"
              rows={5}
              placeholder="Cole aqui o seu currículo em texto."
              value={resume}
              onChange={(e) => setResume(e.target.value)}
            />
          </div>
        </div>

        {create.isError && (
          <p className="error-text" role="alert">
            {create.error.message}
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={create.isPending || role.trim().length < 2 || !company.trim()}
          >
            {create.isPending ? 'Preparando a primeira pergunta…' : 'Começar entrevista →'}
          </button>
        </div>
      </form>
    </div>
  );
}
