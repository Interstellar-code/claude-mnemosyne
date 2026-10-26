// Which process is "the Claude session" for the dashboard's users list (bin/ui-users.ts): the hook
// cannot read its own pid, so it runs CLAUDE_PID_SCRIPT and reads the answer with claudeFromChain().
//
// The script walks up the process tree from the shell's parent (the process that ran it: with the
// hook's `$.process.run`, Claude itself) and prints one line per step:
//   <pid> <ppid> <comm>\t<args>
// stopping at the first `claude` it meets, at pid 1, or after CHAIN_MAX steps.
//
// What it looks like on macOS (2026-10-26, Claude Code's native build, Bun 1.4.3): hook code runs
// inside the `claude` process (no worker process between), so the shell's parent is Claude. `comm`
// is `claude` for a session started from a shell, or the full path of the binary (for example
// `/Users/u/Library/.../bin/claude`) for one started another way, so only the last path part counts.
// An npm install of Claude Code runs as `node .../@anthropic-ai/claude-code/cli.js`: then `comm` is
// `node` and its arguments name Claude Code.
export const CHAIN_MAX = 16

export const CLAUDE_PID_SCRIPT = [
  'set -f',
  'p=$PPID',
  'n=0',
  `while [ "$n" -lt ${CHAIN_MAX} ] && [ "$p" -gt 1 ] 2>/dev/null; do`,
  '  line=$(ps -o ppid=,comm= -p "$p") || break',
  '  [ -n "$line" ] || break',
  '  printf "%s %s\\t%s\\n" "$p" "$line" "$(ps -o args= -p "$p")"',
  '  set -- $line',
  '  shift',
  '  comm="$*"',
  '  case "${comm##*/}" in claude|claude.exe) break ;; esac',
  '  set -- $line',
  '  p=$1',
  '  n=$((n + 1))',
  'done',
].join('\n')

export type Step = { pid: number; ppid: number; comm: string; args: string }

/** The steps the script printed, in order (lines it cannot read are left out). */
export function parseChain(text: string): Step[] {
  const steps: Step[] = []
  for (const raw of text.split('\n')) {
    const tab = raw.indexOf('\t')
    const head = (tab < 0 ? raw : raw.slice(0, tab)).trim()
    const args = tab < 0 ? '' : raw.slice(tab + 1).trim()
    const match = /^(\d+)\s+(\d+)\s+(.+)$/.exec(head)
    if (match === null) continue
    steps.push({ pid: Number(match[1]), ppid: Number(match[2]), comm: match[3]!.trim(), args })
  }
  return steps
}

const base = (path: string) => path.split(/[\\/]/).pop() ?? path
const CLAUDE_NAMES = new Set(['claude', 'claude.exe'])
const RUNTIMES = new Set(['node', 'node.exe', 'bun', 'bun.exe'])
// node/bun running Claude Code: the package name, or a `claude` (or claude.js/.mjs/.exe) path part.
const RUNS_CLAUDE = /@anthropic-ai\/claude-code|(^|[\s/\\])claude(\.exe|\.js|\.mjs|\.cjs)?(\s|$)/

/** Whether a step is a Claude process: `claude` itself, or node/bun running Claude Code. */
export function isClaude(step: Step) {
  const name = base(step.comm)
  if (CLAUDE_NAMES.has(name)) return true
  if (!RUNTIMES.has(name)) return false
  // args starts with the runtime itself; only what follows it can name Claude Code.
  const rest = step.args.split(/\s+/).slice(1).join(' ')
  return RUNS_CLAUDE.test(rest)
}

/** The nearest Claude process in the script's output, or null when there is none. */
export function claudeFromChain(text: string): number | null {
  const found = parseChain(text).find(isClaude)
  return found !== undefined && Number.isInteger(found.pid) && found.pid > 1 ? found.pid : null
}
