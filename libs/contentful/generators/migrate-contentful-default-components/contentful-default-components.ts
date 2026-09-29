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

const CONSTANT = 'CONTENTFUL_DEFAULT_COMPONENTS';
const SPREAD = `...${CONSTANT}`;
const CONTENTFUL_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]@ethlete\/contentful['"]/g;

const lineOf = (content: string, index: number) => content.slice(0, index).split('\n').length;

const taskId = (filePath: string, line: number) =>
  `contentful-default-components--${filePath.replace(/[^a-zA-Z0-9]+/g, '-')}-${line}`;

const namesOwnComponents = (content: string, braceIndex: number) => {
  let depth = 0;
  let topLevel = '';

  for (let i = braceIndex; i < content.length; i++) {
    const char = content[i] ?? '';

    if ('{[('.includes(char)) depth++;
    else if ('}])'.includes(char)) depth--;
    else if (depth === 1) topLevel += char;

    if (depth === 0) break;
  }

  return /(^|[,\s])components\s*:/.test(topLevel);
};

export const scanContentfulDefaultComponentsInFile = (
  filePath: string,
  content: string,
): ContentfulDefaultComponentsScan => {
  const tasks: ContentfulDefaultComponentsTask[] = [];

  const importStatement = [...content.matchAll(CONTENTFUL_IMPORT)].find((match) =>
    /\bprovideContentfulConfig\b/.test(match[1] ?? ''),
  );

  if (!importStatement || content.includes(CONSTANT)) return { next: null, tasks };

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
        return `provideContentfulConfig({ ${SPREAD} })`;
      }

      if (opening.startsWith('{')) {
        rewrote = true;

        if (namesOwnComponents(content, index + call.length - opening.length)) {
          report(
            index,
            `\`provideContentfulConfig\` names its own \`components\`, which replaces the spread. Write \`components: { ...${CONSTANT}.components, ... }\` to keep the defaults.`,
          );
        }

        return opening.endsWith('}')
          ? `provideContentfulConfig({ ${SPREAD} }`
          : `provideContentfulConfig({ ${SPREAD}, `;
      }

      const argument = content.slice(index + call.length - 1).match(/^[^)\n]*/)?.[0] ?? '';

      report(
        index,
        `\`provideContentfulConfig(${argument})\` is not a literal the migration can edit. Spread \`${CONSTANT}\` into it unless it names every asset and link component itself.`,
      );

      return call;
    },
  );

  if (!rewrote) return { next: null, tasks };

  const rewrittenImport = importStatement[0].replace('{', `{ ${CONSTANT},`);
  const importIndex = next.indexOf(importStatement[0]);

  return {
    next: next.slice(0, importIndex) + rewrittenImport + next.slice(importIndex + importStatement[0].length),
    tasks,
  };
};
