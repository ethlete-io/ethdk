const ANTI_ALIAS_TOLERANCE = 8;

/** `true` when any channel of two RGBA pixels (as 32-bit words) differs by more than 8 of 255; a smaller shift is anti-alias, no change. */
export const pixelsDiffer = (a: number, b: number) =>
  Math.abs((a >>> 24) - (b >>> 24)) > ANTI_ALIAS_TOLERANCE ||
  Math.abs(((a >>> 16) & 255) - ((b >>> 16) & 255)) > ANTI_ALIAS_TOLERANCE ||
  Math.abs(((a >>> 8) & 255) - ((b >>> 8) & 255)) > ANTI_ALIAS_TOLERANCE ||
  Math.abs((a & 255) - (b & 255)) > ANTI_ALIAS_TOLERANCE;

const channelsOf = (word: number) => [word >>> 24, (word >>> 16) & 255, (word >>> 8) & 255, word & 255];

type Picture = { words: Uint32Array; width: number; height: number };

const insideRange = (value: number, at: { picture: Picture; x: number; y: number }) => {
  const { picture, x, y } = at;
  const { words, width, height } = picture;
  const channels = channelsOf(value);

  return channels.every((channel, index) => {
    let min = 255;
    let max = 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

        const near = channelsOf(words[ny * width + nx] as number)[index] as number;

        min = Math.min(min, near);
        max = Math.max(max, near);
      }
    }

    return channel >= min && channel <= max;
  });
};

/**
 * Of the pixels marked in `over` (same-sized pictures, row-major), those that are isolated anti-alias on a round edge:
 * no neighbour is over the tolerance, and each picture's value lies inside the other picture's 3x3 range on every channel.
 */
export const isolatedAntiAlias = (options: {
  design: Uint32Array;
  app: Uint32Array;
  width: number;
  height: number;
  over: Uint8Array;
}) => {
  const { design, app, width, height, over } = options;
  const passed = new Uint8Array(over.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * width + x;

      if (!over[at]) continue;

      let lonely = true;

      for (let dy = -1; dy <= 1 && lonely; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < width && ny < height && over[ny * width + nx]) {
            lonely = false;
            break;
          }
        }
      }

      if (
        lonely &&
        insideRange(design[at] as number, { picture: { words: app, width, height }, x, y }) &&
        insideRange(app[at] as number, { picture: { words: design, width, height }, x, y })
      )
        passed[at] = 1;
    }
  }

  return passed;
};
