import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { entryOfBuilt } from '../render-packages';
import { createDesignServer } from '../serve';
import { resolveProduct } from './resolve-product';
import { typecheckProduct, writeEditorTsconfig, writeSystemTsconfig } from './system-tsconfig';

const fixtures = join(__dirname, '__fixtures__', DESIGN_DIR);
const cwd = process.cwd();
const closing: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(closing.splice(0).map((close) => close()));
  process.chdir(cwd);
});

const writeJson = (file: string, value: unknown) => {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(value), 'utf8');
};

const BASE = 'node_modules/@acme/ui/design/sdk';

const consumer = (options: { linked?: boolean } = {}) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-consumer-'));
  const installed = options.linked ? 'node_modules/.store/ui/node_modules/@acme/ui' : 'node_modules/@acme/ui';

  cpSync(join(fixtures, 'acme-base'), join(target, installed, 'design/sdk'), { recursive: true });
  writeJson(join(target, installed, 'package.json'), { name: '@acme/ui', version: '1.0.0' });
  writeJson(join(target, installed, 'design/config.json'), {
    products: { sdk: { presets: { desktop: { width: 1280 } } } },
  });

  if (options.linked) {
    mkdirSync(join(target, 'node_modules/@acme'), { recursive: true });
    symlinkSync(join(target, installed), join(target, 'node_modules/@acme/ui'));
  }

  cpSync(join(fixtures, 'acme'), join(target, DESIGN_DIR, 'app'), { recursive: true });
  writeJson(join(target, DESIGN_DIR, 'config.json'), { products: { app: { base: BASE } } });

  writeJson(join(target, 'node_modules/@ethlete/components/package.json'), {
    name: '@ethlete/components',
    exports: { './design/*': './design/*.ts' },
  });

  return target;
};

const appOf = (target: string) =>
  resolveProduct({ target, name: 'app', config: readConfig(target)?.products?.['app'] ?? {} });

describe('a base installed in node_modules', () => {
  it("types @ethlete/* from node_modules without render.packages, and from dist/libs' own config otherwise", () => {
    const target = consumer();
    const pathsOf = () =>
      JSON.parse(readFileSync(writeSystemTsconfig({ target, product: appOf(target) }), 'utf8')).compilerOptions.paths;

    expect(pathsOf()['@ethlete/components/design/*']).toEqual([
      join(target, 'node_modules/@ethlete/components/design/*.ts'),
    ]);

    mkdirSync(join(target, 'dist/libs'), { recursive: true });

    expect(pathsOf()['@ethlete/components/design/*']).toBeUndefined();
  });

  it('fails at once for a mapped package that is not installed, instead of waiting for a build', () => {
    const target = consumer();

    expect(() =>
      entryOfBuilt(
        { dir: join(target, 'node_modules/@ethlete/query'), subpath: './design' },
        {
          sleep: () => {
            throw new Error('waited');
          },
        },
      ),
    ).toThrow(/has no package\.json/);
  });

  it('writes no editor tsconfig into the installed base, only into the product of the checkout', () => {
    const target = consumer();
    const product = appOf(target);

    writeEditorTsconfig({ target, product: { ...product, dir: join(target, BASE) } });
    writeEditorTsconfig({ target, product });

    expect(existsSync(join(target, BASE, 'tsconfig.json'))).toBe(false);
    expect(existsSync(join(target, DESIGN_DIR, 'app/tsconfig.json'))).toBe(true);
  });

  it('typechecks the base parts with @system/* mapped to the parts the product resolves', () => {
    const target = consumer();

    expect(appOf(target).problems.filter((problem) => problem.rule === 'BASE')).toEqual([]);
    expect(typecheckProduct({ target, product: appOf(target) }).kind).toBe('ok');

    appendFileSync(join(target, BASE, 'components/card/card.ts'), 'export const broken: number = "x";\n');

    expect(typecheckProduct({ target, product: appOf(target) })).toMatchObject({
      kind: 'failed',
      output: expect.stringContaining('card.ts'),
    });
  }, 30_000);

  it.each([false, true])('resolves @system/* inside a base part to the product, linked: %s', async (linked) => {
    const target = consumer({ linked });
    const vite = await createDesignServer({ target, config: readConfig(target) ?? {}, listen: false });

    closing.push(() => vite.close());

    const card = await vite.transformRequest(`/@fs${join(target, BASE)}/components/card/card.ts?design-product=app`);

    expect(card?.code).toContain(`${join(target, DESIGN_DIR, 'app/components/button/button.ts')}?design-product=app`);
    expect(card?.code).toContain('__etMarkPart(__etPart, "components/card")');
  });
});
