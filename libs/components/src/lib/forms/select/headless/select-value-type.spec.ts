import { ApplicationRef, Component, ModelSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import '../../../../test-helpers';
import { SELECT_IMPORTS } from '../select.imports';
import { SelectDirective } from './select.directive';

@Component({
  template: `<et-select [(value)]="value" [multiple]="multiple()" />`,
  imports: [SELECT_IMPORTS],
})
class SelectValueHostComponent {
  public multiple = signal(false);
  public value = signal<string | readonly string[] | null>(null);
}

describe('SelectDirective value type', () => {
  it('follows the bound value type', () => {
    expectTypeOf<SelectDirective<string | null>['value']>().toEqualTypeOf<ModelSignal<string | null>>();
    expectTypeOf<SelectDirective<string[]>['value']>().toEqualTypeOf<ModelSignal<string[]>>();
    expectTypeOf<SelectDirective['value']>().toEqualTypeOf<ModelSignal<unknown>>();

    // @ts-expect-error - a single-value select does not emit an array
    expectTypeOf<SelectDirective<string | null>['value']>().toEqualTypeOf<ModelSignal<string[]>>();
  });

  it('warns in dev mode when the value does not match multiple', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(SelectValueHostComponent);
    const tick = () => TestBed.inject(ApplicationRef).tick();

    fixture.detectChanges();
    tick();
    expect(warn).not.toHaveBeenCalled();

    fixture.componentInstance.value.set(['a']);
    tick();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ET1015'));

    warn.mockClear();
    fixture.componentInstance.multiple.set(true);
    tick();
    expect(warn).not.toHaveBeenCalled();

    fixture.componentInstance.value.set('a');
    tick();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ET1015'));

    warn.mockRestore();
  });
});
