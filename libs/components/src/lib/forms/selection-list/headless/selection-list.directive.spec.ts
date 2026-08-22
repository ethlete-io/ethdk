import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { mountSelectionList, SelectionListDriver } from '../../testing/selection-list-driver';
import { SelectionListControlDirective } from './selection-list-control.directive';
import { SelectionListDirective } from './selection-list.directive';
import { SelectionOptionDirective } from './selection-option.directive';

@Component({
  template: `
    <div [value]="value()" (valueChange)="value.set($event)" etSelectionList>
      <div etSelectionOption value="a"></div>
      <div etSelectionOption value="b"></div>
      <div etSelectionOption value="c"></div>
    </div>
  `,
  imports: [SelectionListDirective, SelectionOptionDirective],
})
class SingleSelectTestHost {
  value = signal<string | null>(null);
}

@Component({
  template: `
    <div [value]="value()" (valueChange)="value.set($event)" multiple etSelectionList>
      <div etSelectionOption value="a"></div>
      <div etSelectionOption value="b"></div>
      <div etSelectionOption value="c"></div>
    </div>
  `,
  imports: [SelectionListDirective, SelectionOptionDirective],
})
class MultiSelectTestHost {
  value = signal<string[]>([]);
}

@Component({
  template: `
    <div [value]="value()" [readonly]="readonly()" (valueChange)="value.set($event)" etSelectionList>
      <div etSelectionOption value="a"></div>
      <div etSelectionOption value="b"></div>
      <div etSelectionOption value="c"></div>
    </div>
  `,
  imports: [SelectionListDirective, SelectionOptionDirective],
})
class ReadonlySelectTestHost {
  value = signal<string | null>('a');
  readonly = signal(true);
}

@Component({
  template: `
    <div
      [value]="value()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      etSelectionList
    >
      <div etSelectionOption value="a"></div>
      <div etSelectionOption value="b"></div>
      <div etSelectionOption value="c"></div>
    </div>
  `,
  imports: [SelectionListDirective, SelectionOptionDirective],
})
class MixedSingleSelectTestHost {
  value = signal<string | null>(null);
  mixed = signal(false);
}

@Component({
  template: `
    <div
      [value]="value()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      multiple
      etSelectionList
    >
      <div etSelectionListControl></div>
      <div etSelectionOption value="a"></div>
      <div etSelectionOption value="b"></div>
      <div etSelectionOption value="c"></div>
    </div>
  `,
  imports: [SelectionListDirective, SelectionOptionDirective, SelectionListControlDirective],
})
class MixedMultiSelectTestHost {
  value = signal<string[]>([]);
  mixed = signal(false);
}

@Component({
  template: `
    <div [aria-label]="ariaLabel()" [aria-labelledby]="ariaLabelledby()" etSelectionList>
      <div etSelectionOption value="a"></div>
    </div>
  `,
  imports: [SelectionListDirective, SelectionOptionDirective],
})
class LabelledSelectTestHost {
  ariaLabel = signal<string | null>(null);
  ariaLabelledby = signal<string | null>(null);
}

describe('SelectionListDirective', () => {
  describe('single select', () => {
    let driver: SelectionListDriver<SingleSelectTestHost>;

    beforeEach(() => {
      driver = mountSelectionList(SingleSelectTestHost);
    });

    it('should create', () => {
      expect(driver.listEl()).toBeTruthy();
    });

    it('should have role radiogroup', () => {
      expect(driver.attr('role')).toBe('radiogroup');
    });

    it('should register options', () => {
      expect(driver.list.selection.items().length).toBe(3);
    });

    it('should select an option on click', () => {
      driver.selectOption(1);

      expect(driver.host.value()).toBe('b');
    });

    it('focuses without selecting on activate (the label-click path)', () => {
      driver.list.activate();
      driver.fixture.detectChanges();

      expect(driver.host.value()).toBeNull();
      expect(document.activeElement).toBe(driver.optionEl(0));
    });

    it('should deselect previous option on new selection', () => {
      driver.selectOption(0);
      driver.selectOption(1);

      expect(driver.host.value()).toBe('b');
    });
  });

  describe('multi select', () => {
    let driver: SelectionListDriver<MultiSelectTestHost>;

    beforeEach(() => {
      driver = mountSelectionList(MultiSelectTestHost);
    });

    it('should have role group', () => {
      expect(driver.attr('role')).toBe('group');
    });

    it('should allow multiple selections', () => {
      driver.selectOption(0);
      driver.selectOption(2);

      expect(driver.host.value()).toEqual(['a', 'c']);
    });

    it('should toggle off a selected option', () => {
      driver.selectOption(0);
      driver.selectOption(0);

      expect(driver.host.value()).toEqual([]);
    });
  });

  describe('readonly', () => {
    let driver: SelectionListDriver<ReadonlySelectTestHost>;

    beforeEach(() => {
      driver = mountSelectionList(ReadonlySelectTestHost);
    });

    it('reflects readonly on the radiogroup and blocks selection', () => {
      expect(driver.attr('aria-readonly')).toBe('true');
      expect(driver.attr('data-readonly')).toBe('true');
      // options keep their normal focusable, non-dimmed state
      expect(driver.optionAttr(0, 'aria-disabled')).toBeNull();
      expect(driver.optionAttr(0, 'data-readonly')).toBe('true');

      driver.selectOption(1);

      expect(driver.host.value()).toBe('a');
    });

    it('moves focus with arrows without selecting (radio pattern pauses while readonly)', () => {
      driver.focusOption(0);
      driver.pressOption(0, 'ArrowDown');

      expect(document.activeElement).toBe(driver.optionEl(1));
      expect(driver.host.value()).toBe('a');
    });

    it('selects again once readonly is lifted', () => {
      driver.host.readonly.set(false);
      driver.tick();

      driver.selectOption(1);

      expect(driver.host.value()).toBe('b');
    });
  });

  describe('accessible name', () => {
    let driver: SelectionListDriver<LabelledSelectTestHost>;

    beforeEach(() => {
      driver = mountSelectionList(LabelledSelectTestHost);
    });

    it('reports no custom name when neither is set', () => {
      expect(driver.list.hasCustomAccessibleName()).toBe(false);
      expect(driver.attr('aria-label')).toBeNull();
      expect(driver.attr('aria-labelledby')).toBeNull();
    });

    it('writes aria-label on the group and counts as a name for the field guard', () => {
      driver.host.ariaLabel.set('Partner scope');
      driver.tick();

      expect(driver.attr('aria-label')).toBe('Partner scope');
      expect(driver.list.hasCustomAccessibleName()).toBe(true);
    });

    it('ignores a blank aria-label', () => {
      driver.host.ariaLabel.set('   ');
      driver.tick();

      expect(driver.attr('aria-label')).toBeNull();
      expect(driver.list.hasCustomAccessibleName()).toBe(false);
    });

    it('writes a consumer-supplied aria-labelledby', () => {
      driver.host.ariaLabelledby.set('external-caption');
      driver.tick();

      expect(driver.attr('aria-labelledby')).toBe('external-caption');
      expect(driver.list.hasCustomAccessibleName()).toBe(true);
    });
  });
});

describe('SelectionListDirective (single, mixed contract)', () => {
  describeMixedStateContract(() => {
    const driver = mountSelectionList(MixedSingleSelectTestHost);

    return {
      enterMixed: () => {
        driver.host.value.set('b');
        driver.host.mixed.set(true);
        driver.tick();
      },
      rawValue: () => 'b',
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.listEl(),
      writeValueExternally: () => {
        driver.host.value.set('c');
        driver.tick();
      },
      externallyWrittenValue: () => 'c',
      commit: () => driver.selectOption(0),
      committedValue: () => 'a',
      assertMasked: () => {
        expect(driver.optionAttrs('aria-checked')).toEqual(['false', 'false', 'false']);
      },
      // no clear affordance - selection lists have no empty-shape control of their own
    };
  });
});

describe('SelectionListDirective (multiple, mixed contract)', () => {
  describeMixedStateContract(() => {
    const driver = mountSelectionList(MixedMultiSelectTestHost);

    return {
      enterMixed: () => {
        driver.host.value.set(['b', 'c']);
        driver.host.mixed.set(true);
        driver.tick();
      },
      rawValue: () => ['b', 'c'],
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.listEl(),
      writeValueExternally: () => {
        driver.host.value.set(['a']);
        driver.tick();
      },
      externallyWrittenValue: () => ['a'],
      // Space on an option - a real keyboard commit
      commit: () => {
        driver.pressOption(0, ' ');
      },
      // replace semantics: a fresh array around the committed option, not a toggle
      committedValue: () => ['a'],
      assertMasked: () => {
        expect(driver.optionAttrs('aria-checked')).toEqual(['false', 'false', 'false']);
      },
    };
  });
});

describe('SelectionListDirective (mixed specifics)', () => {
  describe('single (radio pattern)', () => {
    let driver: SelectionListDriver<MixedSingleSelectTestHost>;

    beforeEach(() => {
      driver = mountSelectionList(MixedSingleSelectTestHost);
      driver.host.value.set('b');
      driver.host.mixed.set(true);
      driver.tick();
    });

    it('reports no option as checked despite the hidden raw value', () => {
      expect(driver.optionAttrs('aria-checked')).toEqual(['false', 'false', 'false']);
    });

    it('roves the tab stop from the first option (no-selection behavior), not the hidden raw value', () => {
      expect(driver.optionAttrs('tabindex')).toEqual(['0', '-1', '-1']);
    });

    it('resolves mixed through radio arrow-selection', () => {
      // raw 'c' so the committed 'b' provably comes from the arrow target, not the hidden value
      driver.host.value.set('c');
      driver.tick();

      driver.focusOption(0);
      driver.pressOption(0, 'ArrowDown');

      expect(driver.host.mixed()).toBe(false);
      expect(driver.host.value()).toBe('b');
      expect(driver.optionAttr(1, 'aria-checked')).toBe('true');
      expect(document.activeElement).toBe(driver.optionEl(1));
    });

    it('keeps masking across external value writes', () => {
      driver.host.value.set('c');
      driver.tick();

      expect(driver.host.mixed()).toBe(true);
      expect(driver.optionAttrs('aria-checked')).toEqual(['false', 'false', 'false']);
    });
  });

  describe('multiple (checkbox pattern)', () => {
    let driver: SelectionListDriver<MixedMultiSelectTestHost>;

    beforeEach(() => {
      driver = mountSelectionList(MixedMultiSelectTestHost);
      driver.host.value.set(['a', 'c']);
      driver.host.mixed.set(true);
      driver.tick();
    });

    it('reports no option as checked despite the hidden raw array', () => {
      expect(driver.optionAttrs('aria-checked')).toEqual(['false', 'false', 'false']);
    });

    it('replaces with a fresh array on first commit - even for a value inside the hidden raw array', () => {
      // 'a' is part of the hidden raw value; toggling against it would remove it instead
      driver.selectOption(0);

      expect(driver.host.mixed()).toBe(false);
      expect(driver.host.value()).toEqual(['a']);
    });

    it('resumes normal toggling after the first commit', () => {
      driver.selectOption(1);

      expect(driver.host.value()).toEqual(['b']);

      driver.selectOption(0);

      // the group recomputes the array in option (registry) order, not click order
      expect(driver.host.value()).toEqual(['a', 'b']);
      expect(driver.host.mixed()).toBe(false);
    });

    it('keeps mixed and the raw array across external value writes', () => {
      driver.host.value.set(['b']);
      driver.tick();

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toEqual(['b']);
      expect(driver.optionAttrs('aria-checked')).toEqual(['false', 'false', 'false']);
    });

    it('shows the select-all control as unchecked while mixed and resolves via toggle-all with every value', () => {
      expect(driver.controlAttr('aria-checked')).toBe('false');

      driver.toggleControl();

      expect(driver.host.mixed()).toBe(false);
      expect(driver.host.value()).toEqual(['a', 'b', 'c']);
      expect(driver.controlAttr('aria-checked')).toBe('true');
    });
  });
});
