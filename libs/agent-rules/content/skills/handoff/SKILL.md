---
name: handoff
description: Save the current work state to a handoff file so a fresh session can continue, or resume from one. Use when context is large, a work chunk is done, or on "handoff", "wrap up", "continue in a new session".
kind: skill
scope: both
vars: [handoffDir]
---

# Session handoff

Long sessions degrade: context fills up, auto-compaction loses detail, and cached
tokens get expensive. The fix is to write the durable state to a file and
continue in a fresh session. Two modes:

- **save** ("handoff", "wrap up") - write a handoff file.
- **resume** ("continue from the handoff") - read one and continue the work.

Text after the slug or the name is an instruction from the user, in both modes. In save mode it is
for the session that resumes, so it must reach that session word for word. In resume mode it wins
over the Next steps of the file where the two conflict. A trailing `[typed by agent-sessions]` is the restart's marker, not an instruction.

Name one invocation form to the user - your own - and never both. The skill is
installed as `ethlete-handoff`, so under Claude Code the commands are
`/ethlete-handoff` and `/ethlete-handoff resume [name]`; there is no `/handoff`.
Codex has no slash commands, so there the same two are plain prompts without the
leading `/`.

Handoff files live in `{%handoffDir%}/` (gitignored - they are personal,
ephemeral working state, not team docs).

## Save and handoff mode

Before you save, or when the `context-warning` hook names handoff mode, read {%resource:save.md%}: it holds save mode, handoff mode (the budget tiers), ending a turn over the budget, and clearing and resuming on your own. A resume needs none of it.

## Resume mode

1. List `{%handoffDir%}/`. Pick the file matching the given name, or the most
   recently modified one if no name was given. If the directory is empty, say so
   and stop.
2. Read the file fully. If its first line starts with `Restarted because:`, show that line to the
   user first, then delete it from the file.
3. Verify reality still matches: current branch, `git status`, last commit. If
   they diverge from the handoff (e.g. someone committed in between), say what
   changed and adapt - the repo is the truth, the handoff is the guide. Read each
   result file in `.claude/handoffs/agent-results/` that the handoff names, act on it,
   then delete it. A named agent without a result file still runs.
4. **Read only what you are about to change.** The handoff already carries the decisions,
   the constraints and the dead ends, so do not re-read the plan files it summarises, and do
   not survey the directory. Open a source file when you are going to edit it, and load a
   focused guidance file only when the work needs one.
5. If the handoff name starts with a role prefix (`builder-`, `doc-agent-`) and a skill
   of that name exists (`builder-agent`, `doc-agent`), load that skill now. Do it yourself;
   do not wait for a line in the handoff that asks for it.
6. Continue with the **Next steps** section. Don't redo work listed under
   _Done_; don't re-open questions under _Decisions_.
7. When every next step is complete, decide whether the handoff can be removed. Delete it
   only if this workflow created it and the save workflow or user authorized cleanup.
   Otherwise report that it is no longer needed and let the user decide.
