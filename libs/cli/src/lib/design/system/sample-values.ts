import { readFileSync } from 'fs';
import ts from 'typescript';
import { sourceFileOf } from './ts-source';

/**
 * The values the product's sample data, `fixtures.ts`, declares: each string literal, trimmed, and each number. The
 * design draws them where the app draws its own data, so a check may treat them as replaceable. Empty without a file.
 */
export const sampleValuesOf = (fixtures: string | null | undefined): ReadonlySet<string> => {
  const values = new Set<string>();

  if (!fixtures) return values;

  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text.trim();

      if (text) values.add(text);
    } else if (ts.isNumericLiteral(node)) values.add(node.text);

    ts.forEachChild(node, visit);
  };

  visit(sourceFileOf(readFileSync(fixtures, 'utf8')));

  return values;
};
