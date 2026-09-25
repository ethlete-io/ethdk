# Replace a hand-debounced search with `searchQueryField`

The earlier query guidance said there was no built-in debounce and to debounce at the input. So a
search box that feeds a query was debounced by hand: `debounceTime` on a stream, a `setTimeout`, or a
debounced copy of the input signal. `searchQueryField()` debounces by itself (300ms), and applies a
cleared input at once.

## Before you start

`et update` regenerates the skills when it moves `@ethlete/agent-rules`. If
`.agents/skills/ethlete-query/SKILL.md` does not mention `searchQueryField`, run
`ethlete-agents sync` with this repo's package manager (`yarn`, `pnpm exec` or `npx`) first.

## Find the call sites

```bash
grep -rnE 'debounceTime\(|debounce\(' apps libs --include='*.ts'
grep -rnE 'setTimeout\(' apps libs --include='*.ts'
```

A call site is in scope when the debounced value ends up in the args of a query.

## What to change

1. Add a `search: searchQueryField()` field to the list's `defineQueryForm`, or declare a form with
   that one field.
2. Call `.observe()` on it. Pass `{ writeToQueryParams: false }` when the search must not reach the
   URL, for example a search inside a dialog.
3. Read `this.qf.value().search` in `withArgs`, and bind the input with `[formField]="qf.fields.search"`.
   Until `searchQueryField()` is typed for it, that binding fails on an `<et-input>` under
   `strictTemplates`: forward the input's value with `qf.patchValue({ search }, { debounce: true })`
   instead.
4. Delete the debounce, the subject or timer, and the intermediate signal.
5. Pass `debounce` to the field when the old delay was deliberately different from 300ms.

If the `list-state-query-form` task already moved this list to a query form, the search is done.

## Leave these alone

- A debounce whose value never reaches a query: resize and scroll handlers, autosave, analytics.
- An SDK control that takes a search input of its own.

## When you are done

Run the type check, the lint task and the tests of every project you changed.

The guide the `Docs` line at the top of this file links (`/query/query-forms` on the SDK docs site)
has the field creators and their options.
