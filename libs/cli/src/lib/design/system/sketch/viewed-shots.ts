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

/** The file a handed-out shot of a sketch variant is copied to, so its viewed record holds its own copy. */
export const viewedShotFileOf = (options: { target: string; sketch: Sketch; variant: string }) =>
  resolve(workRootOf(options.target), 'viewed-shots', `${sketchKeyOf(options.sketch)}-${options.variant}.png`);

const fileOf = (file: string) => {
  try {
    return readFileSync(file);
  } catch {
    return null;
  }
};

const fileHashOf = (file: string) => {
  const content = fileOf(file);

  return content === null ? null : createHash('sha256').update(content).digest('hex');
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
 * Records that the CLI drew `variant` and handed it out, at the content of `drawn` (the sketch itself unless an older
 * copy of it was drawn). It copies the shot (the `shot` file or the `png` bytes) into the variant's own viewed shot file
 * and holds that copy's hash, so a later shot that rewrites the source file leaves the view intact.
 */
export const recordShotViewed = (
  options: { target: string; sketch: Sketch; variant: string; drawn?: Sketch } & ({ shot: string } | { png: Buffer }),
) => {
  const { target, sketch, variant, drawn = sketch } = options;
  const png = 'png' in options ? options.png : fileOf(options.shot);

  if (png === null) return;

  const shot = viewedShotFileOf({ target, sketch, variant });
  const file = viewedFileOf({ target, sketch });
  const record: ViewedShot = {
    content: variantContentHashOf(drawn, variant),
    shot,
    shotHash: createHash('sha256').update(png).digest('hex'),
  };

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(shot, png);
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
