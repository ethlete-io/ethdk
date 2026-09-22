---
'@ethlete/core': minor
---

Enrich the drag and resize gesture events:

- `DragHandleDirective`'s `dragStarted` output now emits a `DragStartEvent` with the `clientX` / `clientY` of the initial pointerdown (previously it emitted `void`).
- `DragMoveEvent` now includes `totalDx` / `totalDy`, the cumulative delta from the pointerdown position, alongside the per-step deltas.
- `ResizeMoveEvent` now includes `clientX` / `clientY`.

These give consumers absolute pointer information without having to accumulate the per-step deltas themselves.
