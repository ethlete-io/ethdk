import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { productCacheDirOf } from '../product';
import { runningRoundOf, Sketch } from './sketch';

/** Why the last `sketch ready` refused a sketch: its refusal lines, the round it judged, and when. */
export type SketchReadyRefusal = { lines: string[]; round: string; at: string };

type Asked = { productDir: string; sketch: Pick<Sketch, 'target' | 'rounds'> };

const refusalFileOf = ({ productDir, sketch }: Asked) =>
  resolve(productCacheDirOf(productDir), 'ready-refusals', `${encodeURIComponent(sketch.target)}.json`);

const isRefusal = (value: unknown): value is SketchReadyRefusal => {
  const entry = value as Partial<SketchReadyRefusal> | null;

  return (
    typeof entry === 'object' &&
    entry !== null &&
    Array.isArray(entry.lines) &&
    entry.lines.every((line) => typeof line === 'string') &&
    typeof entry.round === 'string' &&
    typeof entry.at === 'string'
  );
};

/** Records the refusal `message` of `sketch ready` for the sketch in the product's gitignored cache. */
export const recordReadyRefusal = (asked: Asked & { message: string }) => {
  const file = refusalFileOf(asked);
  const lines = asked.message.split('\n').filter((line) => line.trim() !== '');
  const refusal: SketchReadyRefusal = { lines, round: runningRoundOf(asked.sketch).key, at: new Date().toISOString() };

  mkdirSync(resolve(file, '..'), { recursive: true });
  writeFileSync(file, `${JSON.stringify(refusal, null, 2)}\n`);
};

export const clearReadyRefusal = (asked: Asked) => rmSync(refusalFileOf(asked), { force: true });

/** The recorded refusal of the sketch's running round, or `null` when none is recorded for it. */
export const recordedReadyRefusalOf = (asked: Asked): SketchReadyRefusal | null => {
  const file = refusalFileOf(asked);

  if (!existsSync(file)) return null;

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return isRefusal(parsed) && parsed.round === runningRoundOf(asked.sketch).key ? parsed : null;
  } catch {
    return null;
  }
};
