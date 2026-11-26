export const PIP_WINDOW_Z_INDEX_PROPERTY = '--et-pip-window-z-index';

export type PipWindowZIndexTask = {
  file: string;
  line: number;
  message: string;
};

export type PipWindowZIndexScan = {
  /** The file without its literal declarations, or `null` when it has none. */
  next: string | null;
  /** The integer values of the declarations `next` drops. */
  values: number[];
  tasks: PipWindowZIndexTask[];
};

const STYLESHEET = /\.(css|scss|sass|less)$/;
const SCANNED = /\.(css|scss|sass|less|html|ts)$/;
const LITERAL_DECLARATION = /^[ \t]*--et-pip-window-z-index[ \t]*:[ \t]*(-?\d+)[ \t]*;?[ \t]*(?:\r?\n|$)/gm;
const SOLE_DECLARATION_RULE =
  /^[ \t]*[^{}\n;]+\{\s*--et-pip-window-z-index[ \t]*:[ \t]*(-?\d+)[ \t]*;?\s*\}[ \t]*(?:\r?\n|$)(?:[ \t]*\r?\n)*/gm;
const COMPONENTS_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]@ethlete\/components['"]/g;
const APP_CONFIG_MARKER = /\bApplicationConfig\b|\bbootstrapApplication\(/;

const lineOf = (content: string, index: number) => content.slice(0, index).split('\n').length;

const occurrences = (content: string) => {
  const indexes: number[] = [];
  let index = content.indexOf(PIP_WINDOW_Z_INDEX_PROPERTY);

  while (index !== -1) {
    indexes.push(index);
    index = content.indexOf(PIP_WINDOW_Z_INDEX_PROPERTY, index + 1);
  }

  return indexes;
};

export const pipWindowZIndexTasks = (file: string, content: string, message: string): PipWindowZIndexTask[] =>
  occurrences(content).map((index) => ({ file, line: lineOf(content, index), message }));

export const isPipWindowZIndexCandidate = (filePath: string) => SCANNED.test(filePath) && !filePath.endsWith('.d.ts');

export const scanPipWindowZIndexInFile = (file: string, content: string): PipWindowZIndexScan => {
  if (!content.includes(PIP_WINDOW_Z_INDEX_PROPERTY)) return { next: null, values: [], tasks: [] };

  const values: number[] = [];
  let next: string | null = null;

  if (STYLESHEET.test(file)) {
    const collect = (_: string, value: string) => {
      values.push(Number(value));

      return '';
    };
    const removed = content.replace(SOLE_DECLARATION_RULE, collect).replace(LITERAL_DECLARATION, collect);

    if (values.length > 0) next = removed;
  }

  const tasks = pipWindowZIndexTasks(
    file,
    next ?? content,
    `Sets \`${PIP_WINDOW_Z_INDEX_PROPERTY}\` in a way the migration cannot move. Remove it and pass the level to \`providePipWindowConfig({ overlayLayer })\`.`,
  );

  return { next, values, tasks };
};

/** Adds `providePipWindowConfig({ overlayLayer })` to an application config, or `null` when none fits. */
export const addPipWindowConfigToAppConfig = (content: string, overlayLayer: number): string | null => {
  if (!APP_CONFIG_MARKER.test(content) || content.includes('mergeApplicationConfig(')) return null;
  if (content.includes('providePipWindowConfig(')) return null;

  const providers = content.match(/\bproviders\s*:\s*\[(\s*\])?/);
  if (!providers || providers.index === undefined) return null;

  const provider = `...providePipWindowConfig({ overlayLayer: ${overlayLayer} })`;
  const insertAt = providers.index + providers[0].length;
  const withProvider = providers[1]
    ? `${content.slice(0, providers.index)}providers: [${provider}]${content.slice(insertAt)}`
    : `${content.slice(0, insertAt)}${provider}, ${content.slice(insertAt)}`;

  const importStatement = [...withProvider.matchAll(COMPONENTS_IMPORT)][0];

  if (!importStatement || importStatement.index === undefined) {
    return `import { providePipWindowConfig } from '@ethlete/components';\n${withProvider}`;
  }

  const rewrittenImport = importStatement[0].replace('{', '{ providePipWindowConfig,');

  return (
    withProvider.slice(0, importStatement.index) +
    rewrittenImport +
    withProvider.slice(importStatement.index + importStatement[0].length)
  );
};
