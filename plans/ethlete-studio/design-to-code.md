# Design to code

Status: decided (Tom, 2026-10-31), not built.

## Goal

A merged design becomes code under the control of the system, not of the agent. Tom: "Das System muss machen was
geht, der Agent hat sonst zu viel Freiraum." No implementation without Tom's go (Q153).

### Design to code decisions (Tom, 2026-10-31)

- Q154 check, not generate: the agent implements the design. The system renders the real Angular component in the
  same states and compares it pixel by pixel with the merged design. The goal for SDK components is one shared
  source (the design draws the real template and CSS); the mocks with the real component CSS are close to it today.
- Q155 open points: the system computes a list of open points per part. Studio shows it on the part, and
  `et design check` prints it. A part can be set `ready` only when the list is empty. The system enforces this.
- Q156 the list counts:
  1. A missing state, against the state list for that kind of component (a button without `focus`).
  2. A contrast under the rule: under 3:1 for frames and icons, under 4.5:1 for text.
  3. An open comment on the part.
  4. A sketch in progress, or ready but not merged.
  5. An open question in a plan that names the part. Built last (the system must read the plans).
  6. A part with no linked component (Q157).
  7. The implementation differs from the design (Q159), or the part has no go (Q158).
  8. A missing transition or motion between states.
- Q157 link: the part names its component itself, for example
  `implements: 'apps/ethlete-studio/src/app/…/tree-row.component.ts'`; a page part names its route. No name-based
  guessing. A part without a link is an open point.
- Q158 go: an explicit "Go" action per part in Studio. It stores the design state Tom released. The CLI refuses an
  implementation of a part without a go. A new design change needs a new go.
- Q159 compare: the part declares the inputs per state; the system forces hover, focus and active in the browser.
  Both sides render in the same Chromium with the same fonts. Tolerance 0 px; an exemption per state (for example an
  animation) only with Tom's OK, and it shows as an open point.
- Q160 task: the system gives the agent a fixed task: the part, the released state, the states changed since the
  last implementation, the allowed files, and the target "compare green". The system rejects an implementation that
  changes other files or has a red compare.
- Q161 SDK too: the same flow for the `sdk` product and `libs/components` (go, task, compare). A lib change also
  needs a changeset and docs; the system checks both. This replaces the hand edit after an SDK merge.
- Q162 MVP scope: only the open-point list (Q155, Q156) and the link (Q157) are in the MVP. Go, task and compare come
  after the MVP, before the first implementation. The motion editor is not in the MVP. Tom: the global chat was not
  MVP either ("da haben wir nun schon den Salat"); keep the MVP strict.

## Not decided

- Where the go and the released state are stored (builder call).
- The state list per kind of component for open point 1.
