# Open: 6. Agent process

### 6.5 Completed sketch rounds were mistaken for complete product coverage - open

- **Pain (2026-10-30):** after Switch and Project Picker were merged, the agent proposed only remaining page states and
  then app implementation. Much of Studio is still undesigned: `pages/inbox` has no comment composer or thread reply
  state, `pages/merge` has only `open` (not comparison progress, comparison errors or a refused merge), the start drawing
  sends product creation to the CLI while the app has a form. Missing interaction designs: repo and project picker hover
  and menu, tree-icon tooltips, Inbox and Merge changed-list hover, canvas zoom controls, the preset select's open body,
  the Merge unchanged accordion.
- **Now:** the coverage inventory file is deleted (B597); `design complete` (ADR 0127) gates controls. A
  page's presence, a CSS pseudo-state or a native `title` does not count as a reviewed interaction design.
- **Still open:** the inventory is a source audit, not an exhaustive product review.

### Parked: open points on `pages/sketches` (2026-10-29)

Parked until all pages exist and the components are extracted: several state rows per variant with the head on the top
frame, "Wird gezeichnet" placeholders, the head of the "Aktuell" column, pins and comments at zoom (keep them at screen
size), several screen sizes side by side.
