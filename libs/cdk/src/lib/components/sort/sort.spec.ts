import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import type { Sort } from '@ethlete/query';
import { SortDefaultOptions, SORT_DEFAULT_OPTIONS, SortDirective } from './partials/sort';
import { SortImports } from './sort.imports';

@Component({
  template: `
    <div [etSortDisableClear]="disableClear" etSort>
      <button et-sort-header="name">Name</button>
    </div>
  `,
  imports: [SortImports],
})
class SortHostComponent {
  disableClear = false;
}

@Component({
  template: `
    <div etSort>
      <button et-sort-header="name">Name</button>
    </div>
  `,
  imports: [SortImports],
})
class UnconfiguredSortHostComponent {}

@Component({
  template: `
    <div [sortControl]="control()" etSort>
      <button et-sort-header="name">Name</button>
    </div>
  `,
  imports: [SortImports],
})
class SortControlHostComponent {
  control = signal(new FormControl<Sort | null>({ active: 'name', direction: 'asc' }));
}

const render = (config: { disableClear?: boolean; defaults?: SortDefaultOptions } = {}) => {
  TestBed.configureTestingModule({
    providers: config.defaults ? [{ provide: SORT_DEFAULT_OPTIONS, useValue: config.defaults }] : [],
  });
  if (config.disableClear === undefined) {
    const fixture = TestBed.createComponent(UnconfiguredSortHostComponent);
    fixture.detectChanges();
    return fixture;
  }

  const fixture = TestBed.createComponent(SortHostComponent);
  fixture.componentInstance.disableClear = config.disableClear;
  fixture.detectChanges();
  return fixture;
};

const clickThrice = (fixture: ReturnType<typeof render>) => {
  const header = fixture.nativeElement.querySelector('[et-sort-header]') as HTMLElement;
  const sort = fixture.debugElement.children[0]!.injector.get(SortDirective);
  const directions: string[] = [];

  for (let i = 0; i < 3; i++) {
    header.click();
    directions.push(sort.direction);
  }

  return directions;
};

describe('SortDirective', () => {
  it('clears the sort on the third click by default', () => {
    expect(clickThrice(render())).toEqual(['asc', 'desc', '']);
  });

  it('honors etSortDisableClear', () => {
    expect(clickThrice(render({ disableClear: true }))).toEqual(['asc', 'desc', 'asc']);
  });

  it('honors disableClear from the default options', () => {
    expect(clickThrice(render({ defaults: { disableClear: true } }))).toEqual(['asc', 'desc', 'asc']);
  });

  it('removes the sort action description when the header is destroyed', () => {
    const fixture = render();

    expect(document.querySelectorAll('.cdk-describedby-message-container > *').length).toBe(1);

    fixture.destroy();

    expect(document.querySelectorAll('.cdk-describedby-message-container > *').length).toBe(0);
  });

  it('follows a swapped sortControl', () => {
    const fixture = TestBed.createComponent(SortControlHostComponent);
    fixture.detectChanges();
    const sort = fixture.debugElement.children[0]!.injector.get(SortDirective);
    const oldControl = fixture.componentInstance.control();
    const newControl = new FormControl<Sort | null>({ active: 'name', direction: 'asc' });

    fixture.componentInstance.control.set(newControl);
    fixture.detectChanges();

    newControl.setValue({ active: 'name', direction: 'desc' });
    expect(sort.direction).toBe('desc');

    oldControl.setValue({ active: 'name', direction: '' });
    expect(sort.direction).toBe('desc');
  });
});
