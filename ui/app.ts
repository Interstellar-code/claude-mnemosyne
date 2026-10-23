// The Mnemosyne dashboard page. Built by ui/server.ts with Bun.build at server
// start and served as /app.js.
//
// The link from /mnemosyne-ui carries the token in the URL fragment
// (#token=...), which no request sends. The page takes it from there, removes
// it from the address bar with history.replaceState, and keeps it in this
// tab's sessionStorage for reloads. Every /api call sends it as an
// Authorization header, never in a URL.
//
// Every element is built with createElement and textContent: no HTML is ever
// parsed from data.

const TOKEN_KEY = 'mnemosyne.token'
const TABS = ['Map', 'Memories', 'Activity', 'Search'] as const

type Health = {
  ok: boolean
  pid: number
  store: string
  total: number
  owners: { owner: string; count: number }[]
  note?: string
}

/** The token in a `#token=<value>` fragment, or undefined. */
export function tokenFromHash(hash: string): string | undefined {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get('token')
  return value && /^[A-Za-z0-9_-]+$/.test(value) ? value : undefined
}

// Takes the token from the fragment (then drops the fragment), else from this tab's storage.
function takeToken(): string | undefined {
  const fromLink = tokenFromHash(location.hash)
  if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`)
  if (fromLink) {
    sessionStorage.setItem(TOKEN_KEY, fromLink)
    return fromLink
  }
  return sessionStorage.getItem(TOKEN_KEY) ?? undefined
}

function byId(id: string) {
  const element = document.getElementById(id)
  if (element === null) throw new Error(`#${id} is missing from index.html`)
  return element
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const element = document.createElement(tag)
  if (text !== undefined) element.textContent = text
  if (className) element.className = className
  return element
}

function setStatus(text: string, kind: 'ok' | 'error' | 'plain' = 'plain') {
  const status = byId('status')
  status.textContent = text
  status.className = kind === 'plain' ? 'status' : `status is-${kind}`
}

// The four views arrive with the next release; the shell shows where they will be.
function drawTabs() {
  const tabs = byId('tabs')
  for (const name of TABS) {
    const tab = el('button', name, 'tab')
    tab.type = 'button'
    tab.disabled = true
    tab.title = `${name} is not built yet`
    tabs.append(tab)
  }
}

function drawHealth(health: Health) {
  const projects = health.owners.length
  byId('summary').textContent = `${health.total} ${health.total === 1 ? 'memory' : 'memories'} · ${projects} ${projects === 1 ? 'project' : 'projects'}`
  const facts = byId('facts')
  facts.replaceChildren()
  const fact = (label: string, value: Node | string) => {
    const dd = el('dd')
    dd.append(value)
    facts.append(el('dt', label), dd)
  }
  fact('Store', el('span', health.store, 'mono'))
  const owners = el('ul', undefined, 'owners')
  for (const { owner, count } of health.owners) owners.append(el('li', `${owner} (${count})`, 'owner'))
  fact('Owners', health.owners.length > 0 ? owners : 'none yet')
  fact('Server', `running, process ${health.pid}`)
  if (health.note) fact('Note', health.note)
  facts.hidden = false
}

async function main() {
  drawTabs()
  const token = takeToken()
  if (token === undefined) {
    setStatus('Open this dashboard with the link from /mnemosyne-ui in Claude Code: it carries the key this page needs.', 'error')
    return
  }
  try {
    const response = await fetch('/api/health', { headers: { Authorization: `Bearer ${token}` } })
    if (response.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY)
      setStatus('This link no longer works (the server was restarted). Run /mnemosyne-ui again for a fresh link.', 'error')
      return
    }
    if (!response.ok) throw new Error(`the server answered ${response.status}`)
    drawHealth((await response.json()) as Health)
    setStatus('Connected to the local Mnemosyne server.', 'ok')
  } catch (err) {
    setStatus(`Could not reach the Mnemosyne server: ${(err as Error).message}. Run /mnemosyne-ui again.`, 'error')
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void main())
  else void main()
}
