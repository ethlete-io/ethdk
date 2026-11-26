import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountSelect } from '../../testing/select-driver';
import { SELECT_IMPORTS } from '../select.imports';
import { SelectDisplayWith } from './select.tokens';

const userNames: Record<string, string> = { u_42: 'Ada Lovelace', u_7: 'Alan Turing' };

@Component({
  template: `
    <et-select
      [value]="value()"
      [multiple]="multiple()"
      [displayWith]="displayWith()"
      (valueChange)="value.set($event)"
      class="select"
      placeholder="Pick a user"
    >
      <et-select-option value="u_1">Grace Hopper</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class DisplayWithTestHost {
  value = signal<unknown>('u_42');
  multiple = signal(false);
  displayWith = signal<SelectDisplayWith<string> | null>((id) => userNames[id] ?? id);
}

describe('SelectDirective (displayWith)', () => {
  it('labels a single value no loaded option carries', () => {
    const driver = mountSelect(DisplayWithTestHost);

    expect(driver.select.displayValue()).toBe('Ada Lovelace');
    expect(driver.trigger().textContent).toContain('Ada Lovelace');
  });

  it('prefers the label of a loaded option', () => {
    const driver = mountSelect(DisplayWithTestHost);

    driver.host.value.set('u_1');
    driver.tick();

    expect(driver.select.displayValue()).toBe('Grace Hopper');
  });

  it('labels the chips of multi values no loaded option carries', () => {
    const driver = mountSelect(DisplayWithTestHost);

    driver.host.multiple.set(true);
    driver.host.value.set(['u_42', 'u_1', 'u_7']);
    driver.tick();

    const chips = [...driver.trigger().querySelectorAll('et-chip')].map((chip) => chip.textContent?.trim());

    expect(chips).toEqual(['Ada Lovelace', 'Grace Hopper', 'Alan Turing']);
  });

  it('falls back to the raw string value without displayWith', () => {
    const driver = mountSelect(DisplayWithTestHost);

    driver.host.displayWith.set(null);
    driver.tick();

    expect(driver.select.displayValue()).toBe('u_42');
  });
});
