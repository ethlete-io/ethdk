import { ApplicationRef, Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
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
    let fixture: ComponentFixture<SingleSelectTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [SingleSelectTestHost] });
      fixture = TestBed.createComponent(SingleSelectTestHost);
      fixture.detectChanges();
    });

    it('should create', () => {
      const listEl = fixture.nativeElement.querySelector('[etSelectionList]');
      expect(listEl).toBeTruthy();
    });

    it('should have role radiogroup', () => {
      const listEl = fixture.nativeElement.querySelector('[etSelectionList]');
      expect(listEl.getAttribute('role')).toBe('radiogroup');
    });

    it('should register options', () => {
      const listDir = (fixture.debugElement.children[0] as DebugElement).injector.get(SelectionListDirective);
      expect(listDir.selection.items().length).toBe(3);
    });

    it('should select an option on click', () => {
      const options = fixture.nativeElement.querySelectorAll('[etSelectionOption]');
      options[1].click();
      fixture.detectChanges();
      expect(fixture.componentInstance.value()).toBe('b');
    });

    it('should deselect previous option on new selection', () => {
      const options = fixture.nativeElement.querySelectorAll('[etSelectionOption]');
      options[0].click();
      fixture.detectChanges();
      options[1].click();
      fixture.detectChanges();
      expect(fixture.componentInstance.value()).toBe('b');
    });
  });

  describe('multi select', () => {
    let fixture: ComponentFixture<MultiSelectTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [MultiSelectTestHost] });
      fixture = TestBed.createComponent(MultiSelectTestHost);
      fixture.detectChanges();
    });

    it('should have role group', () => {
      const listEl = fixture.nativeElement.querySelector('[etSelectionList]');
      expect(listEl.getAttribute('role')).toBe('group');
    });

    it('should allow multiple selections', () => {
      const options = fixture.nativeElement.querySelectorAll('[etSelectionOption]');
      options[0].click();
      fixture.detectChanges();
      options[2].click();
      fixture.detectChanges();
      expect(fixture.componentInstance.value()).toEqual(['a', 'c']);
    });

    it('should toggle off a selected option', () => {
      const options = fixture.nativeElement.querySelectorAll('[etSelectionOption]');
      options[0].click();
      fixture.detectChanges();
      options[0].click();
      fixture.detectChanges();
      expect(fixture.componentInstance.value()).toEqual([]);
    });
  });

  describe('readonly', () => {
    let fixture: ComponentFixture<ReadonlySelectTestHost>;
    let options: NodeListOf<HTMLElement>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [ReadonlySelectTestHost] });
      fixture = TestBed.createComponent(ReadonlySelectTestHost);
      fixture.detectChanges();
      options = fixture.nativeElement.querySelectorAll('[etSelectionOption]');
    });

    it('reflects readonly on the radiogroup and blocks selection', () => {
      const listEl = fixture.nativeElement.querySelector('[etSelectionList]');

      expect(listEl.getAttribute('aria-readonly')).toBe('true');
      expect(listEl.getAttribute('data-readonly')).toBe('true');
      // options keep their normal focusable, non-dimmed state
      expect(options[0]!.getAttribute('aria-disabled')).toBeNull();
      expect(options[0]!.getAttribute('data-readonly')).toBe('true');

      options[1]!.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.value()).toBe('a');
    });

    it('moves focus with arrows without selecting (radio pattern pauses while readonly)', () => {
      options[0]!.focus();
      options[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      fixture.detectChanges();

      expect(document.activeElement).toBe(options[1]);
      expect(fixture.componentInstance.value()).toBe('a');
    });

    it('selects again once readonly is lifted', () => {
      fixture.componentInstance.readonly.set(false);
      fixture.detectChanges();

      options[1]!.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.value()).toBe('b');
    });
  });

  describe('accessible name', () => {
    let fixture: ComponentFixture<LabelledSelectTestHost>;
    let listEl: HTMLElement;
    let listDir: SelectionListDirective;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [LabelledSelectTestHost] });
      fixture = TestBed.createComponent(LabelledSelectTestHost);
      fixture.detectChanges();
      listEl = fixture.nativeElement.querySelector('[etSelectionList]');
      listDir = (fixture.debugElement.children[0] as DebugElement).injector.get(SelectionListDirective);
    });

    it('reports no custom name when neither is set', () => {
      expect(listDir.hasCustomAccessibleName()).toBe(false);
      expect(listEl.getAttribute('aria-label')).toBeNull();
      expect(listEl.getAttribute('aria-labelledby')).toBeNull();
    });

    it('writes aria-label on the group and counts as a name for the field guard', () => {
      fixture.componentInstance.ariaLabel.set('Partner scope');
      fixture.detectChanges();

      expect(listEl.getAttribute('aria-label')).toBe('Partner scope');
      expect(listDir.hasCustomAccessibleName()).toBe(true);
    });

    it('ignores a blank aria-label', () => {
      fixture.componentInstance.ariaLabel.set('   ');
      fixture.detectChanges();

      expect(listEl.getAttribute('aria-label')).toBeNull();
      expect(listDir.hasCustomAccessibleName()).toBe(false);
    });

    it('writes a consumer-supplied aria-labelledby', () => {
      fixture.componentInstance.ariaLabelledby.set('external-caption');
      fixture.detectChanges();

      expect(listEl.getAttribute('aria-labelledby')).toBe('external-caption');
      expect(listDir.hasCustomAccessibleName()).toBe(true);
    });
  });
});

describe('SelectionListDirective (single, mixed contract)', () => {
  describeMixedStateContract(() => {
    TestBed.configureTestingModule({ imports: [MixedSingleSelectTestHost] });

    const fixture = TestBed.createComponent(MixedSingleSelectTestHost);

    fixture.detectChanges();

    const tick = () => TestBed.inject(ApplicationRef).tick();
    const options = () => fixture.nativeElement.querySelectorAll<HTMLElement>('[etSelectionOption]');

    return {
      enterMixed: () => {
        fixture.componentInstance.value.set('b');
        fixture.componentInstance.mixed.set(true);
        fixture.detectChanges();
        tick();
      },
      rawValue: () => 'b',
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => fixture.nativeElement.querySelector('[etSelectionList]') as HTMLElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set('c');
        fixture.detectChanges();
        tick();
      },
      externallyWrittenValue: () => 'c',
      commit: () => {
        options()[0]!.click();
        fixture.detectChanges();
        tick();
      },
      committedValue: () => 'a',
      assertMasked: () => {
        for (const option of Array.from(options())) {
          expect(option.getAttribute('aria-checked')).toBe('false');
        }
      },
      // no clear affordance - selection lists have no empty-shape control of their own
    };
  });
});

describe('SelectionListDirective (multiple, mixed contract)', () => {
  describeMixedStateContract(() => {
    TestBed.configureTestingModule({ imports: [MixedMultiSelectTestHost] });

    const fixture = TestBed.createComponent(MixedMultiSelectTestHost);

    fixture.detectChanges();

    const tick = () => TestBed.inject(ApplicationRef).tick();
    const options = () => fixture.nativeElement.querySelectorAll<HTMLElement>('[etSelectionOption]');

    return {
      enterMixed: () => {
        fixture.componentInstance.value.set(['b', 'c']);
        fixture.componentInstance.mixed.set(true);
        fixture.detectChanges();
        tick();
      },
      rawValue: () => ['b', 'c'],
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => fixture.nativeElement.querySelector('[etSelectionList]') as HTMLElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set(['a']);
        fixture.detectChanges();
        tick();
      },
      externallyWrittenValue: () => ['a'],
      // Space on an option - a real keyboard commit
      commit: () => {
        options()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        fixture.detectChanges();
        tick();
      },
      // replace semantics: a fresh array around the committed option, not a toggle
      committedValue: () => ['a'],
      assertMasked: () => {
        for (const option of Array.from(options())) {
          expect(option.getAttribute('aria-checked')).toBe('false');
        }
      },
    };
  });
});

describe('SelectionListDirective (mixed specifics)', () => {
  const tick = () => TestBed.inject(ApplicationRef).tick();

  describe('single (radio pattern)', () => {
    let fixture: ComponentFixture<MixedSingleSelectTestHost>;
    let options: NodeListOf<HTMLElement>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [MixedSingleSelectTestHost] });
      fixture = TestBed.createComponent(MixedSingleSelectTestHost);
      fixture.componentInstance.value.set('b');
      fixture.componentInstance.mixed.set(true);
      fixture.detectChanges();
      tick();
      options = fixture.nativeElement.querySelectorAll('[etSelectionOption]');
    });

    it('reports no option as checked despite the hidden raw value', () => {
      for (const option of Array.from(options)) {
        expect(option.getAttribute('aria-checked')).toBe('false');
      }
    });

    it('roves the tab stop from the first option (no-selection behavior), not the hidden raw value', () => {
      expect(options[0]!.getAttribute('tabindex')).toBe('0');
      expect(options[1]!.getAttribute('tabindex')).toBe('-1');
      expect(options[2]!.getAttribute('tabindex')).toBe('-1');
    });

    it('resolves mixed through radio arrow-selection', () => {
      // raw 'c' so the committed 'b' provably comes from the arrow target, not the hidden value
      fixture.componentInstance.value.set('c');
      fixture.detectChanges();
      tick();

      options[0]!.focus();
      options[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      fixture.detectChanges();
      tick();

      expect(fixture.componentInstance.mixed()).toBe(false);
      expect(fixture.componentInstance.value()).toBe('b');
      expect(options[1]!.getAttribute('aria-checked')).toBe('true');
      expect(document.activeElement).toBe(options[1]);
    });

    it('keeps masking across external value writes', () => {
      fixture.componentInstance.value.set('c');
      fixture.detectChanges();
      tick();

      expect(fixture.componentInstance.mixed()).toBe(true);

      for (const option of Array.from(options)) {
        expect(option.getAttribute('aria-checked')).toBe('false');
      }
    });
  });

  describe('multiple (checkbox pattern)', () => {
    let fixture: ComponentFixture<MixedMultiSelectTestHost>;
    let options: NodeListOf<HTMLElement>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [MixedMultiSelectTestHost] });
      fixture = TestBed.createComponent(MixedMultiSelectTestHost);
      fixture.componentInstance.value.set(['a', 'c']);
      fixture.componentInstance.mixed.set(true);
      fixture.detectChanges();
      tick();
      options = fixture.nativeElement.querySelectorAll('[etSelectionOption]');
    });

    it('reports no option as checked despite the hidden raw array', () => {
      for (const option of Array.from(options)) {
        expect(option.getAttribute('aria-checked')).toBe('false');
      }
    });

    it('replaces with a fresh array on first commit - even for a value inside the hidden raw array', () => {
      // 'a' is part of the hidden raw value; toggling against it would remove it instead
      options[0]!.click();
      fixture.detectChanges();
      tick();

      expect(fixture.componentInstance.mixed()).toBe(false);
      expect(fixture.componentInstance.value()).toEqual(['a']);
    });

    it('resumes normal toggling after the first commit', () => {
      options[1]!.click();
      fixture.detectChanges();
      tick();

      expect(fixture.componentInstance.value()).toEqual(['b']);

      options[0]!.click();
      fixture.detectChanges();
      tick();

      // the group recomputes the array in option (registry) order, not click order
      expect(fixture.componentInstance.value()).toEqual(['a', 'b']);
      expect(fixture.componentInstance.mixed()).toBe(false);
    });

    it('keeps mixed and the raw array across external value writes', () => {
      fixture.componentInstance.value.set(['b']);
      fixture.detectChanges();
      tick();

      expect(fixture.componentInstance.mixed()).toBe(true);
      expect(fixture.componentInstance.value()).toEqual(['b']);

      for (const option of Array.from(options)) {
        expect(option.getAttribute('aria-checked')).toBe('false');
      }
    });

    it('shows the select-all control as unchecked while mixed and resolves via toggle-all with every value', () => {
      const control = fixture.nativeElement.querySelector('[etSelectionListControl]') as HTMLElement;

      expect(control.getAttribute('aria-checked')).toBe('false');

      control.click();
      fixture.detectChanges();
      tick();

      expect(fixture.componentInstance.mixed()).toBe(false);
      expect(fixture.componentInstance.value()).toEqual(['a', 'b', 'c']);
      expect(control.getAttribute('aria-checked')).toBe('true');
    });
  });
});
