# Use the SDK component where one exists

The earlier `ethlete-sdk-docs` skill listed only part of the component domains, and named some by a
word an agent would not search for. So apps built their own bar charts, avatars and progress bars,
although `@ethlete/components` ships all three. The skill now lists every domain and maps the common
needs to them.

## Before you start

`et update` regenerates the skills when it moves `@ethlete/agent-rules`. If
`.agents/skills/ethlete-sdk-docs/SKILL.md` has no "Check this list before you build any UI by hand"
table, run `npx ethlete-agents sync` first. Read that table: it covers more than the three below.

## Find the call sites

```bash
grep -rnE 'chart|bar-?graph|<rect ' apps libs --include='*.html' --include='*.ts'
grep -rnE 'avatar|initials' apps libs --include='*.html' --include='*.ts' --include='*.css'
grep -rnE 'progress' apps libs --include='*.html' --include='*.ts' --include='*.css'
```

Skip every hit that already uses an `et-` element.

## The replacement for each

| Hand-built                                | SDK component                  | Guide                |
| ----------------------------------------- | ------------------------------ | -------------------- |
| Bar or stacked bar chart, a series legend | `et-bar-chart`                 | `/components/chart`  |
| Initials or a user picture in a circle    | `et-avatar`, `et-avatar-group` | `/components/avatar` |
| Progress bar                              | `et-progress-bar`              | `/components/loader` |

## What to change

1. Read the guide of the component, and map the data the hand-built one received onto its inputs.
2. Replace the markup, and delete the component, the CSS and the helpers only it used.
3. Style it through its `--et-*` tokens, not by overriding its internals.

## Leave these alone

- A visual the SDK component cannot express, such as a chart type it does not have. Report it
  instead of forcing a fit.
- A component another repo imports from this one: replacing it is a change to that repo's contract,
  so report it.

## When you are done

Run the type check, the lint task and the tests of every project you changed, and compare each
replaced view in the browser with how it looked before.

Every component domain is listed at <https://ethlete-sdk-docs.web.app/components/>.
