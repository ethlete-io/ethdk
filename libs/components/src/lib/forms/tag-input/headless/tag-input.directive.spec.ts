import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { mountTagInput, TagInputDriver } from '../../testing/tag-input-driver';
import { TAG_INPUT_IMPORTS } from '../tag-input.imports';

@Component({
  template: `
    <et-tag-input
      [value]="value()"
      [allowDuplicates]="allowDuplicates()"
      [maxTags]="maxTags()"
      [disabled]="disabled()"
      [mixed]="mixed()"
      (valueChange)="writeValue($event)"
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

  /** Every `valueChange` the control emitted - a no-op interaction must add nothing here. */
  writes: string[][] = [];

  writeValue(next: string[]) {
    this.writes.push(next);
    this.value.set(next);
  }
}

describe('TagInputDirective', () => {
  let driver: TagInputDriver<TagInputTestHost>;

  beforeEach(() => {
    driver = mountTagInput(TagInputTestHost);
  });

  it('commits on Enter and clears the field', () => {
    driver.typeAndPress('alpha', 'Enter');

    expect(driver.host.value()).toEqual(['alpha']);
    expect(driver.fieldValue()).toBe('');
    expect(driver.chipLabels()).toEqual(['alpha']);
  });

  it('commits when a separator character is typed', () => {
    driver.type('beta,');

    expect(driver.host.value()).toEqual(['beta']);
    expect(driver.fieldValue()).toBe('');
  });

  it('commits pending text on blur and trims it', () => {
    driver.typeAndBlur('  gamma  ');

    expect(driver.host.value()).toEqual(['gamma']);
  });

  it('rejects duplicates and empty text by default', () => {
    driver.typeAndPress('alpha', 'Enter');
    driver.typeAndPress('alpha', 'Enter');

    expect(driver.host.value()).toEqual(['alpha']);
    // the rejected text stays in the field for the user to edit
    expect(driver.fieldValue()).toBe('alpha');

    driver.typeAndPress('   ', 'Enter');
    expect(driver.host.value()).toEqual(['alpha']);

    driver.clearField();
    driver.host.allowDuplicates.set(true);
    driver.tick();
    driver.typeAndPress('alpha', 'Enter');

    expect(driver.host.value()).toEqual(['alpha', 'alpha']);
  });

  it('stops adding at maxTags', () => {
    driver.host.maxTags.set(2);
    driver.tick();

    driver.typeAndPress('one', 'Enter');
    driver.typeAndPress('two', 'Enter');
    driver.typeAndPress('three', 'Enter');

    expect(driver.host.value()).toEqual(['one', 'two']);
  });

  it('removes the last tag with Backspace on an empty field', () => {
    driver.host.value.set(['one', 'two']);
    driver.tick();

    driver.press('Backspace');

    expect(driver.host.value()).toEqual(['one']);
  });

  it('emits nothing when a removal has no tag to remove', () => {
    const empty = driver.tagInput.value();

    driver.press('Backspace');
    driver.press('Backspace');

    expect(driver.host.writes).toEqual([]);
    expect(driver.tagInput.value()).toBe(empty);

    driver.host.value.set(['one']);
    driver.tick();

    const filled = driver.tagInput.value();

    driver.tagInput.removeAt(99);
    driver.tagInput.removeAt(-1);
    driver.tick();

    expect(driver.host.writes).toEqual([]);
    expect(driver.tagInput.value()).toBe(filled);

    driver.press('Backspace');

    expect(driver.host.writes).toEqual([[]]);
  });

  it('removes a tag via its chip', () => {
    driver.host.value.set(['one', 'two']);
    driver.tick();

    driver.removeChip(0);

    expect(driver.host.value()).toEqual(['two']);
  });

  it('splits pastes on separators and newlines', () => {
    driver.paste('one, two\nthree');

    expect(driver.host.value()).toEqual(['one', 'two', 'three']);
  });

  it('splices a paste into the pending text at the caret', () => {
    driver.type('pre');
    driver.paste('one,two');

    expect(driver.host.value()).toEqual(['preone', 'two']);
    expect(driver.fieldValue()).toBe('');

    driver.type('ab');
    driver.field().setSelectionRange(1, 1);
    driver.paste('x,y');

    expect(driver.host.value()).toEqual(['preone', 'two', 'ax', 'yb']);
    expect(driver.fieldValue()).toBe('');
  });

  it('keeps a full field editable while it still holds text', () => {
    driver.host.value.set(['one']);
    driver.host.maxTags.set(2);
    driver.tick();

    driver.typeAndPress('one', 'Enter');

    expect(driver.fieldValue()).toBe('one');

    driver.host.value.set(['one', 'two']);
    driver.tick();

    expect(driver.tagInput.isFull()).toBe(true);
    expect(driver.field().readOnly).toBe(false);

    driver.type('');

    expect(driver.field().readOnly).toBe(true);
  });

  it('ignores interaction while disabled', () => {
    driver.host.value.set(['one']);
    driver.host.disabled.set(true);
    driver.tick();

    driver.press('Backspace');

    expect(driver.host.value()).toEqual(['one']);
    expect(driver.field().disabled).toBe(true);
  });

  describe('mixed', () => {
    const enterMixed = (raw: string[]) => {
      driver.host.value.set(raw);
      driver.host.mixed.set(true);
      driver.tick();
    };

    it('hides the chips and shows the mixedLabel as placeholder while the raw value survives', () => {
      enterMixed(['one', 'two']);

      expect(driver.chipLabels()).toEqual([]);
      expect(driver.placeholder()).toBe('Mixed');
      expect(driver.host.value()).toEqual(['one', 'two']);
    });

    it('replaces the hidden raw value with the first committed tag, then appends normally', () => {
      enterMixed(['one', 'two']);

      driver.typeAndPress('fresh', 'Enter');

      expect(driver.host.value()).toEqual(['fresh']);
      expect(driver.host.mixed()).toBe(false);

      driver.typeAndPress('next', 'Enter');

      expect(driver.host.value()).toEqual(['fresh', 'next']);
    });

    it('checks duplicates against the fresh set, not the hidden raw value', () => {
      enterMixed(['alpha']);

      driver.typeAndPress('alpha', 'Enter');

      expect(driver.host.value()).toEqual(['alpha']);
      expect(driver.host.mixed()).toBe(false);
    });

    it('ignores Backspace on the empty field and removeLast while mixed', () => {
      enterMixed(['one', 'two']);

      driver.press('Backspace');

      expect(driver.host.value()).toEqual(['one', 'two']);
      expect(driver.host.mixed()).toBe(true);

      driver.tagInput.removeLast();
      driver.tagInput.removeAt(0);
      driver.tagInput.remove('one');
      driver.tick();

      expect(driver.host.value()).toEqual(['one', 'two']);
      expect(driver.host.mixed()).toBe(true);
    });

    it('evaluates maxTags against the effective (empty) selection while mixed', () => {
      driver.host.maxTags.set(2);
      enterMixed(['one', 'two']);

      expect(driver.tagInput.isFull()).toBe(false);
      expect(driver.field().readOnly).toBe(false);

      driver.typeAndPress('fresh', 'Enter');

      expect(driver.host.value()).toEqual(['fresh']);
    });

    it('preserves mixed across external value writes', () => {
      enterMixed(['one']);

      driver.host.value.set(['server']);
      driver.tick();

      expect(driver.host.mixed()).toBe(true);
      expect(driver.chipLabels()).toEqual([]);
    });
  });
});

describe('TagInputDirective (contract)', () => {
  describeMixedStateContract(() => {
    const driver = mountTagInput(TagInputTestHost);

    return {
      enterMixed: () => {
        driver.host.value.set(['one', 'two']);
        driver.host.mixed.set(true);
        driver.tick();
      },
      rawValue: () => ['one', 'two'],
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.element(),
      writeValueExternally: () => {
        driver.host.value.set(['three']);
        driver.tick();
      },
      externallyWrittenValue: () => ['three'],
      commit: () => driver.typeAndPress('fresh', 'Enter'),
      // replace semantics: a fresh array around the committed tag, not an append
      committedValue: () => ['fresh'],
      assertMasked: () => {
        expect(driver.chips().length).toBe(0);
        expect(driver.placeholder()).toBe('Mixed');
      },
      // no clear affordance - the tag input has no clear-all control
    };
  });
});
