import { logger, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import migration from './migration';
import reportRemovedExports from './removed-exports';

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
