import { decodePng, Pixels } from './part-compare';

export const PLATFORM_MEASURE_RULE = 'PLATFORM-MEASURE';

const DEFAULT_TOLERANCE = 0.5;

/** The share of the strongest difference from the background a pixel needs to count as ink. */
export const INK_COVERAGE = 0.5;

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

type Side = (typeof SIDES)[number];

/** A `platformMeasures` entry of a part, as `et design check` reads it from the loaded module. */
export type PlatformMeasure = {
  platform: string;
  states: string[];
  target: string;
  width?: number;
  height?: number;
  inset?: { edge: string } & Partial<Record<Side, number>>;
  ink?: { width?: number; height?: number };
  tolerance?: number;
};

/** What the check found on one element a measure targets; `ink` is `null` when it drew no ink. */
export type MeasuredElement = {
  width: number;
  height: number;
  inset: Partial<Record<Side, number>> | null;
  ink?: { width: number; height: number } | null;
};

type Found = { rule: string; path: string; detail: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const numberOr = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const sizeOf = (value: unknown) =>
  isRecord(value) ? { width: numberOr(value['width']), height: numberOr(value['height']) } : undefined;

const insetOf = (value: unknown): PlatformMeasure['inset'] => {
  if (!isRecord(value) || typeof value['edge'] !== 'string') return undefined;

  return {
    edge: value['edge'],
    ...Object.fromEntries(SIDES.flatMap((side) => (numberOr(value[side]) === undefined ? [] : [[side, value[side]]]))),
  };
};

/** The well-formed `platformMeasures` of a loaded part definition that name `state`. */
export const platformMeasuresOf = (definition: unknown, state: string): PlatformMeasure[] => {
  const measures = isRecord(definition) ? definition['platformMeasures'] : undefined;

  if (!Array.isArray(measures)) return [];

  return measures.flatMap((measure: unknown) => {
    if (!isRecord(measure) || typeof measure['target'] !== 'string' || typeof measure['platform'] !== 'string')
      return [];

    const states = Array.isArray(measure['states'])
      ? measure['states'].filter((name): name is string => typeof name === 'string')
      : [];

    if (!states.includes(state)) return [];

    return [
      {
        platform: measure['platform'],
        states,
        target: measure['target'],
        width: numberOr(measure['width']),
        height: numberOr(measure['height']),
        inset: insetOf(measure['inset']),
        ink: sizeOf(measure['ink']),
        tolerance: numberOr(measure['tolerance']),
      },
    ];
  });
};

/** The width and height of the pixels of `pixels` that differ from its most frequent colour by at least `INK_COVERAGE` of the strongest difference. */
export const inkBoxOf = (pixels: Pixels): { width: number; height: number } | null => {
  const { width, height, data } = pixels;
  const counts = new Map<number, number>();

  for (let at = 0; at < width * height; at++) {
    const word = data.readUInt32BE(at * 4);

    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const background = [...counts.entries()].reduce((best, entry) => (entry[1] > best[1] ? entry : best), [0, -1])[0];
  const channels = [background >>> 24, (background >>> 16) & 255, (background >>> 8) & 255];
  const differences = new Float64Array(width * height);
  let strongest = 0;

  for (let at = 0; at < width * height; at++) {
    const difference = Math.max(...channels.map((channel, index) => Math.abs((data[at * 4 + index] ?? 0) - channel)));

    differences[at] = difference;
    strongest = Math.max(strongest, difference);
  }

  if (strongest === 0) return null;

  let [left, top, right, bottom] = [width, height, -1, -1];

  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if ((differences[y * width + x] ?? 0) >= strongest * INK_COVERAGE) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }

  return { width: right - left + 1, height: bottom - top + 1 };
};

const px = (value: number) => `${Math.round(value * 100) / 100}px`;

/** One line per declared value of `measure` that `measured` misses by more than its tolerance. */
export const measureProblemsOf = (measure: PlatformMeasure, measured: MeasuredElement): string[] => {
  const tolerance = measure.tolerance ?? DEFAULT_TOLERANCE;
  const missed = (name: string, [declared, value]: [number | undefined, number | undefined]) =>
    declared === undefined || (value !== undefined && Math.abs(value - declared) <= tolerance)
      ? []
      : [`${name} ${value === undefined ? 'not measurable' : px(value)}, ${measure.platform} declares ${px(declared)}`];

  return [
    ...missed('width', [measure.width, measured.width]),
    ...missed('height', [measure.height, measured.height]),
    ...(measure.inset && !measured.inset ? [`inset edge ${measure.inset.edge} matches no element`] : []),
    ...SIDES.flatMap((side) => missed(`${side} inset`, [measure.inset?.[side], measured.inset?.[side]])),
    ...(measure.ink && measured.ink === null ? [`no ink drawn, ${measure.platform} declares ink`] : []),
    ...missed('ink width', [measure.ink?.width, measured.ink?.width]),
    ...missed('ink height', [measure.ink?.height, measured.ink?.height]),
  ];
};

type MeasurePage = {
  evaluate(script: string): Promise<unknown>;
  locator(selector: string): { nth(index: number): { screenshot(): Promise<Buffer> } };
};

type MeasuredBox = Omit<MeasuredElement, 'ink'>;

const boxesScriptOf = (
  target: string,
  edge: string | null,
) => `[...document.querySelectorAll(${JSON.stringify(target)})].map((element) => {
  const box = element.getBoundingClientRect();
  const edge = ${JSON.stringify(edge)};
  const edgeBox = edge ? (element.closest(edge) ?? document.querySelector(edge))?.getBoundingClientRect() : null;

  return {
    width: box.width,
    height: box.height,
    inset: edgeBox
      ? { top: box.top - edgeBox.top, right: edgeBox.right - box.right, bottom: edgeBox.bottom - box.bottom, left: box.left - edgeBox.left }
      : null,
  };
})`;

/** Measures every `measures` entry in the drawn `page`, as render issues of the `PLATFORM-MEASURE` rule. */
export const platformMeasureIssuesOf = async (page: MeasurePage, measures: PlatformMeasure[]): Promise<Found[]> => {
  const found: Found[] = [];

  for (const measure of measures) {
    const boxes = (await page.evaluate(boxesScriptOf(measure.target, measure.inset?.edge ?? null))) as MeasuredBox[];

    if (boxes.length === 0)
      found.push({
        rule: PLATFORM_MEASURE_RULE,
        path: measure.target,
        detail: `matches no element, so no ${measure.platform} measure was taken`,
      });

    for (const [index, box] of boxes.entries()) {
      const ink = measure.ink
        ? inkBoxOf(decodePng(await page.locator(measure.target).nth(index).screenshot()))
        : undefined;
      const problems = measureProblemsOf(measure, { ...box, ink });

      if (problems.length > 0)
        found.push({
          rule: PLATFORM_MEASURE_RULE,
          path: boxes.length > 1 ? `${measure.target} #${index + 1}` : measure.target,
          detail: problems.join('; '),
        });
    }
  }

  return found;
};
