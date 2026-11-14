import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import '../../../test-helpers';
import { provideIconOverrides } from '../../icon';
import { FORM_FIELD_IMPORTS } from '../form-field/form-field.imports';
import { provideSelectIcons } from './select-icons';
import { SELECT_IMPORTS } from './select.imports';

@Component({
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS, FormField],
  template: `
    <et-form-field>
      <et-label>Team</et-label>
      <et-select [formField]="fields.team" clearable>
        <et-select-option value="a">Alpha</et-select-option>
        <et-select-option value="b">Beta</et-select-option>
      </et-select>
    </et-form-field>
  `,
})
class SelectHost {
  public fields = form(signal<{ team: string | null }>({ team: 'a' }));
}

const glyph = (name: string) => ({ name, data: `<svg class="${name}"></svg>` });

const render = async () => {
  const fixture = TestBed.createComponent(SelectHost);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  await settle();

  const combobox = fixture.nativeElement.querySelector('[role="combobox"]') as HTMLElement;
  combobox.focus();
  combobox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await settle();

  return fixture.nativeElement as HTMLElement;
};

describe('select icons', () => {
  it('renders the built-in glyphs by default', async () => {
    const host = await render();

    expect(host.querySelector('.et-select-arrow .et-icon--et-chevron')).not.toBeNull();
    expect(document.querySelector('et-select-option[data-selected] .et-icon--et-check')).not.toBeNull();
  });

  it('renders the glyphs named by provideSelectIcons in the trigger and the options', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideSelectIcons({ chevron: 'app-caret', clear: 'app-cross', check: 'app-tick' }),
        provideIconOverrides(glyph('app-caret'), glyph('app-cross'), glyph('app-tick')),
      ],
    });

    const host = await render();
    const selected = document.querySelector('et-select-option[data-selected]');

    expect(host.querySelector('.et-select-arrow .et-icon--app-caret')).not.toBeNull();
    expect(host.querySelector('.et-input-clear .et-icon--app-cross')).not.toBeNull();
    expect(selected?.querySelector('.et-select-option-check .et-icon--app-tick')).not.toBeNull();
  });
});
