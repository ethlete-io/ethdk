export type ContentfulDefaultComponentsTask = {
  id: string;
  file: string;
  line: number;
  message: string;
};

export type ContentfulDefaultComponentsScan = {
  next: string | null;
  tasks: ContentfulDefaultComponentsTask[];
};

const FEATURE = 'withContentfulDefaultComponents';
const FEATURES_ENTRY = `features: [${FEATURE}()]`;
const CONTENTFUL_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]@ethlete\/contentful['"]/g;

const lineOf = (content: string, index: number) => content.slice(0, index).split('\n').length;

const taskId = (filePath: string, line: number) =>
  `contentful-default-components--${filePath.replace(/[^a-zA-Z0-9]+/g, '-')}-${line}`;

export const scanContentfulDefaultComponentsInFile = (
  filePath: string,
  content: string,
): ContentfulDefaultComponentsScan => {
  const tasks: ContentfulDefaultComponentsTask[] = [];

  const importStatement = [...content.matchAll(CONTENTFUL_IMPORT)].find((match) =>
    /\bprovideContentfulConfig\b/.test(match[1] ?? ''),
  );

  if (!importStatement || content.includes(FEATURE)) return { next: null, tasks };

  const report = (index: number, message: string) => {
    const line = lineOf(content, index);

    tasks.push({ id: taskId(filePath, line), file: filePath, line, message });
  };

  let rewrote = false;

  const next = content.replace(
    /provideContentfulConfig\(\s*(\{\s*\}|\{\s*|\)|[^\s{)])/g,
    (call: string, opening: string, index: number) => {
      if (opening === ')') {
        rewrote = true;
        return `provideContentfulConfig({ ${FEATURES_ENTRY} })`;
      }

      if (opening.startsWith('{')) {
        if (/^\s*features\s*:/.test(content.slice(index + call.length))) {
          report(index, `\`provideContentfulConfig\` names its own \`features\`. Add \`${FEATURE}()\` to them.`);
          return call;
        }

        rewrote = true;
        return opening.endsWith('}')
          ? `provideContentfulConfig({ ${FEATURES_ENTRY} }`
          : `provideContentfulConfig({ ${FEATURES_ENTRY}, `;
      }

      const argument = content.slice(index + call.length - 1).match(/^[^)\n]*/)?.[0] ?? '';

      report(
        index,
        `\`provideContentfulConfig(${argument})\` is not a literal the migration can edit. Add \`${FEATURES_ENTRY}\` to it unless it names every asset and link component itself.`,
      );

      return call;
    },
  );

  if (!rewrote) return { next: null, tasks };

  const rewrittenImport = importStatement[0].replace('{', `{ ${FEATURE},`);
  const importIndex = next.indexOf(importStatement[0]);

  return {
    next: next.slice(0, importIndex) + rewrittenImport + next.slice(importIndex + importStatement[0].length),
    tasks,
  };
};
