import { ApplicationRef, Component, ModelSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import '../../../test-helpers';
import { TREE_IMPORTS } from '../tree.imports';
import { TreeDirective } from './tree.directive';
import { TreeDataSource, TreeSelectionMode } from './tree.types';

@Component({
  template: `<et-tree [(value)]="value" [dataSource]="dataSource" [selectionMode]="mode()" />`,
  imports: [TREE_IMPORTS],
})
class TreeValueHostComponent {
  public dataSource: TreeDataSource<string> = { loadChildren: () => [] };
  public mode = signal<TreeSelectionMode>('single');
  public value = signal<string | readonly string[] | null>(null);
}

describe('TreeDirective value type', () => {
  it('follows the bound value type', () => {
    expectTypeOf<TreeDirective<string, string | null>['value']>().toEqualTypeOf<ModelSignal<string | null>>();
    expectTypeOf<TreeDirective<string, string[]>['value']>().toEqualTypeOf<ModelSignal<string[]>>();

    // @ts-expect-error - a number value cannot bind to a tree of strings
    expectTypeOf<TreeDirective<string, number | null>>();
  });

  it('warns in dev mode when the value does not match the selection mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(TreeValueHostComponent);
    const tick = () => TestBed.inject(ApplicationRef).tick();

    fixture.detectChanges();
    tick();
    expect(warn).not.toHaveBeenCalled();

    fixture.componentInstance.value.set(['a']);
    tick();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ET4602'));

    warn.mockClear();
    fixture.componentInstance.mode.set('multiple');
    tick();
    expect(warn).not.toHaveBeenCalled();

    fixture.componentInstance.value.set('a');
    tick();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ET4602'));

    warn.mockClear();
    fixture.componentInstance.mode.set('none');
    tick();
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});
