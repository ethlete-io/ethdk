import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import ts from 'typescript';
import { harnessOf } from '../harness-map';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { skipRule } from '../rule-skips';
import { sourceFileOf } from '../ts-source';

const TAG = /<(?:"[^"]*"|'[^']*'|[^"'>])*>/gu;
const INTERPOLATION = /\{\{[\s\S]*?\}\}/gu;
const COMMAND =
  /(?:^|[\s`'"(])(?:(?:npx|nx|yarn|pnpm|npm|node|git)\s+[a-z@:.-]+|--[a-z][\w-]*(?=$|[\s`'".,;:)])|[A-Z][A-Z0-9_]+=\S)/u;

const sourceFilesIn = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter(
          (path) =>
            (path.endsWith('.html') || path.endsWith('.ts')) && !path.endsWith('.d.ts') && !path.endsWith('.spec.ts'),
        )
        .map((path) => resolve(dir, path))
        .sort()
    : [];

const visibleTextIn = (markup: string) =>
  markup
    .replace(INTERPOLATION, '\n')
    .replace(TAG, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

const commandsIn = (text: string) => visibleTextIn(text).filter((line) => COMMAND.test(line));

const commandsInSource = (file: string, source: string) => {
  if (file.endsWith('.html')) return commandsIn(source);

  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node)) {
      if (node.text.includes('<')) found.push(...commandsIn(node.text));
    } else if (ts.isTemplateExpression(node)) {
      const text = node.head.text + node.templateSpans.map((span) => '\u0001' + span.literal.text).join('');

      if (text.includes('<')) found.push(...commandsIn(text));
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFileOf(source));

  return found;
};

/**
 * Command text (`npx`, `nx `, `yarn `, `--flag`, `NAME=value`) in the visible text of a design drawing or of the
 * harness app's templates, for a product whose config sets `commandText: 'deny'`. A designer can do nothing with it.
 */
export const commandTextOf = (product: ResolvedProduct): Problem[] => {
  if (product.config.commandText !== 'deny') {
    skipRule({
      rule: 'COMMAND-TEXT',
      product: product.name,
      kind: 'not-applicable',
      reason: 'config.json does not set commandText: "deny"',
    });

    return [];
  }

  const harness = harnessOf(product);
  const root = resolve(product.configFile, '../../..');
  const appDir = harness === null || typeof harness === 'string' ? null : resolve(root, harness.app, 'src/app');

  return [...sourceFilesIn(product.dir), ...(appDir ? sourceFilesIn(appDir) : [])].flatMap((file) =>
    commandsInSource(file, readFileSync(file, 'utf8')).map((line) => ({
      rule: 'COMMAND-TEXT',
      file,
      message: `\`${line.slice(0, 80)}\` is command text in visible UI - a designer can do nothing with it; say what to do in words or drop it`,
    })),
  );
};
