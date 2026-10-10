import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { expectDescribedByPointsAtErrors } from '../../testing/described-by';
import { FORM_FIELD_IMPORTS } from '../../form-field/form-field.imports';
import { mountControl } from '../../../testing/control-driver';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { mountTagInput, TagInputDriver } from '../../testing/tag-input-driver';
import { TAG_INPUT_IMPORTS } from '../tag-input.imports';

@Component({
  template: `
    <et-tag-input
      [value]="value()"
      [allowDuplicates]="allowDuplicates()"
      [maxSelection]="maxSelection()"
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
  maxSelection = signal<number | undefined>(undefined);
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

  it('leaves the Enter that confirms an IME composition to the IME', () => {
    const field = driver.field();
    field.value = 'にほん';

    const event = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true });
    field.dispatchEvent(event);
    driver.tick();

    expect(event.defaultPrevented).toBe(false);
    expect(driver.host.value()).toEqual([]);
    expect(driver.fieldValue()).toBe('にほん');
  });

  it('commits when a separator character is typed', () => {
    driver.type('beta,');

    expect(driver.host.value()).toEqual(['beta']);
    expect(driver.fieldValue()).toBe('');
  });

  it('commits the text before a separator typed mid-text and keeps the rest', () => {
    driver.type('beta,gamma');

    expect(driver.host.value()).toEqual(['beta']);
    expect(driver.fieldValue()).toBe('gamma');
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

  it('stops adding at maxSelection', () => {
    driver.host.maxSelection.set(2);
    driver.tick();

    driver.typeAndPress('one', 'Enter');
    driver.typeAndPress('two', 'Enter');
    driver.typeAndPress('three', 'Enter');

    expect(driver.host.value()).toEqual(['one', 'two']);
  });

  it('keeps the pasted text a full field rejected instead of dropping it', () => {
    driver.host.maxSelection.set(2);
    driver.tick();

    driver.paste('one,two,three');

    expect(driver.host.value()).toEqual(['one', 'two']);
    expect(driver.fieldValue()).toBe('three');
    expect(driver.field().readOnly).toBe(false);
  });

  it('keeps a pasted duplicate in the field like a typed one', () => {
    driver.host.value.set(['one']);
    driver.tick();

    driver.paste('one,two');

    expect(driver.host.value()).toEqual(['one', 'two']);
    expect(driver.fieldValue()).toBe('one');
  });

  it('keeps the chips out of the tab order', () => {
    driver.host.value.set(['one']);
    driver.tick();

    expect(driver.queryAll('.et-chip-remove-button')[0]!.getAttribute('tabindex')).toBe('-1');
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
    driver.host.maxSelection.set(2);
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

    it('evaluates maxSelection against the effective (empty) selection while mixed', () => {
      driver.host.maxSelection.set(2);
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

@Component({
  template: `<et-tag-input [(value)]="value" [separators]="['Enter', ',', '-', ';']" placeholder="Add tags" />`,
  imports: [TAG_INPUT_IMPORTS],
})
class DashSeparatorTagInputTestHost {
  value = signal<string[]>([]);
}

describe('TagInputDirective with a dash separator', () => {
  it('splits a paste on the separators only, not on the characters between them', () => {
    const driver = mountTagInput(DashSeparatorTagInputTestHost);

    driver.paste('a1b-c;d');

    expect(driver.host.value()).toEqual(['a1b', 'c', 'd']);
  });

  it('never splits a paste on a key name such as Enter', () => {
    const driver = mountTagInput(DashSeparatorTagInputTestHost);

    driver.paste('Enterprise;Bank');

    expect(driver.host.value()).toEqual(['Enterprise', 'Bank']);
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
      resolveMixedFromConsumer: () => {
        driver.host.mixed.set(false);
        driver.tick();
      },
      mixedLabel: () => 'Mixed',
      mixedDisplayText: () => driver.placeholder(),
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

@Component({
  template: `
    <et-form-field>
      <et-label>Tags</et-label>
      <et-tag-input [(touched)]="touched" [errors]="errors" invalid name="tags" />
      <et-hint>Press enter after each tag</et-hint>
    </et-form-field>
  `,
  imports: [FORM_FIELD_IMPORTS, TAG_INPUT_IMPORTS],
})
class TagInputInFormFieldTestHost {
  errors = [{ kind: 'required', message: 'Add at least one tag' }];

  touched = signal(true);
}

describe('tag input support region', () => {
  it('should describe the tag input by the rendered error', () => {
    const host = mountControl(TagInputInFormFieldTestHost).nativeElement as HTMLElement;

    expectDescribedByPointsAtErrors(host);
  });
});

@Component({
  template: `<et-tag-input [value]="value()" (valueChange)="value.set($event)" placeholder="Add tags" />`,
  imports: [TAG_INPUT_IMPORTS],
})
class NullValueTagInputTestHost {
  value = signal<string[]>(null as unknown as string[]);
}

describe('tag input with a null value', () => {
  it('renders, adds and removes tags', () => {
    const driver = mountTagInput(NullValueTagInputTestHost);

    expect(driver.chips()).toHaveLength(0);

    driver.typeAndPress('a', 'Enter');
    expect(driver.host.value()).toEqual(['a']);

    driver.removeChip(0);
    expect(driver.host.value()).toEqual([]);
  });
});
