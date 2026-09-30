# Use the SDK component where one exists

The `ethlete-sdk-docs` skill now lists every component domain, with a table that maps common needs
to them ("Check this list before you build any UI by hand"). Apps built their own bar charts,
avatars and progress bars because the old list did not name them. Replacing one restyles its view,
so it happens when someone next edits that view, not in this task.

When you do replace one, check every feature of the hand-built one against the SDK component's
inputs, slots and `--et-*` tokens first, and keep the hand-built one where a feature has no
counterpart. Known gaps:

- `et-bar-chart` renders every category label and only truncates it, and has no slot for a title,
  a note or an empty state.
- `et-avatar` derives initials from `name` only, and takes its colours from a colour theme only.

No code changes in this task. To count the candidates, skipping hits that already use an `et-`
element:

```bash
grep -rlE 'bar-?chart|bar-?graph|avatar|initials|progress-?bar' apps libs --include='*.html' --include='*.ts' | xargs grep -LE '<et-(bar-chart|avatar|progress-bar)' | wc -l
```

## Done when

- The count is in your final message, or in the report you give the developer.

Then delete this task file.
