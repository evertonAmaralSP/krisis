import { useEffect, useSyncExternalStore } from 'react';

export type ThemePreference = 'sistema' | 'claro' | 'escuro';
export type ResolvedTheme = 'claro' | 'escuro';

const KEY = 'krisis.tema';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'claro' || v === 'escuro' ? v : 'sistema';
  } catch {
    return 'sistema';
  }
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref !== 'sistema') return pref;
  return media().matches ? 'escuro' : 'claro';
}

function apply() {
  document.documentElement.dataset.theme = resolveTheme(read());
}

export function setThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* navegador sem armazenamento: vale só nesta aba */
  }
  apply();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Preferência atual + tema efetivo. Reage à troca de tema do sistema operacional. */
export function useTheme() {
  const preference = useSyncExternalStore(subscribe, read, () => 'sistema' as const);
  useEffect(() => {
    const mq = media();
    const onChange = () => {
      apply();
      listeners.forEach((l) => l());
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return { preference, resolved: resolveTheme(preference), setPreference: setThemePreference };
}
