import { Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
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
    <div [value]="value()" [multiple]="true" (valueChange)="value.set($event)" etSelectionList>
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
});
