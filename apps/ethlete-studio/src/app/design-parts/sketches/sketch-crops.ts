import { SketchChange } from '../../../host/design';
import { SKETCH_CURRENT, SketchRow } from './sketches-sample';

type Box = SketchChange['box'];

const MARGIN = 24;

type CropVariant = Pick<SketchRow, 'key' | 'label'>;

export type SketchCropReason = { variant?: CropVariant; pixels: number; regions: number };

export type SketchCropGroup = {
  states: string[];
  change: SketchChange;
  reasons: SketchCropReason[];
  crop: Box;
  magnify: number;
};

const reasonsOf = (changes: readonly { variant: CropVariant; change: SketchChange }[]): SketchCropReason[] => {
  const reasons = changes.map(({ variant, change }) => ({ variant, pixels: change.pixels, regions: change.regions }));
  const [first] = reasons;

  if (!first) return [];

  return reasons.every((reason) => reason.pixels === first.pixels && reason.regions === first.regions)
    ? [{ pixels: first.pixels, regions: first.regions }]
    : reasons;
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
    });
  }

  return [...groups.values()];
};

export const magnifyTextOf = (magnify: number) => magnify.toFixed(1).replace('.', ',');
