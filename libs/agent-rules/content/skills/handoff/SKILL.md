---
name: handoff
description: Save the current work state to a handoff file so a fresh session can continue seamlessly, or resume from one. Use when context is getting large, when a work chunk is done and the next one starts, or when the user says "handoff", "wrap up", or "continue in a new session".
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

This skill is installed as `ethlete-handoff`, so under Claude Code the commands
are `/ethlete-handoff` and `/ethlete-handoff resume [name]` - there is no
`/handoff`. Name them that way whenever you tell the user what to run.

Handoff files live in `{%handoffDir%}/` (gitignored - they are personal,
ephemeral working state, not team docs).

## Save mode

Write `{%handoffDir%}/<slug>.md` where `<slug>` is a short kebab-case name for
the task (use the user-provided slug if they gave one). If the file exists,
overwrite it - a handoff always describes the _current_ state.

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

- `path/to/file.ts` - why it matters here

## Decisions & constraints

Choices already made (and why) that the next session must not re-litigate.
User-stated constraints verbatim.

## Gotchas / dead ends

Things that looked right but weren't. Approaches already tried and rejected,
and why - this is the most valuable section, don't skip it.

## Next steps

1. Concrete, ordered, actionable steps. Each should name files/commands.

## Verify

Commands to check the work (lint, storybook story ids, test commands).

## Follow-ups owed

Changeset written? Docs page updated? Whatever this repo treats as part of a
change rather than optional.
```

Before writing, actually check `git status`, `git log -1`, and the branch - do
not describe state from memory. Keep the file under ~150 lines; a handoff is a
map, not a transcript.

After writing, tell the user where it landed and that a fresh session should
resume from it.

## Resume mode

1. List `{%handoffDir%}/`. Pick the file matching the given name, or the most
   recently modified one if no name was given. If the directory is empty, say so
   and stop.
2. Read the file fully.
3. Verify reality still matches: current branch, `git status`, last commit. If
   they diverge from the handoff (e.g. someone committed in between), say what
   changed and adapt - the repo is the truth, the handoff is the guide.
4. Read any focused repository guidance the handoff's work needs - same rules as always.
5. Continue with the **Next steps** section. Don't redo work listed under
   _Done_; don't re-open questions under _Decisions_.
6. When every next step is complete, decide whether the handoff can be removed. Delete it
   only if this workflow created it and the save workflow or user authorized cleanup.
   Otherwise report that it is no longer needed and let the user decide.
