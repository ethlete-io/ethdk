import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const libDir = dirname(fileURLToPath(import.meta.url));

const findCssFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? findCssFiles(full) : entry.name.endsWith('.css') ? [full] : [];
  });

const ownRuleBodies = (css: string): string[] => {
  const stack: string[] = [''];
  const bodies: string[] = [];
  for (const ch of css) {
    if (ch === '{') {
      stack.push('');
    } else if (ch === '}') {
      const body = stack.pop();
      if (body !== undefined) bodies.push(body);
    } else if (stack.length) {
      stack[stack.length - 1] += ch;
    }
  }
  return bodies;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cssFiles = findCssFiles(libDir);

describe('user-select CSS prefixing', () => {
  it.each(cssFiles.map((file) => relative(libDir, file)))(
    'pairs every user-select with the -webkit-user-select Safari 18.6 needs in %s',
    (relativeFile) => {
      const css = readFileSync(join(libDir, relativeFile), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

      for (const body of ownRuleBodies(css)) {
        for (const match of body.matchAll(/(^|[^-\w])user-select:\s*([^;]+);/g)) {
          const value = match[2]?.trim();
          if (!value) continue;

          expect(body, `${relativeFile}: user-select: ${value} has no -webkit-user-select in the same rule`).toMatch(
            new RegExp(`-webkit-user-select:\\s*${escapeRegExp(value)}\\s*;`),
          );
        }
      }
    },
  );
});
