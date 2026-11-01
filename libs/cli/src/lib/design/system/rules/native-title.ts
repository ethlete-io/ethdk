import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import ts from 'typescript';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { sourceFileOf } from '../ts-source';

const HOLE = '\u0001';
const OPENING_TAG = /<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)(?:>|$)/gu;
const TITLE_ATTRIBUTE = /(?:^|\s)title\s*=/u;
const TITLE_IN_TAG = /\stitle\s*=/u;

const tsFilesIn = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => path.endsWith('.ts') && !path.endsWith('.d.ts') && !path.endsWith('.spec.ts'))
        .map((path) => resolve(dir, path))
        .sort()
    : [];

const newlinesIn = (text: string) => text.split('\n').length - 1;

const nativeTitleLinesIn = (source: string) => {
  const file = sourceFileOf(source);
  const lines: number[] = [];
  const scan = (text: string, offset: number) => {
    for (const match of text.matchAll(OPENING_TAG)) {
      const [, name = '', attributes = ''] = match;

      if (name.includes('-') || !TITLE_ATTRIBUTE.test(attributes)) continue;

      const titleAt = match.index + (TITLE_IN_TAG.exec(match[0])?.index ?? 0);

      lines.push(offset + newlinesIn(text.slice(0, titleAt + 1)) + 1);
    }
  };
  const visit = (node: ts.Node) => {
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line;

    if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node)) scan(node.text, line);
    else if (ts.isTemplateExpression(node)) {
      scan(
        node.head.text +
          node.templateSpans
            .map(
              (span) =>
                HOLE +
                '\n'.repeat(newlinesIn(source.slice(span.expression.getFullStart(), span.literal.getStart(file)))) +
                span.literal.text,
            )
            .join(''),
        line,
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return lines;
};

/**
 * A native `title` attribute on an HTML element in the design markup of a product whose config sets
 * `nativeTitle: 'deny'`. Elements with a dash in their name are components and pass.
 */
export const nativeTitlesOf = (product: ResolvedProduct): Problem[] =>
  product.config.nativeTitle !== 'deny'
    ? []
    : tsFilesIn(product.dir).flatMap((file) =>
        nativeTitleLinesIn(readFileSync(file, 'utf8')).map((line) => ({
          rule: 'NATIVE-TITLE',
          file,
          message: `line ${line}: a native \`title\` attribute shows an unstyled browser tooltip - use the SDK tooltip`,
        })),
      );
