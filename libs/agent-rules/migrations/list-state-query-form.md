# Lists with URL state use `defineQueryForm`

The `ethlete-query` skill now says every filtered, searched, sorted or paged list uses
`defineQueryForm`, not `injectQueryParams()`, `router.navigate` and a draft signal wired by hand.
Moving a list is a rewrite of its component, so it happens when someone next edits that list. The
skill says how to keep the old URL working when you do.

No code changes in this task. To see how many components still wire their params by hand, count
the files that both read and write query params:

```bash
grep -rlE 'injectQueryParams?\(|queryParamMap|snapshot\.queryParams|\.queryParams\.(pipe|subscribe)\(' apps libs --include='*.ts' |
  xargs grep -lE '\bqueryParams(Handling)?\b' | wc -l
```

## Done when

- The count is in your final message, or in the report you give the developer.

Then delete this task file.
