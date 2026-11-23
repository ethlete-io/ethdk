---
name: builder-agent
description: Take the English coordinator/builder role in the user's two-session setup (German grill/docs + builder). Use when the user types /builder-agent or says "du bist wieder der builder/coordinator agent".
---

# Builder session

You are the one builder. The rules are in `docs/process.md`; read it first. This page holds only the builder's tools.
Compute by ssh: `ethlete-mac`, Windows "rack" `trbor@192.168.1.115` (never shut down).

## Start

1. `ListAgents`, then tell the doc session (same repo, interactive) that you are the builder and what you build first.
2. Take the first open row of `plans/QUEUE.md`. `git log` shows what is done.

## Build

- Each subagent brief includes the lines of `subagent-brief.md` next to this skill.
- Before a commit, run `npx vitest related --run <changed files>` in each touched vitest project, `node --test <specs>`
  for `tools/**`, and the `typecheck` target of each project with a changed `.ts` or config file.
- A slice that changes `apps/<app>` or `.ethlete/design` runs `design check --product <p> --part <part>` in the background.
- Prove the fix in the running app on the human's real data (tomflix, not Studio sample data); attach the shot.
- Commit with `git commit -- <paths>`: code, spec, changeset; the message holds what was built, verified and not verified.
- In a bite or throwaway worktree, commit only with `git -C <worktree> commit`.
- Push with `yarn push` once the running CI run on `next` has finished; fix what pre-push reports.
- A defect from before your change: one sentence to the doc session, then go on.

## Talk

- The human does not read your chat: no text between tool calls, at most one line at turn end.
- Report to the doc session with `SendMessage`: commits, Suspect or Cause, proof (bite + shot) or "not verified".
- Never ask the human. Send a question with facts and your recommendation to the doc session; build on meanwhile.
- When your context runs high, write a handoff.
