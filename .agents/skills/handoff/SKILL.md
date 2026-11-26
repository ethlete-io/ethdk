---
name: handoff
description: Save the current work state to a handoff file so a fresh session can continue seamlessly, or resume from one. Use when context is getting large (the context-warning hook recommends this), when a work chunk is done and the next one starts, or when the user says "handoff", "wrap up", or "continue in a new session".
---

# Session handoff

Long sessions degrade: context fills up, auto-compact loses detail, and cached
tokens get expensive. The fix is to write the durable state to a file and
continue in a fresh session. This skill has two modes:

- **save** (`handoff`, optionally followed by a short slug) - write a handoff file.
- **resume** (`handoff resume [name]`) - read a handoff file and continue the work.

Text after the slug or the name is an instruction from the user, in both modes. In save mode it is
for the session that resumes, so it must reach that session word for word. In resume mode it wins
over the Next steps of the file where the two conflict.

Name one invocation form to the user - your own - and never both. Under Claude
Code that is `/handoff` and `/handoff resume [name]`. Codex has no slash
commands, so there both are plain prompts: drop the leading `/` from every
command this guide quotes, and from `/clear` say "start a new session" instead.

Handoff files live in `.claude/handoffs/` (gitignored - they are personal,
ephemeral working state, not team docs).

## Save and handoff mode

Before you save, or when the `context-warning` hook names handoff mode, read `save.md` next to this file: it holds save mode, handoff mode (the budget tiers), ending a turn over the budget, and clearing and resuming on your own. A resume needs none of it.

## Resume mode

1. List `.claude/handoffs/`. Pick the file matching the given name, or the most
   recently modified one if no name was given. If the directory is empty, say so
   and stop.
2. Read the file fully. If its first line starts with `Restarted because:`, show that line to the
   user first, then delete it from the file.
3. Verify reality still matches: current branch, `git status`, last commit. If
   they diverge from the handoff (e.g. someone committed in between), say what
   changed and adapt - the repo is the truth, the handoff is the guide. Read each
   result file in `.claude/handoffs/agent-results/` that the handoff names, act on it,
   then delete it. A named agent without a result file still runs.
4. **Read only what you are about to change.** The handoff already carries the
   decisions, the constraints and the dead ends, so do not re-read the plan files
   it summarises, and do not survey the directory. Open a source file when you are
   going to edit it, and read a skill only when the work needs one (e.g. `theming`
   before CSS work).
5. If the handoff name starts with `builder-`, invoke the `builder-agent` skill now. If it
   starts with `doc-agent-`, invoke the `doc-agent` skill. Do it yourself; do not wait for a
   line in the handoff that asks for it.
6. Continue with the **Next steps** section. Don't redo work listed under
   *Done*; don't re-open questions under *Decisions*.
7. When every next step is complete (including changeset/docs follow-ups),
   delete the handoff file so the directory only contains live handoffs.
