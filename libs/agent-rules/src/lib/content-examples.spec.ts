import { readFileSync } from 'fs';
import { join } from 'path';
import { format } from 'prettier';
import { describe, expect, it } from 'vitest';
import { loadContent } from './load-content';

const PARSERS: Record<string, string> = {
  css: 'css',
  html: 'angular',
  json: 'json',
  jsonc: 'json5',
  ts: 'typescript',
  typescript: 'typescript',
};

type FencedExample = {
  code: string;
  language: string;
  origin: string;
  line: number;
};

const extractFencedExamples = (source: string, origin: string) => {
  const lines = source.split('\n');
  const examples: FencedExample[] = [];
  let opening: { language: string; line: number } | null = null;
  let body: string[] = [];

  for (const [index, line] of lines.entries()) {
    const fence = /^```([^\s`]*)\s*$/.exec(line);

    if (!fence) {
      if (opening) body.push(line);
      continue;
    }

    if (!opening) {
      opening = { language: fence[1] ?? '', line: index + 1 };
      body = [];
      continue;
    }

    examples.push({ code: body.join('\n'), language: opening.language, origin, line: opening.line });
    opening = null;
    body = [];
  }

  if (opening) throw new Error(`${origin}:${opening.line}: fenced example is never closed.`);

  return examples;
};

const packagedExamples = loadContent().flatMap((item) => [
  ...extractFencedExamples(item.body, item.sourcePath),
  ...item.resources.flatMap((resource) =>
    resource.fileName.endsWith('.md')
      ? extractFencedExamples(readFileSync(resource.absolutePath, 'utf8'), resource.absolutePath)
      : [],
  ),
]);
const workspaceStyleguide = join(__dirname, '..', '..', '..', '..', 'docs', 'STYLEGUIDE.md');
const examples = [
  ...packagedExamples,
  ...extractFencedExamples(readFileSync(workspaceStyleguide, 'utf8'), workspaceStyleguide),
];

describe('packaged content examples', () => {
  it.each(examples.filter((example) => PARSERS[example.language]))(
    'parses $origin:$line as $language',
    async ({ code, language }) => {
      await expect(format(code, { parser: PARSERS[language] })).resolves.toBeTypeOf('string');
    },
  );

  it.each(examples.filter((example) => example.language === 'html'))(
    'does not nest interactive buttons in $origin:$line',
    ({ code }) => {
      let depth = 0;

      for (const tag of code.matchAll(/<\/?button\b[^>]*>/g)) {
        if (tag[0].startsWith('</')) {
          depth -= 1;
        } else {
          depth += 1;
          expect(depth).toBe(1);
        }
      }

      expect(depth).toBe(0);
    },
  );
});
