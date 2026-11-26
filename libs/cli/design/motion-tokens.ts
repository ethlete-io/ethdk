import { MotionTrack } from './motion-runtime';

/** A CSS custom property declared on `:root`, with its computed value. */
export type MotionToken = { name: string; value: string };

/** A track with the names of the tokens whose value equals its duration or easing, in declaration order. */
export type NamedMotionTrack = MotionTrack & { durationTokens?: string[]; easingTokens?: string[] };

const KEYWORD_EASINGS: Record<string, string> = {
  ease: 'cubic-bezier(0.25,0.1,0.25,1)',
  'ease-in': 'cubic-bezier(0.42,0,1,1)',
  'ease-out': 'cubic-bezier(0,0,0.58,1)',
  'ease-in-out': 'cubic-bezier(0.42,0,0.58,1)',
  'step-start': 'steps(1,jump-start)',
  'step-end': 'steps(1,jump-end)',
};

const TIME = /^(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(ms|s)$/u;
const EASING_FUNCTION = /^(cubic-bezier|linear|steps)\((.*)\)$/u;

const roundedOf = (value: number) => String(Math.round(value * 10000) / 10000);

const msOf = (value: string) => {
  const match = TIME.exec(value.trim().toLowerCase());

  return match ? Number(match[1]) * (match[2] === 's' ? 1000 : 1) : null;
};

const linearOf = (body: string) => {
  const points: { output: number; input: number | null }[] = [];

  for (const stop of body.split(',')) {
    const [output = '', ...inputs] = stop.trim().split(/\s+/u);
    const value = Number(output);

    if (output === '' || !Number.isFinite(value) || inputs.length > 2) return null;

    const percents = inputs.map((input) => (input.endsWith('%') ? Number(input.slice(0, -1)) : Number.NaN));

    if (percents.some((percent) => !Number.isFinite(percent))) return null;

    if (percents.length === 0) points.push({ output: value, input: null });
    for (const percent of percents) points.push({ output: value, input: percent });
  }

  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];

  if (first && first.input === null) first.input = 0;
  if (last && last.input === null) last.input = Math.max(100, ...points.map((point) => point.input ?? 0));

  let highest = 0;

  for (const point of points) {
    if (point.input !== null) point.input = Math.max(point.input, highest);
    highest = point.input ?? highest;
  }

  for (let index = 1; index < points.length; index++) {
    if (points[index]?.input !== null) continue;

    const before = index - 1;
    let after = index;

    while (points[after]?.input === null) after++;

    const from = points[before]?.input ?? 0;
    const to = points[after]?.input ?? 100;

    for (let gap = index; gap < after; gap++) {
      const point = points[gap];

      if (point) point.input = from + ((to - from) * (gap - before)) / (after - before);
    }
  }

  return `linear(${points.map((point) => `${roundedOf(point.output)} ${roundedOf(point.input ?? 0)}%`).join(',')})`;
};

/** An easing in one spelling, so `ease` equals `cubic-bezier(.25, .1, .25, 1)`; `null` when it is not an easing. */
export const normalisedEasingOf = (value: string): string | null => {
  const easing = value.trim().toLowerCase().replace(/\s+/gu, ' ');

  if (easing === 'linear') return 'linear';
  if (KEYWORD_EASINGS[easing]) return KEYWORD_EASINGS[easing];

  const match = EASING_FUNCTION.exec(easing);

  if (!match) return null;

  const [, kind = '', body = ''] = match;

  if (kind === 'linear') return linearOf(body);

  const args = body.split(',').map((arg) => arg.trim());

  if (kind === 'steps') return args.length === 1 || args.length === 2 ? `steps(${args[0]},${args[1] ?? 'end'})` : null;

  const numbers = args.map(Number);

  return numbers.length === 4 && numbers.every(Number.isFinite)
    ? `cubic-bezier(${numbers.map(roundedOf).join(',')})`
    : null;
};

/** What a token stands for: a time, an easing, or both as a `spring()` token stores them (`<duration>ms linear(...)`). */
const meaningOf = (value: string) => {
  const trimmed = value.trim();
  const ms = msOf(trimmed);

  if (ms !== null) return { ms, easing: null };

  const [head = '', ...rest] = trimmed.split(/\s+/u);
  const leading = msOf(head);

  if (leading !== null) {
    const easing = normalisedEasingOf(rest.join(' '));

    return easing ? { ms: leading, easing } : null;
  }

  const easing = normalisedEasingOf(trimmed);

  return easing ? { ms: null, easing } : null;
};

/**
 * Adds the names of the `tokens` whose value equals a track's duration (`durationTokens`) or easing (`easingTokens`),
 * in the order of `tokens`; a field without a match is left out.
 */
export const withTokenNames = (track: MotionTrack, tokens: readonly MotionToken[]): NamedMotionTrack => {
  const easing = normalisedEasingOf(track.easing);
  const durationTokens: string[] = [];
  const easingTokens: string[] = [];

  for (const token of tokens) {
    const meaning = meaningOf(token.value);

    if (!meaning) continue;
    if (meaning.ms !== null && Math.abs(meaning.ms - track.duration) < 0.001) durationTokens.push(token.name);
    if (meaning.easing !== null && easing !== null && meaning.easing === easing) easingTokens.push(token.name);
  }

  return {
    ...track,
    ...(durationTokens.length ? { durationTokens } : {}),
    ...(easingTokens.length ? { easingTokens } : {}),
  };
};

const rootNamesOf = (rules: CSSRuleList, names: Set<string>) => {
  for (const rule of [...rules]) {
    if (rule instanceof CSSStyleRule && /^(:root|html)$/u.test(rule.selectorText.trim()))
      for (const property of [...rule.style]) if (property.startsWith('--')) names.add(property);

    if ('cssRules' in rule && rule.cssRules instanceof CSSRuleList) rootNamesOf(rule.cssRules, names);
  }
};

/** The custom properties declared on `:root` in the stylesheets of `document`, in declaration order, as computed there. */
export const rootTokensOf = (document: Document): MotionToken[] => {
  const names = new Set<string>();

  for (const sheet of [...document.styleSheets]) {
    try {
      rootNamesOf(sheet.cssRules, names);
    } catch {
      continue;
    }
  }

  const computed = getComputedStyle(document.documentElement);

  return [...names].map((name) => ({ name, value: computed.getPropertyValue(name).trim() }));
};
