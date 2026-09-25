# Move URL-bound list state to `defineQueryForm`

The earlier query guidance did not name `defineQueryForm`, so list pages wired their filters,
search, sort and paging to the URL by hand: `injectQueryParams()` to read, `router.navigate` to write,
and a draft signal plus an effect in between. `defineQueryForm` does the URL sync, the debounce, the
defaults and the page reset, and the `ethlete-query` skill now says to use it for every filtered,
searched, sorted or paged list.

## Before you start

`et update` regenerates the skills when it moves `@ethlete/agent-rules`. If
`.agents/skills/ethlete-query/SKILL.md` does not mention `defineQueryForm`, run
`ethlete-agents sync` with this repo's package manager (`yarn`, `pnpm exec` or `npx`) first. Read
the skill, then the guide the `Docs` line at the top of this file links (`/query/query-forms` on the
SDK docs site).

## Find the call sites

The reads, with comment lines filtered out:

```bash
grep -rnE 'injectQueryParams?\(|inject\(ActivatedRoute\)|:\s*ActivatedRoute\b|queryParamMap|snapshot\.queryParams|\.queryParams\.(pipe|subscribe)\(' \
  apps libs --include='*.ts' | grep -vE '^[^:]+:[0-9]+:\s*(//|/?\*)'
```

The writes. A navigation spreads its options over several lines, so this prints the `queryParams`
line up to three lines below each call:

```bash
grep -rnE -A3 '\.navigate(ByUrl)?\(|createUrlTree\(|\.(go|replaceState|pushState)\(' apps libs --include='*.ts' \
  | grep -E '\bqueryParams(Handling)?\b|\?[a-zA-Z_-]+='
```

A call site is in scope when the params it reads or writes are the arguments of a list query:
search text, filters, sort, page or page size.

## What to change

1. Declare one `defineQueryForm({ fields })` per list, with a field creator per param
   (`searchQueryField`, `sortQueryField`, `queryField<number>` for the page, and the typed array and
   date creators for filters), and call `.observe()` on it.
2. Give the page field `isResetBy` for the fields that must send the list back to page 1.
3. Feed the query from `withArgs(() => … this.qf.value() …)`.
4. Bind each control with `[formField]="qf.fields.<name>"`.
5. Delete the hand-written reads, writes, draft signals and effects the form replaces.
6. Keep the param names the URL already uses, so saved links keep working. Each field is one param,
   named by its key. Use `queryParamPrefix` when two lists share a route.

### Sort and direction in two params

`sortQueryField()` writes one param as `active:direction` (`?sort=name:asc`). No field maps two
params, so a URL with separate params such as `?sort=name&dir=asc` needs a decision:

- **Keep the URL** (the default). Declare two fields, `sort: queryField<SortKey>(…)` and
  `dir: queryField<'asc' | 'desc'>(…)`, each with a `defaultValue` and a `queryParamToValue` that
  maps an unknown value to the default. Give `dir` `skipInFilterCount: true`: only `sort` is on the
  list of names `activeFilterCount` ignores. Put both in the page field's `isResetBy`.
- **Move to `sortQueryField()`** only when the list binds a table sort that syncs to the URL itself,
  since the table uses the same `active:direction` format. This changes the URL: old links with a
  `dir` param lose their direction. Say so in the commit message.

## Leave these alone

- A param that is not list state, such as a `returnUrl`, a tab id or an opened-detail id. Reading it
  with `injectQueryParam` is correct.
- A one-off `router.navigate` to another page.

## When you are done

No list may read and write its params by hand any more. Run the type check, the lint task and the tests
of every project you changed, and check in the browser that reload, back and forward restore the list.

The guide in the `Docs` line at the top of this file has every field creator, the URL rules and
filter overlays.
