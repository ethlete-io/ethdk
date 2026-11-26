import { logger, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import migration from './migration';
import { join } from 'node:path';
import ts from 'typescript';
import coreV4Exports from './core-v4-exports.json';
import reportRemovedExports, { REMOVED_EXPORTS } from './removed-exports';

const REWRITTEN_BY_OTHER_TRANSFORMS = new Set([
  'ViewportService',
  'RouterStateService',
  'createProvider',
  'createRootProvider',
  'createStaticProvider',
  'createStaticRootProvider',
]);

const currentCoreExports = () => {
  const barrel = join(__dirname, '../../src/index.ts');
  const program = ts.createProgram([barrel], { skipLibCheck: true, noEmit: true, types: [] });
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(barrel)!)!;

  return new Set(checker.getExportsOfModule(moduleSymbol).map((symbol) => symbol.name));
};

describe('migrate-to-v5 -> REMOVED_EXPORTS', () => {
  const current = currentCoreExports();

  it('covers every 4.32 export that core 5 no longer has', () => {
    const uncovered = coreV4Exports.filter(
      (name) => !current.has(name) && !REMOVED_EXPORTS.has(name) && !REWRITTEN_BY_OTHER_TRANSFORMS.has(name),
    );

    expect(uncovered).toEqual([]);
  });

  it('names no symbol core 5 still exports', () => {
    expect([...REMOVED_EXPORTS.keys()].filter((name) => current.has(name))).toEqual([]);
  });
});

describe('migrate-to-v5 -> removed exports report', () => {
  let tree: Tree;
  let loggerWarnSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.spyOn(logger, 'info').mockImplementation(() => {
      // noop
    });
    loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('points a removed v4 export at its successor', async () => {
    tree.write(
      'libs/app/save-bar.component.ts',
      `import { ObserveResizeDirective, LetDirective, SEO_DIRECTIVE_TOKEN } from '@ethlete/core';\n`,
    );

    const log = (await reportRemovedExports(tree)).review.join('\n');

    expect(log).toContain(
      'ObserveResizeDirective was removed from @ethlete/core in v5. Use `signalElementDimensions()`.',
    );
    expect(log).toContain("LetDirective was removed from @ethlete/core in v5. Use Angular's `@let`.");
    expect(log).toContain(
      'SEO_DIRECTIVE_TOKEN was removed from @ethlete/core in v5. Use the `apply*Binding` functions',
    );
  });

  it('should list each removed import per file without changing it', async () => {
    const memoInput = `import { Memo, injectRoute } from '@ethlete/core';

export class SomeService {
  @Memo()
  compute(value: number) {
    return value * 2;
  }
}
`;
    const propsInput = `import type { AnyTemplateType } from '@ethlete/core';
import { createProps as makeProps, PropsDirective } from '@ethlete/core';

export { templateComputed } from '@ethlete/core';
`;
    tree.write('libs/app-a/some.service.ts', memoInput);
    tree.write('libs/app-b/some.component.ts', propsInput);

    const { filesChanged, review } = await reportRemovedExports(tree);
    const log = review.join('\n');

    expect(filesChanged).toBe(0);
    expect(log).toContain(
      'libs/app-a/some.service.ts: Memo was removed from @ethlete/core together with the @Memo decorator',
    );
    expect(log).not.toContain('injectRoute');
    expect(log).toContain(
      'libs/app-b/some.component.ts: AnyTemplateType was removed from @ethlete/core together with the props module',
    );
    expect(log).toContain('createProps was removed');
    expect(log).toContain('PropsDirective was removed');
    expect(log).toContain('templateComputed was removed');
    expect(tree.read('libs/app-a/some.service.ts', 'utf-8')).toBe(memoInput);
    expect(tree.read('libs/app-b/some.component.ts', 'utf-8')).toBe(propsInput);
  });

  it('should list a template that binds [etProps]', async () => {
    tree.write('libs/app-a/some.component.html', `<div [etProps]="props"></div>\n`);

    const { review } = await reportRemovedExports(tree);

    expect(review).toEqual([
      'libs/app-a/some.component.html: [etProps] (PropsDirective) was removed from @ethlete/core together with the props module.',
    ]);
  });

  it('should stay silent for other packages and remaining core exports', async () => {
    tree.write(
      'libs/app-a/some.component.ts',
      `import { Memo } from 'some-memo-lib';
import { injectRoute, Props as CoreProps } from '@ethlete/other';
import { signalElementDimensions } from '@ethlete/core';
`,
    );
    tree.write('libs/app-a/some.component.html', `<div [etPropsLike]="value"></div>\n`);

    const { review } = await reportRemovedExports(tree);

    expect(review).toEqual([]);
  });

  it('should run from the migration unless disabled', async () => {
    tree.write('some.ts', `import { MapLike } from '@ethlete/core';\n`);

    const warnings = () => loggerWarnSpy.mock.calls.flat().join('\n');

    await migration(tree, { skipFormat: true });
    expect(warnings()).toContain('some.ts: MapLike was removed');

    loggerWarnSpy.mockClear();
    await migration(tree, { skipFormat: true, reportRemovedExports: false });
    expect(warnings()).not.toContain('MapLike was removed');
  });
});
