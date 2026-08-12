import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../test-helpers';
import { CheckboxComponent } from './checkbox';
import { ChoiceFieldComponent } from './choice-field/choice-field.component';
import { LabelDirective } from './form-field/headless';
import { SelectionCardControlPosition } from './selection-card.types';
import { CheckboxOptionComponent } from './selection-list/checkbox-group/checkbox-option.component';
import { RadioComponent } from './selection-list/radio-group/radio.component';
import { TEST_COLOR_THEMES } from '../testing/color-themes';

@Component({
  template: `
    <et-radio [variant]="variant()" [controlPosition]="controlPosition()" value="pro">
      <i class="leading" etSelectionCardLeading>icon</i>
      Pro
      <span class="trailing" etSelectionCardTrailing>$29</span>
    </et-radio>

    <et-checkbox-option [variant]="variant()" [controlPosition]="controlPosition()" value="pro">
      <i class="leading" etSelectionCardLeading>icon</i>
      Pro
      <span class="trailing" etSelectionCardTrailing>$29</span>
    </et-checkbox-option>

    <et-choice-field [variant]="variant()" [controlPosition]="controlPosition()">
      <et-checkbox />
      <i class="leading" etSelectionCardLeading>icon</i>
      <et-label>Pro</et-label>
      <span class="trailing" etSelectionCardTrailing>$29</span>
    </et-choice-field>
  `,
  imports: [RadioComponent, CheckboxOptionComponent, ChoiceFieldComponent, CheckboxComponent, LabelDirective],
})
class HostComponent {
  public variant = signal<'plain' | 'card'>('card');
  public controlPosition = signal<SelectionCardControlPosition>('end');
}

beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });
});

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();

  return fixture;
};

const cardOf = (fixture: ReturnType<typeof create>, selector: string) =>
  fixture.nativeElement.querySelector(selector) as HTMLElement;

describe('selection card slots', () => {
  it.each([['et-radio'], ['et-checkbox-option'], ['et-choice-field']])(
    'projects the leading slot between the control and the content on %s',
    (selector) => {
      const fixture = create();
      const card = cardOf(fixture, selector).querySelector('.et-selection-card') ?? cardOf(fixture, selector);
      const children = [...card.children];

      const control = children.findIndex((el) => el.classList.contains('et-selection-card-control'));
      const leading = children.findIndex((el) => el.classList.contains('leading'));
      const content = children.findIndex((el) => el.classList.contains('et-selection-card-content'));
      const trailing = children.findIndex((el) => el.classList.contains('trailing'));

      expect(control).toBeLessThan(leading);
      expect(leading).toBeLessThan(content);
      expect(content).toBeLessThan(trailing);
    },
  );

  it.each([['et-radio'], ['et-checkbox-option'], ['et-choice-field']])(
    'reflects the control position onto %s while it is a card',
    (selector) => {
      const fixture = create();

      expect(cardOf(fixture, selector).getAttribute('data-control-position')).toBe('end');

      fixture.componentInstance.controlPosition.set('start');
      fixture.detectChanges();

      expect(cardOf(fixture, selector).getAttribute('data-control-position')).toBe('start');
    },
  );

  it.each([['et-radio'], ['et-checkbox-option'], ['et-choice-field']])(
    'drops the control position from %s in the plain variant',
    (selector) => {
      const fixture = create();

      fixture.componentInstance.variant.set('plain');
      fixture.detectChanges();

      expect(cardOf(fixture, selector).hasAttribute('data-control-position')).toBe(false);
    },
  );

  it('marks the choice field control slot as the card control so it orders with the other two', () => {
    const fixture = create();
    const slot = cardOf(fixture, 'et-choice-field').querySelector('.et-choice-field-control-slot');

    expect(slot?.classList.contains('et-selection-card-control')).toBe(true);
  });
});
