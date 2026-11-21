import { useTheme, type ThemePreference } from '../theme/theme.ts';
import styles from './SettingsPage.module.css';

const OPTIONS: { id: ThemePreference; label: string; desc: string }[] = [
  { id: 'sistema', label: 'Sistema', desc: 'Acompanha o sistema operacional' },
  { id: 'claro', label: 'Claro', desc: 'Sempre claro' },
  { id: 'escuro', label: 'Escuro', desc: 'Sempre escuro' },
];

/** Etapa 1: tema. Nome, e-mail e troca de senha entram na etapa 4. */
export function SettingsPage() {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div>
          <div className="eyebrow">Configurações</div>
          <h1 className={styles.title}>Preferências</h1>
        </div>

        <section className={`card ${styles.section}`} aria-labelledby="tema-titulo">
          <div>
            <h2 id="tema-titulo" className={styles.h2}>
              Tema
            </h2>
            <p className={styles.muted}>Escolha a aparência do portal. A escolha fica salva neste navegador.</p>
          </div>
          <div role="radiogroup" aria-labelledby="tema-titulo" className={styles.options}>
            {OPTIONS.map((o) => (
              <label key={o.id} className={styles.option}>
                <input
                  type="radio"
                  name="tema"
                  value={o.id}
                  checked={preference === o.id}
                  onChange={() => setPreference(o.id)}
                />
                <span className={styles.preview} data-preview={o.id} aria-hidden="true">
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
            {preference === 'sistema'
              ? `Seguindo o sistema: no momento, tema ${resolved}.`
              : `Tema ${preference} fixo, independente do sistema.`}
          </p>
        </section>
      </div>
    </div>
  );
}
