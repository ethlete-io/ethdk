import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { TAG_INPUT_IMPORTS } from '../tag-input.imports';
import { TagInputDirective } from './tag-input.directive';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';

@Component({
  template: `
    <et-tag-input
      [value]="value()"
      [allowDuplicates]="allowDuplicates()"
      [maxTags]="maxTags()"
      [disabled]="disabled()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
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
  mixed = signal(false);
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
    // jsdom has no DataTransfer - fake the clipboardData surface
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

  describe('mixed', () => {
    const enterMixed = (raw: string[]) => {
      fixture.componentInstance.value.set(raw);
      fixture.componentInstance.mixed.set(true);
      fixture.detectChanges();
    };

    it('hides the chips and shows the mixedLabel as placeholder while the raw value survives', () => {
      enterMixed(['one', 'two']);

      expect(chips()).toEqual([]);
      expect(field.getAttribute('placeholder')).toBe('Mixed');
      expect(fixture.componentInstance.value()).toEqual(['one', 'two']);
    });

    it('replaces the hidden raw value with the first committed tag, then appends normally', () => {
      enterMixed(['one', 'two']);

      typeAndKey('fresh', 'Enter');

      expect(fixture.componentInstance.value()).toEqual(['fresh']);
      expect(fixture.componentInstance.mixed()).toBe(false);

      typeAndKey('next', 'Enter');

      expect(fixture.componentInstance.value()).toEqual(['fresh', 'next']);
    });

    it('checks duplicates against the fresh set, not the hidden raw value', () => {
      enterMixed(['alpha']);

      typeAndKey('alpha', 'Enter');

      expect(fixture.componentInstance.value()).toEqual(['alpha']);
      expect(fixture.componentInstance.mixed()).toBe(false);
    });

    it('ignores Backspace on the empty field and removeLast while mixed', () => {
      enterMixed(['one', 'two']);

      const tagInput = fixture.debugElement.children[0]!.injector.get(TagInputDirective);

      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
      fixture.detectChanges();

      expect(fixture.componentInstance.value()).toEqual(['one', 'two']);
      expect(fixture.componentInstance.mixed()).toBe(true);

      tagInput.removeLast();
      tagInput.removeAt(0);
      tagInput.remove('one');
      fixture.detectChanges();

      expect(fixture.componentInstance.value()).toEqual(['one', 'two']);
      expect(fixture.componentInstance.mixed()).toBe(true);
    });

    it('evaluates maxTags against the effective (empty) selection while mixed', () => {
      fixture.componentInstance.maxTags.set(2);
      enterMixed(['one', 'two']);

      const tagInput = fixture.debugElement.children[0]!.injector.get(TagInputDirective);

      expect(tagInput.isFull()).toBe(false);
      expect(field.readOnly).toBe(false);

      typeAndKey('fresh', 'Enter');

      expect(fixture.componentInstance.value()).toEqual(['fresh']);
    });

    it('preserves mixed across external value writes', () => {
      enterMixed(['one']);

      fixture.componentInstance.value.set(['server']);
      fixture.detectChanges();

      expect(fixture.componentInstance.mixed()).toBe(true);
      expect(chips()).toEqual([]);
    });
  });
});

describe('TagInputDirective (contract)', () => {
  describeMixedStateContract(() => {
    TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

    const fixture = TestBed.createComponent(TagInputTestHost);

    fixture.detectChanges();

    const field = fixture.nativeElement.querySelector('.et-tag-input-field') as HTMLInputElement;

    return {
      enterMixed: () => {
        fixture.componentInstance.value.set(['one', 'two']);
        fixture.componentInstance.mixed.set(true);
        fixture.detectChanges();
      },
      rawValue: () => ['one', 'two'],
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => fixture.nativeElement.querySelector('et-tag-input') as HTMLElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set(['three']);
        fixture.detectChanges();
      },
      externallyWrittenValue: () => ['three'],
      commit: () => {
        field.value = 'fresh';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
      },
      // replace semantics: a fresh array around the committed tag, not an append
      committedValue: () => ['fresh'],
      assertMasked: () => {
        expect(fixture.nativeElement.querySelectorAll('et-chip').length).toBe(0);
        expect(field.getAttribute('placeholder')).toBe('Mixed');
      },
      // no clear affordance - the tag input has no clear-all control
    };
  });
});
