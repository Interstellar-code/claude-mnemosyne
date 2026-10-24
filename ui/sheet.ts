// A bottom sheet: one panel that slides up from the bottom of the page, shared
// by every tab (Memories uses it for a memory in full; Knowledge and Search can
// open it the same way).
//
// The markup is one <aside id="sheet"> at the end of the app root in
// index.html: a drag-handle bar (decorative), a header with the title and a
// Close button, and a scrolling body. This file only fills it, shows it and
// hides it, so the page keeps its single set of elements.
//
// It is a plain element with a class toggle (not <dialog>): the page behind it
// stays usable, so aria-modal is false and focus is not trapped. Escape and
// Close close it; focus goes to the title on open and back to `returnFocus`
// on close.

export type SheetOptions = {
  /** The heading; it also names the dialog for screen readers. */
  title: string
  /** The content. It replaces whatever the sheet showed before. */
  body: Node
  /** Where focus goes on close: an element, or a function that finds it then (rows get redrawn). Default: what had focus when the sheet opened. */
  returnFocus?: HTMLElement | null | (() => HTMLElement | null)
  /** Runs once when the sheet closes (not when another call to openSheet replaces its content). */
  onClose?: () => void
}

/** How long the slide-down lasts: the sheet is hidden for good after this. */
const SLIDE_MS = 220

const state = {
  open: false,
  returnFocus: undefined as SheetOptions['returnFocus'],
  onClose: undefined as (() => void) | undefined,
  timer: 0 as ReturnType<typeof setTimeout> | 0,
  wired: false,
}

function parts() {
  const sheet = document.getElementById('sheet')
  const title = document.getElementById('sheet-title')
  const body = document.getElementById('sheet-body')
  return sheet && title && body ? { sheet, title, body } : null
}

/** True while the sheet is up. */
export const sheetOpen = () => state.open

/** Shows the sheet with this title and content; when it is already up the content is swapped in place. */
export function openSheet(options: SheetOptions) {
  const found = parts()
  if (found === null) return
  const { sheet, title, body } = found
  if (state.timer) clearTimeout(state.timer)
  state.timer = 0
  title.textContent = options.title
  body.replaceChildren(options.body)
  body.scrollTop = 0
  // A replaced sheet keeps the focus target it already had, unless the caller names a new one.
  if (options.returnFocus !== undefined) state.returnFocus = options.returnFocus
  else if (!state.open) {
    const active = document.activeElement as HTMLElement | null
    state.returnFocus = active && active !== document.body ? active : null
  }
  state.onClose = options.onClose
  if (!state.open) {
    state.open = true
    sheet.hidden = false
    // Reading the height makes the browser lay the sheet out below the fold first, so the class below slides it up.
    void sheet.offsetHeight
    sheet.classList.add('is-open')
  }
  sheet.setAttribute('aria-hidden', 'false')
  title.focus()
}

/** Slides the sheet away, runs its onClose and gives focus back. Does nothing when it is not up. */
export function closeSheet() {
  if (!state.open) return
  const found = parts()
  state.open = false
  const { onClose, returnFocus } = state
  state.onClose = undefined
  state.returnFocus = undefined
  if (found !== null) {
    const { sheet, body } = found
    sheet.classList.remove('is-open')
    sheet.setAttribute('aria-hidden', 'true')
    // Hidden for good once it has slid down; a new openSheet in between cancels this.
    state.timer = setTimeout(() => {
      state.timer = 0
      if (!state.open) {
        sheet.hidden = true
        body.replaceChildren()
      }
    }, SLIDE_MS)
  }
  onClose?.()
  const target = typeof returnFocus === 'function' ? returnFocus() : returnFocus
  target?.focus()
}

/** Wires Close and Escape once; call it when the page starts. */
export function wireSheet() {
  if (state.wired) return
  state.wired = true
  document.getElementById('sheet-close')?.addEventListener('click', () => closeSheet())
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && state.open && !event.defaultPrevented) closeSheet()
  })
}
