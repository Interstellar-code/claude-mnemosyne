// A dev dashboard straight from this checkout, beside the installed one.
//
//   bun run dev:ui                 starts it on 127.0.0.1:47175 and opens the link
//   MNEMOSYNE_UI_PORT=47200 bun run dev:ui   another port
//
// It runs ui/server.ts under `bun --watch` with MNEMOSYNE_UI_DEV=1: the page,
// style and app are read and built again on every request, and the page reloads
// itself within a second when a file in ui/ changes. An edit to the server
// restarts it on the same port with the same token, so the open tab keeps
// working. It reads the real store (read-only, as the installed dashboard does)
// and writes its own ui.json under ~/.claude/mnemosyne/dev-ui, so the installed
// dashboard and its /mnemosyne-ui link are left alone. A search or forget from
// it goes through the engine and the activity log like the installed one's.
// Ctrl-C stops it.

import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const REPO = join(import.meta.dir, '..')
const BASE = process.env.MNEMOSYNE_HOME ?? join(homedir(), '.claude', 'mnemosyne')
const port = Number(process.env.MNEMOSYNE_UI_PORT ?? 47175)
// One token for this run: every restart under --watch keeps it, so the tab's stored token stays good.
const token = randomBytes(32).toString('base64url')

const cli = join(BASE, 'engine', 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'src', 'cli.ts')
if (!existsSync(cli)) {
  console.error(`No installed engine at ${cli}. Run /mnemosyne-setup once in Claude Code first.`)
  process.exit(1)
}

const child = Bun.spawn(['bun', '--watch', join(REPO, 'ui', 'server.ts')], {
  cwd: REPO,
  stdin: 'pipe',
  stdout: 'pipe',
  stderr: 'inherit',
  env: {
    ...process.env,
    MNEMOSYNE_UI_DEV: '1',
    MNEMOSYNE_UI_PORT: String(port),
    MNEMOSYNE_UI_TOKEN: token,
    MNEMOSYNE_ROOT: join(BASE, 'dev-ui'),
    MNEMOSYNE_STORE: join(BASE, 'store'),
    MNEMOSYNE_CLI: cli,
    MNEMOSYNE_ACTIVITY_LOG: process.env.MNEMOSYNE_ACTIVITY_LOG ?? join(BASE, 'activity.jsonl'),
    MNEMOSYNE_PLUGIN_ROOT: REPO,
    MNEMOSYNE_EXTRACTION: process.env.MNEMOSYNE_EXTRACTION ?? 'unknown',
    // On when /mnemosyne-setup downloaded the model (its marker file), as the installed dashboard sees it.
    MNEMOSYNE_EMBEDDINGS: process.env.MNEMOSYNE_EMBEDDINGS ?? (existsSync(join(BASE, 'embeddings.json')) ? 'on' : 'off'),
  },
})

const link = `http://127.0.0.1:${port}/#token=${token}`
let opened = false
void (async () => {
  const decoder = new TextDecoder()
  for await (const chunk of child.stdout) {
    const text = decoder.decode(chunk)
    // The server's ready line ({"port","pid"}) comes once per start; the link is shown and opened on the first.
    if (!opened && text.includes('"port"')) {
      opened = true
      console.log(`Dev dashboard: ${link}`)
      console.log('Edits in ui/ reload the page; edits to ui/server.ts restart the server. Ctrl-C stops it.')
      if (process.platform === 'darwin') Bun.spawn(['open', link])
      else if (process.platform === 'linux') Bun.spawn(['xdg-open', link])
    } else if (text.includes('"port"')) {
      console.log('Server restarted.')
    } else {
      process.stdout.write(text)
    }
  }
})()

const stop = () => {
  child.kill()
  process.exit(0)
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, stop)
process.exit(await child.exited)
