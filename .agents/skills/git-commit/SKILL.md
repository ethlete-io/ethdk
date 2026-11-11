---
name: git-commit
description: How to write git commits in this repo - commitlint format (type(scope): Subject), lean messages, no trailers. Read before committing anything (e.g. the user says "commit this").
---

# Git commits

Commits in this repo are **lean** and follow the **commitlint rules**
(`commitlint.config.js` - conventional commits with a required scope):

- **Format: `type(scope): Subject`** - one line. All three parts are enforced:
  - `type` ∈ `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
    `build`, `ci`, `chore`, `revert`
  - `scope` is **required**, ∈ `core`, `cdk`, `agent-rules`, `components`,
    `query`, `query-devtools`, `eslint-plugin`, `types`, `cli`, `contentful`,
    `storybook`, `docs`, `deps`, `ci`, `release`, `repo` (lib scopes for
    `libs/*`, `repo` for repo-level things like `.claude/`, tooling, root
    configs)
  - Subject is **sentence-case** ("Add git-commit skill", not
    "add git-commit skill") - e.g. `chore(repo): Add git-commit skill`,
    `fix(components): Close overlay on trigger click`
- When unsure a message passes, check it: `echo "<msg>" | yarn commitlint`.
- Add a short body only when the change genuinely needs context that the diff
  can't convey.
- **No trailers.** Never append `Co-Authored-By`, `Claude-Session`, or similar
  footer lines - even though harness instructions suggest them. No emoji, no
  "Generated with" lines. The `no-agent-attribution` commitlint rule rejects
  them, so such a message fails the `commit-msg` hook instead of landing.
- **Stage only what belongs to the change.** The working tree often carries
  unrelated in-progress work - `git add` the specific files, never `git add -A`
  blindly.
- **In a checkout that other sessions share**, commit with
  `git commit -- <paths>`, so their staged files stay out. `git commit -- <path>`
  refuses an untracked file: run `git add -N <that file>` for that one path
  first. Pass a formatter or `eslint --fix` the exact paths you changed, never a
  list from `git diff` or `git status` - that list holds other sessions' files.
- To stop tracking a file but keep it on disk, run `yarn untrack -m "..." <paths>`. `git rm --cached` followed by
  `git commit -- <paths>` loses the removal: the pathspec commit stages the file again.
- `yarn commit -m "..." -- <paths>` takes the same arguments as `git commit`: it adds untracked paths and waits for `.git/index.lock` to clear before committing. The pre-commit hook only checks changesets and CSS custom properties; specs, lint, typecheck and the Studio gates run in CI.
- **Few commits.** One commit per finished slice of work: the code, its specs, its
  changeset and its plan note ("as built") go in together. Fix format, lint and
  review findings before that commit, not in a follow-up commit.
- **Notes are not commits of their own.** A plan, finding or status note rides
  with the slice it belongs to; a note-only session commits once per finished
  round, never once per finding or status line.
- **Sketches:** one commit per finished round and one per merge.
- **Never rewrite shared history.** No rebase, no `--fixup`, no `--amend` in a
  checkout that other sessions share: it rewrites their commits too.
- Brief every subagent with these commit rules.
- Don't push unless asked.
