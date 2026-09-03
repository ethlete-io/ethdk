import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountSelectionList, SelectionListDriver } from '../../testing/selection-list-driver';
import { SEGMENTED_BUTTON_IMPORTS } from '../selection-list.imports';

@Component({
  template: `
    <et-segmented-button-group [value]="value()" [variant]="variant()" (valueChange)="value.set($event)">
      <et-segmented-button value="day">Day</et-segmented-button>
      <et-segmented-button value="week">Week</et-segmented-button>
    </et-segmented-button-group>
  `,
  imports: [SEGMENTED_BUTTON_IMPORTS],
})
class SegmentedButtonGroupTestHost {
  public value = signal<string | null>(null);
  public variant = signal<'pill' | 'tabs'>('pill');
}

describe('SegmentedButtonGroupComponent', () => {
  let driver: SelectionListDriver<SegmentedButtonGroupTestHost>;

  beforeEach(() => {
    driver = mountSelectionList(SegmentedButtonGroupTestHost, {
      listSelector: 'et-segmented-button-group[role="radiogroup"]',
      optionSelector: 'et-segmented-button[role="radio"]',
    });
  });

  it('applies the selection-list directives to the group and every button', () => {
    expect(driver.listEl()).toBeInstanceOf(HTMLElement);
    expect(driver.optionEls()).toHaveLength(2);
  });

  it('selects a button and reflects its checked state', () => {
    driver.selectOption(1);

    expect(driver.host.value()).toBe('week');
    expect(driver.optionAttrs('aria-checked')).toEqual(['false', 'true']);
  });

  it('reflects the tabs variant on its host', () => {
    driver.host.variant.set('tabs');
    driver.fixture.detectChanges();

    expect(driver.attr('data-variant')).toBe('tabs');
    expect(driver.listEl().classList).toContain('et-tab-scale');
  });
});
