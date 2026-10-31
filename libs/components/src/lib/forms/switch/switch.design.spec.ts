import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { switchControl, SwitchMockOptions } from '../../../../design/switch';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { mockShapeOf, shapeOf } from '../../testing/design-mock-shape';
import { CHOICE_FIELD_IMPORTS, ChoiceFieldVariant } from '../choice-field';
import { FormFieldSize } from '../form-field/form-field.variants';
import { SelectionCardControlPosition } from '../selection-card.types';
import { SWITCH_IMPORTS } from './switch.imports';

@Component({
  imports: [CHOICE_FIELD_IMPORTS, SWITCH_IMPORTS],
  template: `
    <et-switch
      [checked]="checked()"
      [indeterminate]="indeterminate()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [required]="required()"
    />
    <et-choice-field [size]="size()" [variant]="variant()" [controlPosition]="controlPosition()">
      <et-switch
        [checked]="checked()"
        [indeterminate]="indeterminate()"
        [disabled]="disabled()"
        [readonly]="readonly()"
        [required]="required()"
      />
      <et-label>Notify</et-label>
    </et-choice-field>
  `,
})
class SwitchHost {
  public checked = input(false);
  public indeterminate = input(false);
  public disabled = input(false);
  public readonly = input(false);
  public required = input(false);
  public size = input<FormFieldSize>('md');
  public variant = input<ChoiceFieldVariant>('plain');
  public controlPosition = input<SelectionCardControlPosition>('end');
}

const CASES: SwitchMockOptions[] = [
  {},
  { checked: true, size: 'sm' },
  { indeterminate: true, required: true, size: 'lg' },
  { disabled: true, checked: true, variant: 'card' },
  { readonly: true, variant: 'card', controlPosition: 'start' },
];

describe('switch design mock', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });
  });

  it.each(CASES)('draws the classes the component renders for %o', async (options) => {
    const fixture = TestBed.createComponent(SwitchHost);

    for (const name of [
      'checked',
      'indeterminate',
      'disabled',
      'readonly',
      'required',
      'size',
      'variant',
      'controlPosition',
    ] as const) {
      if (options[name] !== undefined) fixture.componentRef.setInput(name, options[name]);
    }

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const [standalone, field] = fixture.nativeElement.querySelectorAll('et-switch, et-choice-field');

    expect(mockShapeOf(switchControl(options), 'et-switch')).toEqual(shapeOf(standalone));
    expect(mockShapeOf(switchControl({ ...options, label: 'Notify' }), 'et-choice-field')).toEqual(shapeOf(field));
  });
});
