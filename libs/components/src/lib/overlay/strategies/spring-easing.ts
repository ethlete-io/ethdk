export type SpringConfig = {
  /** Seconds one undamped oscillation takes. Smaller is stiffer. */
  response: number;

  /** `1` settles without overshoot, below `1` overshoots. Values above `1` are treated as `1`. */
  dampingFraction: number;
};

export type SpringEasingInput = SpringConfig & {
  /** Start speed as a multiple of the full distance per second. Positive moves toward the target. */
  initialVelocity?: number;

  /** Progress error below which the spring counts as at rest. */
  epsilon?: number;

  /** Ends the curve the first time it reaches the target, for a motion whose overshoot is off screen. */
  stopAtTarget?: boolean;

  maxDurationMs?: number;
};

export type SpringEasing = {
  durationMs: number;
  easing: string;
};

export const SHEET_SETTLE_SPRING: SpringConfig = { response: 0.42, dampingFraction: 0.86 };
export const SHEET_LEAVE_SPRING: SpringConfig = { response: 0.4, dampingFraction: 1 };

const SAMPLE_STEP_S = 1 / 120;
const SIMPLIFY_TOLERANCE = 0.002;

type SpringSolution = (t: number) => { progress: number; velocity: number };

const solveSpring = ({ response, dampingFraction, initialVelocity = 0 }: SpringEasingInput): SpringSolution => {
  const omega = (2 * Math.PI) / response;
  const zeta = Math.min(1, Math.max(0, dampingFraction));

  if (zeta === 1) {
    const b = initialVelocity - omega;

    return (t) => {
      const decay = Math.exp(-omega * t);

      return { progress: 1 + (-1 + b * t) * decay, velocity: (b - omega * (-1 + b * t)) * decay };
    };
  }

  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  const b = (initialVelocity - zeta * omega) / omegaD;

  return (t) => {
    const decay = Math.exp(-zeta * omega * t);
    const cos = Math.cos(omegaD * t);
    const sin = Math.sin(omegaD * t);
    const displacement = -cos + b * sin;

    return {
      progress: 1 + decay * displacement,
      velocity: decay * (-zeta * omega * displacement + omegaD * (sin + b * cos)),
    };
  };
};

type Sample = readonly [time: number, progress: number];

const simplify = (samples: Sample[]) => {
  const kept: Sample[] = [];

  samples.forEach((sample, index) => {
    const previous = kept[kept.length - 1];
    const next = samples[index + 1];

    if (!previous || !next) {
      kept.push(sample);

      return;
    }

    const [t0, p0] = previous;
    const [t1, p1] = sample;
    const [t2, p2] = next;
    const interpolated = p0 + ((p2 - p0) * (t1 - t0)) / (t2 - t0);

    if (Math.abs(interpolated - p1) > SIMPLIFY_TOLERANCE) kept.push(sample);
  });

  return kept;
};

/** Samples a damped spring from progress `0` to `1` into a CSS `linear()` easing and its duration. */
export const springEasing = (input: SpringEasingInput): SpringEasing => {
  const { epsilon = 0.001, stopAtTarget = false, maxDurationMs = 1000 } = input;
  const solve = solveSpring(input);
  const omega = (2 * Math.PI) / input.response;
  const samples: Sample[] = [[0, 0]];
  const maxS = maxDurationMs / 1000;

  let t = 0;

  while (t < maxS) {
    t = Math.min(maxS, t + SAMPLE_STEP_S);

    const { progress, velocity } = solve(t);

    if (stopAtTarget && progress >= 1 - epsilon) break;

    samples.push([t, progress]);

    if (Math.abs(1 - progress) < epsilon && Math.abs(velocity) < epsilon * omega) break;
  }

  samples.push([t, 1]);

  const easing = simplify(samples)
    .map(([time, progress]) => `${Number(progress.toFixed(4))} ${Number(((time / t) * 100).toFixed(2))}%`)
    .join(', ');

  return { durationMs: Math.round(t * 1000), easing: `linear(${easing})` };
};
