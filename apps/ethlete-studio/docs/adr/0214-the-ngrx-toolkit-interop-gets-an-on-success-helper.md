---
status: accepted
open: et-update-findings 12 T3
decided: 2026-11-06
source: grill session 2026-11-06
---

# The ngrx-toolkit interop gets an on-success helper

fifagg's ngrx-toolkit migration left 13 `NTK-FACADE-ON` tasks (31 type errors): code that reacted to an action's
success (reload a list after a mutation, show a success message) has no replacement in the interop. fifagg built the
same small service twice, emitting when a handle's `callState$` reaches SUCCESS.

The interop (`@ethlete/query/ngrx-toolkit`) gets a small public helper, for example `toolkitOnSuccess(handle)`, that
emits on every success of a handle. `migrate-from-ngrx-toolkit` rewrites `NTK-FACADE-ON` sites to it instead of leaving
a task. The helper belongs to the interop only and goes away with it; plain v3 does not grow. The proof is a trimmed
fifagg fixture (roster or team-members service) that fails before the rewrite. Tom: "q1ok".

Shape (doc agent, applying this decision to the facts of fifagg base 116a0d9afa, 2026-11-06): every `NTK-FACADE-ON`
site there is a global listener keyed by action with no handle in scope (`facade.on(x.success)` and
`.on([a.success, b.success])` in another component), so the helper is keyed by creator:
`toolkitOnSuccess(creatorOrCreators, { injector? })` emits the response each time any `toolkitCall` handle of that
creator in the same environment injector reaches SUCCESS. The generator rewrites both forms; `.failure`, `once()` and
other action types stay a task. No handle overload: one form keeps the interop small.
