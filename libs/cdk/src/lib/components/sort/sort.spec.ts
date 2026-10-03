import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
});
