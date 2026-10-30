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

Text after the slug or the name is an instruction from the user, in both modes. In save mode it is
for the session that resumes, so it must reach that session word for word. In resume mode it wins
over the Next steps of the file where the two conflict.

Name one invocation form to the user - your own - and never both. The skill is
installed as `ethlete-handoff`, so under Claude Code the commands are
`/ethlete-handoff` and `/ethlete-handoff resume [name]`; there is no `/handoff`.
Codex has no slash commands, so there the same two are plain prompts without the
leading `/`.

Handoff files live in `{%handoffDir%}/` (gitignored - they are personal,
ephemeral working state, not team docs).

## Handoff mode

Where this repo installs the `context-warning` hook, it names the budget at session start,
turns handoff mode on at 70% of it, and repeats a short note with the remaining budget on
every prompt after that. It reaches you at three points, not only when the user types: at
the start of the session, after a batch of your own tool calls, and as a turn ends. So a
long autonomous run learns its token count while it works.

Handoff mode is not an order to stop. It is the signal to change how you work, so that
either ending - you finish, or a fresh session takes over - stays cheap:

- Work in slices that each end in a committable state. Never leave two half-finished edits
  in the tree.
- Send bulky reads, searches and test runs to a sub-agent. Its output stays out of your
  context; its answer does not.
- Write down each decision and dead end as you reach it, in the commit message or in the
  handoff file. Do not save them for a final summary you may have no room for.
- Start nothing you cannot finish or hand off inside the remaining budget.

At the critical tier (85%) the hook asks you to choose one of two, and to tell the user
which you chose:

1. **Finish the task.** Only when you can name every step that is left, and they plainly
   fit the remaining budget. Finish it, commit, then apply the save test below - the answer
   is then usually that no file is needed at all.
2. **Hand off.** Everything else. Finish the in-flight atomic edit, nothing new, then save.

"Nearly done" means you can name the last steps now. It does not mean the end feels close.
At the last tier (95%) the hook takes option 1 away, because a budget that small covers no
task.

### Ending a turn over the budget

From 85% on, the hook also fires as you try to end the turn, and the turn then continues so
you can act. It adds a third option to the two above:

3. **Cross the boundary on purpose.** Some sessions are worth the premium rate: the task is
   one step from done, or this session holds reasoning that no handoff file survives. Take
   it only for a reason you can name in one sentence right now. Say the reason, say what it
   costs, and keep working.

Option 3 is a judgment call, not a way out of the other two. Naming a reason you cannot
state plainly is the same as taking option 2 late and expensively. The hook asks once per
tier, so it will not block the end of a turn twice for the same budget. It stays quiet while a
handoff is being saved, until the user's next prompt.

## Save mode

**Decide first whether a handoff is needed at all.** One exists so work can resume, so
write one only when at least one of these holds:

- Uncommitted work from this session sits in the tree.
- A step the user asked for is unfinished, blocked, or waiting on a result.
- A decision, dead end, or user constraint from this session is written down nowhere else -
  not in a commit message, a changeset, a docs page, or a plan file.

Check it, never assume it: `git status`, `git log`, and the task as the user stated it. A
context warning is a token count, not evidence that work is left.

If none of them holds, write no file. Tell the user in two or three lines what landed, name
the commits, and say a fresh session needs nothing from this one. A handoff nobody resumes is
noise, and it costs the next session the tokens to read it.

Then give a prompt the user can copy into the fresh session, in a code block: the next task, the
plan file or finding it lives in, and any rule of this session that the repo does not record. Keep
it to a few lines.

An open item counts as the next task: a known gap, an open finding, or an unbuilt step in the plan,
in the task, or in your own report of this session. "Everything waits for the user" is true only
when every open item needs a decision of the user. Then name each decision; do not stop silently.
In a `tmux` session, restart yourself with the next task as the prompt (see the next section) instead
of handing the prompt to the user.

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

## Clear and resume on your own

Run inside a `tmux` session started with the agent-sessions `run` command or the shell functions from `shell-install` (`echo $TMUX` is not empty and
the agent-sessions script `restart` finds the session)? Then you may clear and
resume yourself after the save, instead of asking the user to. You decide. Do it only if every line
is true:

- No sub-agent, workflow or background command still runs. A background command from the old
  session reports back into the new one, and a sub-agent answer has no reader after the clear.
- No answer you wait for is open: a peer session, a mailbox reply, a CI run.
- The tree is committed, or the handoff file names every uncommitted change.
- The handoff file is saved and its Next steps are concrete.

If one line is false, finish or collect that first. If you cannot, hand the prompt to the user as
before. Then run, with the slug of the file you saved:

```bash
node <sessions-skill-dir>/agent-sessions.mjs restart <name> '<resume command> <slug> [<text after the slug>]'
```

If the user wrote text after the slug of the save command, append it to the prompt word for word.
Escape each `'` in it as `'\''`. The restart drops anything you leave out, and the fresh session has
no other way to see it.

`<resume command>` is your own resume form from the top of this guide, with the name this repo
installed the skill under: `/ethlete-handoff resume` under Claude Code, `ethlete-handoff resume`
under Codex. A repo that ships its own copy can name it `handoff`, so check the skill directory
name. A wrong name runs no skill, and the fresh session starts without the file.

`<name>` is the sender name of your session (`claude`, `codex`). The command returns at once. It
types `/clear` (`/new` for a `codex` name) and the prompt into your pane a few seconds later, so
end your turn after you run it and do not start another tool call. The `/clear` wipes the pane, so
the user never sees text you write after the command. Before you run it, put the reason as the
first line of the handoff file: `Restarted because: <one line>`. End the turn with no text.

## Resume mode

1. List `{%handoffDir%}/`. Pick the file matching the given name, or the most
   recently modified one if no name was given. If the directory is empty, say so
   and stop.
2. Read the file fully. If its first line starts with `Restarted because:`, show that line to the
   user first, then delete it from the file.
3. Verify reality still matches: current branch, `git status`, last commit. If
   they diverge from the handoff (e.g. someone committed in between), say what
   changed and adapt - the repo is the truth, the handoff is the guide.
4. **Read only what you are about to change.** The handoff already carries the decisions,
   the constraints and the dead ends, so do not re-read the plan files it summarises, and do
   not survey the directory. Open a source file when you are going to edit it, and load a
   focused guidance file only when the work needs one.
5. Continue with the **Next steps** section. Don't redo work listed under
   _Done_; don't re-open questions under _Decisions_.
6. When every next step is complete, decide whether the handoff can be removed. Delete it
   only if this workflow created it and the save workflow or user authorized cleanup.
   Otherwise report that it is no longer needed and let the user decide.
