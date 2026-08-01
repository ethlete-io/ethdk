import { describe, expect, it } from 'vitest';
import { migrateProviderShapeInFile } from './provider-shape';

const migrate = (source: string) => migrateProviderShapeInFile('libs/app/src/thing.ts', source);

describe('migrate-provider-shape', () => {
  it('splits a two-binding tuple into a definition and two pure extractors', () => {
    const { content, changed } = migrate(
      [
        "import { createRootProvider } from '@ethlete/core';",
        '',
        "export const [provideThing, injectThing] = createRootProvider(() => ({}), { name: 'Thing' });",
      ].join('\n'),
    );

    expect(changed).toBe(true);
    expect(content).toBe(
      [
        "import { defineRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';",
        '',
        "const THING_DEF = /* @__PURE__ */ defineRootProvider(() => ({}), { name: 'Thing' });",
        '',
        'export const provideThing = /* @__PURE__ */ toProvideFn(THING_DEF);',
        'export const injectThing = /* @__PURE__ */ toInjectFn(THING_DEF);',
      ].join('\n'),
    );
  });

  it('keeps type arguments and the exported token', () => {
    const { content } = migrate(
      [
        "import { createStaticRootProvider } from '@ethlete/core';",
        '',
        'export const [provideCfg, injectCfg, CFG_TOKEN] = createStaticRootProvider<Cfg>(DEFAULTS);',
      ].join('\n'),
    );

    expect(content).toContain('const CFG_DEF = /* @__PURE__ */ defineStaticRootProvider<Cfg>(DEFAULTS);');
    expect(content).toContain('export const CFG_TOKEN = /* @__PURE__ */ toToken(CFG_DEF);');
    expect(content).toContain(
      "import { defineStaticRootProvider, toInjectFn, toProvideFn, toToken } from '@ethlete/core';",
    );
  });

  it('drops omitted bindings instead of naming them', () => {
    const { content } = migrate(
      [
        "import { createRootProvider } from '@ethlete/core';",
        '',
        'export const [, injectOnly] = createRootProvider(() => 1);',
      ].join('\n'),
    );

    expect(content).toContain('export const injectOnly = /* @__PURE__ */ toInjectFn(ONLY_DEF);');
    expect(content).not.toContain('toProvideFn');
  });

  it('moves the declaration JSDoc onto the first named binding', () => {
    const { content } = migrate(
      [
        "import { createLabels } from '@ethlete/core';",
        '',
        '/** Localize the widget. */',
        "export const [provideWidgetLabels, injectWidgetLabels] = createLabels<WidgetLabels>('WIDGET_LABELS', DEFAULTS);",
      ].join('\n'),
    );

    expect(content).toBe(
      [
        "import { defineLabels, toInjectFn, toProvideFn } from '@ethlete/core';",
        '',
        "const WIDGET_LABELS_DEF = /* @__PURE__ */ defineLabels<WidgetLabels>('WIDGET_LABELS', DEFAULTS);",
        '',
        '/** Localize the widget. */',
        'export const provideWidgetLabels = /* @__PURE__ */ toProvideFn(WIDGET_LABELS_DEF);',
        'export const injectWidgetLabels = /* @__PURE__ */ toInjectFn(WIDGET_LABELS_DEF);',
      ].join('\n'),
    );
  });

  it('rewrites several declarations in one file without name collisions', () => {
    const { content } = migrate(
      [
        "import { createStaticProvider } from '@ethlete/core';",
        '',
        "export const [provideA, injectA] = createStaticProvider(1, { name: 'A' });",
        "export const [provideB, injectB] = createStaticProvider(2, { name: 'B' });",
      ].join('\n'),
    );

    expect(content).toContain('const A_DEF = /* @__PURE__ */ defineStaticProvider(1');
    expect(content).toContain('const B_DEF = /* @__PURE__ */ defineStaticProvider(2');
  });

  it('leaves non-exported declarations non-exported', () => {
    const { content } = migrate(
      [
        "import { createRootProvider } from '@ethlete/core';",
        '',
        'const [provideInternal, injectInternal] = createRootProvider(() => 1);',
      ].join('\n'),
    );

    expect(content).toContain('const provideInternal = /* @__PURE__ */ toProvideFn(INTERNAL_DEF);');
    expect(content).not.toContain('export const provideInternal');
  });

  it('rewrites a runtime ref factory in place, without an annotation', () => {
    const { content } = migrate(
      [
        "import { createQueryClient } from '@ethlete/query';",
        '',
        "export const [provideApi, injectApi] = createQueryClient({ name: 'api', baseUrl: '/' });",
      ].join('\n'),
    );

    expect(content).toBe(
      [
        "import { createQueryClient } from '@ethlete/query';",
        "import { toInjectFn, toProvideFn } from '@ethlete/core';",
        '',
        "const API_DEF = createQueryClient({ name: 'api', baseUrl: '/' });",
        '',
        'export const provideApi = toProvideFn(API_DEF);',
        'export const injectApi = toInjectFn(API_DEF);',
      ].join('\n'),
    );
  });

  it('joins the extractors onto an existing core import', () => {
    const { content } = migrate(
      [
        "import { isObject } from '@ethlete/core';",
        "import { createWebSocketClient } from '@ethlete/query';",
        '',
        "const [, injectSocket] = createWebSocketClient({ name: 's', url: '/' });",
      ].join('\n'),
    );

    expect(content).toContain("import { isObject, toInjectFn } from '@ethlete/core';");
    expect(content).toContain("const SOCKET_DEF = createWebSocketClient({ name: 's', url: '/' });");
    expect(content).toContain('const injectSocket = toInjectFn(SOCKET_DEF);');
  });

  it('reports a runtime factory call it cannot rewrite instead of touching it', () => {
    const source = [
      "import { createRootProvider } from '@ethlete/core';",
      '',
      'export const createClient = (options: Options) => createRootProvider(() => build(options));',
    ].join('\n');

    const { content, changed, tasks } = migrate(source);

    expect(changed).toBe(false);
    expect(content).toBe(source);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.id).toBe('provider-shape:libs/app/src/thing.ts:3');
    expect(tasks[0]?.message).toContain('defineRootProvider');
  });

  it('is a no-op for a file that never mentions a factory', () => {
    const source = 'export const injectThing = () => inject(THING);\n';

    expect(migrate(source)).toEqual({ content: source, changed: false, tasks: [] });
  });
});
