/** A rectangle of changed pixels, in pixels from the top left of the picture. */
export type ChangedBox = { x: number; y: number; width: number; height: number };

const CLUSTER_GAP = 16;
const MAX_BOXES = 8;

const unionOf = (a: ChangedBox, b: ChangedBox): ChangedBox => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);

  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

/** The smallest box around every one of `boxes`, or `null` for none. */
export const boundsOf = (boxes: ChangedBox[]) =>
  boxes.length === 0 ? null : boxes.reduce((all, box) => unionOf(all, box));

const isNear = ([a, b]: [ChangedBox, ChangedBox], gap: number) =>
  a.x - gap <= b.x + b.width &&
  b.x - gap <= a.x + a.width &&
  a.y - gap <= b.y + b.height &&
  b.y - gap <= a.y + a.height;

/**
 * `boxes` with every two at most `gap` apart merged into one, top to bottom, then left to right. While more than
 * `max` remain, the gap doubles.
 */
export const clusteredBoxesOf = (boxes: ChangedBox[], options: { gap: number; max?: number }): ChangedBox[] => {
  const { max = MAX_BOXES } = options;
  const clusters = [...boxes];
  let gap = options.gap;
  let merged = true;

  while (merged) {
    merged = false;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = clusters.length - 1; j > i; j--) {
        if (isNear([clusters[i] as ChangedBox, clusters[j] as ChangedBox], gap)) {
          clusters[i] = unionOf(clusters[i] as ChangedBox, clusters[j] as ChangedBox);
          clusters.splice(j, 1);
          merged = true;
        }
      }
    }

    if (!merged && clusters.length > max) {
      gap = Math.max(1, gap * 2);
      merged = true;
    }
  }

  return clusters.sort((a, b) => a.y - b.y || a.x - b.x);
};

/** The changed areas of a picture: `boxes` of changed pixels closer than 16 pixels merged, at most eight. */
export const changedAreasOf = (boxes: ChangedBox[]) => clusteredBoxesOf(boxes, { gap: CLUSTER_GAP });
