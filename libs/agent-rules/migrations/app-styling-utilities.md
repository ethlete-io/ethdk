# Move app CSS out of `@layer components`

The `app-styling` rule now says how app components are styled: Tailwind utilities in the
template, CSS only for what a utility cannot express, and never an app rule in
`@layer components`. SDK styles are injected into that layer at runtime, after the app's
stylesheet, so an app rule there ties on layer and loses on source order. That is a bug today,
and this task fixes it. The rest of the rule applies when a component is next edited.

## Before you start

If this repo has no `app-styling` rule yet (in `AGENTS.md`, or under `.claude/rules/ethlete/`),
run `ethlete-agents sync` with this repo's package manager (`yarn`, `pnpm exec` or `npx`), then
read the rule. If the repo's own styling rules (a styleguide, `CONTRIBUTING.md`, the parts of
`AGENTS.md` outside the generated block) forbid a change below, follow them and report the
conflict.

## What to change

1. Find the app stylesheets with a `@layer components` block, global stylesheets included:

   ```bash
   grep -rlE '@layer components' apps libs --include='*.css' --include='*.scss' --include='*.sass' --include='*.less'
   ```

2. In each, move the rules out of the block into `@layer utilities`, and delete the empty
   block. In `@layer utilities` a rule still beats the SDK, and does not beat every utility the
   way unlayered CSS would.
3. The move lets these rules win over SDK styles they used to lose to. Check the views that use
   them. Where a view now looks wrong because the old rule was never meant to apply, delete the
   rule instead.

## Leave these alone

- A library that ships its own CSS to other repos. The rule is about app components.
- Generated theme files, such as the surface and colour themes `@ethlete/core` writes.
- `--spacing` and the other rem scales in `@theme`. If the app has not set `--spacing: 0.4rem`,
  setting it now rescales every utility already in use: report it and leave it.
- `html { font-size: 62.5%; }`: if it is missing, report it and leave it. Adding it rescales
  every `rem` the app uses.

## On touch, not in this task

Rewriting BEM classes and component stylesheets to utilities, replacing hardcoded colours with
theme tokens, and adding `ViewEncapsulation.None` to a component that relies on emulated CSS
(its CSS would leak) happen when someone edits that component. Count what is left for the
final message:

```bash
grep -rlE 'styleUrls?:' apps libs --include='*.ts' | wc -l
grep -rlE 'class="[^"]*\b[a-z0-9-]+__[a-z0-9-]+' apps libs --include='*.html' --include='*.ts' | wc -l
grep -rlE '@Component\(' apps libs --include='*.ts' | xargs grep -LE 'ViewEncapsulation\.None' | wc -l
```

## Done when

- The grep in step 1 finds no app stylesheet, apart from the ones under "Leave these alone".
- The type check, lint and build pass for every project you changed.
- Each view that uses a moved rule is checked in the browser. A view you cannot open (the login
  fails, no API) is listed as unchecked in your final message; that does not block the task.
- Your final message gives the three counts above, and whether `--spacing` and the 62.5% root
  are set.

Then delete this task file.
