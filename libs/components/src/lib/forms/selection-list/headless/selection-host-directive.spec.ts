import { Component, inject, input, signal } from '@angular/core';
import { disabled, form, FormField } from '@angular/forms/signals';
import '../../../../test-helpers';
import { mountSelectionList, SelectionListDriver } from '../../testing/selection-list-driver';
import { SelectionListDirective } from './selection-list.directive';
import { SelectionOptionDirective } from './selection-option.directive';

@Component({
  selector: 'app-test-card',
  template: `<span [id]="option.labelId">{{ heading() }}</span>`,
  hostDirectives: [{ directive: SelectionOptionDirective, inputs: ['value', 'disabled'] }],
  host: { '[attr.data-checked]': 'option.checked() || null' },
})
class TestCardComponent {
  protected option = inject(SelectionOptionDirective);
  public heading = input.required<string>();
}

@Component({
  selector: 'app-test-picker',
  template: `<ng-content />`,
  hostDirectives: [
    {
      directive: SelectionListDirective,
      inputs: ['value', 'touched', 'disabled', 'readonly', 'invalid', 'errors', 'required', 'name', 'aria-label'],
      outputs: ['valueChange', 'touchedChange'],
    },
  ],
})
class TestPickerComponent {}

@Component({
  template: `
    <app-test-picker [formField]="testForm.broadcast" aria-label="Broadcast">
      <app-test-card value="main" heading="Main stage" />
      <app-test-card value="pov" heading="Player cam" disabled />
      <app-test-card value="replay" heading="Replay" />
    </app-test-picker>
  `,
  imports: [TestPickerComponent, TestCardComponent, FormField],
})
class CustomCardTestHost {
  model = signal<{ broadcast: string | null }>({ broadcast: 'main' });
  locked = signal(false);
  testForm = form(this.model, (s) => disabled(s.broadcast, () => this.locked()));
}

describe('selection directives composed as host directives of app components', () => {
  let driver: SelectionListDriver<CustomCardTestHost>;

  beforeEach(() => {
    driver = mountSelectionList(CustomCardTestHost, {
      listSelector: 'app-test-picker',
      optionSelector: 'app-test-card',
    });
  });

  it('renders the radio pattern and reflects the bound field value', () => {
    expect(driver.attr('role')).toBe('radiogroup');
    expect(driver.optionAttrs('role')).toEqual(['radio', 'radio', 'radio']);
    expect(driver.optionAttrs('aria-checked')).toEqual(['true', 'false', 'false']);
    expect(driver.optionAttrs('tabindex')).toEqual(['0', '-1', '-1']);
    expect(driver.optionAttrs('data-checked')).toEqual(['true', null, null]);
    expect(driver.optionAttr(0, 'aria-labelledby')).toBe(driver.optionEl(0).querySelector('span')!.id);
  });

  it('writes a click into the field', () => {
    driver.selectOption(2);

    expect(driver.host.model().broadcast).toBe('replay');
    expect(driver.optionAttrs('aria-checked')).toEqual(['false', 'false', 'true']);
  });

  it('skips a disabled option with the arrow keys and checks the next one', () => {
    driver.focusOption(0);
    driver.pressOption(0, 'ArrowDown');
    driver.detectChanges();

    expect(document.activeElement).toBe(driver.optionEl(2));
    expect(driver.host.model().broadcast).toBe('replay');
    expect(driver.optionAttrs('tabindex')).toEqual(['-1', '-1', '0']);
  });

  it('disables every option from the field state', () => {
    driver.host.locked.set(true);
    driver.detectChanges();

    expect(driver.optionAttrs('aria-disabled')).toEqual(['true', 'true', 'true']);

    driver.selectOption(2);

    expect(driver.host.model().broadcast).toBe('main');
  });
});
