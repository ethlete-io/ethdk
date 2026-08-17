---
name: timetrack
description: How to reach Jira from any repo through the running Timetrack app - look up an issue, search for one, ask which project a repo logs into, file a ticket, or add a worklog row. Read whenever a task needs Jira data or a Jira write, and never put a Jira token in a repo.
kind: skill
scope: both
---

# Reaching Jira through Timetrack

**No repository holds a Jira token.** The Timetrack desktop app holds one set of credentials
in this machine's keychain, and every repository asks it:

```bash
npx ethlete-agents timetrack status                 # is the app reachable, and what does it hold?
npx ethlete-agents timetrack issue FIP-2177         # one issue: summary, type, parent, subject
npx ethlete-agents timetrack search "password"      # open issues of the picked projects
npx ethlete-agents timetrack project                # which project does this repo log into?
```

Add `--json` to any of them when you need to read a field rather than a line.

**Never ask the user for a Jira token, and never write one into a file.** If a command reports
that the app is not running, say so and ask the user to start it. That is the whole fix -
there is no per-repo fallback, by design: a secret copied into every checkout is a secret
nobody can rotate.

## What each command is for

| Command                           | Use it when                                                             |
| --------------------------------- | ----------------------------------------------------------------------- |
| `status`                          | Before anything else, when a Jira command failed and you need the cause |
| `issue <KEY>`                     | The user names a key and you need its summary, type or parent           |
| `search [text]`                   | The user describes work but names no key                                |
| `project [path]`                  | You need the project a repository files into                            |
| `create --summary "…"`            | The work has no ticket and the user asked for one                       |
| `log --issue <KEY> --minutes <n>` | The user asks to record time that nothing observed                      |

`git-flow start` uses the same channel, so a branch is named from the real issue rather than
from a key you typed - see the `git-flow` skill.

## Writes

Two commands write, so both need the user to have asked for them in this conversation:

```bash
npx ethlete-agents timetrack create --summary "Reset password mail is not sent" --project FIP
npx ethlete-agents timetrack log --issue FIP-2177 --minutes 45 --description "pairing call"
```

- **`create`** files the issue with the instance's own ticket settings - its type, its parent
  rule and its subject field all come from the app, so the ticket is shaped like every other.
  `--project` is needed unless the app holds exactly one picked project.
- **`log`** adds a row to the day in Timetrack. It is **not** a Tempo entry: the user reviews
  the day and syncs it, which is what keeps an agent's row from double-booking against the
  hours the day already observed. `--at <date>` places it; without one it starts now.

## What the app decides, not you

- **The projects.** The user picked them in Timetrack. `search` is scoped to them, and
  `--project <KEY>` is how you look outside.
- **The branch subject.** `issue` returns `subject` when the instance's subject field is set on
  that issue. Prefer it over the summary; the summary is a paraphrase.
- **The instance.** Its host, its issue types and its hierarchy are settings in the app. Do not
  hardcode any of them in this repo.
