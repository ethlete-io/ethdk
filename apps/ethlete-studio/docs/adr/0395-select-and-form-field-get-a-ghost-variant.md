---
status: accepted
built: bceb0ba9f
decided: 2026-11-20
source: grill session 2026-11-20 (evening), list item D5
---

# Select and form field get a ghost variant

The form field gets a public input `variant: 'default' | 'ghost'`; a select inside it takes the variant, since the
select draws no chrome of its own. `ghost` draws no border and no background, for toolbars and table cells; `default`
stays as today. An app sets the look through this input, never by
overriding the component's styles.

The human, asked to choose between the new input or per-app style overrides, with the recommendation "the input":
"q2ok".
