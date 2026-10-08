import { ApplicationRef, Component, ModelSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import '../../../../test-helpers';
import { CASCADER_IMPORTS } from '../cascader.imports';
import { CascaderDirective } from './cascader.directive';
import { CascaderDataSource } from './internals/cascader-tree';

@Component({
  template: `<et-cascader [(value)]="value" [dataSource]="dataSource" [multiple]="multiple()" />`,
  imports: [CASCADER_IMPORTS],
})
class CascaderValueHostComponent {
  public dataSource: CascaderDataSource<string> = { loadChildren: () => [] };
  public multiple = signal(false);
  public value = signal<string | readonly string[] | null>(null);
}

describe('CascaderDirective value type', () => {
  it('follows the bound value type', () => {
    expectTypeOf<CascaderDirective<string, string | null>['value']>().toEqualTypeOf<ModelSignal<string | null>>();
    expectTypeOf<CascaderDirective<string, string[]>['value']>().toEqualTypeOf<ModelSignal<string[]>>();

    // @ts-expect-error - a number value cannot bind to a cascader of strings
    expectTypeOf<CascaderDirective<string, number | null>>();
  });

  it('warns in dev mode when the value does not match multiple', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(CascaderValueHostComponent);
    const tick = () => TestBed.inject(ApplicationRef).tick();

    fixture.detectChanges();
    tick();
    expect(warn).not.toHaveBeenCalled();

    fixture.componentInstance.value.set(['a']);
    tick();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ET3309'));

    warn.mockClear();
    fixture.componentInstance.multiple.set(true);
    tick();
    expect(warn).not.toHaveBeenCalled();

    fixture.componentInstance.value.set('a');
    tick();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ET3309'));

    warn.mockRestore();
  });
});
