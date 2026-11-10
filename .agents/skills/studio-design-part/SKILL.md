---
name: studio-design-part
description: How to implement a Studio design part as an Angular app component without duplicating, faking or drifting from the design. Read before implementing or changing an app component for a Studio design part (a part with an `implements` link, `et design task`, apps/ethlete-studio/src/app/components and design-parts).
---

# Implement a design part as an app component

A part implemented in isolation passes `design check`, `design task` and `design compare` and still
duplicates, fakes and drifts (finding 151, `plans/ethlete-studio/design-to-code.md`). Those checks judge the
component against its own design only. These rules cover what they do not.

## Start

1. Run `et design task <layer>/<name>` (`et` is `et design`; pass `--product studio`). It
   names the `implements` file, each state with its props and the files you may change.
2. Open the design (`.ethlete/design/<product>/<layer>/<name>/<name>.ts`) and read its imports first.
3. The part's `implements` link (`definePart({ implements: 'apps/ethlete-studio/src/app/.../x.component.ts' })`)
   must point at the component you write. Without it compare, task and implemented refuse the part. Never add
   or move the link as part of the implementation - it changes the design hash and makes the check record stale.

## Compose, never copy

- A design that imports another part (`import { x } from '@system/components/x'`) and that part is implemented:
  use **that part's component** in your template. Never paste its markup. Inbox pasted comment-pin with "TB"
  baked in; the studio logo was pasted twice beside `studio-mark.component.ts`.
- Classes or types you need from another part or a page (frame classes, an entry type) are not copied into
  your folder. Import them from the owner. If the task scope forbids it, stop and report it; do not fork.
- Components that already exist in `apps/ethlete-studio/src/app/components/` (e.g. `studio-mark`) are reused.

## Inputs

- **No sample data as an input default.** `input(SHELL_SAMPLE)` is wrong; so is `INBOX_SAMPLE`. The default is
  empty or neutral (`input<Entry[]>([])`, `input<Entry>()`); the fixture and the harness supply the data.
- **Design-only knobs are not production inputs.** A page design states `openOn`, `draft`, `camera` as
  controls to reach a state. The component takes the data that produces the state, not a knob that fakes it.
- **Every input is bound by an app consumer** (a template under `apps/ethlete-studio/src` other than the
  harness). An input nobody binds is deleted. A part nothing in the app uses is not implemented yet
  (error-toast rendered only in the harness).
- Output events the design declares must be real outputs that the consumer handles.

## Text

All user-visible text comes from `STUDIO_LABELS` (`apps/ethlete-studio/src/app/i18n/studio-labels.ts`).
Add the key there; never inline a string in the template, and never invent a title or `aria-label` the
design lacks (zoom-chip got English titles the design does not have). Read the label in the component
(`protected readonly labels = STUDIO_LABELS`).

## SDK pieces, never hand-made

- **Focus ring: `etFocusRing`** (`@ethlete/components`, `libs/components/src/lib/focus-ring/`; guide
  `apps/docs/components/focus-ring.md`). No `focus-visible:ring-*`, `outline-*` or custom ring CSS.
- **Overlays and anchored dialogs:** the SDK overlay (`injectOverlayManager`, the anchored dialog strategy;
  guides `overlays.md`, `overlay-openers.md`). Never position a popover by hand or draw its arrow in markup
  (inbox hand-built an anchored-dialog arrow).
- **`et-button` internals are not restyled from outside.** No `[&>.et-button-contents]:*`, no
  `hover:bg-transparent` over the button. Pick `variant`, `color`, `size`, or add a button option in the SDK.
- Styling in app templates is Tailwind utilities, no per-component `.css` (see AGENTS.md "Styling").

## Spec

Every part gets `<name>.component.spec.ts`. It renders the component with **data that is not the fixture** (a
different entry count, a long name, an empty list) and asserts text and outputs. The render check uses only
the fixture and sample defaults, so the spec is the only place other data is tried. Cover each output
(click, key) and each state the design names.

## Verify

Run in this order and fix before moving on:

1. `et design check --product <name> --part <layer>/<name>` - static rules, copied components, tsc, open points.
2. `npx nx lint ethlete-studio --fix` and `npx nx test ethlete-studio`.
3. `et design task <layer>/<name> --product <name> --verify` - checks the changed files against the allowed ones, runs
   compare and records `implemented.json`.
4. `et design compare <layer>/<name> --product <name>` - every state `ok` at tolerance 0 (`--url` for a running app).
5. `et design compare --affected --product <name>` - every other implemented part your change reached, on one
   harness, recorded again when green. The UI item is done only when it shows in the app and this run is green
   (ADR 0203); `check --rules --base` names each part it leaves uncompared.

Then grep the app: the component is imported by a consumer, no `*_SAMPLE` in `src/app/components`, no
hard-coded strings. Add a changeset for `ethlete-studio` (skill `changeset`).
