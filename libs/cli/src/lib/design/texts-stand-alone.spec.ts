import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../../../..');

const SOURCE_DIRS = ['libs/cli/src/lib/design', 'apps/ethlete-studio/src/app/i18n'];

const ADR_REFERENCE = /\bADRs?[ -]?\d{2,4}\b|\badr\/\d{4}/i;
const PLAN_ROW = /\bB\d{3,4}\b/;
const SDK_PATH =
  /\bplans\/|\bdocs\/adr\b|\blibs\/(?:components|cli|core|query|types|bracket|agent-rules|eslint-plugin)\/|\bapps\/ethlete-studio\//;

const isSource = (file: string) =>
  file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.d.ts') && !file.includes('__fixtures__');

const sourcesIn = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === 'node_modules' ? [] : sourcesIn(path);
    return isSource(path) ? [path] : [];
  });

const textsOf = (file: string) => {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const texts: { text: string; line: number }[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      texts.push({
        text: node.text,
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(source);

  return texts;
};

const standAloneViolation = (text: string) => {
  if (ADR_REFERENCE.test(text)) return 'names an ADR';
  if (!/\s/.test(text)) return null;
  if (PLAN_ROW.test(text)) return 'names a plan row';
  if (SDK_PATH.test(text)) return 'names an SDK repo path';
  return null;
};

describe('standAloneViolation', () => {
  it('flags an ADR, a plan row and an SDK path', () => {
    expect(standAloneViolation('add a group (ADR 0407)')).toBe('names an ADR');
    expect(standAloneViolation('see B685 for the rest')).toBe('names a plan row');
    expect(standAloneViolation('read plans/x.md first')).toBe('names an SDK repo path');
  });

  it('passes class names, ids and plain texts', () => {
    expect(standAloneViolation('et-b123')).toBeNull();
    expect(standAloneViolation('B148')).toBeNull();
    expect(standAloneViolation('libs/components/design')).toBeNull();
    expect(standAloneViolation('add a group per flow step')).toBeNull();
  });
});

describe('design CLI and Studio texts stand alone', () => {
  it('name no ADR, plan row or SDK repo path', () => {
    const hits = SOURCE_DIRS.flatMap((dir) => sourcesIn(join(repoRoot, dir))).flatMap((file) =>
      textsOf(file).flatMap(({ text, line }) => {
        const violation = standAloneViolation(text);
        return violation ? [`${relative(repoRoot, file)}:${line} ${violation}: ${text.slice(0, 100)}`] : [];
      }),
    );

    expect(hits).toEqual([]);
  });
});
