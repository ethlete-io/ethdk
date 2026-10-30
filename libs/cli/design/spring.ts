/** A spring as a CSS easing: `easing` is a `linear(...)` function, `duration` the ms until it settles; as a string, `<duration>ms <easing>`. */
export type Spring = { easing: string; duration: number; toString: () => string };

const SETTLED = 0.001;
const LONGEST_MS = 10000;

const positionOf = (damping: number, frequency: number) => {
  const natural = 2 * Math.PI * frequency;

  if (damping < 1) {
    const damped = natural * Math.sqrt(1 - damping * damping);
    const decay = damping * natural;

    return (seconds: number) =>
      1 - Math.exp(-decay * seconds) * (Math.cos(damped * seconds) + (decay / damped) * Math.sin(damped * seconds));
  }

  if (damping === 1) return (seconds: number) => 1 - Math.exp(-natural * seconds) * (1 + natural * seconds);

  const root = Math.sqrt(damping * damping - 1);
  const slow = -natural * (damping - root);
  const fast = -natural * (damping + root);

  return (seconds: number) => 1 - (fast * Math.exp(slow * seconds) - slow * Math.exp(fast * seconds)) / (fast - slow);
};

/**
 * Samples a spring that moves from 0 to 1 at rest, for a motion token in `foundations`, e.g.
 * `--motion-capsule: ${spring({ damping: 0.6, frequency: 2 })}`. `damping` is the damping ratio (below 1 it
 * overshoots) and `frequency` the undamped frequency in Hz.
 */
export const spring = (options: { damping: number; frequency: number }): Spring => {
  const { damping, frequency } = options;

  if (!(damping > 0) || !(frequency > 0) || !Number.isFinite(damping) || !Number.isFinite(frequency))
    throw new Error(
      `design-explore: spring() needs a damping and a frequency above 0, got ${damping} and ${frequency}`,
    );

  const position = positionOf(damping, frequency);
  let last = 0;

  for (let ms = 0; ms <= LONGEST_MS; ms++) if (Math.abs(1 - position(ms / 1000)) >= SETTLED) last = ms;

  const duration = Math.max(1, last + 1);
  const count = Math.min(200, Math.max(10, Math.ceil(duration / 16)));
  const points = Array.from({ length: count + 1 }, (_, index) =>
    index === count ? 1 : Math.round(position(((index / count) * duration) / 1000) * 10000) / 10000,
  );
  const easing = `linear(${points.join(', ')})`;

  return { easing, duration, toString: () => `${duration}ms ${easing}` };
};
