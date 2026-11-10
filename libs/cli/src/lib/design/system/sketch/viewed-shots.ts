import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { workRootOf } from '../../work-root';
import { Sketch, variantContentHashOf } from './sketch';

/** What a live variant of a sketch draws differently from the product, or `null` when it draws the same pixels. */
export type VariantChange = { variant: string; change: string | null };

type ViewedShot = { content: string; shot: string; shotHash: string };

type ViewedFile = Record<string, ViewedShot | string>;

/**
 * The file `design shot` writes its contact sheet to without `--out`: one per part or named sketch, and one per set of
 * `--variant` names, so the shots of two variants never overwrite each other.
 */
export const shotFileOf = (options: {
  target: string;
  product: string;
  part: string;
  sketch?: string;
  variants?: string[];
}) =>
  resolve(
    workRootOf(options.target),
    'shots',
    `${options.product}-${options.part.replace('/', '-')}${options.sketch ? `.${options.sketch}` : ''}${(options.variants ?? []).map((variant) => `-${variant}`).join('')}.png`,
  );

const sketchKeyOf = (sketch: Sketch) => createHash('sha256').update(resolve(sketch.dir)).digest('hex').slice(0, 16);

const viewedFileOf = (options: { target: string; sketch: Sketch }) =>
  resolve(workRootOf(options.target), 'viewed-shots', `${sketchKeyOf(options.sketch)}.json`);

/** The file the design server writes a sketch variant shot to when it hands one out. */
export const viewedShotFileOf = (options: { target: string; sketch: Sketch; variant: string }) =>
  resolve(workRootOf(options.target), 'viewed-shots', `${sketchKeyOf(options.sketch)}-${options.variant}.png`);

const fileHashOf = (file: string) => {
  try {
    return createHash('sha256').update(readFileSync(file)).digest('hex');
  } catch {
    return null;
  }
};

const readViewed = (file: string): ViewedFile => {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ViewedFile) : {};
  } catch {
    return {};
  }
};

/**
 * Records that the CLI drew `shot` of `variant` and handed it out, at the content of `drawn` (the sketch itself unless
 * an older copy of it was drawn). The record holds the hash of the shot file, so it counts only while that file holds it.
 */
export const recordShotViewed = (options: {
  target: string;
  sketch: Sketch;
  variant: string;
  shot: string;
  drawn?: Sketch;
}) => {
  const { target, sketch, variant, shot, drawn = sketch } = options;
  const shotHash = fileHashOf(shot);

  if (shotHash === null) return;

  const file = viewedFileOf({ target, sketch });
  const record: ViewedShot = { content: variantContentHashOf(drawn, variant), shot: resolve(shot), shotHash };

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ ...readViewed(file), [variant]: record }));
};

const unviewedReasonOf = (record: ViewedShot | string | undefined, content: string) => {
  if (typeof record === 'string')
    return record === content
      ? 'its viewed record predates shot hashes, so view the shot again'
      : 'no shot of it was viewed since its last edit';
  if (!record || record.content !== content) return 'no shot of it was viewed since its last edit';
  if (fileHashOf(record.shot) !== record.shotHash)
    return 'the shot it was viewed in is gone or was drawn over, so view the shot again';

  return null;
};

/**
 * One line per variant that draws a pixel diff against the product and has no shot the CLI drew of its current content,
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
  const name = sketch.target.split('@')[1];

  return changes.flatMap(({ variant, change }) => {
    const reason = change === null ? null : unviewedReasonOf(viewed[variant], variantContentHashOf(sketch, variant));

    return reason === null
      ? []
      : [
          `SHOT-NOT-VIEWED ${change} - variant ${variant}: ${reason}: view ` +
            `${shotFileOf({ target, product: sketch.product, part, sketch: name, variants: [variant] })} after ` +
            `\`${invocation} shot ${sketch.target} --states --variants --variant ${variant} --product ${sketch.product}\`, ` +
            `or GET /__design/shot?product=${sketch.product}&part=${part}&sketch=${sketch.target}&variant=${variant}&state=<state>`,
        ];
  });
};
