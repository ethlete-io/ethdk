---
name: handoff
description: Save the current work state to a handoff file so a fresh session can continue seamlessly, or resume from one. Use when context is getting large (the context-warning hook recommends this), when a work chunk is done and the next one starts, or when the user says "handoff", "wrap up", or "continue in a new session". Run /handoff to save; /handoff resume [name] in the new session to pick up.
---

# Session handoff

Long sessions degrade: context fills up, auto-compact loses detail, and cached
tokens get expensive. The fix is to write the durable state to a file and
continue in a fresh session. This skill has two modes:

- **`/handoff`** (no args, or with a short slug) — **save**: write a handoff file.
- **`/handoff resume [name]`** — **resume**: read a handoff file and continue the work.

Handoff files live in `.claude/handoffs/` (gitignored — they are personal,
ephemeral working state, not team docs).

## Save mode

Write `.claude/handoffs/<slug>.md` where `<slug>` is a short kebab-case name for
the task (use the user-provided slug if they gave one, e.g.
`/handoff menu-focus-trap`). If the file exists, overwrite it — a handoff always
describes the *current* state.

**Write for a reader with zero context.** The next session sees none of this
conversation. No "as discussed above", no shorthand invented mid-session. Every
claim must be verifiable from the repo: exact file paths, exact commands.

Template:

```markdown
# Handoff: <task title>

Branch: <git branch> · Last commit: <short sha> <subject>
Working tree: <clean | summary of uncommitted changes>

## Goal

What the overall task is and why. One paragraph max.

## State

- Done: <what is finished and verified, with file paths>
- In progress: <what is half-done, and exactly where it stands>
- Not started: <known remaining work>

## Key files

- `path/to/file.ts` — why it matters here

## Decisions & constraints

Choices already made (and why) that the next session must not re-litigate.
User-stated constraints verbatim.

## Gotchas / dead ends

Things that looked right but weren't. Approaches already tried and rejected,
and why — this is the most valuable section, don't skip it.

## Next steps

1. Concrete, ordered, actionable steps. Each should name files/commands.

## Verify

Commands to check the work (lint, storybook story ids, test commands).

## Follow-ups owed

Changeset written? Docs page updated? (Per CLAUDE.md these are part of any
lib change, not optional.)
```

Before writing, actually check `git status`, `git log -1`, and the branch — do
not describe state from memory. Keep the file under ~150 lines; a handoff is a
map, not a transcript.

After writing, tell the user:

> Handoff saved to `.claude/handoffs/<slug>.md`. Start a fresh session (`/clear`
> or a new terminal) and run `/handoff resume <slug>` to continue.

## Resume mode

1. List `.claude/handoffs/`. Pick the file matching the given name, or the most
   recently modified one if no name was given. If the directory is empty, say so
   and stop.
2. Read the file fully.
3. Verify reality still matches: current branch, `git status`, last commit. If
   they diverge from the handoff (e.g. someone committed in between), say what
   changed and adapt — the repo is the truth, the handoff is the guide.
4. Read any skills the handoff's work obviously needs (e.g. `theming` before
   CSS work) — same rules as always.
5. Continue with the **Next steps** section. Don't redo work listed under
   *Done*; don't re-open questions under *Decisions*.
6. When every next step is complete (including changeset/docs follow-ups),
   delete the handoff file so the directory only contains live handoffs.
