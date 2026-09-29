export type StreamDefaultComponentsTask = {
  id: string;
  file: string;
  line: number;
  message: string;
};

export type StreamDefaultComponentsScan = {
  /** The rewritten file, or `null` when nothing changed. */
  next: string | null;
  usesStream: boolean;
  hasConfig: boolean;
  tasks: StreamDefaultComponentsTask[];
};

const USAGE_MARKERS = [/<et-[a-z]+-player-slot[\s/>]/, /\bSTREAM_(?:[A-Z]+_)?IMPORTS\b/] as const;

const COMPONENTS_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]@ethlete\/components['"]/g;

const lineOf = (content: string, index: number) => content.slice(0, index).split('\n').length;

const taskId = (filePath: string, line: number) =>
  `stream-default-components--${filePath.replace(/[^a-zA-Z0-9]+/g, '-')}-${line}`;

/**
 * Spreads `STREAM_DEFAULT_COMPONENTS` first into every literal `provideStreamConfig` call, so an overlay the
 * config names itself still wins, and reports each call whose config is not a literal.
 */
export const scanStreamDefaultComponentsInFile = (filePath: string, content: string): StreamDefaultComponentsScan => {
  const usesStream = USAGE_MARKERS.some((marker) => marker.test(content));
  const hasConfig = content.includes('provideStreamConfig(');
  const tasks: StreamDefaultComponentsTask[] = [];

  const importStatement = [...content.matchAll(COMPONENTS_IMPORT)].find((match) =>
    /\bprovideStreamConfig\b/.test(match[1] ?? ''),
  );

  if (!importStatement || content.includes('STREAM_DEFAULT_COMPONENTS')) {
    return { next: null, usesStream, hasConfig, tasks };
  }

  let rewrote = false;

  const next = content.replace(
    /provideStreamConfig\(\s*(\{\s*\}|\{\s*|\)|[^\s{)])/g,
    (call: string, opening: string, index: number) => {
      if (opening === ')') {
        rewrote = true;
        return 'provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS })';
      }

      if (opening.startsWith('{')) {
        rewrote = true;
        return opening.endsWith('}')
          ? 'provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS }'
          : 'provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS, ';
      }

      const line = lineOf(content, index);
      const argument = content.slice(index + call.length - 1).match(/^[^)\n]*/)?.[0] ?? '';

      tasks.push({
        id: taskId(filePath, line),
        file: filePath,
        line,
        message: `\`provideStreamConfig(${argument})\` is not a literal the migration can edit. Spread \`STREAM_DEFAULT_COMPONENTS\` into it unless it names both overlays itself.`,
      });

      return call;
    },
  );

  if (!rewrote) return { next: null, usesStream, hasConfig, tasks };

  const rewrittenImport = importStatement[0].replace('{', '{ STREAM_DEFAULT_COMPONENTS,');
  const importIndex = next.indexOf(importStatement[0]);

  return {
    next: next.slice(0, importIndex) + rewrittenImport + next.slice(importIndex + importStatement[0].length),
    usesStream,
    hasConfig,
    tasks,
  };
};

export const streamUsageTask = (filePath: string, content: string): StreamDefaultComponentsTask => {
  const index = Math.min(...USAGE_MARKERS.map((marker) => content.search(marker)).filter((position) => position >= 0));
  const line = lineOf(content, index);

  return {
    id: taskId(filePath, line),
    file: filePath,
    line,
    message:
      'Renders a stream player slot, but the app has no `provideStreamConfig`, so no loading or error overlay is registered.',
  };
};

export const TEMPLATE_URL = /templateUrl\s*:\s*['"]([^'"]+)['"]/g;

const STREAM_IMPORTS_NAME = /\bSTREAM_IMPORTS\b/;

const OVERLAY_SELECTORS = [
  { selector: '<et-stream-player-loading', component: 'StreamPlayerLoadingComponent' },
  { selector: '<et-stream-player-error', component: 'StreamPlayerErrorComponent' },
] as const;

/**
 * Adds the loading and error overlay components next to every `STREAM_IMPORTS` in a file whose templates
 * render their selectors, or returns `null` when nothing needs adding.
 */
export const addStreamOverlayImportsToFile = (content: string, externalTemplates: string[]): string | null => {
  const importStatement = [...content.matchAll(COMPONENTS_IMPORT)].find(
    (match) => STREAM_IMPORTS_NAME.test(match[1] ?? '') && !/\bSTREAM_IMPORTS\s+as\b/.test(match[1] ?? ''),
  );

  if (!importStatement || importStatement.index === undefined) return null;

  const templates = [content, ...externalTemplates];
  const missing = OVERLAY_SELECTORS.filter(
    ({ selector, component }) =>
      templates.some((template) => template.includes(selector)) &&
      !new RegExp(`\\b${component}\\b`).test(importStatement[1] ?? ''),
  ).map(({ component }) => component);

  if (missing.length === 0) return null;

  const extra = missing.join(', ');
  const start = importStatement.index;
  const end = start + importStatement[0].length;
  const rewrittenImport = importStatement[0].replace(STREAM_IMPORTS_NAME, `STREAM_IMPORTS, ${extra}`);
  const addNextToUsage = (code: string) =>
    code.replace(/(\.\.\.)?\bSTREAM_IMPORTS\b/g, (_, spread: string | undefined) =>
      spread ? `...STREAM_IMPORTS, ${extra}` : `STREAM_IMPORTS, ${extra}`,
    );

  return addNextToUsage(content.slice(0, start)) + rewrittenImport + addNextToUsage(content.slice(end));
};
