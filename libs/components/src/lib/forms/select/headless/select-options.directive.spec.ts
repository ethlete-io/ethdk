import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { SelectOptionsFromQuery } from '../select-options-from-query';
import { SELECT_IMPORTS } from '../select.imports';
import { SelectDirective } from './select.directive';
import { SelectOptionData } from './select.tokens';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';

@Component({
  template: `
    <et-select [value]="value()" [etSelectOptions]="bundle" (valueChange)="value.set($event)" placeholder="Pick">
      <input etSelectSearch placeholder="Search" />
      @for (option of bundle.options(); track option.value) {
        <et-select-option [value]="option.value">{{ option.label }}</et-select-option>
      }
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class OptionsDirectiveHost {
  value = signal<unknown>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  hasMore = signal(false);
  optionsData = signal<SelectOptionData[]>([{ value: 'apple', label: 'Apple' }]);
  setQueryCalls: string[] = [];
  loadMoreCalls = 0;

  bundle: SelectOptionsFromQuery<SelectOptionData> = {
    options: this.optionsData,
    loading: this.loading,
    error: this.error,
    hasMore: this.hasMore,
    query: signal(''),
    setQuery: (query) => this.setQueryCalls.push(query),
    loadMore: () => {
      this.loadMoreCalls += 1;
    },
  };
}

describe('SelectOptionsDirective', () => {
  let fixture: ComponentFixture<OptionsDirectiveHost>;
  let host: OptionsDirectiveHost;
  let select: SelectDirective;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OptionsDirectiveHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(OptionsDirectiveHost);
    fixture.detectChanges();
    host = fixture.componentInstance;
    select = fixture.debugElement.children[0]!.injector.get(SelectDirective);
  });

  it('forwards the bundle async state onto the select', () => {
    expect(select.loading()).toBe(false);
    expect(select.error()).toBeNull();
    expect(select.hasMoreItems()).toBe(false);

    host.loading.set(true);
    host.error.set('boom');
    host.hasMore.set(true);
    tick();

    expect(select.loading()).toBe(true);
    expect(select.error()).toBe('boom');
    expect(select.hasMoreItems()).toBe(true);
  });

  it('forces filterMode to external while the bundle is bound', () => {
    expect(select.filterMode()).toBe('external');
  });

  it('drives the bundle setQuery from the select queryChange output', () => {
    select.queryChange.emit('mango');

    expect(host.setQueryCalls).toEqual(['mango']);
  });

  it('drives the bundle loadMore from the select loadMore output', () => {
    select.loadMore.emit();
    select.loadMore.emit();

    expect(host.loadMoreCalls).toBe(2);
  });

  it('clears the async source when the directive is destroyed', () => {
    host.loading.set(true);
    tick();
    expect(select.loading()).toBe(true);

    fixture.destroy();

    // asyncOptions is cleared on destroy, so state falls back to the (default false) input
    expect(select.asyncOptions()).toBeNull();
    expect(select.loading()).toBe(false);
  });
});
