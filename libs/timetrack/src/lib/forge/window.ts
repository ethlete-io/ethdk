/** How far before the newest stored event a forge read starts. Wide enough that yesterday evening is still in it. */
export const FORGE_READ_OVERLAP_MS = 26 * 60 * 60_000;

/** The furthest a forge read reaches back, and what it reads when nothing of its source is stored yet. */
export const FORGE_READ_MAX_WINDOW_MS = 30 * 24 * 60 * 60_000;

export type ForgeReadWindow = {
  from: Date;
  to: Date;
  /** The newest event of the source the store already holds. A cap that stops short of it lost nothing. */
  coveredThrough: Date | null;
};

/**
 * The window one forge read covers: from the newest stored event of its source, less an overlap, to
 * `at`. It reaches back the full thirty days only when nothing of the source is stored yet, so a
 * restart does not re-read a month into the feed and lookup caps.
 */
export const forgeReadWindow = (options: { at: Date; newestStored: Date | null }): ForgeReadWindow => {
  const { at, newestStored } = options;
  const earliest = at.getTime() - FORGE_READ_MAX_WINDOW_MS;

  if (!newestStored) return { from: new Date(earliest), to: at, coveredThrough: null };

  const resumeAt = Math.min(newestStored.getTime(), at.getTime()) - FORGE_READ_OVERLAP_MS;

  return { from: new Date(Math.max(earliest, resumeAt)), to: at, coveredThrough: newestStored };
};

/** Whether an instant lies inside what the store already holds of the source. */
export const isForgeCovered = (at: Date, coveredThrough: Date | null | undefined) =>
  !!coveredThrough && at.getTime() <= coveredThrough.getTime();
