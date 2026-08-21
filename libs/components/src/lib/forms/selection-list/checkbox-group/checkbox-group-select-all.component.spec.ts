import { Component, Provider, signal } from '@angular/core';
import '../../../../test-helpers';
import { provideFormFieldLabels } from '../../form-field/form-field-labels';
import { LabelDirective } from '../../form-field/headless';
import { mountSelectionList, SelectionListDriverOptions } from '../../testing/selection-list-driver';
import { SelectionListOrientation } from '../selection-list.types';
import { CheckboxGroupSelectAllComponent } from './checkbox-group-select-all.component';
import { CheckboxGroupComponent } from './checkbox-group.component';
import { CheckboxOptionComponent } from './checkbox-option.component';

@Component({
  template: `
    <et-checkbox-group [(value)]="value" [orientation]="orientation()" [disabled]="disabled()">
      <et-label>Toppings</et-label>
      <et-checkbox-group-select-all [label]="label()" />
      @for (option of options; track option) {
        <et-checkbox-option [value]="option">{{ option }}</et-checkbox-option>
      }
    </et-checkbox-group>
  `,
  imports: [CheckboxGroupComponent, CheckboxGroupSelectAllComponent, CheckboxOptionComponent, LabelDirective],
})
class HostComponent {
  public readonly options = ['a', 'b', 'c'];
  public value = signal<string[]>([]);
  public label = signal<string | null>(null);
  public orientation = signal<SelectionListOrientation>('vertical');
  public disabled = signal(false);
}

const CHECKBOX_GROUP: SelectionListDriverOptions = {
  listSelector: 'et-checkbox-group',
  optionSelector: 'et-checkbox-option',
  controlSelector: 'et-checkbox-group-select-all',
};

const create = (providers: Provider[] = []) => mountSelectionList(HostComponent, CHECKBOX_GROUP, providers);

describe('CheckboxGroupSelectAllComponent', () => {
  it('is a checkbox, not an option - only a checkbox can say "mixed"', () => {
    expect(create().controlAttr('role')).toBe('checkbox');
  });

  it('reads unchecked with nothing selected', () => {
    expect(create().controlAttr('aria-checked')).toBe('false');
  });

  it('selects every option when clicked', () => {
    const driver = create();

    driver.toggleControl();

    expect(driver.host.value()).toEqual(['a', 'b', 'c']);
    expect(driver.controlAttr('aria-checked')).toBe('true');
  });

  it('clears every option when clicked again', () => {
    const driver = create();

    driver.toggleControl();
    driver.toggleControl();

    expect(driver.host.value()).toEqual([]);
  });

  it('reads mixed while only some are selected', () => {
    const driver = create();

    driver.host.value.set(['a']);
    driver.tick();

    expect(driver.controlAttr('aria-checked')).toBe('mixed');
  });

  it('toggles with Space and Enter, like the checkbox it claims to be', () => {
    const driver = create();

    driver.pressControl(' ');
    expect(driver.host.value()).toEqual(['a', 'b', 'c']);

    driver.pressControl('Enter');
    expect(driver.host.value()).toEqual([]);
  });

  it('follows the group when it is disabled', () => {
    const driver = create();

    driver.host.disabled.set(true);
    driver.tick();
    driver.toggleControl();

    expect(driver.controlAttr('aria-disabled')).toBe('true');
    expect(driver.host.value()).toEqual([]);
  });

  it('takes its text from the shared form labels', () => {
    const driver = create([provideFormFieldLabels({ selectAll: 'Alle auswählen' })]);

    expect(driver.controlText()).toBe('Alle auswählen');
  });

  it('takes a per-instance label over the shared one', () => {
    const driver = create();

    driver.host.label.set('Everything');
    driver.tick();

    expect(driver.controlText()).toBe('Everything');
  });
});

describe('selection list orientation', () => {
  it('is vertical by default', () => {
    expect(create().attr('data-orientation')).toBe('vertical');
  });

  it('marks the group horizontal, which is what the CSS keys off', () => {
    const driver = create();

    driver.host.orientation.set('horizontal');
    driver.tick();

    expect(driver.attr('data-orientation')).toBe('horizontal');
  });

  it('leaves the projected DOM alone - an option is still a direct child of the group', () => {
    const driver = create();

    driver.host.orientation.set('horizontal');
    driver.tick();

    expect(driver.childOptionEls()).toHaveLength(3);
  });
});
