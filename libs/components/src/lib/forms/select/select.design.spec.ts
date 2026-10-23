import { Component, input, signal, OnInit } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { disabled, form, FormField } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import { formField } from '../../../../design/form-field';
import { CHECK_ICON_SVG, CHEVRON_ICON_SVG, select, TIMES_ICON_SVG, SelectMockOptions } from '../../../../design/select';
import '../../../test-helpers';
import { CHECK_ICON, CHEVRON_ICON, TIMES_ICON } from '../../icon';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { mockShapeOf, shapeOf } from '../../testing/design-mock-shape';
import { FORM_FIELD_IMPORTS } from '../form-field/form-field.imports';
import { SELECT_IMPORTS } from './select.imports';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

@Component({
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS, FormField],
  template: `
    <et-form-field>
      <et-label>Team</et-label>
      <et-select [formField]="fields.team" [open]="open()" placeholder="Pick a team">
        @for (option of options; track option.value) {
          <et-select-option [value]="option.value">{{ option.label }}</et-select-option>
        }
      </et-select>
    </et-form-field>
  `,
})
class SelectHost implements OnInit {
  public value = input<string | null>(null);
  public open = input(false);
  public isDisabled = input(false);

  protected options = OPTIONS;
  protected model = signal<{ team: string | null }>({ team: null });
  public fields = form(this.model, (path) => disabled(path.team, () => this.isDisabled()));

  public ngOnInit() {
    this.model.set({ team: this.value() });
  }
}

type Case = { select: SelectMockOptions; open?: boolean; disabled?: boolean };

const CASES: Case[] = [
  { select: { options: OPTIONS, placeholder: 'Pick a team' } },
  { select: { options: OPTIONS, value: 'a' } },
  { select: { options: OPTIONS, value: 'b' }, disabled: true },
  { select: { options: OPTIONS, value: 'a', active: 'a', panelColor: 'default' }, open: true },
];

const render = async (testCase: Case) => {
  const fixture = TestBed.createComponent(SelectHost);

  if (testCase.select.value) fixture.componentRef.setInput('value', testCase.select.value);
  if (testCase.disabled) fixture.componentRef.setInput('isDisabled', true);

  fixture.detectChanges();
  await fixture.whenStable();

  if (testCase.open) fixture.componentRef.setInput('open', true);

  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture.nativeElement.querySelector('et-form-field') as HTMLElement;
};

const flatten = (svg: string) =>
  svg
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s*\/>/g, '/>')
    .trim();

describe('select design mock', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });
  });

  it.each(CASES)('draws the classes the component renders for %o', async (testCase) => {
    const real = await render(testCase);
    const drawn = formField({
      label: 'Team',
      control: select(testCase.select),
      errorColor: 'red',
      open: testCase.open,
      disabled: testCase.disabled,
    });

    expect(mockShapeOf(drawn, 'et-form-field')).toEqual(shapeOf(real));

    if (testCase.open) {
      const panel = document.querySelector('et-select-panel');
      if (!panel) throw new Error('the select opened no panel');

      expect(mockShapeOf(drawn, 'et-select-panel')).toEqual(shapeOf(panel));
    }
  });

  it('draws the icons the component registers', () => {
    expect(CHECK_ICON_SVG).toBe(flatten(CHECK_ICON.data));
    expect(CHEVRON_ICON_SVG).toBe(flatten(CHEVRON_ICON.data));
    expect(TIMES_ICON_SVG).toBe(flatten(TIMES_ICON.data));
  });
});
