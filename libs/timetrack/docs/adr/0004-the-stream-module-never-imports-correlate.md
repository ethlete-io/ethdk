# The stream module never imports the correlate module

`stream/` is the v2 pipeline and `correlate/` is the one it replaces. `stream/` may not import from
`correlate/`. The helpers both need — `contextKey`, `repoRootOf`, `branchOf` and the stream key —
move into `model/`, and both modules import them from there.

`streamDay()` needs the `repoRoots` folding, which is what turned 48 blocks into 21 on 2026-08-12,
and `repoRootOf` is a file-local helper in `correlate/sessionize.ts` today. Exporting it from
`correlate/` would be the smaller change and it makes the boundary nominal: the new pipeline would
depend on the module it exists to replace, and the day `correlate/` is deleted it breaks. A rule
that only holds while nobody tests it is not a rule.

## Consequences

- `model/` holds only rule-free identity and path helpers. A sessionization rule stays where it is.
- The move is mechanical, and lint finds every call site.
