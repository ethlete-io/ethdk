# 05 — Form field: character counter (+ field busy state)

## Character counter

No `x / N` counter exists anywhere: `form-field.component.ts` has no counter
slot, `et-input`/`et-textarea`/`et-tag-input` expose no component-level
`maxLength`, only the schema-level `maxLength()` validator (which validates
but displays nothing). Material/Mantine/Ark all ship this; it's a standard ask
for bios/descriptions.

Design:

- New `et-counter` support element in the form-field shell, sibling of
  `et-hint`/`et-form-error` in the support region. Layout: hint/error at
  inline-start, counter at inline-end (the common convention); both visible at
  once — the counter does NOT participate in `SUPPORT_CONTENT_STATE`
  swapping, it's persistent. Extend the support-region CSS accordingly
  (`@layer components`, tokens only).
- Value source, in priority order:
  1. Explicit `[max]` input on `et-counter` (works for any control).
  2. Auto-derive from the bound field's schema `maxLength` validator if
     signal-forms exposes it introspectably — investigate first; if not
     cleanly reachable, skip auto-derivation (don't hack into validator
     internals).
- Current length comes from the registered control's value signal
  (string → `.length`; array values like tag-input → count; expose a
  `lengthOf` input fn for custom types).
- Over-limit state: counter gets an error style when length > max (uses the
  error theme via `injectErrorTheme()` semantics per the theming skill), and
  plays nice with the actual validation error shown in the support region.
- A11y: `aria-live="polite"` announcements only at thresholds (e.g. crossing
  90% and reaching/exceeding max), not every keystroke.

## Generic field busy/pending state

Signal-forms async validators produce a pending state; the select has its own
`loading` input but the shell has nothing generic.

- Form-field reads the bound field's pending signal (verify the exact
  signal-forms API for async-validator pending) and exposes a `busy` state:
  a small spinner in the suffix slot area (does not displace an explicit
  consumer suffix — renders after it), plus `aria-busy` on the field.
- Manual override input for non-validator busy cases
  (`[busy]="true"`).
- Keep it subtle: spinner only, no text, no blocking.

## Scope

Shell + input/textarea/tag-input stories. Other controls get the counter for
free via the shell when they have string/array values. Not in scope: word
count (RTE concern), auto-truncation.

## Verification & shipping

Stories: counter with maxLength (type to limit, over limit), counter +
error simultaneously, tag-input count mode, busy state with a slow async
validator. Docs: `forms.md` (shell anatomy section) + `text-inputs.md`.
Changeset: `@ethlete/components` (minor).
