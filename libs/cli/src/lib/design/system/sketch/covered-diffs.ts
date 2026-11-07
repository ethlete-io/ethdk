import { parseTarget, Sketch, sketchIdOf } from './sketch';

/** The id of the open sketch of `part` that names `state` in its `covers`; `null` when none does or its pick is made. */
export const coveringSketchOf = (options: { sketches: readonly Sketch[]; part: string; state: string }) => {
  const found = options.sketches.find(
    (sketch) =>
      sketch.decision === undefined &&
      sketch.targets.includes(options.part) &&
      (sketch.covers ?? []).includes(options.state),
  );

  if (!found) return null;

  const target = parseTarget(found.target);

  return typeof target === 'string' ? found.target : sketchIdOf(target);
};

/** The line `compare` prints for a DIFF an open sketch covers (ADR 0222). */
export const coveredLineOf = (line: string, sketch: string) => `${line} (covered by open sketch ${sketch}, ADR 0222)`;
