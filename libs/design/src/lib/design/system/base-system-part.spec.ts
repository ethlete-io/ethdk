import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { resolveProduct } from './resolve-product';
import { typecheckProduct } from './system-tsconfig';

const REPO = resolve(__dirname, '../../../../../..');
const SDK_ANCHORED_DIALOG = join(REPO, '.ethlete/design/sdk/components/anchored-dialog');
const SDK_DESIGN = join(REPO, 'libs/components/design');
const TOMFLIX_BUTTON = join(__dirname, '__fixtures__/tomflix-button-b697');
const INSTALLED = 'node_modules/@ethlete/components';

const writeJson = (file: string, value: unknown) => {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(value), 'utf8');
};

const tomflixWithRequiredButtonProp = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-base-system-part-'));
  const config = { styles: [], base: '@ethlete/components', schemes: ['dark'] as 'dark'[], accent: '#e50914' };
  const design = join(target, INSTALLED, 'design');

  writeJson(join(target, INSTALLED, 'package.json'), {
    name: '@ethlete/components',
    exports: { './design/*': './design/*.ts' },
  });
  cpSync(SDK_ANCHORED_DIALOG, join(design, 'sdk/components/anchored-dialog'), { recursive: true });
  writeJson(join(design, 'config.json'), { products: { sdk: { presets: { desktop: { width: 1440 } } } } });

  for (const file of readdirSync(SDK_DESIGN).filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts')))
    symlinkSync(join(SDK_DESIGN, file), join(design, file));

  const button = join(target, DESIGN_DIR, 'tomflix/components/button');

  mkdirSync(button, { recursive: true });
  writeFileSync(join(button, 'button-states.ts'), readFileSync(join(TOMFLIX_BUTTON, 'button-states.ts.txt')));
  writeFileSync(
    join(button, 'button.ts'),
    readFileSync(join(TOMFLIX_BUTTON, 'button.ts.txt'), 'utf8').replace("'@shared/button-states'", "'./button-states'"),
  );
  cpSync(join(TOMFLIX_BUTTON, 'button.css'), join(button, 'button.css'));
  writeJson(join(target, DESIGN_DIR, 'config.json'), { products: { tomflix: config } });

  return { target, product: resolveProduct({ target, name: 'tomflix', config }) };
};

describe('a base part that draws a @system/* part', () => {
  it('typechecks against a product whose override requires a prop the base does not pass', () => {
    const { target, product } = tomflixWithRequiredButtonProp();

    expect(product.parts.map((part) => [part.layer, part.name, part.origin])).toEqual(
      expect.arrayContaining([
        ['components', 'anchored-dialog', 'base'],
        ['components', 'button', 'product'],
      ]),
    );
    expect(typecheckProduct({ target, product })).toEqual({ kind: 'ok' });
  }, 60_000);
});
