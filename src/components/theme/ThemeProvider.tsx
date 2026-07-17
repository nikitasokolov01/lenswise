"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  parseStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme/resolveTheme";

export type { Theme };
export { THEME_STORAGE_KEY };

interface ThemeContextValue {
  /** The user's chosen setting: light, dark, or follow the OS. */
  theme: Theme;
  /** The palette actually applied right now (system resolved to light/dark). */
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolve(theme: Theme): "light" | "dark" {
  return resolveTheme(theme, prefersDark());
}

/** Apply (or remove) the `.dark` class on <html> to swap the CSS-variable palette. */
function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolve(theme) === "dark");
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    return parseStoredTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    /* localStorage may be unavailable; fall back to system. */
    return "system";
  }
}

/**
 * App-wide theme state. Initializes from localStorage (so the choice survives
 * reloads and applies on unauthenticated pages), keeps the `.dark` class on
 * <html> in sync, and re-resolves when the OS theme changes while in "system"
 * mode. When signed in, the account preference is treated as the source of
 * truth via <ThemeAccountSync/>.
 *
 * A `persist` callback (wired to a server action) lets an authenticated caller
 * save the choice to their account; unauthenticated pages omit it and rely on
 * localStorage alone.
 */
export function ThemeProvider({
  children,
  persist,
}: {
  children: ReactNode;
  persist?: (theme: Theme) => void;
}) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Hydrate from localStorage on mount (avoids SSR/client mismatch).
  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
    setResolved(resolve(stored));
  }, []);

  // Follow OS changes while in "system" mode.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        applyTheme("system");
        setResolved(resolve("system"));
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const persistRef = useRef(persist);
  persistRef.current = persist;

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    setResolved(resolve(next));
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore storage failures */
    }
    persistRef.current?.(next);
  }, []);

  // Used only by <ThemeAccountSync/> to adopt the account value without
  // re-persisting it back to the server.
  const adoptTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    setResolved(resolve(next));
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore storage failures */
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      <AdoptContext.Provider value={adoptTheme}>{children}</AdoptContext.Provider>
    </ThemeContext.Provider>
  );
}

const AdoptContext = createContext<((theme: Theme) => void) | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe no-op fallback if used outside a provider (e.g. isolated tests).
    return { theme: "system", resolved: "light", setTheme: () => {} };
  }
  return ctx;
}

/**
 * When authenticated, the account's saved preference is the source of truth.
 * Mounted inside the app shell with the profile value; on mount it adopts that
 * value (unless it already matches) so a preference set on another device wins
 * over this device's localStorage. Renders nothing.
 */
export function ThemeAccountSync({ accountTheme }: { accountTheme: Theme }) {
  const adopt = useContext(AdoptContext);
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    adopt?.(accountTheme);
  }, [accountTheme, adopt]);
  return null;
}
