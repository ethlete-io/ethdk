---
name: timetrack
description: How to reach Jira from any repo through the running Timetrack app - look up an issue, search for one, ask which project a repo logs into, file a ticket, add a worklog row, read the evidence a day holds, or list the work that still waits for a ticket. Read whenever a task needs Jira data, a Jira write, or the day's own events, and never put a Jira token in a repo.
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
npx ethlete-agents timetrack instance               # the instance's own levels and custom fields
npx ethlete-agents timetrack standins               # work the user named that Jira does not hold yet
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
| `instance`                        | A setup step needs the instance's levels or its branch-subject field    |
| `issue <KEY>`                     | The user names a key and you need its summary, type or parent           |
| `search [text]`                   | The user describes work but names no key                                |
| `project [path]`                  | You need the project a repository files into                            |
| `create --summary "…"`            | The work has no ticket and the user asked for one                       |
| `log --issue <KEY> --minutes <n>` | The user asks to record time that nothing observed                      |
| `day [YYYY-MM-DD]`                | You need the evidence a day holds, not a screenshot of it               |
| `rules`                           | You need to know why a band was named, or why it was not                |
| `standins`                        | You need to know which work still waits for a ticket, and for how long  |

`git-flow start` uses the same channel, so a branch is named from the real issue rather than
from a key you typed. Follow the repository's branch workflow when creating a branch.

## Reading a day

The app's store is encrypted, so no shell reads a day off disk. `day` is the only way in:

```bash
npx ethlete-agents timetrack day                       # today: how many events, and of which kind
npx ethlete-agents timetrack day 2026-09-10 --out /tmp/day.json
```

A real day holds thousands of events, so **never print them**. Write them to a file with
`--out`, then read that file from a test or a script. Without `--out` the command reports
only the counts, which is what tells you whether a day holds the source you are looking for.

## Why a band carries the name it does

`rules` reads the settings that name a day's work - the attribution rules, the project links,
the background projects and the applications the user has ruled in or out. It holds no host, no
account and no token, so it is safe to quote back to the user.

```bash
npx ethlete-agents timetrack rules            # a summary of the rules
npx ethlete-agents timetrack rules --json     # the whole answer
```

Read it before claiming a band should have been named something: a rule that donates its time
carries no issue key, and a project in `backgroundProjects` keeps only the minutes no other
band claims.

## Work with no ticket yet

A **stand-in** is a name the user gave work that Jira does not hold yet. It takes bands across
days and across checkouts, and it books nothing. `standins` lists them:

```bash
npx ethlete-agents timetrack standins         # the open ones, oldest first
npx ethlete-agents timetrack standins --json  # the whole answer, resolved ones included
```

Read it, report it, and stop there. **Never open or resolve a stand-in.** The name is the
user's own word for their work, and the app is the only place they give it. If the user asks
for a ticket, use `create` and tell them to resolve the stand-in in Timetrack.

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
