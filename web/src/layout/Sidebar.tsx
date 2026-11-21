import type { v1 } from '@krisis/contracts';
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useInterviews, useLogout } from '../api/queries.ts';
import { Brand } from '../components/Brand.tsx';
import { IconClose, IconGear, IconLogout, IconPanel, IconPlus } from '../components/icons.tsx';
import { formatShortDate, LEVEL_LABEL, KIND_LABEL } from '../lib/format.ts';
import styles from './Sidebar.module.css';

const KEY = 'krisis.barraRecolhida';
const readCollapsed = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

interface Props {
  user: v1.User;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

export function Sidebar({ user, drawerOpen, onCloseDrawer }: Props) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const interviews = useInterviews();
  const logout = useLogout();
  const navigate = useNavigate();

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* sem armazenamento: vale só nesta aba */
    }
  };

  const open = !collapsed || drawerOpen;

  return (
    <>
      {drawerOpen && <div className={styles.backdrop} onClick={onCloseDrawer} aria-hidden="true" />}
      <nav
        aria-label="Entrevistas"
        className={`${styles.sidebar} ${open ? '' : styles.collapsed} ${drawerOpen ? styles.drawerOpen : ''}`}
      >
        <div className={styles.top}>
          <Link to="/" className={styles.brandLink}>
            <Brand size={32} showName={open} />
          </Link>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.desktopOnly}`}
            onClick={toggle}
            aria-label={open ? 'Recolher barra lateral' : 'Expandir barra lateral'}
            aria-expanded={open}
          >
            <IconPanel />
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.mobileOnly}`}
            onClick={onCloseDrawer}
            aria-label="Fechar histórico"
          >
            <IconClose />
          </button>
        </div>

        <Link to="/entrevistas/nova" className={`btn-primary ${styles.newButton}`} aria-label="Nova entrevista">
          <IconPlus />
          {open && <span>Nova entrevista</span>}
        </Link>

        <div className={styles.history}>
          {open && (
            <>
              <div className={styles.sectionLabel}>Histórico</div>
              {interviews.isPending && <p className={styles.muted}>Carregando…</p>}
              {interviews.isError && <p className={styles.muted}>Não foi possível carregar o histórico.</p>}
              {interviews.data?.length === 0 && <p className={styles.muted}>Nenhuma entrevista ainda.</p>}
              <ul className={styles.list}>
                {interviews.data?.map((i) => (
                  <li key={i.id}>
                    <NavLink
                      to={`/entrevistas/${i.id}`}
                      className={({ isActive }) => `${styles.item} ${isActive ? styles.itemActive : ''}`}
                    >
                      <span className={styles.itemTop}>
                        <span className={styles.itemTitle}>{i.role}</span>
                        <span className={styles.itemDate}>{formatShortDate(i.createdAt)}</span>
                      </span>
                      <span className={styles.itemMeta}>
                        {LEVEL_LABEL[i.level]} · {KIND_LABEL[i.kind]}
                      </span>
                      <span className={i.status === 'active' ? styles.chipActive : styles.chipDone}>
                        {i.status === 'active' ? 'Em andamento' : 'Encerrada'}
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <NavLink
          to="/configuracoes"
          aria-label="Configurações"
          className={({ isActive }) => `${styles.footerLink} ${isActive ? styles.itemActive : ''}`}
        >
          <IconGear />
          {open && <span>Configurações</span>}
        </NavLink>

        <div className={styles.footer}>
          {open && <span className={styles.userName}>{user.name}</span>}
          <button
            type="button"
            className={styles.logout}
            aria-label="Sair"
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/entrar', { replace: true }) })}
          >
            <IconLogout />
            {open && <span>Sair</span>}
          </button>
        </div>
      </nav>
    </>
  );
}
