# Decisions

Decisions live in `apps/ethlete-studio/docs/adr/` since 2026-11-04 (ADR 0001).

### Colour foundations and agent logos decisions (2026-10-30)

- ADR 0140: [The foundations/colors part is the one colour source](../../../apps/ethlete-studio/docs/adr/0140-the-foundations-colors-part-is-the-one-colour-source.md)
- ADR 0141: [The colours part drops its copied generator output](../../../apps/ethlete-studio/docs/adr/0141-the-colours-part-drops-its-copied-generator-output.md)
- ADR 0142: [A warning theme of type warning is registered](../../../apps/ethlete-studio/docs/adr/0142-a-warning-theme-of-type-warning-is-registered.md)
- ADR 0143: [No surface token below the surface system](../../../apps/ethlete-studio/docs/adr/0143-no-surface-token-below-the-surface-system.md)
- ADR 0144: [The colours part shows active, disabled and subtle states](../../../apps/ethlete-studio/docs/adr/0144-the-colours-part-shows-active-disabled-and-subtle-states.md)
- ADR 0145: [Studio-only colour tokens stay, labelled](../../../apps/ethlete-studio/docs/adr/0145-studio-only-colour-tokens-stay-labelled.md)
- ADR 0146: [Agent logos come from official sources only](../../../apps/ethlete-studio/docs/adr/0146-agent-logos-come-from-official-sources-only.md)

### State token values decisions (2026-10-30)

- ADR 0147: [State tokens first land with today's values](../../../apps/ethlete-studio/docs/adr/0147-state-tokens-first-land-with-todays-values.md)
- ADR 0148: [State token values are tuned in their own sketch](../../../apps/ethlete-studio/docs/adr/0148-state-token-values-are-tuned-in-their-own-sketch.md)

### Comment cleanup decisions (2026-10-30)

- ADR 0149: [A sketch end resolves its addressed comments](../../../apps/ethlete-studio/docs/adr/0149-a-sketch-end-resolves-its-addressed-comments.md)
- ADR 0150: [Addressed comments of ended sketches are resolved once](../../../apps/ethlete-studio/docs/adr/0150-addressed-comments-of-ended-sketches-are-resolved-once.md)
- ADR 0151: [An addressed comment without a sketch resolves with the next merge of its part](../../../apps/ethlete-studio/docs/adr/0151-an-addressed-comment-without-a-sketch-resolves-with-the-next-merge-of.md)

**As built (2026-10-30):** `sketch merge` and `sketch discard` call `resolveSketchEndComments` before they
address the open comments, so only comments addressed earlier are resolved (note "resolved by the merge of
<target> variant <key>" or "...the discard of <target>"); a merge also resolves the sketch-less addressed
comments of its merged parts. `et design comment resolve-ended [--product]` resolved 45 comments of
`studio` (27 addressed, 18 legacy `resolved` files that read as addressed); open comments were untouched.
