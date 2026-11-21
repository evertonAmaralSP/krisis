import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useLogin, useMe } from '../api/queries.ts';
import { Brand } from '../components/Brand.tsx';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const me = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (me.data) return <Navigate to={from} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => navigate(from, { replace: true }) });
  };

  return (
    <div className={styles.page}>
      <section className={styles.brandSide}>
        <Brand size={40} />
        <div className={styles.orbit} aria-hidden="true">
          <div className={styles.orb} />
          <div className={styles.ring1} />
          <div className={styles.ring2} />
        </div>
        <div className={styles.hero}>
          <div className="eyebrow">Treino de entrevistas</div>
          <h1 className={styles.title}>
            Pratique a conversa.
            <br />
            <span className={styles.gradText}>Chegue pronto.</span>
          </h1>
          <p className={styles.lead}>
            Um entrevistador de IA conversa com você por voz, aprofunda o que você responde e, no fim, mostra onde
            você foi bem e o que pode melhorar.
          </p>
        </div>
        <p className={styles.footnote}>Acesso pessoal · sem cadastro</p>
      </section>

      <section className={styles.formSide}>
        <form className={`card ${styles.form}`} onSubmit={submit} noValidate>
          <div>
            <h2 className={styles.formTitle}>Entrar</h2>
            <p className={styles.muted}>Use o seu e-mail e a sua senha.</p>
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {login.isError && (
            <p className="error-text" role="alert">
              {login.error.message}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={login.isPending || !email || !password}>
            {login.isPending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </div>
  );
}
