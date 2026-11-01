import { Component, input, signal, OnInit } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { disabled, form, FormField } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import { formField } from '../../../../design/form-field';
import {
  select,
  selectAllOption,
  SelectMockOptions,
  selectOption,
  selectOptionGroup,
  selectPanel,
} from '../../../../design/select';
import '../../../test-helpers';
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

const GROUPS = [
  {
    label: 'Forwards',
    options: [
      { value: 'f1', label: 'Mbappé' },
      { value: 'f2', label: 'Haaland', disabled: true },
    ],
  },
  { label: 'Midfielders', options: [{ value: 'm1', label: 'Bellingham' }] },
];

@Component({
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS, FormField],
  template: `
    <et-form-field>
      <et-label>Players</et-label>
      <et-select [formField]="fields.players" [open]="open()" multiple selectAll>
        @for (group of groups; track group.label) {
          <et-select-option-group [label]="group.label">
            @for (option of group.options; track option.value) {
              <et-select-option [value]="option.value" [disabled]="!!option.disabled">{{
                option.label
              }}</et-select-option>
            }
          </et-select-option-group>
        }
      </et-select>
    </et-form-field>
  `,
})
class GroupedSelectHost {
  public open = signal(false);

  protected groups = GROUPS;
  protected model = signal<{ players: string[] }>({ players: ['f1'] });
  public fields = form(this.model);
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

  if (testCase.open) {
    fixture.nativeElement
      .querySelector('[role="combobox"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture.nativeElement.querySelector('et-form-field') as HTMLElement;
};

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

  it('draws the panel of a grouped multi select with a select-all row', async () => {
    const fixture = TestBed.createComponent(GroupedSelectHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const panel = document.querySelector('et-select-panel');
    if (!panel) throw new Error('the select opened no panel');

    const groups = GROUPS.map((group, groupIndex) =>
      selectOptionGroup({
        labelId: `group-${groupIndex}`,
        label: group.label,
        content: group.options
          .map((option, index) =>
            selectOption(option, {
              id: `option-${groupIndex}-${index}`,
              selected: option.value === 'f1',
              active: option.value === 'f1' ? 'pointer' : undefined,
            }),
          )
          .join(''),
      }),
    ).join('');
    const drawn = selectPanel({
      id: 'players',
      labelId: 'label',
      multiple: true,
      color: 'default',
      content: selectAllOption({ id: 'all', label: 'Select all', checked: 'mixed' }) + groups,
    });

    expect(mockShapeOf(drawn, 'et-select-panel')).toEqual(shapeOf(panel));
  });
});
