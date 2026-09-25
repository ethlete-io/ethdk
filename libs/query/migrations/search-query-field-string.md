# `searchQueryField()` is a `string` that starts at `''`

`searchQueryField()` used to be typed `string | null` and start at `null`. It is typed `string` now and
starts at `''`, so `[formField]` binds it to `<et-input>` under `strictTemplates`. An empty search still
writes no URL param, so URLs do not change. The type check finds most call sites; a comparison with
`null` compiles and silently stops matching.

## Find the call sites

```bash
grep -rnE 'searchQueryField\(' apps libs --include='*.ts' -l
```

In each file found, and in each file that reads the form's value, look for the search field's key
(`search`, `query`, `q`, …) next to `null`:

```bash
grep -rnE '(search|query|q)\b[^;]*(null|\?\?)' apps libs --include='*.ts'
```

## What to change

1. A write of `null` - `setValue({ search: null, … })`, `patchValue({ search: null })`, a seed object,
   a test fixture - writes `''` instead.
2. A check for an empty search - `search === null`, `search !== null`, `search == null`,
   `search ?? ''` - becomes `search === ''`, `search !== ''`, or just `search`. `?? ''` is dead code
   now; delete it.
3. A search that goes into a request body or GraphQL variables passes `search || null` where the API
   expects `null` for "no search". Query params need nothing: the client drops an empty string.
4. A type that restates the value, such as `search: string | null` in an interface built from the
   form, becomes `string`. Prefer deriving it from `ReturnType<typeof qf.value>`.
5. A test that expects `null` for an empty search expects `''`.

## Leave these alone

- `queryField<string>()` fields. They still start at `null`.
- The legacy `SearchQueryField` class. It is unchanged.

## When you are done

Run the type check, the lint task and the tests of every project you changed.

The query forms guide is at <https://ethlete-sdk-docs.web.app/query/query-forms>.
