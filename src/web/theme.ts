/** Appearance is independent of puzzle progress, shared links and language. */
export const THEME_KEY = 'pbp:theme';
export const THEMES = ['classic', 'modern', 'dark'] as const;
export type Theme = typeof THEMES[number];

export function parseTheme(value: unknown): Theme {
  return value === 'modern' || value === 'dark' ? value : 'classic';
}

/** Storage can be disabled (private mode, WebView policies) or contain old values. */
export function readSavedTheme(storage?: Pick<Storage, 'getItem'> | null): Theme {
  try {
    const source = storage === undefined
      ? (typeof window === 'undefined' ? null : window.localStorage)
      : storage;
    return parseTheme(source?.getItem(THEME_KEY));
  } catch {
    return 'classic';
  }
}

export function getTheme(): Theme {
  return typeof document === 'undefined' ? 'classic' : parseTheme(document.documentElement.dataset.theme);
}

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#101722' : theme === 'modern' ? '#f2f5fb' : '#f7f2ea';
}

export function initTheme(): void {
  applyTheme(readSavedTheme());
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* The current theme still works when persistence is unavailable. */
  }
}
