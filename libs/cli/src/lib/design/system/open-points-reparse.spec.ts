import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type * as Ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { readOpenPoints } from './read-open-points';
import { ResolvedProduct } from './resolve-product';
import { oneProductOf } from './sketch/cli-args';
import { createSketch, markSketchReady, Sketch, variantDirOf } from './sketch/sketch';

const walked = vi.hoisted(() => ({ texts: [] as string[] }));

vi.mock('typescript', async (importOriginal) => {
  const original = await importOriginal<{ default: typeof Ts }>();
  const ts = { ...original.default };
  const forEachChild = ts.forEachChild;

  ts.forEachChild = ((node: Ts.Node, ...rest: [never]) => {
    if (node.kind === ts.SyntaxKind.SourceFile) walked.texts.push((node as Ts.SourceFile).text);

    return forEachChild(node, ...rest);
  }) as typeof ts.forEachChild;

  return { ...ts, default: ts };
});

const PARTS = ['rating', 'badge', 'chip', 'tag'];

const checkout = () => {
  const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-open-points-reparse-')));
  const design = join(target, DESIGN_DIR);

  for (const name of PARTS) {
    mkdirSync(join(design, 'app-a/elements', name), { recursive: true });
    writeFileSync(
      join(design, 'app-a/elements', name, `${name}.ts`),
      `export default definePart({ implements: 'libs/${name}.ts', states: { default: { render: () => \`<span class="${name}">${name}</span>\` } } });\n`,
    );
  }
  writeFileSync(join(design, 'app-a/styles.css'), "@import 'tailwindcss';\n");
  writeFileSync(
    join(design, 'config.json'),
    JSON.stringify({ products: { 'app-a': { styles: [`${DESIGN_DIR}/app-a/styles.css`] } } }),
  );

  return target;
};

const productOf = (target: string) =>
  oneProductOf({ target, config: readConfig(target) ?? {}, asked: 'app-a' }) as ResolvedProduct;

describe('open points after a part edit', { timeout: 60_000 }, () => {
  it('walks the syntax tree of no unchanged source again', () => {
    const target = checkout();
    const sketch = markSketchReady({
      checkout: target,
      sketch: createSketch({
        product: productOf(target),
        sketch: { layer: 'elements', name: 'rating' },
        variants: ['a', 'b'],
      }) as Sketch,
    }) as Sketch;

    writeFileSync(join(variantDirOf(sketch, 'a'), 'elements/rating/rating.css'), '.rating { display: flex; }\n');
    readOpenPoints(productOf(target), { sketchProblems: true });

    const badge = join(target, DESIGN_DIR, 'app-a/elements/badge/badge.ts');

    writeFileSync(badge, `${readFileSync(badge, 'utf8')}// edited\n`);
    walked.texts = [];

    const points = readOpenPoints(productOf(target), { sketchProblems: true });
    const edited = readFileSync(badge, 'utf8');

    expect(
      points.flatMap(({ points }) =>
        points.flatMap((point) => (point.kind === 'sketch-problem' ? [`${point.variant} ${point.rule}`] : [])),
      ),
    ).toEqual(['a UTILITY-CSS', 'a SKETCH', 'b SKETCH']);
    expect(walked.texts.length).toBeGreaterThan(0);
    expect(new Set(walked.texts.filter((text) => text !== edited))).toEqual(new Set());
  });
});
