import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { ruleProblemsOf } from '../check-system';
import { resolveProduct } from '../resolve-product';
import { badSvgAssetsOf } from './svg-asset';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const productOf = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const linesOf = (problems: { rule: string; file: string; message: string }[]) =>
  problems.map((problem) => `${problem.rule} ${problem.file.split('/').slice(-2).join('/')}: ${problem.message}`);

describe('badSvgAssetsOf', () => {
  it('passes an svg with the svg namespace on its root, after a prolog and a comment', () => {
    const target = acme();

    write(
      target,
      'acme/assets/mark.svg',
      '<?xml version="1.0"?>\n<!-- <svg> -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"/>',
    );
    write(target, 'acme/assets/logo.png', 'not an svg');

    expect(badSvgAssetsOf(productOf(target))).toEqual([]);
  });

  it('reports an svg without the svg namespace and a file without a root svg', () => {
    const target = acme();

    write(target, 'acme/assets/mark.svg', '<svg viewBox="0 0 8 8"><g xmlns="http://www.w3.org/2000/svg"/></svg>');
    write(target, 'acme/assets/icons/empty.svg', '<div></div>');

    expect(linesOf(ruleProblemsOf(productOf(target)).filter((problem) => problem.rule === 'SVG-ASSET'))).toEqual([
      'SVG-ASSET icons/empty.svg: has no root <svg> element',
      'SVG-ASSET assets/mark.svg: the root <svg> has no xmlns="http://www.w3.org/2000/svg" - an image viewer or <img src> does not draw it',
    ]);
  });

  it('checks a sketch variant’s own assets instead of the product’s', () => {
    const target = acme();
    const assetsDir = join(target, DESIGN_DIR, 'acme/sketches/components-button/a/assets');

    write(target, 'acme/assets/mark.svg', '<svg/>');
    write(target, 'acme/sketches/components-button/a/assets/new.svg', "<svg xmlns='http://www.w3.org/1999/xhtml'/>");

    expect(linesOf(badSvgAssetsOf({ ...productOf(target), assetsDir }))).toEqual([
      'SVG-ASSET assets/new.svg: the root <svg> has no xmlns="http://www.w3.org/2000/svg" - an image viewer or <img src> does not draw it',
    ]);
  });
});
