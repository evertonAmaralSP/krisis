import { v1 } from '@krisis/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../api/client.ts';
import { useAccount, useChangePassword, useUpdateAccount, useVoices } from '../api/queries.ts';
import { IconPlay, IconStop } from '../components/icons.tsx';
import { useTheme, type ThemePreference } from '../theme/theme.ts';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div>
          <div className="eyebrow">Configurações</div>
          <h1 className={styles.title}>Sua conta e preferências</h1>
        </div>
        <AccountSection />
        <PasswordSection />
        <VoiceSection />
        <ThemeSection />
      </div>
    </div>
  );
}

// ---------- Conta ----------

function AccountSection() {
  const account = useAccount();
  const update = useUpdateAccount();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);

  // Preenche só quando o nome/e-mail do servidor mudam (ex.: ao salvar), não a cada
  // atualização da conta — escolher a voz não pode apagar o que está sendo digitado.
  const serverName = account.data?.name;
  const serverEmail = account.data?.email;
  useEffect(() => {
    if (serverName !== undefined) setName(serverName);
  }, [serverName]);
  useEffect(() => {
    if (serverEmail !== undefined) setEmail(serverEmail);
  }, [serverEmail]);

  const emailChanged = Boolean(account.data) && email.trim().toLowerCase() !== account.data!.email;
  const dirty = Boolean(account.data) && (name.trim() !== account.data!.name || emailChanged);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    update.mutate(
      {
        name: name.trim(),
        ...(emailChanged && { email: email.trim(), currentPassword: password }),
      },
      {
        onSuccess: () => {
          setPassword('');
          setSaved(true);
        },
      },
    );
  };

  return (
    <section className={`card ${styles.section}`} aria-labelledby="conta-titulo">
      <div>
        <h2 id="conta-titulo" className={styles.h2}>
          Conta
        </h2>
        <p className={styles.muted}>O e-mail é o que você usa para entrar.</p>
      </div>
      {account.isError && <p className="error-text">{account.error.message}</p>}
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.grid3}>
          <div className="field">
            <label htmlFor="nome">Nome</label>
            <input
              id="nome"
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setSaved(false);
                setName(e.target.value);
              }}
              required
              maxLength={80}
            />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setSaved(false);
                setEmail(e.target.value);
              }}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="senha-conta">Senha atual</label>
            <input
              id="senha-conta"
              type="password"
              autoComplete="current-password"
              aria-describedby="senha-conta-ajuda"
              value={password}
              disabled={!emailChanged}
              required={emailChanged}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span id="senha-conta-ajuda" className="hint">
              Necessária só para trocar o e-mail.
            </span>
          </div>
        </div>
        {update.isError && (
          <p className="error-text" role="alert">
            {update.error.message}
          </p>
        )}
        <div className={styles.actions}>
          {saved && !update.isPending && (
            <span role="status" className={styles.ok}>
              Dados salvos.
            </span>
          )}
          <button type="submit" className="btn-secondary" disabled={!dirty || update.isPending || (emailChanged && !password)}>
            {update.isPending ? 'Salvando…' : 'Salvar dados'}
          </button>
        </div>
      </form>
    </section>
  );
}

// ---------- Senha ----------

function PasswordSection() {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);

  const tooShort = next.length > 0 && next.length < v1.PASSWORD_MIN;
  const mismatch = confirm.length > 0 && confirm !== next;
  const valid = current.length > 0 && next.length >= v1.PASSWORD_MIN && confirm === next;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setDone(false);
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          setCurrent('');
          setNext('');
          setConfirm('');
          setDone(true);
        },
      },
    );
  };

  return (
    <section className={`card ${styles.section}`} aria-labelledby="senha-titulo">
      <div>
        <h2 id="senha-titulo" className={styles.h2}>
          Trocar senha
        </h2>
        <p className={styles.muted}>
          Mínimo de {v1.PASSWORD_MIN} caracteres. Ao trocar, as outras sessões abertas são encerradas; esta continua.
        </p>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.grid3}>
          <div className="field">
            <label htmlFor="senha-atual">Senha atual</label>
            <input id="senha-atual" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="senha-nova">Nova senha</label>
            <input
              id="senha-nova"
              type="password"
              autoComplete="new-password"
              value={next}
              aria-invalid={tooShort}
              aria-describedby="senha-nova-ajuda"
              onChange={(e) => setNext(e.target.value)}
            />
            <span id="senha-nova-ajuda" className="hint">
              {tooShort ? `Faltam ${v1.PASSWORD_MIN - next.length} caracteres.` : ' '}
            </span>
          </div>
          <div className="field">
            <label htmlFor="senha-conf">Confirmar nova senha</label>
            <input
              id="senha-conf"
              type="password"
              autoComplete="new-password"
              value={confirm}
              aria-invalid={mismatch}
              aria-describedby="senha-conf-ajuda"
              onChange={(e) => setConfirm(e.target.value)}
            />
            <span id="senha-conf-ajuda" className="hint">
              {mismatch ? 'As senhas não conferem.' : ' '}
            </span>
          </div>
        </div>
        {change.isError && (
          <p className="error-text" role="alert">
            {change.error.message}
          </p>
        )}
        <div className={styles.actions}>
          {done && (
            <span role="status" className={styles.ok}>
              Senha alterada. As outras sessões foram encerradas.
            </span>
          )}
          <button type="submit" className="btn-primary" disabled={!valid || change.isPending}>
            {change.isPending ? 'Trocando…' : 'Trocar senha'}
          </button>
        </div>
      </form>
    </section>
  );
}

// ---------- Voz ----------

function VoiceSection() {
  const account = useAccount();
  const voices = useVoices();
  const update = useUpdateAccount();
  const [playing, setPlaying] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const audioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  // Cada clique ganha um número: resultado de um clique antigo (ou depois de sair da tela) é ignorado.
  const tokenRef = useRef(0);

  const stop = () => {
    tokenRef.current += 1;
    if (audioRef.current) {
      audioRef.current.audio.pause();
      URL.revokeObjectURL(audioRef.current.url);
    }
    audioRef.current = null;
    setPlaying(null);
  };

  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (voices.isError || voices.data?.enabled === false) return null; // sem voz no servidor: a seção não aparece
  const selected = voices.data?.default;

  const listen = async (voice: string) => {
    stop();
    const token = tokenRef.current;
    setSampleError(null);
    setPlaying(voice);
    try {
      const blob = await api.voiceSample(voice);
      if (token !== tokenRef.current) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = { audio, url };
      const finish = () => {
        if (token !== tokenRef.current) return;
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setPlaying(null);
      };
      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', finish, { once: true });
      await audio.play();
    } catch (err) {
      if (token !== tokenRef.current) return;
      setPlaying(null);
      setSampleError((err as Error).message);
    }
  };

  return (
    <section className={`card ${styles.section}`} aria-labelledby="voz-titulo">
      <div>
        <h2 id="voz-titulo" className={styles.h2}>
          Voz do entrevistador
        </h2>
        <p className={styles.muted}>
          A voz que fala sozinha depois de cada resposta. Ouça uma amostra antes de escolher. Nas falas, os botões
          "Ouvir" continuam permitindo comparar.
        </p>
      </div>
      <div role="radiogroup" aria-labelledby="voz-titulo" className={styles.voiceList}>
        {voices.data?.voices.map((v) => (
          <div key={v.id} className={styles.voiceRow}>
            <label className={styles.voiceOption}>
              <input
                type="radio"
                name="voz"
                value={v.id}
                checked={selected === v.id}
                disabled={update.isPending}
                onChange={() => update.mutate({ ttsVoice: v.id })}
              />
              <span className={styles.radioMark} aria-hidden="true" />
              <span className={styles.optionLabel}>{v.label}</span>
            </label>
            <button
              type="button"
              className={playing === v.id ? styles.sampleActive : styles.sample}
              aria-label={playing === v.id ? `Parar amostra da voz ${v.label}` : `Ouvir amostra da voz ${v.label}`}
              onClick={() => (playing === v.id ? stop() : void listen(v.id))}
            >
              {playing === v.id ? <IconStop size={12} /> : <IconPlay size={12} />}
              {playing === v.id ? 'Parar' : 'Ouvir amostra'}
            </button>
          </div>
        ))}
      </div>
      {account.data?.ttsVoice && (
        <button type="button" className={styles.linkButton} onClick={() => update.mutate({ ttsVoice: null })}>
          Voltar à voz padrão do servidor
        </button>
      )}
      {(sampleError || update.isError) && (
        <p className="error-text" role="alert">
          {sampleError ?? update.error?.message}
        </p>
      )}
    </section>
  );
}

// ---------- Tema ----------

const THEMES: { id: ThemePreference; label: string; desc: string }[] = [
  { id: 'sistema', label: 'Sistema', desc: 'Acompanha o sistema operacional' },
  { id: 'claro', label: 'Claro', desc: 'Sempre claro' },
  { id: 'escuro', label: 'Escuro', desc: 'Sempre escuro' },
];

function ThemeSection() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <section className={`card ${styles.section}`} aria-labelledby="tema-titulo">
      <div>
        <h2 id="tema-titulo" className={styles.h2}>
          Tema
        </h2>
        <p className={styles.muted}>Escolha a aparência do portal. A escolha fica salva neste navegador.</p>
      </div>
      <div role="radiogroup" aria-labelledby="tema-titulo" className={styles.options}>
        {THEMES.map((o) => (
          <label key={o.id} className={styles.option}>
            <input type="radio" name="tema" value={o.id} checked={preference === o.id} onChange={() => setPreference(o.id)} />
            <span className={styles.preview} aria-hidden="true">
              {(o.id === 'sistema' ? ['claro', 'escuro'] : [o.id]).map((t) => (
                <span key={t} className={styles.half} data-theme-preview={t}>
                  <span className={styles.rail} />
                  <span className={styles.bubbles}>
                    <span className={styles.bubble} />
                    <span className={`${styles.bubble} ${styles.mine}`} />
                    <span className={styles.bubble} />
                  </span>
                </span>
              ))}
            </span>
            <span className={styles.optionText}>
              <span className={styles.optionLabel}>{o.label}</span>
              <span className={styles.optionDesc}>{o.desc}</span>
            </span>
          </label>
        ))}
      </div>
      <p className={styles.muted} role="status">
        {preference === 'sistema' ? `Seguindo o sistema: no momento, tema ${resolved}.` : `Tema ${preference} fixo, independente do sistema.`}
      </p>
    </section>
  );
}
