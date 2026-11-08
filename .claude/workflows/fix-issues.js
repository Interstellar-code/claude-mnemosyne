export const meta = {
  name: 'fix-issues',
  description: 'Reproduce, fix and independently review a batch of GitHub issues, one worktree per issue',
  whenToUse: 'A batch of independent bug issues, each in different files; args = {repo, setup, rules?, issues:[{number, title, location, summary, decision?, testHint}]}',
  phases: [
    { title: 'Fix', detail: 'one agent per issue, own worktree: failing test, smallest fix, commit' },
    { title: 'Review', detail: 'fresh agent per fix, reads only the commit and the issue' },
    { title: 'Refix', detail: 'one more round only where the review found something' },
  ],
}

const FIX = {
  type: 'object',
  properties: {
    issue: { type: 'number' },
    verdict: { type: 'string', enum: ['fixed', 'already_fixed', 'not_reproducible', 'blocked'] },
    worktree: { type: 'string', description: 'absolute path from git rev-parse --show-toplevel' },
    branch: { type: 'string' },
    commit: { type: 'string', description: 'full sha of the fix commit, empty if none' },
    test: { type: 'string', description: 'spec file and test name that fails before and passes after' },
    failedBefore: { type: 'boolean', description: 'the new test was run against the unfixed code and failed' },
    testsRun: { type: 'string', description: 'exact commands run and their pass/fail counts' },
    summary: { type: 'string', description: 'what was wrong and what changed, 2-4 sentences' },
    upstreamNote: { type: 'string', description: 'for engine/ changes: What / Why / Files / Tests lines for engine/UPSTREAM.md, else empty' },
  },
  required: ['issue', 'verdict', 'worktree', 'branch', 'commit', 'test', 'failedBefore', 'testsRun', 'summary', 'upstreamNote'],
}

const REVIEW = {
  type: 'object',
  properties: {
    approved: { type: 'boolean' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'should_fix', 'nit'] },
          file: { type: 'string' },
          problem: { type: 'string' },
          scenario: { type: 'string', description: 'concrete input or state that goes wrong' },
        },
        required: ['severity', 'file', 'problem', 'scenario'],
      },
    },
  },
  required: ['approved', 'findings'],
}

// Repo-specific rules come from args.rules (a string). The defaults below are the repo-neutral part.
const RULES = `
Rules for every change:
- Test first: write a test that shows the bug, run it, and see it FAIL on the unfixed code before you fix anything.
- Smallest fix that makes the test pass. No refactors, no renames, no formatting of untouched lines.
- Then run the tests for the files you touched plus their neighbours. Report the exact commands and counts.
- Commit on the worktree's current branch with a message ending in "(#<issue number>)". Do not push.
- If the bug is already gone on this code, or you cannot reproduce it, say so with the evidence and commit nothing.
${args.rules ?? ''}`

const issues = args.issues

const results = await pipeline(
  issues,

  // Stage 1: reproduce and fix, in its own worktree
  (_, it) => agent(
    `You are fixing GitHub issue #${it.number} in ${args.repo}: "${it.title}".
Reported location: ${it.location}
The report: ${it.summary}
${it.decision ? `The owner decided the intended behaviour: ${it.decision}` : ''}
Testing hint: ${it.testHint}

You are in a fresh git worktree of the repository. First install dependencies: ${args.setup}
The report may be older than the code; check the current code before trusting line numbers.
${RULES}
Return the worktree path (git rev-parse --show-toplevel), branch (git branch --show-current) and the full commit sha.`,
    { label: `fix #${it.number}`, phase: 'Fix', schema: FIX, isolation: 'worktree' }),

  // Stage 2: independent review of the commit (read-only, no worktree)
  (fix, it) => {
    if (!fix || fix.verdict !== 'fixed' || !fix.commit) return { fix, review: null }
    return agent(
      `Review one bug fix in ${args.repo}. You did not write it; your job is to find what is wrong with it.
Issue #${it.number}: "${it.title}". Report: ${it.summary}
${it.decision ? `Intended behaviour decided by the owner: ${it.decision}` : ''}
The fix is commit ${fix.commit} in the worktree ${fix.worktree} (run: git -C ${fix.worktree} show ${fix.commit}).
Check: does the new test really fail without the fix and pass with it (run it; you may check out the parent commit's version of the source in a scratch copy, never in that worktree)? Does the fix cover every path the report names? Can it break existing callers (search the repo for every caller of what changed, including hooks/ and ui/ code reading the engine's replies)? Does it follow the owner's decision exactly?
Do not edit any file. Approve only if you found no blocker and no should_fix.`,
      { label: `review #${it.number}`, phase: 'Review', schema: REVIEW })
      .then(review => ({ fix, review }))
  },

  // Stage 3: one more round where the review found something
  (r, it) => {
    if (!r || !r.review || r.review.approved) return r
    const todo = r.review.findings.filter(f => f.severity !== 'nit')
    if (todo.length === 0) return r
    return agent(
      `A reviewer found problems in your earlier fix for issue #${it.number} in ${args.repo} ("${it.title}").
Work in the existing worktree ${r.fix.worktree} (cd there first; it already has the fix commit ${r.fix.commit}).
${it.decision ? `Intended behaviour decided by the owner: ${it.decision}` : ''}
Findings to address, each with a test where it is a behaviour problem:
${todo.map((f, i) => `${i + 1}. [${f.severity}] ${f.file}: ${f.problem} — scenario: ${f.scenario}`).join('\n')}
If you disagree with a finding, leave the code and explain why in the summary.
${RULES}
Add a new commit (do not amend). Return the same fields; commit = the new head sha.`,
      { label: `refix #${it.number}`, phase: 'Refix', schema: FIX })
      .then(refix => ({ ...r, refix }))
  },
)

return results
