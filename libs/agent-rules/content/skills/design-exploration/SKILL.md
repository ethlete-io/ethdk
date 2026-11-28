---
name: design-exploration
description: 'How a visual design exploration runs: step size, what to show the user at each stop, when you may commit. Read BEFORE any visual design work on a sketch, prototype, theme, palette or component look.'
kind: skill
scope: both
vars: [storybookUrl]
---

# Design exploration

A design exploration is a dialog. **The user is the designer. You find and frame. The user
chooses.** A finding is not a licence to pick the fix.

One exception: where the rules of the project give your role its own picks, build your recommendation, record the
pick with `--by <model id>` and report it. Do not stop for a choice then.

The unit of work is one open question, with every answer drawn side by side at the same
geometry: a **sketch** on a product, or a **call** in a repository with the old setup. A variant wins
or loses only against the other variants of its question.

## The rules

1. **One open call at a time.** Take one question. Draw its variants. Stop.
2. **Put the variants in the call, then name your pick.** Two to four variants, drawn for
   real, side by side, labelled, with what each one costs. Your pick is a proposal. Never ask
   the user what they want or a yes/no question about content: deliver strong variants.
3. **Commit only when the user says commit.** A merge in Ethlete Studio counts as
   that word for the merged part: commit the part, not open sketches.
4. **A clear rejection starts the next call.** Settle and record it, then draw
   the next focused question, within the user's original scope. Stop only when the
   user asks to pause or end the exploration, or when their feedback leaves no grounded next
   question.
5. **Keep the answer short.** 120 words at most.
6. **A reference informs, it is not a template.** Before you show a round led by a reference
   (a Figma file, another product), state the problem the reference solves, the principle you take
   from it, and how each variant differs in concept. Then review the variants beside the reference
   for literal copies. Derive the composition from the product's own visual language; a new palette
   or spacing on the reference's layout is not a different concept.

7. **Visible UI is built only from a sketch the user picked.** A new or changed element, label,
   badge or layout needs a picked sketch, and the build brief names its id. "Decision" and
   "regression" items are no exception. Without a picked sketch, build data and specs only and
   stop at the UI.

Confirm the step size once, at the start. A task is not finished while the user is still talking about it.

## What one stop looks like

- The question, in one sentence.
- The sketch (or call slug) to look at.
- The variants, labelled A, B, C, one line each.
- Your pick, one line on why.
- Nothing else. No next step, no second finding.

**Do not send a screenshot.** The user keeps the call open. Screenshot only for your own check that a
variant renders. Do not write a scratch script for batch shots.

If a second defect appears, add it to the open list and give it one line. Do not draw it.

## Where the variants are drawn

The exploration's plan file names the tool. Two shapes exist.

**A repository with a `.ethlete/design` folder** keeps one design system per product, drawn and decided in Ethlete
Studio. Use the Studio design MCP server (`ethlete-design`): its server instructions and its `design_guide` tool
carry the commands, the rules for products and sketches, the checks and the shots. Without that server in your tool
list, ask the user to add it.

**A repository with a sketch Storybook** draws every variant in the **same** story, side by side, under the real
geometry the thing ships in. The default Storybook is {%storybookUrl%}; an app with its own sketch Storybook names its
port in the plan file.

Details, read on demand:

- {%resource:reference-shots.md%}: screenshots of a Storybook story, with forced pseudo-states.

## Check before you look

A broken build draws an overlay, so a screenshot of it looks like a design. **One check covers that, and it is the
whole gate.** Name the files you changed, never a whole project, which is far slower and can fight the user's own
editor. In a Studio repository, run the check the MCP server describes. With a Storybook, copy
{%resource:check-story.mjs%} to the **repository root** first:

```bash
node check-story.mjs --lint <changed files> --tsconfig apps/<app>/.storybook/tsconfig.json
```

It takes about four seconds and needs no dev server. Open a browser only when the check passes and the drawing still
does not appear:

```bash
node check-story.mjs --tsconfig <path> --story <story-id>
```

A passing check says the variant builds, not that it looks good. Before the user sees a variant, look at it at a
readable scale and in its whole host page, and critique its hierarchy, spacing, nesting and host context together.
Drop a visually weak variant before the user sees it. In your summary, say "renders correctly", never "good" or
"approved": the user decides that.

## Delegating a sketch

Every brief names `model: opus`, and every prompt names the exact model id the sub-agent runs on,
for example "Your model id is `claude-opus-5-5`; pass `--by claude-opus-5-5` to every write
command." You know the id because you chose the model; the sub-agent does not, and must not guess.

1. **One agent per sketch.** It draws all the variants of the sketch. Give it the sketch folder, the
   fixture it must not change, and the claim of each variant. Do not spawn one agent per
   variant: each would re-read the skill, the call, the fixture and the example, about 45-57k
   tokens each, so the cost is several times higher. Calls are independent, so several calls
   can run at once, one agent each.
2. **One check-and-fix agent, after the drawing agents return.** Give it the changed files
   and the call slug. It runs the check above, fixes what it reports, and repeats until the
   check says `ok`. It may not change what a variant draws, only what stops it rendering.
3. **One write-up agent, once the user settles the sketch.** Give it the verdict in the
   user's own words and the plan file. It records what won, what lost and why, it sets each
   variant's `verdict` in an old call's `call.ts` (a product sketch needs none; the merge sets the note). It runs while you open
   the next call.

## Writing it down

Every settled call goes in the exploration's plan file: what won, what lost, and why, plus an **Open** list. After a clear rejection, draw the next call from that record without waiting.
