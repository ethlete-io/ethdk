import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { provideFormFieldLabels } from '../../form-field/form-field-labels';
import { LabelDirective } from '../../form-field/headless';
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

// The option row and this control both take `etColorInteractive`, and the group resolves an error
// theme for its validation state — so a test needs a default theme and one typed `error`.
const COLOR = {
  color: { default: '0 255 161', hover: '76 247 184', focus: '76 247 184', active: '0 198 126', disabled: '0 122 77' },
  onColor: { default: '0 0 0', disabled: '0 36 23' },
};

const TEST_COLOR_THEMES = [
  { name: 'default', isDefault: true, primary: COLOR },
  { name: 'red', type: 'error' as const, primary: COLOR },
];

beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });
});

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  return fixture;
};

const selectAll = (fixture: ComponentFixture<HostComponent>) =>
  (fixture.nativeElement as HTMLElement).querySelector('et-checkbox-group-select-all') as HTMLElement;

const click = (fixture: ComponentFixture<HostComponent>) => {
  selectAll(fixture).click();
  fixture.detectChanges();
};

describe('CheckboxGroupSelectAllComponent', () => {
  it('is a checkbox, not an option — only a checkbox can say "mixed"', () => {
    expect(selectAll(create()).getAttribute('role')).toBe('checkbox');
  });

  it('reads unchecked with nothing selected', () => {
    expect(selectAll(create()).getAttribute('aria-checked')).toBe('false');
  });

  it('selects every option when clicked', () => {
    const fixture = create();

    click(fixture);

    expect(fixture.componentInstance.value()).toEqual(['a', 'b', 'c']);
    expect(selectAll(fixture).getAttribute('aria-checked')).toBe('true');
  });

  it('clears every option when clicked again', () => {
    const fixture = create();

    click(fixture);
    click(fixture);

    expect(fixture.componentInstance.value()).toEqual([]);
  });

  it('reads mixed while only some are selected', () => {
    const fixture = create();

    fixture.componentInstance.value.set(['a']);
    fixture.detectChanges();

    expect(selectAll(fixture).getAttribute('aria-checked')).toBe('mixed');
  });

  it('toggles with Space and Enter, like the checkbox it claims to be', () => {
    const fixture = create();

    selectAll(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toEqual(['a', 'b', 'c']);

    selectAll(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toEqual([]);
  });

  it('follows the group when it is disabled', () => {
    const fixture = create();

    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    click(fixture);

    expect(selectAll(fixture).getAttribute('aria-disabled')).toBe('true');
    expect(fixture.componentInstance.value()).toEqual([]);
  });

  it('takes its text from the shared form labels', () => {
    TestBed.configureTestingModule({ providers: [provideFormFieldLabels({ selectAll: 'Alle auswählen' })] });

    expect(selectAll(create()).textContent?.trim()).toBe('Alle auswählen');
  });

  it('takes a per-instance label over the shared one', () => {
    const fixture = create();

    fixture.componentInstance.label.set('Everything');
    fixture.detectChanges();

    expect(selectAll(fixture).textContent?.trim()).toBe('Everything');
  });
});

describe('selection list orientation', () => {
  it('is vertical by default', () => {
    const group = (create().nativeElement as HTMLElement).querySelector('et-checkbox-group');

    expect(group?.getAttribute('data-orientation')).toBe('vertical');
  });

  it('marks the group horizontal, which is what the CSS keys off', () => {
    const fixture = create();

    fixture.componentInstance.orientation.set('horizontal');
    fixture.detectChanges();

    const group = (fixture.nativeElement as HTMLElement).querySelector('et-checkbox-group');

    expect(group?.getAttribute('data-orientation')).toBe('horizontal');
  });

  it('leaves the projected DOM alone — an option is still a direct child of the group', () => {
    const fixture = create();

    fixture.componentInstance.orientation.set('horizontal');
    fixture.detectChanges();

    const group = (fixture.nativeElement as HTMLElement).querySelector('et-checkbox-group');

    expect(group?.querySelectorAll(':scope > et-checkbox-option')).toHaveLength(3);
  });
});
