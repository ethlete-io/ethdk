import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3 prepare migration', () => {
  let tree: Tree;

  const readFile = (path: string) => tree.read(path, 'utf-8')!;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should add an injector member and wire it into class-based prepare calls', async () => {
    tree.write(
      'component.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  loadUsers() {
    return legacyGetUsers.prepare({ queryParams: { page: 1 } });
  }
}
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('component.ts');

    expect(result).toContain("import { Injector, inject } from '@angular/core';");
    expect(result).toContain('private injector = inject(Injector);');
    expect(result).toContain('injector: this.injector');
    expect(result).toContain('config: { destroyOnResponse: true }');
  });

  it('should avoid destroyOnResponse when polling is detected in the same function', async () => {
    tree.write(
      'component.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  loadUsers() {
    const query = legacyGetUsers.prepare();
    query.poll();

    return query;
  }
}
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('component.ts');

    expect(result).toContain('const query = legacyGetUsers.prepare({ injector: this.injector });');
    expect(result).not.toContain('destroyOnResponse');
  });

  describe('callback call sites', () => {
    const writeComponent = (body: string) =>
      tree.write(
        'component.ts',
        `
import { computed, effect } from '@angular/core';
import { createLegacyQueryCreator, queryComputed } from '@ethlete/query';
import { map, switchMap } from 'rxjs';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
${body}
}
      `.trim(),
      );

    it('migrates a computed at a class field', async () => {
      writeComponent(`  users = computed(() => legacyGetUsers.prepare({ queryParams: { page: 1 } }));`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('injector: this.injector');
    });

    it('migrates an effect inside the constructor', async () => {
      writeComponent(`  constructor() {
    effect(() => legacyGetUsers.prepare({}));
  }`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('injector: this.injector');
    });

    it('migrates an rxjs operator callback inside the constructor', async () => {
      writeComponent(`  constructor() {
    this.source$.pipe(map(() => legacyGetUsers.prepare({}))).subscribe();
  }

  private source$ = {} as never;`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('injector: this.injector');
    });

    it('migrates a callback nested inside queryComputed', async () => {
      writeComponent(`  users = queryComputed(() => this.source$.pipe(switchMap(() => legacyGetUsers.prepare({}))));

  private source$ = {} as never;`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('injector: this.injector');
    });

    it('leaves queryComputed itself alone', async () => {
      writeComponent(`  users = queryComputed(() => legacyGetUsers.prepare({}));`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).not.toContain('injector');
    });

    it('leaves a synchronous array callback in the constructor alone', async () => {
      writeComponent(`  constructor() {
    [1, 2].forEach(() => legacyGetUsers.prepare({}));
  }`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).not.toContain('injector');
    });

    it('leaves a plain class field alone', async () => {
      writeComponent(`  users = legacyGetUsers.prepare({});`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).not.toContain('injector');
    });
  });

  describe('destroyOnResponse for discarded queries', () => {
    const writeComponent = (statement: string) =>
      tree.write(
        'component.ts',
        `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  loadUsers() {
    ${statement}
  }
}
      `.trim(),
      );

    it('adds it when the query is thrown away', async () => {
      writeComponent('legacyGetUsers.prepare({}).execute();');

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('destroyOnResponse: true');
    });

    it('does not add it to a chained poll', async () => {
      writeComponent('legacyGetUsers.prepare({}).poll({ interval: 1000 });');

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).not.toContain('destroyOnResponse');
    });

    it('does not add it when the query is handed to something else', async () => {
      writeComponent('this.container.next(legacyGetUsers.prepare({}));');

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).not.toContain('destroyOnResponse');
    });
  });

  it('should write manual review tasks for standalone functions without inject context', async () => {
    tree.write(
      'standalone.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export const loadUsers = () => legacyGetUsers.prepare({ queryParams: { page: 1 } });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const report = readFile('query-v3-migration-tasks.md');

    expect(report).toContain('Review standalone prepare() usage for legacyGetUsers');
    expect(report).toContain('Pass an Injector explicitly');
  });
});
