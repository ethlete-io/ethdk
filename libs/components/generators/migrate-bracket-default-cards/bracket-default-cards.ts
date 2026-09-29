export type BracketDefaultCardsTask = {
  id: string;
  file: string;
  line: number;
  message: string;
};

export type BracketDefaultCardsScan = {
  /** The rewritten file, or `null` when nothing changed. */
  next: string | null;
  usesBracket: boolean;
  hasConfig: boolean;
  tasks: BracketDefaultCardsTask[];
};

const USAGE_MARKERS = [
  /<et-bracket[\s/>]/,
  /<et-bracket-rounds-list[\s/>]/,
  /\bBRACKET_IMPORTS\b/,
  /\bBRACKET_ROUNDS_LIST_IMPORTS\b/,
  /\bBracketComponent\b/,
  /\bBracketRoundsListComponent\b/,
] as const;

const COMPONENTS_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]@ethlete\/components['"]/g;

const lineOf = (content: string, index: number) => content.slice(0, index).split('\n').length;

const taskId = (filePath: string, line: number) =>
  `bracket-default-cards--${filePath.replace(/[^a-zA-Z0-9]+/g, '-')}-${line}`;

/**
 * Spreads `BRACKET_DEFAULT_CARDS` first into every literal `provideBracketConfig` call, so a card the
 * config names itself still wins, and reports each call whose config is not a literal.
 */
export const scanBracketDefaultCardsInFile = (filePath: string, content: string): BracketDefaultCardsScan => {
  const usesBracket = USAGE_MARKERS.some((marker) => marker.test(content));
  const hasConfig = content.includes('provideBracketConfig(');
  const tasks: BracketDefaultCardsTask[] = [];

  const importStatement = [...content.matchAll(COMPONENTS_IMPORT)].find((match) =>
    /\bprovideBracketConfig\b/.test(match[1] ?? ''),
  );

  if (!importStatement || content.includes('BRACKET_DEFAULT_CARDS')) {
    return { next: null, usesBracket, hasConfig, tasks };
  }

  let rewrote = false;

  const next = content.replace(
    /provideBracketConfig\(\s*(\{\s*\}|\{\s*|\)|[^\s{)])/g,
    (call: string, opening: string, index: number) => {
      if (opening === ')') {
        rewrote = true;
        return 'provideBracketConfig({ ...BRACKET_DEFAULT_CARDS })';
      }

      if (opening.startsWith('{')) {
        rewrote = true;
        return opening.endsWith('}')
          ? 'provideBracketConfig({ ...BRACKET_DEFAULT_CARDS }'
          : 'provideBracketConfig({ ...BRACKET_DEFAULT_CARDS, ';
      }

      const line = lineOf(content, index);
      const argument = content.slice(index + call.length - 1).match(/^[^)\n]*/)?.[0] ?? '';

      tasks.push({
        id: taskId(filePath, line),
        file: filePath,
        line,
        message: `\`provideBracketConfig(${argument})\` is not a literal the migration can edit. Spread \`BRACKET_DEFAULT_CARDS\` into it unless it names every card itself.`,
      });

      return call;
    },
  );

  if (!rewrote) return { next: null, usesBracket, hasConfig, tasks };

  const rewrittenImport = importStatement[0].replace('{', '{ BRACKET_DEFAULT_CARDS,');
  const importIndex = next.indexOf(importStatement[0]);

  return {
    next: next.slice(0, importIndex) + rewrittenImport + next.slice(importIndex + importStatement[0].length),
    usesBracket,
    hasConfig,
    tasks,
  };
};

export const bracketUsageTask = (filePath: string, content: string): BracketDefaultCardsTask => {
  const index = Math.min(...USAGE_MARKERS.map((marker) => content.search(marker)).filter((position) => position >= 0));
  const line = lineOf(content, index);

  return {
    id: taskId(filePath, line),
    file: filePath,
    line,
    message: 'Renders a bracket, but the app has no `provideBracketConfig`, so no card is registered.',
  };
};
