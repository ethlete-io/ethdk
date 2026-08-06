# Drag & resize

Pointer-gesture primitives: a drag handle directive and a resize handles component. Both are gesture _sources_ - they emit deltas and let you apply them, which is how the [grid](/components/grid) and the stream PIP window build their drag/resize behavior on top.

## Drag handle

`DragHandleDirective` (`[etDragHandle]`) turns any element into a drag gesture source with a commit threshold, so small movements still register as taps:

```html
<div
  (dragTapped)="toggle()"
  (dragStarted)="beginDrag($event)"
  (dragMoved)="updateDrag($event)"
  (dragEnded)="finishDrag()"
  etDragHandle
></div>
```

```ts
import { DragHandleDirective } from '@ethlete/core';
```

| Input             | Default | Description                                               |
| ----------------- | ------- | --------------------------------------------------------- |
| `commitThreshold` | `8`     | Pixels of movement (either axis) before the drag commits. |
| `disabled`        | `false` | Ignore pointer input.                                     |

| Output        | Payload                                                | Emitted                                                 |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| `dragTapped`  | `void`                                                 | Released without ever crossing the threshold.           |
| `dragStarted` | `{ clientX, clientY }`                                 | Threshold crossed (position is the pointerdown origin). |
| `dragMoved`   | `{ stepX, stepY, clientX, clientY, totalDx, totalDy }` | Every pointer move while dragging.                      |
| `dragEnded`   | `void`                                                 | Released after a committed drag.                        |

`isDragging` is exposed as a signal. On commit, the directive captures the pointer and emits a catch-up move in the same tick so the dragged element snaps to the pointer instead of trailing by the threshold. Only the primary button starts a gesture, and a new gesture is ignored while one is active. There is no built-in keyboard support - provide a keyboard path yourself where dragging changes state (the grid does).

While enabled, the handle sets `touch-action: none` on its host so touch drags work - otherwise the browser would claim the pointermoves for scrolling and cancel the gesture. The flip side: touches on the handle can't scroll the page, so keep handles reasonably sized (or `disabled` when inactive - a disabled handle scrolls normally).

## Resize handles

`ResizeHandlesComponent` (`<et-resize-handles>`) renders edge and corner grab handles over its **positioned parent** and emits resize gestures:

```html
<et-resize-handles
  [edges]="['e', 's', 'se']"
  [disabled]="isReadOnly()"
  (resizeStarted)="beginResize()"
  (resizeMoved)="updateResize($event)"
  (resizeEnded)="finishResize()"
/>
```

```ts
import { ResizeHandlesComponent } from '@ethlete/core';
```

| Input      | Default                       | Description                                   |
| ---------- | ----------------------------- | --------------------------------------------- |
| `edges`    | all 8 (`n s e w ne nw se sw`) | Which handles to render.                      |
| `disabled` | `false`                       | Hides the handles from interaction (`inert`). |

| Output          | Payload                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| `resizeStarted` | The `ResizeEdge` being dragged.                                                |
| `resizeMoved`   | `{ edge, dx, dy, clientX, clientY }` - `dx`/`dy` cumulative since pointerdown. |
| `resizeEnded`   | `void`                                                                         |

`isResizing` and `activeEdge` are signals; the active edge is also reflected as `data-active-edge` on the host. Handles set the matching resize cursor per edge. Sizing is themable via CSS custom properties (`--et-resize-handles-edge-size`, `--et-resize-handles-corner-size`, `--et-resize-handles-z-index`, …) - see `resize-handles.component.ts` for the full list and defaults.

Under `any-pointer: coarse` every strip swaps to `--et-resize-handles-touch-edge-size` / `-touch-corner-size` (20px / 28px). The query is `any-pointer`, not `hover: none`, so a touchscreen laptop - where the mouse is the primary input - grows its handles too.

`--et-resize-handles-outset` (default `0px`) grows every strip **outward**, past the host's own box, without moving the handles' inner edge or costing content area. Reach for it where the host sits in dead space it can spill into - a [grid item](/components/grid) grows into half the grid's gap, which is what makes a 6px edge a 14px target. Cap it at half of whatever separates the host from its neighbour: two hosts whose strips overlap are resolved by DOM order, not by which one the pointer is nearer.
