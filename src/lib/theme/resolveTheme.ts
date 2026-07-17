/**
 * Pure, DOM-free theme resolution. Shared by the client ThemeProvider (which
 * supplies the live `prefers-color-scheme` value) so the light/dark/system logic
 * has a single source of truth and can be unit tested without a browser.
 */

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "lenswise:theme";

/** Resolve a chosen theme to the concrete palette, given the OS preference. */
export function resolveTheme(theme: Theme, systemPrefersDark: boolean): "light" | "dark" {
  if (theme === "system") return systemPrefersDark ? "dark" : "light";
  return theme;
}

/** Whether the `.dark` class should be applied for this theme + OS preference. */
export function shouldApplyDark(theme: Theme, systemPrefersDark: boolean): boolean {
  return resolveTheme(theme, systemPrefersDark) === "dark";
}

/** Coerce a persisted value to a valid Theme, defaulting to `system`. */
export function parseStoredTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}
