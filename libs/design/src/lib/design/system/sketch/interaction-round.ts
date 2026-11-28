import { INTERACTIONS } from '../../force-interactions';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from './overlay';
import { rejectionOf, runningRoundOf, Sketch } from './sketch';
import { SketchPartLoader } from './unchanged-states';

export const INTERACTION_ROUND_RULE = 'INTERACTION-ROUND';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const drawnInteractionsOf = (definition: unknown): string[] => {
  if (!isRecord(definition)) return [];

  const declared = Array.isArray(definition['interactions']) ? definition['interactions'] : [];
  const grid = definition['grid'];
  const columns =
    isRecord(grid) && isRecord(grid['rows'])
      ? Object.values(grid['rows']).flatMap((cells) => (isRecord(cells) ? Object.keys(cells) : []))
      : [];
  const states = isRecord(definition['states']) ? Object.keys(definition['states']) : [];

  return INTERACTIONS.filter(
    (interaction) =>
      declared.includes(interaction) ||
      columns.includes(interaction) ||
      states.some((state) => state === interaction || state.endsWith(`-${interaction}`)),
  );
};

export const interactionRoundLinesOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
}): Promise<string[]> => {
  const { product, sketch, load } = options;
  const known = new Set(product.parts.map(partKeyOf));
  const fresh = sketch.targets.filter((target) => !known.has(target));
  const round = runningRoundOf(sketch);
  const first = sketch.rounds.length === 1;
  const lines: string[] = [];

  if (fresh.length === 0) return lines;

  const live = sketch.variants.filter(
    (variant) => !rejectionOf(sketch, variant) && sketch.variantInfo[variant]?.round === round.key,
  );

  for (const variant of live) {
    const parts = overlaySketch({ product, sketch, variant }).parts;

    for (const target of fresh) {
      const part = parts.find((entry) => partKeyOf(entry) === target);

      if (!part) continue;

      const loaded = (await load({
        file: part.file,
        product: product.name,
        sketch: { target: sketch.target, variant },
      }).catch(() => null)) as { default?: unknown } | null;
      const drawn = drawnInteractionsOf(loaded?.default);
      const prefix = `${INTERACTION_ROUND_RULE} ${sketch.target} ${variant} ${target}:`;

      if (first && drawn.length > 0)
        lines.push(
          `${prefix} the first round of a new part draws only rest, one state per content, but it draws ` +
            `${drawn.join(', ')} - remove them; once the user picks a base variant, open a second round from it ` +
            `with \`sketch variant ${sketch.target} <key> --from <picked> --round <title> --note <why>\` and draw ` +
            `them there`,
        );

      const missing = INTERACTIONS.filter(
        (interaction) => !drawn.includes(interaction) && !(round.drops ?? []).includes(interaction),
      );

      if (!first && missing.length > 0)
        lines.push(
          `${prefix} round ${round.key} draws the interactions of the picked base, but it lacks ` +
            `${missing.join(', ')} - draw them (interactionRows or \`interactions\`, a disabled row), or drop ` +
            `the ones the part cannot have with \`sketch round ${sketch.target} ${round.key} --drops ` +
            `${missing.join(',')}\``,
        );
    }
  }

  return lines;
};
