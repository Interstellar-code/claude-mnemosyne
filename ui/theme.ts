// The dashboard theme: Auto (follows the system), Light or Dark. The colours live in ui/style.css
// as light-dark() pairs; this file only decides the mode, remembers it, and sets data-theme on <html>
// for an explicit choice (Auto removes it, so the system setting rules). Pure and DOM-free so a spec
// can drive it with a fake root and a fake storage.

export type ThemeMode = 'auto' | 'light' | 'dark'
export const THEME_MODES: readonly ThemeMode[] = ['auto', 'light', 'dark']
export const THEME_KEY = 'mnemosyne.theme'
const NAMES: Record<ThemeMode, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' }

/** A stored value as a valid mode: anything unknown (or no value) is Auto. */
export function themeMode(stored: string | null | undefined): ThemeMode {
  return THEME_MODES.find(mode => mode === stored) ?? 'auto'
}

/** The mode after one press: Auto, then Light, then Dark, then Auto again. */
export function nextTheme(mode: ThemeMode): ThemeMode {
  return THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length]!
}

/** The visible text of the button. */
export const themeButtonText = (mode: ThemeMode) => `Theme: ${NAMES[mode]}`

/** The accessible name: the current mode and what a press does. */
export const themeButtonLabel = (mode: ThemeMode) => `Theme: ${NAMES[mode]}. Press for ${NAMES[nextTheme(mode)]}.`

/** Sets data-theme on the root element for Light and Dark, and removes it for Auto. */
export function applyTheme(root: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void }, mode: ThemeMode): void {
  if (mode === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
}

/** The stored mode, or null when there is none or storage throws (private windows, blocked storage). */
export function readTheme(storage: Pick<Storage, 'getItem'> | undefined): string | null {
  try {
    return storage?.getItem(THEME_KEY) ?? null
  } catch {
    return null
  }
}

/** Remembers the mode picked; failure is ignored (storage is a convenience only). */
export function saveTheme(storage: Pick<Storage, 'setItem'> | undefined, mode: ThemeMode): void {
  try {
    storage?.setItem(THEME_KEY, mode)
  } catch {
    // a private window or blocked storage: the choice just lasts until the page closes
  }
}

/**
 * Wires the header button: applies the stored mode now, shows it on the button, and cycles on each
 * press, saving the choice. Returns the current mode getter for tests.
 */
export function startTheme(
  button: { textContent: string | null; setAttribute(name: string, value: string): void; addEventListener(type: 'click', listener: () => void): void },
  root: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void },
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
): () => ThemeMode {
  let mode = themeMode(readTheme(storage))
  const show = () => {
    button.textContent = themeButtonText(mode)
    button.setAttribute('aria-label', themeButtonLabel(mode))
    applyTheme(root, mode)
  }
  show()
  button.addEventListener('click', () => {
    mode = nextTheme(mode)
    saveTheme(storage, mode)
    show()
  })
  return () => mode
}
