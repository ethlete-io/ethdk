import { execFileSync } from 'child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDesign } from '../check';
import { DESIGN_DIR, readConfig } from '../design-config';
import { partsChangedOf } from './base-parts';
import { acme, output } from './check-system.fixtures';
import { gitDiffChangesOf } from './part-task';
import { resolveProduct } from './resolve-product';

const git = (target: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.email=spec@example.com', '-c', 'user.name=spec', ...args], {
    cwd: target,
    stdio: 'pipe',
  });

const committed = (prepare?: (target: string) => void) => {
  const target = acme();

  prepare?.(target);
  git(target, 'init', '-q');
  git(target, 'add', '-A');
  git(target, 'commit', '-q', '-m', 'base');

  return target;
};

const changedPartsOf = (target: string) => {
  const config = readConfig(target) ?? {};
  const product = resolveProduct({ target, name: 'acme', config: config.products?.['acme'] ?? {} });

  return partsChangedOf({
    target,
    config,
    products: [product],
    changes: gitDiffChangesOf({ root: target, range: 'HEAD' }),
  }).get('acme');
};

describe('design check --product --base', () => {
  afterEach(() => vi.restoreAllMocks());

  it('checks only the parts whose design changed since the base and the parts that embed them, and names them', async () => {
    const target = committed();
    const lines = output();

    appendFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '\n.acme-hero { gap: 1px; }\n');

    await checkDesign({ target, argv: ['--product', 'acme', '--base', 'HEAD'], invocation: 'et design' });

    expect(lines).toContain('BASE acme since HEAD: 2 part(s) - elements/hero, pages/home');
    expect(lines.filter((line) => line.startsWith('NO PART'))).toEqual([]);
    expect(lines.some((line) => line.startsWith('PART acme components/button'))).toBe(false);
  });

  it('chooses a part whose implementing app files changed, and its hosts', () => {
    const component = 'apps/app-a/src/hero.component.ts';
    const target = committed((dir) => {
      const hero = join(dir, DESIGN_DIR, 'acme/elements/hero/hero.ts');

      mkdirSync(join(dir, 'apps/app-a/src'), { recursive: true });
      writeFileSync(join(dir, component), '@Component({})\nexport class Hero {}\n');
      writeFileSync(
        hero,
        readFileSync(hero, 'utf8').replace(
          'definePart<HeroProps>({',
          `definePart<HeroProps>({ implements: '${component}',`,
        ),
      );
    });

    expect(changedPartsOf(target)).toEqual([]);

    appendFileSync(join(target, component), 'export const gap = 1;\n');

    expect(changedPartsOf(target)).toEqual(['elements/hero', 'pages/home']);
  });

  it('refuses --base with --part', async () => {
    const target = committed();
    const lines = output();

    expect(
      await checkDesign({
        target,
        argv: ['--product', 'acme', '--part', 'elements/hero', '--base', 'HEAD'],
        invocation: 'et design',
      }),
    ).toBe(2);
    expect(lines).toEqual(['check takes --base or --part, not both']);
  });
});
