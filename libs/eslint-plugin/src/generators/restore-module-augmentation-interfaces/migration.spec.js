// @ts-check
'use strict';

const { createTreeWithEmptyWorkspace } = require('@nx/devkit/testing');
const migrate = require('./migration');

const BEFORE = `import type { Brand } from './brand';

declare module '@ethlete/core' {
  type EthleteColorThemeNameRegistry = {
    brand: true;
    danger: true;
  };

  export type EthleteSurfaceThemeNameRegistry<T = Brand> = { base: T };

  type ThemeName = 'brand' | 'danger';

  type Mapped = { [K in ThemeName]: true };
}

declare global {
  type Window = {
    appVersion: string;
  };
}

type Local = { name: string };
`;

const AFTER = `import type { Brand } from './brand';

declare module '@ethlete/core' {
  interface EthleteColorThemeNameRegistry {
    brand: true;
    danger: true;
  }

  export interface EthleteSurfaceThemeNameRegistry<T = Brand> { base: T }

  type ThemeName = 'brand' | 'danger';

  type Mapped = { [K in ThemeName]: true };
}

declare global {
  interface Window {
    appVersion: string;
  }
}

type Local = { name: string };
`;

const DIRECTIVES_BEFORE = `// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface A { a: string }
interface B { b: string } // eslint-disable-line @typescript-eslint/consistent-type-definitions, no-console
/* eslint-disable @typescript-eslint/consistent-type-definitions */
interface C { c: string }
/* eslint-enable @typescript-eslint/consistent-type-definitions */
const note = '@typescript-eslint/consistent-type-definitions';
`;

const DIRECTIVES_AFTER = `// eslint-disable-next-line ethlete/consistent-type-definitions
interface A { a: string }
interface B { b: string } // eslint-disable-line ethlete/consistent-type-definitions, no-console
/* eslint-disable ethlete/consistent-type-definitions */
interface C { c: string }
/* eslint-enable ethlete/consistent-type-definitions */
const note = '@typescript-eslint/consistent-type-definitions';
`;

describe('restore-module-augmentation-interfaces', () => {
  /** @type {import('@nx/devkit').Tree} */
  let tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('turns object-literal aliases in module augmentations back into interfaces', async () => {
    tree.write('libs/theme/src/theme.d.ts', BEFORE);

    await migrate(tree, { skipFormat: true });

    expect(tree.read('libs/theme/src/theme.d.ts', 'utf-8')).toBe(AFTER);
  });

  it('lists the aliases it cannot turn into an interface', async () => {
    tree.write('libs/theme/src/theme.ts', BEFORE);

    await migrate(tree, { skipFormat: true });

    const warnings = vi.mocked(console.warn).mock.calls.map(([message]) => String(message));

    expect(warnings.filter((message) => message.includes('libs/theme/src/theme.ts:'))).toEqual([
      expect.stringContaining('theme.ts:11: type ThemeName'),
      expect.stringContaining('theme.ts:13: type Mapped'),
    ]);
  });

  it('renames the upstream rule in eslint directives', async () => {
    tree.write('apps/web/src/a.ts', DIRECTIVES_BEFORE);

    await migrate(tree, { skipFormat: true });

    expect(tree.read('apps/web/src/a.ts', 'utf-8')).toBe(DIRECTIVES_AFTER);
  });

  it('is idempotent', async () => {
    tree.write('libs/theme/src/theme.d.ts', AFTER);
    tree.write('apps/web/src/a.ts', DIRECTIVES_AFTER);

    await migrate(tree, { skipFormat: true });

    expect(tree.read('libs/theme/src/theme.d.ts', 'utf-8')).toBe(AFTER);
    expect(tree.read('apps/web/src/a.ts', 'utf-8')).toBe(DIRECTIVES_AFTER);
  });

  it('leaves type aliases outside module augmentations alone', async () => {
    const source = `declare namespace Api {\n  type User = { id: string };\n}\n\ntype Local = { name: string };\n`;

    tree.write('libs/api/src/api.ts', source);

    await migrate(tree, { skipFormat: true });

    expect(tree.read('libs/api/src/api.ts', 'utf-8')).toBe(source);
  });
});
