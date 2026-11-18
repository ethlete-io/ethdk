import { Component, signal } from '@angular/core';
import '../../../test-helpers';
import { mountSelect } from '../testing/select-driver';
import { SELECT_IMPORTS } from './select.imports';
import { SelectOptionData } from './headless/select.tokens';

const OPTIONS: SelectOptionData[] = [
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France' },
];

@Component({
  template: `
    <et-select [options]="options()" class="select" aria-label="Select Country">
      <input etSelectSearch />
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class SearchSelectHost {
  options = signal(OPTIONS);
}

@Component({
  template: `
    <et-select [options]="options()" class="select" aria-label="Select Country" aria-labelledby="caption" />
    <span id="caption">Country</span>
  `,
  imports: [SELECT_IMPORTS],
})
class TriggerSelectHost {
  options = signal(OPTIONS);
}

describe('et-select accessible name', () => {
  it('names only the search combobox, not the et-select host', () => {
    const driver = mountSelect(SearchSelectHost);
    const host = driver.fixture.nativeElement.querySelector('et-select') as HTMLElement;

    expect(driver.searchInput().getAttribute('aria-label')).toBe('Select Country');
    expect(host.hasAttribute('aria-label')).toBe(false);
    expect(driver.fixture.nativeElement.querySelectorAll('[aria-label="Select Country"]')).toHaveLength(1);
  });

  it('names only the trigger, not the et-select host', () => {
    const driver = mountSelect(TriggerSelectHost);
    const host = driver.fixture.nativeElement.querySelector('et-select') as HTMLElement;

    expect(driver.trigger().getAttribute('aria-labelledby')?.split(' ')).toContain('caption');
    expect(host.hasAttribute('aria-label')).toBe(false);
    expect(host.hasAttribute('aria-labelledby')).toBe(false);
  });
});
