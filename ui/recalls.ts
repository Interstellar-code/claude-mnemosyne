// What counts as a recall, in ONE place: the server's health report (ui/server.ts) and the
// Activity tab's "Claude recalls today" tile (ui/app.ts) both ask these functions, so the two
// tabs cannot disagree. Pure: no DOM, no I/O.
//
// A dashboard search is logged as a recall (origin ui, the audit trail) but is nobody recalling;
// an outside app's recall (origin external) is real but is not Claude Code's own.

type LogLine = { action?: unknown; origin?: unknown; ok?: unknown; t?: unknown }

const CLAUDE_ORIGINS = ['hook', 'tool', 'trigger']

/** A recall by the Claude Code plugin itself: origin hook, tool or trigger; not ui, not external, not failed. */
export function isClaudeRecall(line: LogLine): boolean {
  return line.action === 'recall' && typeof line.origin === 'string' && CLAUDE_ORIGINS.includes(line.origin) && line.ok !== false
}

/** A recall by another app over MCP (origin external), counted apart from Claude's. */
export function isOtherAppsRecall(line: LogLine): boolean {
  return line.action === 'recall' && line.origin === 'external' && line.ok !== false
}

/** Matching lines per UTC day (the line's `t` date), for the lines that pass `test`. */
export function countByDay(lines: readonly LogLine[], test: (line: LogLine) => boolean): Record<string, number> {
  const days: Record<string, number> = {}
  for (const line of lines) {
    if (typeof line.t !== 'string' || !test(line)) continue
    const day = line.t.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) days[day] = (days[day] ?? 0) + 1
  }
  return days
}
