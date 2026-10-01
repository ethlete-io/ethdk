const OLD_TOKEN = '--et-line-chart-stacked-area-opacity';
const NEW_TOKEN = '--et-line-chart-stacked-area-mix';

const OCCURRENCE = new RegExp(
  [
    `var\\(\\s*${OLD_TOKEN}\\s*(?:(?<fallbackLead>,\\s*)(?<fallback>[^()]*?)(?<fallbackTail>\\s*))?\\)`,
    `${OLD_TOKEN}(?<colon>\\s*:\\s*)(?<value>[^;}\\n"'\`]*)`,
    OLD_TOKEN,
  ].join('|'),
  'g',
);

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const PERCENTAGE = /^[+-]?(?:\d+\.?\d*|\.\d+)%$/;

export type StackedAreaMixResult = {
  content: string;
  unmapped: number[];
};

export const opacityToMix = (value: string): string | null => {
  const trimmed = value.trim();

  if (NUMBER.test(trimmed)) return `${Math.round(Number(trimmed) * 100)}%`;
  if (PERCENTAGE.test(trimmed)) return trimmed;

  return null;
};

const lineAt = (content: string, index: number) => content.slice(0, index).split('\n').length;

/** Renames every `--et-line-chart-stacked-area-opacity` to `--et-line-chart-stacked-area-mix` and maps its values, or returns `null` when there is none. */
export const migrateStackedAreaMix = (content: string): StackedAreaMixResult | null => {
  if (!content.includes(OLD_TOKEN)) return null;

  const unmapped: number[] = [];

  const next = content.replace(OCCURRENCE, (match, ...args) => {
    const index = args.at(-3) as number;
    const groups = args.at(-1) as Record<string, string | undefined>;

    if (match.startsWith('var(')) {
      if (groups['fallback'] === undefined) return `var(${NEW_TOKEN})`;

      const mapped = opacityToMix(groups['fallback']);
      if (mapped === null) unmapped.push(lineAt(content, index));

      return `var(${NEW_TOKEN}${groups['fallbackLead']}${mapped ?? groups['fallback']}${groups['fallbackTail']})`;
    }

    if (groups['colon'] !== undefined) {
      const value = groups['value'] ?? '';
      const trimmed = value.trimEnd();
      const mapped = opacityToMix(trimmed);
      if (mapped === null) unmapped.push(lineAt(content, index));

      return `${NEW_TOKEN}${groups['colon']}${mapped ?? trimmed}${value.slice(trimmed.length)}`;
    }

    unmapped.push(lineAt(content, index));

    return NEW_TOKEN;
  });

  return { content: next, unmapped };
};
