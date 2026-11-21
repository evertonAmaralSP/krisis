import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../api/queries.ts';
import { Brand } from '../components/Brand.tsx';
import { IconMenu } from '../components/icons.tsx';
import { Sidebar } from './Sidebar.tsx';
import styles from './AppLayout.module.css';

/** Área logada: barra lateral + conteúdo. Sem sessão, vai para /entrar. */
export function AppLayout() {
  const me = useMe();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  if (me.isPending) return <div className={styles.splash} aria-busy="true" />;
  if (me.isError) {
    return (
      <div className={styles.splash}>
        <p className="error-text">{me.error.message}</p>
      </div>
    );
  }
  if (!me.data) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;

  return (
    <div className={styles.shell}>
      <header className={styles.mobileBar}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Abrir histórico de entrevistas"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <IconMenu />
        </button>
        <Brand size={28} />
      </header>

      <Sidebar user={me.data} drawerOpen={drawerOpen} onCloseDrawer={() => setDrawerOpen(false)} />

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
