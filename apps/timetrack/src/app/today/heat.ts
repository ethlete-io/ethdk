/** What the fire beside the concurrency readout shows. A day that ran nothing beside you has none. */
export type Heat = {
  level: 'warm' | 'hot' | 'blazing' | 'inferno';
  /** One entry per flame to draw. */
  flames: number[];
  hint: string;
  /** 0 at the first tier and 1 at the top, so the glow and the flicker grow between the tiers too. */
  glow: number;
};

/** Ordered from the hottest down, so the first tier a ratio reaches is its own. */
const TIERS = [
  { from: 3, level: 'inferno', flames: 4, hint: 'More than three at once. Little of this day was serial.' },
  { from: 2.2, level: 'blazing', flames: 3, hint: 'Three streams at once, for much of the day.' },
  { from: 1.6, level: 'hot', flames: 2, hint: 'Two streams ran beside you for much of the day.' },
  { from: 1.2, level: 'warm', flames: 1, hint: 'Something ran beside you for part of the day.' },
] as const;

/** The ratio the glow starts at, and the one it stops growing at so a runaway day cannot flood the readout. */
const GLOW_RANGE = { from: 1.2, to: 4 };

/**
 * How hot a day's concurrency reads. Below the first tier this is `null` and the readout stays plain —
 * a serial day and a day of long calls are both ordinary, and neither earns a mark of its own.
 */
export const readHeat = (concurrency: number): Heat | null => {
  const tier = TIERS.find((candidate) => concurrency >= candidate.from);

  if (!tier) return null;

  return {
    level: tier.level,
    flames: Array.from({ length: tier.flames }, (_, index) => index),
    hint: tier.hint,
    glow: Math.min((concurrency - GLOW_RANGE.from) / (GLOW_RANGE.to - GLOW_RANGE.from), 1),
  };
};
