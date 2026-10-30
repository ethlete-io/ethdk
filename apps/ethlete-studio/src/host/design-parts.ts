/** One part as a frame draws it: in a product, or in one variant of one of the product's sketches. */
export type DrawnPart = { product: string; part: string; sketch: { target: string; variant: string } | null };

/**
 * The parts a file change redraws. `all` redraws every frame; `errored` also redraws every frame that
 * shows an error now.
 */
export type PartsRedraw = { all: true } | { all: false; parts: DrawnPart[]; errored?: true };

export type PartsChange = { revision: number } & PartsRedraw;

/** Reads the payload of a `parts` event; null for one this Studio cannot read. */
export const partsChangeOf = (data: unknown): PartsChange | null => {
  if (typeof data !== 'string') return null;

  try {
    const change: unknown = JSON.parse(data);

    if (typeof change !== 'object' || change === null || !('all' in change)) return null;
    if (change.all === true) return { revision: 0, ...change, all: true };

    return 'parts' in change && Array.isArray(change.parts) ? ({ revision: 0, ...change } as PartsChange) : null;
  } catch {
    return null;
  }
};
