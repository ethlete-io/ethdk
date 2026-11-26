import { describe, expect, it } from 'vitest';
import { migrateCreateDestroyInFile } from './create-destroy';

const migrate = (source: string[]) => migrateCreateDestroyInFile('libs/app/src/thing.ts', source.join('\n'));

describe('migrate-create-destroy', () => {
  it('rewrites takeUntil in a method to the destroy ref and swaps the field', () => {
    const { content, changed, tasks } = migrate([
      "import { Directive } from '@angular/core';",
      "import { createDestroy } from '@ethlete/core';",
      "import { takeUntil } from 'rxjs';",
      '',
      '@Directive()',
      'export class A {',
      '  private readonly _destroy$ = createDestroy();',
      '',
      '  start() {',
      '    this.source$.pipe(takeUntil(this._destroy$)).subscribe();',
      '  }',
      '}',
    ]);

    expect(changed).toBe(true);
    expect(tasks).toEqual([]);
    expect(content).toContain('private readonly _destroyRef = inject(DestroyRef);');
    expect(content).toContain('takeUntilDestroyed(this._destroyRef)');
    expect(content).toContain("import { takeUntilDestroyed } from '@angular/core/rxjs-interop';");
    expect(content).toContain("import { DestroyRef, Directive, inject } from '@angular/core';");
    expect(content).not.toContain('createDestroy');
    expect(content).not.toContain('takeUntil(');
    expect(content).not.toContain("from 'rxjs'");
  });

  it('uses a plain takeUntilDestroyed() when every use is in an injection context', () => {
    const { content } = migrate([
      "import { createDestroy } from '@ethlete/core';",
      "import { takeUntil } from 'rxjs';",
      '',
      'export class A {',
      '  private destroy$ = createDestroy();',
      '  value$ = this.source$.pipe(takeUntil(this.destroy$));',
      '',
      '  constructor() {',
      '    this.other$.pipe(takeUntil(this.destroy$)).subscribe();',
      '  }',
      '}',
    ]);

    expect(content).toContain('this.source$.pipe(takeUntilDestroyed())');
    expect(content).toContain('this.other$.pipe(takeUntilDestroyed()).subscribe()');
    expect(content).not.toContain('DestroyRef');
    expect(content).not.toContain('destroy$');
    expect(content).not.toContain('inject');
  });

  it('needs the ref for a callback inside the constructor', () => {
    const { content } = migrate([
      "import { createDestroy } from '@ethlete/core';",
      "import { takeUntil } from 'rxjs';",
      '',
      'export class A {',
      '  private _destroy$ = createDestroy();',
      '',
      '  constructor() {',
      '    this.a$.subscribe(() => this.b$.pipe(takeUntil(this._destroy$)).subscribe());',
      '    this.c$.pipe(takeUntil(this._destroy$)).subscribe();',
      '  }',
      '}',
    ]);

    expect(content).toContain('takeUntilDestroyed(this._destroyRef)');
    expect(content).toContain('this.c$.pipe(takeUntilDestroyed()).subscribe()');
    expect(content).toContain('private _destroyRef = inject(DestroyRef);');
  });

  it('reuses an existing DestroyRef field', () => {
    const { content } = migrate([
      "import { DestroyRef, inject } from '@angular/core';",
      "import { createDestroy } from '@ethlete/core';",
      "import { takeUntil } from 'rxjs';",
      '',
      'export class A {',
      '  private readonly _ref = inject(DestroyRef);',
      '  private readonly _destroy$ = createDestroy();',
      '',
      '  start() {',
      '    this.source$.pipe(takeUntil(this._destroy$)).subscribe();',
      '  }',
      '}',
    ]);

    expect(content).toContain('takeUntilDestroyed(this._ref)');
    expect(content.match(/inject\(DestroyRef\)/g)).toHaveLength(1);
    expect(content).not.toContain('_destroy$');
  });

  it('leaves other uses untouched and reports them with file and line', () => {
    const { content, tasks } = migrate([
      "import { createDestroy } from '@ethlete/core';",
      "import { takeUntil } from 'rxjs';",
      '',
      'export class A {',
      '  private _destroy$ = createDestroy();',
      '',
      '  start() {',
      '    this.source$.pipe(takeUntil(this._destroy$)).subscribe();',
      '    this.other$.pipe(takeUntil(this._destroy$), takeUntil(this._destroy$)).subscribe();',
      '    this._destroy$.pipe(first()).subscribe();',
      '    helper(this._destroy$);',
      '  }',
      '}',
    ]);

    expect(content).toContain('private _destroy$ = createDestroy();');
    expect(content).toContain('this._destroy$.pipe(first())');
    expect(content).toContain('helper(this._destroy$)');
    expect(content).toContain('takeUntilDestroyed(this._destroyRef)');
    expect(content).toContain("import { createDestroy } from '@ethlete/core';");
    expect(tasks.map((task) => [task.file, task.line])).toEqual([
      ['libs/app/src/thing.ts', 10],
      ['libs/app/src/thing.ts', 11],
    ]);
  });

  it('keeps takeUntil imported while another use remains', () => {
    const { content } = migrate([
      "import { createDestroy } from '@ethlete/core';",
      "import { Subject, takeUntil } from 'rxjs';",
      '',
      'export class A {',
      '  private _destroy$ = createDestroy();',
      '  private _stop$ = new Subject<void>();',
      '',
      '  start() {',
      '    this.a$.pipe(takeUntil(this._destroy$)).subscribe();',
      '    this.b$.pipe(takeUntil(this._stop$)).subscribe();',
      '  }',
      '}',
    ]);

    expect(content).toContain("import { Subject, takeUntil } from 'rxjs';");
    expect(content).toContain('this.b$.pipe(takeUntil(this._stop$))');
    expect(content).not.toContain('createDestroy');
  });

  it('migrates each class on its own', () => {
    const { content } = migrate([
      "import { createDestroy } from '@ethlete/core';",
      "import { takeUntil } from 'rxjs';",
      '',
      'export class A {',
      '  private _destroy$ = createDestroy();',
      '  a$ = x$.pipe(takeUntil(this._destroy$));',
      '}',
      '',
      'export class B {',
      '  private _destroy$ = createDestroy();',
      '  start() {',
      '    x$.pipe(takeUntil(this._destroy$)).subscribe();',
      '  }',
      '}',
    ]);

    expect(content).toContain('a$ = x$.pipe(takeUntilDestroyed());');
    expect(content).toContain('takeUntilDestroyed(this._destroyRef)');
    expect(content.match(/inject\(DestroyRef\)/g)).toHaveLength(1);
  });

  it('reports a createDestroy call that is not a class field', () => {
    const { changed, tasks } = migrate([
      "import { createDestroy } from '@ethlete/core';",
      '',
      'export const make = () => createDestroy();',
    ]);

    expect(changed).toBe(false);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.line).toBe(3);
  });

  it('ignores files without createDestroy', () => {
    const source = ["import { takeUntil } from 'rxjs';", 'export class A {}'];

    expect(migrate(source)).toEqual({ content: source.join('\n'), changed: false, tasks: [] });
  });
});
