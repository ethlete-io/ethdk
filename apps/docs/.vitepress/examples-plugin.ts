import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const EXAMPLES_DIR = fileURLToPath(new URL('../../docs-examples/src/examples/', import.meta.url));
const EXAMPLE_LINE = /^([ \t]*)@example ([\w-]+\/[\w-]+)(?: (\S+))?[ \t]*$/gm;

const fenceFor = (code: string) => {
  const longestRun = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));

  return '`'.repeat(Math.max(3, longestRun + 1));
};

const codeBlock = (path: string) => {
  const code = readFileSync(path, 'utf8').trimEnd();
  const fence = fenceFor(code);
  const name = path.slice(path.lastIndexOf('/') + 1);

  return `${fence}ts [${name}]\n${code}\n${fence}`;
};

export const docsExamples = (): Plugin => ({
  name: 'ethlete-docs-examples',
  enforce: 'pre',
  transform(source, id) {
    if (!id.endsWith('.md') || !source.includes('@example ')) return null;

    const code = source.replace(EXAMPLE_LINE, (_line, indent: string, exampleId: string, height?: string) => {
      const examplePath = `${EXAMPLES_DIR}${exampleId}.example.ts`;
      const dataPath = `${EXAMPLES_DIR}${exampleId}.data.ts`;

      if (!existsSync(examplePath)) {
        throw new Error(`@example ${exampleId}: ${examplePath} does not exist`);
      }

      const files = [examplePath, ...(existsSync(dataPath) ? [dataPath] : [])];

      for (const file of files) this.addWatchFile(file);

      const heightAttribute = height ? ` height="${height}"` : '';

      return [
        `<Example id="${exampleId}"${heightAttribute} />`,
        '',
        ':::: details Show code',
        '',
        '::: code-group',
        '',
        ...files.map(codeBlock).flatMap((block) => [block, '']),
        ':::',
        '',
        '::::',
      ]
        .join('\n')
        .replace(/^(?=.)/gm, indent);
    });

    return code === source ? null : { code, map: null };
  },
});
