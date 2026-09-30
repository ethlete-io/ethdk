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
2. Call `.observe()` on it. Keep the URL behaviour the old search had. If it did not write the
   URL, as a search inside a dialog, pass `{ writeToQueryParams: false, syncOnNavigation: false }`.
   `writeToQueryParams: false` alone stops the writes only: the form still reads the page's own
   params, such as `page`.
3. Read `this.qf.value().search` in `withArgs`, and bind the input with `[formField]="qf.fields.search"`.
4. Delete the debounce, the subject or timer, and the intermediate signal.
5. Pass `debounce` to the field when the old delay was deliberately different from 300ms.

If the search text is part of list state the component syncs to the URL by hand, skip the call
site: it moves with the rest of the list to `defineQueryForm` when that list is next edited.

## Leave these alone

- A debounce whose value never reaches a query: resize and scroll handlers, autosave, analytics.
- An SDK control that takes a search input of its own.

## Done when

- No hit of the greps above feeds a query any more, apart from the hand-synced lists you skipped.
  Your final message names each skipped one.
- The type check, lint and tests pass for every project you changed.

Then delete this task file.

The guide the `Docs` line at the top of this file links (`/query/query-forms` on the SDK docs site)
has the field creators and their options.
