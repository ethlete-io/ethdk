import { SketchChange } from '../../../host/design';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { SKETCH_CURRENT, SketchRow } from './sketches-sample';

type Box = SketchChange['box'];

const MARGIN = 24;
const EVERYWHERE = 0.8;

type CropVariant = Pick<SketchRow, 'key' | 'label'>;

export type SketchCropReason = { variant?: CropVariant; text: string };

export type SketchCropGroup = {
  states: string[];
  change: SketchChange;
  reasons: SketchCropReason[];
  crop: Box;
  magnify: number;
  whole: boolean;
};

const zoneOf = ({ at, size }: { at: number; size: number }, [low, high]: [string, string]) =>
  at < size / 3 ? low : at > (size * 2) / 3 ? high : null;

const placeOf = (change: Pick<SketchChange, 'width' | 'height'>, box: Box) => {
  const row = zoneOf({ at: box.y + box.height / 2, size: change.height }, ['oben', 'unten']);
  const column = zoneOf({ at: box.x + box.width / 2, size: change.width }, ['links', 'rechts']);

  return [row, column].filter(Boolean).join(' ') || SKETCHES_LABELS.middle;
};

const directionOf = ({ from, to }: NonNullable<SketchChange['moves']>[number]) => {
  const x = to.x + to.width / 2 - (from.x + from.width / 2);
  const y = to.y + to.height / 2 - (from.y + from.height / 2);
  const major = Math.max(Math.abs(x), Math.abs(y)) / 3;
  const row = Math.abs(y) >= major ? (y < 0 ? 'oben' : 'unten') : null;
  const column = Math.abs(x) >= major ? (x < 0 ? 'links' : 'rechts') : null;

  return [row, column].filter(Boolean).join(' ');
};

const sameOrNull = (texts: string[]) => (new Set(texts).size === 1 ? (texts[0] ?? null) : null);

/** What a change does and where, in the words of a designer: moved parts with their direction, else the changed places. */
export const changeTextOf = (change: SketchChange) => {
  const areas = change.areas?.length ? change.areas : [change.box];
  const moves = change.moves ?? [];
  const count = change.areas?.length ? areas.length : change.regions;

  if (moves.length === 0 && change.box.width * change.box.height >= change.width * change.height * EVERYWHERE)
    return SKETCHES_LABELS.changedEverywhere;

  if (moves.length === 0) {
    const where = sameOrNull(areas.map((area) => placeOf(change, area)));

    return count <= 1
      ? SKETCHES_LABELS.changedAt(placeOf(change, change.box))
      : SKETCHES_LABELS.changedIn(count, where);
  }

  const direction = sameOrNull(moves.map(directionOf));
  const moved =
    moves.length === 1 && direction
      ? SKETCHES_LABELS.movedTo(direction)
      : SKETCHES_LABELS.movedCount(moves.length, direction);
  const others = Math.max(0, areas.length - moves.length * 2);

  return others > 0 ? SKETCHES_LABELS.alsoChanged(moved, others) : moved;
};

const reasonsOf = (changes: readonly { variant: CropVariant; change: SketchChange }[]): SketchCropReason[] => {
  const reasons = changes.map(({ variant, change }) => ({ variant, text: changeTextOf(change) }));
  const [first] = reasons;

  if (!first) return [];

  return reasons.every((reason) => reason.text === first.text) ? [{ text: first.text }] : reasons;
};

const unionOf = (boxes: Box[]): Box => {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));

  return {
    x: left,
    y: top,
    width: Math.max(...boxes.map((box) => box.x + box.width)) - left,
    height: Math.max(...boxes.map((box) => box.y + box.height)) - top,
  };
};

export const cropOf = (change: Pick<SketchChange, 'width' | 'height'>, box: Box): Box => {
  const x = Math.max(0, box.x - MARGIN);
  const y = Math.max(0, box.y - MARGIN);

  return {
    x,
    y,
    width: Math.min(change.width, box.x + box.width + MARGIN) - x,
    height: Math.min(change.height, box.y + box.height + MARGIN) - y,
  };
};

/**
 * The changed states of the variant rows, one group per crop: states whose every variant changes the same pixels in
 * the same place form one group, in the order the rows list them. A state without a measured change is in no group.
 * A group is `whole` when its crop is the whole picture.
 */
export const cropGroupsOf = (rows: readonly SketchRow[]): SketchCropGroup[] => {
  const variants = rows.filter((row) => row.key !== SKETCH_CURRENT);
  const states = [...new Set(variants.flatMap((row) => row.shots.map((shot) => shot.state)))];
  const groups = new Map<string, SketchCropGroup>();

  for (const state of states) {
    const named = variants.flatMap((row) => {
      const change = row.shots.find((shot) => shot.state === state)?.change;

      return change ? [{ variant: { key: row.key, label: row.label }, change }] : [];
    });
    const changes = named.map(({ change }) => change);
    const [first] = changes;

    if (!first) continue;

    const key = JSON.stringify(variants.map((row) => row.shots.find((shot) => shot.state === state)?.change ?? null));
    const known = groups.get(key);

    if (known) {
      known.states.push(state);
      continue;
    }

    const crop = cropOf(first, unionOf(changes.map((change) => change.box)));

    groups.set(key, {
      states: [state],
      change: first,
      reasons: reasonsOf(named),
      crop,
      magnify: first.width / crop.width,
      whole: crop.width >= first.width && crop.height >= first.height,
    });
  }

  return [...groups.values()];
};
