import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import ts from 'typescript';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { sourceFileOf } from '../ts-source';

const HOLE = '\u0001';
const OPENS_A_NAME = /[-_:/[(.,]$/u;
const CONTINUES_A_NAME = /^[-_:/\]).,]/u;

const tsFilesIn = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => path.endsWith('.ts') && !path.endsWith('.d.ts') && !path.endsWith('.spec.ts'))
        .map((path) => resolve(dir, path))
        .sort()
    : [];

const classValuesIn = (source: string) => {
  const values: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isTemplateExpression(node)) {
      const text = node.head.text + node.templateSpans.map((span) => HOLE + span.literal.text).join('');

      if (text.includes('<'))
        values.push(...[...text.matchAll(/\bclass=["']([^"']*)/gu)].map(([, value]) => value ?? ''));
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFileOf(source));

  return values;
};

const gluedTokensIn = (value: string) =>
  value
    .split(/\s+/u)
    .filter((token) => token.includes(HOLE))
    .flatMap((token) => {
      const pieces = token.split(HOLE);

      return pieces.flatMap((piece, index) => {
        if (index === 0) return [];

        const before = pieces[index - 1] ?? '';
        const gluedBefore = before !== '' && !OPENS_A_NAME.test(before);
        const gluedAfter = piece !== '' && !CONTINUES_A_NAME.test(piece);

        return gluedBefore ? [before] : gluedAfter ? [piece] : [];
      });
    });

/**
 * A class in a part's `html` template with no space between it and a `${...}` interpolation. Tailwind's scanner reads the
 * class and the `${` as one candidate and emits no CSS for it. A class built by interpolation (`et-icon--${name}`, a
 * trailing `-`, `:` or `/`) is no complete class the scanner could read anyway, so it passes.
 */
export const gluedInterpolationsOf = (product: ResolvedProduct): Problem[] =>
  [
    ...new Set(product.parts.filter((part) => part.origin !== 'base').flatMap((part) => tsFilesIn(dirname(part.file)))),
  ].flatMap((file) =>
    [...new Set(classValuesIn(readFileSync(file, 'utf8')).flatMap(gluedTokensIn))].map((token) => ({
      rule: 'CLASS-GLUED-INTERPOLATION',
      file,
      message: `The class \`${token}\` is glued to a \`\${...}\` interpolation - Tailwind reads both as one candidate and emits no CSS for it; put a space between the class and the interpolation`,
    })),
  );
