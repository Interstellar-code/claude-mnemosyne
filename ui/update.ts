// The Health tab's version line and Update button (0.28.0). Pure text helpers
// plus DOM built with createElement and textContent only (no classList, no
// inline colours), so a stand-in document can test it. The server side is
// ui/update-routes.ts; app.ts fetches, starts and polls.

export type UpdateState = 'starting' | 'running' | 'done' | 'failed' | 'blocked'
export type UpdateStatus = { state: UpdateState; lines: string[]; code?: number; started: string; updated: string }
export type Latest = { tag: string; plugin: string; engine: string | null }
export type UpdateInfo = {
  current: { plugin: string | null; engine: string | null }
  latest: Latest | null
  available: boolean
  updatable: boolean
  status: UpdateStatus | null
}

const STATES: readonly UpdateState[] = ['starting', 'running', 'done', 'failed', 'blocked']
const text = (value: unknown) => (typeof value === 'string' ? value : null)

function parseStatus(value: unknown): UpdateStatus | null {
  const s = value as Partial<UpdateStatus> | null
  if (!s || typeof s !== 'object' || !STATES.includes(s.state as UpdateState) || !Array.isArray(s.lines)) return null
  return { state: s.state as UpdateState, lines: s.lines.filter(line => typeof line === 'string'), code: typeof s.code === 'number' ? s.code : undefined, started: text(s.started) ?? '', updated: text(s.updated) ?? '' }
}

/** The /api/update body, checked field by field; null when it is not one. */
export function parseUpdateInfo(body: unknown): UpdateInfo | null {
  const b = body as Record<string, any> | null
  if (!b || typeof b !== 'object' || typeof b.current !== 'object' || b.current === null) return null
  const latest = b.latest && typeof b.latest === 'object' && typeof b.latest.tag === 'string' && typeof b.latest.plugin === 'string' ? { tag: b.latest.tag, plugin: b.latest.plugin, engine: text(b.latest.engine) } : null
  return {
    current: { plugin: text(b.current.plugin), engine: text(b.current.engine) },
    latest,
    available: b.available === true && latest !== null,
    updatable: b.updatable === true,
    status: parseStatus(b.status),
  }
}

/** The /api/update/status body's progress, or null. */
export const parseStatusBody = (body: unknown) => parseStatus((body as { status?: unknown } | null)?.status)

export const isRunning = (status: UpdateStatus | null) => status !== null && (status.state === 'starting' || status.state === 'running')

/** "Mnemosyne v0.27.0 · v0.28.0 available", "… · up to date", or the version alone when no check answered. */
export function versionText(info: UpdateInfo): string {
  const current = info.current.plugin ? `Mnemosyne v${info.current.plugin}` : 'Mnemosyne'
  if (info.available && info.latest) return `${current} · v${info.latest.plugin} available`
  if (info.latest) return `${current} · up to date`
  return current
}

/** What the confirm says will change, and what will not. */
export function confirmLines(info: UpdateInfo): string[] {
  const latest = info.latest
  if (!latest) return []
  const { plugin, engine } = info.current
  const engineLine =
    latest.engine === null ? `Engine ${engine ?? 'unknown'} → the build that ships with v${latest.plugin}` : latest.engine === engine ? `Engine ${engine} (unchanged)` : `Engine ${engine ?? 'none'} → ${latest.engine}`
  return [
    `Plugin v${plugin ?? '?'} → v${latest.plugin}`,
    engineLine,
    'Your memories, settings and tags are not touched.',
    'Open Claude Desktop chats keep the old engine until Claude Desktop restarts.',
    'The dashboard restarts during the update; this page reloads when it is back.',
  ]
}

/** A short title and the lines to show for a run's progress file. */
export function statusSummary(status: UpdateStatus): { title: string; lines: string[] } {
  const tail = status.lines.slice(-8)
  if (status.state === 'starting' || status.state === 'running') return { title: 'Updating…', lines: tail }
  if (status.state === 'done') return { title: 'Update finished.', lines: tail }
  if (status.state === 'blocked') {
    return { title: 'The update could not replace files that open Claude chats are using. Quit Claude Desktop, then click Update again. Nothing was stopped.', lines: tail }
  }
  return { title: 'The update failed. The previous version keeps working unless the lines below say otherwise.', lines: tail }
}

// ---- DOM ----

function el<K extends keyof HTMLElementTagNameMap>(tag: K, content?: string, className?: string) {
  const element = document.createElement(tag)
  if (content !== undefined) element.textContent = content
  if (className) element.className = className
  return element
}

/** Fills `box` with a run's progress: the title, then its last lines. */
export function renderProgress(box: HTMLElement, status: UpdateStatus | null, extra?: string) {
  box.replaceChildren()
  if (status === null && extra === undefined) {
    box.hidden = true
    return
  }
  box.hidden = false
  if (status !== null) {
    const summary = statusSummary(status)
    box.append(el('p', summary.title, status.state === 'failed' || status.state === 'blocked' ? 'warn' : 'small'))
    if (summary.lines.length > 0) box.append(el('pre', summary.lines.join('\n'), 'update-lines mono'))
  }
  if (extra !== undefined) box.append(el('p', extra, 'small'))
}

export type UpdateHost = {
  /** POSTs the start; resolves with the error text when the server refused it. */
  start: () => Promise<string | undefined>
  /** Called once the run started (app.ts polls the progress from here). */
  started: (box: HTMLElement) => void
}

/**
 * The Version value of the System panel: the version line, and when a newer
 * release can be installed here an Update… button and its confirm (Cancel is
 * the default and has the focus). A run in progress shows its progress and no button.
 */
export function versionCell(info: UpdateInfo, host: UpdateHost): HTMLElement {
  const cell = el('div', undefined, 'update-cell')
  cell.append(el('span', versionText(info)))
  const progress = el('div', undefined, 'update-progress')
  progress.setAttribute('aria-live', 'polite')
  const recent = info.status !== null && (isRunning(info.status) || Date.now() - Date.parse(info.status.updated) < 24 * 60 * 60 * 1000)
  renderProgress(progress, recent ? info.status : null)
  if (!info.available || !info.latest) {
    cell.append(progress)
    return cell
  }
  if (!info.updatable) {
    cell.append(el('span', 'Update with: claude plugin update mnemosyne@mnemosyne', 'muted small'), progress)
    return cell
  }
  const ask = el('button', 'Update…', 'btn small')
  ask.type = 'button'
  ask.hidden = isRunning(info.status)
  const confirm = el('div', undefined, 'confirm')
  confirm.hidden = true
  confirm.setAttribute('role', 'group')
  confirm.setAttribute('aria-label', 'Confirm the update')
  confirm.append(el('p', `Update Mnemosyne to ${info.latest.tag}?`))
  const list = el('ul', undefined, 'small update-changes')
  for (const line of confirmLines(info)) list.append(el('li', line))
  confirm.append(list)
  const buttons = el('div', undefined, 'buttons')
  const cancel = el('button', 'Cancel', 'btn')
  cancel.type = 'button'
  const yes = el('button', 'Update', 'btn primary')
  yes.type = 'button'
  buttons.append(cancel, yes)
  const problem = el('p', undefined, 'warn')
  problem.hidden = true
  confirm.append(buttons, problem)
  const back = () => {
    confirm.hidden = true
    problem.hidden = true
    ask.hidden = false
    ask.focus()
  }
  ask.addEventListener('click', () => {
    ask.hidden = true
    confirm.hidden = false
    cancel.focus()
  })
  cancel.addEventListener('click', back)
  confirm.addEventListener('keydown', event => {
    if ((event as KeyboardEvent).key === 'Escape') back()
  })
  yes.addEventListener('click', () => {
    yes.disabled = true
    cancel.disabled = true
    void host.start().then(error => {
      yes.disabled = false
      cancel.disabled = false
      if (error !== undefined) {
        problem.textContent = error
        problem.hidden = false
        return
      }
      confirm.hidden = true
      renderProgress(progress, { state: 'starting', lines: [`Starting the update to ${info.latest!.tag} ...`], started: '', updated: '' })
      host.started(progress)
    })
  })
  cell.append(ask, confirm, progress)
  // A run already under way (started from another tab, or before a reload): follow it.
  if (isRunning(info.status)) host.started(progress)
  return cell
}
