import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { TAG_INPUT_IMPORTS } from '../tag-input.imports';

const TEST_COLOR_THEMES = [
  {
    name: 'default',
    isDefault: true,
    primary: {
      color: {
        default: '0 255 161',
        hover: '76 247 184',
        focus: '76 247 184',
        active: '0 198 126',
        disabled: '0 122 77',
      },
      onColor: {
        default: '0 0 0',
        disabled: '0 36 23',
      },
    },
  },
] as const;

@Component({
  template: `
    <et-tag-input
      [value]="value()"
      [allowDuplicates]="allowDuplicates()"
      [maxTags]="maxTags()"
      [disabled]="disabled()"
      (valueChange)="value.set($event)"
      placeholder="Add tags"
    />
  `,
  imports: [TAG_INPUT_IMPORTS],
})
class TagInputTestHost {
  value = signal<string[]>([]);
  allowDuplicates = signal(false);
  maxTags = signal<number | undefined>(undefined);
  disabled = signal(false);
}

describe('TagInputDirective', () => {
  let fixture: ComponentFixture<TagInputTestHost>;
  let field: HTMLInputElement;

  const typeAndKey = (text: string, key: string) => {
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };

  const chips = () =>
    Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>('et-chip .et-chip-label')).map((chip) =>
      chip.textContent?.trim(),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TagInputTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(TagInputTestHost);
    fixture.detectChanges();
    field = fixture.nativeElement.querySelector('.et-tag-input-field');
  });

  it('commits on Enter and clears the field', () => {
    typeAndKey('alpha', 'Enter');

    expect(fixture.componentInstance.value()).toEqual(['alpha']);
    expect(field.value).toBe('');
    expect(chips()).toEqual(['alpha']);
  });

  it('commits when a separator character is typed', () => {
    field.value = 'beta,';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toEqual(['beta']);
    expect(field.value).toBe('');
  });

  it('commits pending text on blur and trims it', () => {
    field.value = '  gamma  ';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toEqual(['gamma']);
  });

  it('rejects duplicates and empty text by default', () => {
    typeAndKey('alpha', 'Enter');
    typeAndKey('alpha', 'Enter');

    expect(fixture.componentInstance.value()).toEqual(['alpha']);
    // the rejected text stays in the field for the user to edit
    expect(field.value).toBe('alpha');

    typeAndKey('   ', 'Enter');
    expect(fixture.componentInstance.value()).toEqual(['alpha']);

    field.value = '';
    fixture.componentInstance.allowDuplicates.set(true);
    fixture.detectChanges();
    typeAndKey('alpha', 'Enter');

    expect(fixture.componentInstance.value()).toEqual(['alpha', 'alpha']);
  });

  it('stops adding at maxTags', () => {
    fixture.componentInstance.maxTags.set(2);
    fixture.detectChanges();

    typeAndKey('one', 'Enter');
    typeAndKey('two', 'Enter');
    typeAndKey('three', 'Enter');

    expect(fixture.componentInstance.value()).toEqual(['one', 'two']);
  });

  it('removes the last tag with Backspace on an empty field', () => {
    fixture.componentInstance.value.set(['one', 'two']);
    fixture.detectChanges();

    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toEqual(['one']);
  });

  it('removes a tag via its chip', () => {
    fixture.componentInstance.value.set(['one', 'two']);
    fixture.detectChanges();

    fixture.nativeElement.querySelectorAll('.et-chip-remove-button')[0]!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toEqual(['two']);
  });

  it('splits pastes on separators and newlines', () => {
    // jsdom has no DataTransfer — fake the clipboardData surface
    const event = new Event('paste', { bubbles: true, cancelable: true });

    Object.defineProperty(event, 'clipboardData', { value: { getData: () => 'one, two\nthree' } });
    field.dispatchEvent(event);
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toEqual(['one', 'two', 'three']);
  });

  it('ignores interaction while disabled', () => {
    fixture.componentInstance.value.set(['one']);
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toEqual(['one']);
    expect(field.disabled).toBe(true);
  });
});
