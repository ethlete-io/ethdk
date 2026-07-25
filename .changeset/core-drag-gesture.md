---
'@ethlete/core': minor
---

Export `dragGestureFrom(event, element, { commitThreshold })` — the pointer-drag primitive that
`etDragHandle` is built on, now usable directly. It takes a `pointerdown` and returns an observable of
`start` / `move` / `end` (or a single `tapped` when the pointer never crossed the commit threshold),
completing with the gesture.

Prefer the directive. Reach for the primitive when the draggable element belongs to someone else's
template and you only have a delegated `pointerdown` — the case that motivated this: `et-table`'s
opt-in column-reorder feature attaches a drag to header cells the table itself renders, without the
table having to import any drag code.

`DragHandleDirective` is unchanged and now uses this primitive internally; `DragStartEvent` /
`DragMoveEvent` keep their import path.
