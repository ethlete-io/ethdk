# Move URL-bound list state to `defineQueryForm`

The earlier query guidance did not name `defineQueryForm`, so list pages wired their filters,
search, sort and paging to the URL by hand: `injectQueryParams()` to read, `router.navigate` to write,
and a draft signal plus an effect in between. `defineQueryForm` does the URL sync, the debounce, the
defaults and the page reset, and the `ethlete-query` skill now says to use it for every filtered,
searched, sorted or paged list.

## Before you start

`et update` regenerates the skills when it moves `@ethlete/agent-rules`. If
`.agents/skills/ethlete-query/SKILL.md` does not mention `defineQueryForm`, run
`npx ethlete-agents sync` first. Read the skill, then the guide linked below.

## Find the call sites

```bash
grep -rnE 'injectQueryParams?\(' apps libs --include='*.ts'
grep -rnE 'queryParamsHandling|navigate\(\[\],' apps libs --include='*.ts'
grep -rnE 'ActivatedRoute|queryParamMap' apps libs --include='*.ts'
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
6. Keep the param names the URL already uses, so saved links keep working. Use `queryParamPrefix`
   when two lists share a route.

## Leave these alone

- A param that is not list state, such as a `returnUrl`, a tab id or an opened-detail id. Reading it
  with `injectQueryParam` is correct.
- A one-off `router.navigate` to another page.

## When you are done

No list may read and write its params by hand any more. Run the type check, the lint task and the tests
of every project you changed, and check in the browser that reload, back and forward restore the list.

The guide, with every field creator, the URL rules and filter overlays, is at
<https://ethlete-sdk-docs.web.app/query/query-forms>.
