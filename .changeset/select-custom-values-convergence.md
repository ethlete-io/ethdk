---
'@ethlete/components': minor
---

Select: full tag-input ergonomics in custom-value mode (`allowCustomValues`).

- A "Create …" listbox row (label via `createLabel`) now offers the query as a custom value even while options still match — keyboard-reachable via virtual focus; headless compositions use `customValueCandidate()` + `customValueOption`.
- New inputs: `customValueSeparators` (characters that commit while typing and split pastes), `commitCustomValueOnClose` (pending text commits on Tab/outside-click close instead of being discarded), `normalizeCustomValue` (map/reject raw text), and `maxSelection` (caps multi selection and locks the search input while full, exposed as `isFull()`; unselected options render disabled while full — deselecting frees them again).
- `commitCustomValue(raw)` is now public for imperative commits.
