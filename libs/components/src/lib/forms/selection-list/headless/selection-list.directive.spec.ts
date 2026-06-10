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
      expect(listDir.items().length).toBe(3);
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
});
