import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch } from './sketch';
import { SketchPartLoader } from './unchanged-states';

export const SAMPLE_MARK_DRIFT = 'SAMPLE-MARK-DRIFT';

const SAMPLES = Symbol.for('@ethlete/cli/design/samples');

type Sample = { part: string; id: string; marks: Record<string, unknown> };

type Drawn = { state: string; sample: Sample };

export type SampleMarkDrift = { part: string; id: string; first: Drawn; other: Drawn };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const samplesOf = async (render: (props: unknown) => unknown, props: unknown): Promise<Sample[]> => {
  const samples: Sample[] = [];
  const scope = globalThis as Record<symbol, unknown>;

  scope[SAMPLES] = (sample: Sample) => samples.push(sample);

  try {
    await render(props);
  } finally {
    delete scope[SAMPLES];
  }

  return samples;
};

const marksDifferOf = (first: Sample, other: Sample) =>
  [...new Set([...Object.keys(first.marks), ...Object.keys(other.marks)])].filter(
    (mark) => JSON.stringify(first.marks[mark] ?? null) !== JSON.stringify(other.marks[mark] ?? null),
  );

/**
 * Each embedded sample whose marks differ between two states of the part `definition`: renders every state and
 * compares the marks of the instances that carry the same part and `id`, see `PartSample`. A state that fails to
 * render is skipped.
 */
export const sampleMarkDriftsOf = async (definition: unknown): Promise<SampleMarkDrift[]> => {
  if (!isRecord(definition) || typeof definition['render'] !== 'function' || !isRecord(definition['states'])) return [];

  const render = definition['render'] as (props: unknown) => unknown;
  const seen = new Map<string, Drawn>();
  const drifts = new Map<string, SampleMarkDrift>();

  for (const [state, props] of Object.entries(definition['states'])) {
    const samples = await samplesOf(render, props).catch((): Sample[] => []);

    for (const sample of samples) {
      const key = `${sample.part}\n${sample.id}`;
      const first = seen.get(key);

      if (!first) seen.set(key, { state, sample });
      else if (!drifts.has(key) && marksDifferOf(first.sample, sample).length > 0)
        drifts.set(key, { part: sample.part, id: sample.id, first, other: { state, sample } });
    }
  }

  return [...drifts.values()];
};

const marksOf = (sample: Sample, marks: string[]) =>
  marks.map((mark) => `${mark}=${JSON.stringify(sample.marks[mark] ?? null)}`).join(' ');

export const sampleMarkDriftLineOf = (drift: SampleMarkDrift) => {
  const marks = marksDifferOf(drift.first.sample, drift.other.sample);

  return (
    `${drift.part} "${drift.id}" draws ${marksOf(drift.first.sample, marks)} in ${drift.first.state} but ` +
    `${marksOf(drift.other.sample, marks)} in ${drift.other.state} - give it the same marks in every state, or ` +
    `another id where the state shows another sample`
  );
};

/** One `SAMPLE-MARK-DRIFT` line per sample whose marks differ between two states of a target of a live variant. */
export const sampleMarkDriftLinesOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
}): Promise<string[]> => {
  const { product, sketch, load } = options;
  const lines: string[] = [];

  for (const variant of sketch.variants.filter((entry) => !rejectionOf(sketch, entry))) {
    const parts = overlaySketch({ product, sketch, variant }).parts;

    for (const target of sketch.targets) {
      const file = parts.find((entry) => partKeyOf(entry) === target)?.file;

      if (!file) continue;

      const loaded = (await load({
        file,
        product: product.name,
        sketch: { target: sketch.target, variant },
      }).catch(() => null)) as { default?: unknown } | null;

      for (const drift of await sampleMarkDriftsOf(loaded?.default))
        lines.push(`${SAMPLE_MARK_DRIFT} ${sketch.target} ${variant} ${target}: ${sampleMarkDriftLineOf(drift)}`);
    }
  }

  return lines;
};
