import { ListedSketch, SketchTargetChanges } from '../../host/design';

export type PixelFreeLine = {
  variant: string;
  text: string;
  note: SketchTargetChanges['note'];
  variantNote: string | null;
};

const droppedText = (states: string[]) =>
  states.length === 0 ? null : `${states.length === 1 ? 'state' : 'states'} ${states.join(', ')} dropped`;

/** One line per variant in `variants` whose every state draws as the part does now, saying what it changes instead. */
export const pixelFreeLinesOf = (
  sketch: Pick<ListedSketch, 'targets' | 'variantInfo'>,
  variants: readonly string[],
): PixelFreeLine[] =>
  variants.flatMap((variant) => {
    const target = sketch.targets?.find((candidate) => candidate.variant === variant);
    const changes = target?.changes;

    if (!target || !changes || target.error || !target.states.every((state) => target.unchanged?.includes(state)))
      return [];

    const facts = [changes.note && 'part note changed', droppedText(changes.dropped)].filter(Boolean);

    return [
      {
        variant,
        text: `${variant} changes no pixel${facts.length > 0 ? `: ${facts.join(', ')}` : ''}`,
        note: changes.note,
        variantNote: sketch.variantInfo?.[variant]?.note ?? null,
      },
    ];
  });
