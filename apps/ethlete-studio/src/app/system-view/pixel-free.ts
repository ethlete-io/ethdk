import { ListedSketch, SketchTargetChanges } from '../../host/design';
import { STUDIO_LABELS } from '../i18n/studio-labels';

export type PixelFreeLine = {
  variant: string;
  text: string;
  note: SketchTargetChanges['note'];
  variantNote: string | null;
};

const droppedText = (states: string[]) => (states.length === 0 ? null : STUDIO_LABELS.pixelFree.dropped(states));

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

    const facts = [changes.note && STUDIO_LABELS.pixelFree.noteChanged, droppedText(changes.dropped)].filter(Boolean);

    return [
      {
        variant,
        text: STUDIO_LABELS.pixelFree.changesNoPixel(variant, facts.join(', ')),
        note: changes.note,
        variantNote: sketch.variantInfo?.[variant]?.note ?? null,
      },
    ];
  });
