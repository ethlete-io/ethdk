import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { workRootOf } from '../../paths';
import { Sketch, variantContentHashOf } from './sketch';

/** What a live variant of a sketch draws differently from the product, or `null` when it draws the same pixels. */
export type VariantChange = { variant: string; change: string | null };

type ViewedFile = Record<string, string>;

/**
 * The file `design shot` writes its contact sheet to without `--out`: one per part, and one per set of `--variant`
 * names, so the shots of two variants never overwrite each other.
 */
export const shotFileOf = (options: { target: string; product: string; part: string; variants?: string[] }) =>
  resolve(
    workRootOf(options.target),
    'shots',
    `${options.product}-${options.part.replace('/', '-')}${(options.variants ?? []).map((variant) => `-${variant}`).join('')}.png`,
  );

const viewedFileOf = (options: { target: string; sketch: Sketch }) =>
  resolve(
    workRootOf(options.target),
    'viewed-shots',
    `${createHash('sha256').update(resolve(options.sketch.dir)).digest('hex').slice(0, 16)}.json`,
  );

const readViewed = (file: string): ViewedFile => {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ViewedFile) : {};
  } catch {
    return {};
  }
};

/** Records that a shot of `variant` was handed out, at the content the variant has now. */
export const recordShotViewed = (options: { target: string; sketch: Sketch; variant: string }) => {
  const { target, sketch, variant } = options;
  const file = viewedFileOf({ target, sketch });
  const viewed = { ...readViewed(file), [variant]: variantContentHashOf(sketch, variant) };

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(viewed));
};

/**
 * One line per variant that draws a pixel diff against the product and has no shot handed out since its last edit,
 * naming the command and the address that hand one out.
 */
export const unviewedShotLinesOf = (options: {
  target: string;
  invocation: string;
  sketch: Sketch;
  changes: VariantChange[];
}): string[] => {
  const { target, invocation, sketch, changes } = options;
  const viewed = readViewed(viewedFileOf({ target, sketch }));
  const part = sketch.targets[0] ?? sketch.target;

  return changes
    .filter(({ variant, change }) => change !== null && viewed[variant] !== variantContentHashOf(sketch, variant))
    .map(
      ({ variant, change }) =>
        `SHOT-NOT-VIEWED ${change} - no shot of variant ${variant} was viewed since its last edit: view ` +
        `${shotFileOf({ target, product: sketch.product, part, variants: [variant] })} after ` +
        `\`${invocation} shot ${part} --states --variants --variant ${variant} --product ${sketch.product}\`, ` +
        `or GET /__design/shot?product=${sketch.product}&part=${part}&sketch=${sketch.target}&variant=${variant}&state=<state>`,
    );
};
