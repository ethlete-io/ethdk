import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { SelectionListDirective } from './selection-list.directive';
import { SelectionOptionDirective } from './selection-option.directive';

@Component({
  template: `
    <div [value]="value()" (valueChange)="value.set($event)" etSelectionList>
      <div etSelectionOption value="a"></div>
      <div [disabled]="true" etSelectionOption value="b"></div>
      <div etSelectionOption value="c"></div>
    </div>
  `,
  imports: [SelectionListDirective, SelectionOptionDirective],
})
class OptionTestHost {
  value = signal<string | null>(null);
}

describe('SelectionOptionDirective', () => {
  let fixture: ComponentFixture<OptionTestHost>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OptionTestHost] });
    fixture = TestBed.createComponent(OptionTestHost);
    fixture.detectChanges();
  });

  it('should create options', () => {
    const options = fixture.nativeElement.querySelectorAll('[etSelectionOption]');
    expect(options.length).toBe(3);
  });

  it('should have role radio in single select', () => {
    const option = fixture.nativeElement.querySelector('[etSelectionOption]');
    expect(option.getAttribute('role')).toBe('radio');
  });

  it('should apply aria-disabled on disabled option', () => {
    const options = fixture.nativeElement.querySelectorAll('[etSelectionOption]');
    expect(options[1].getAttribute('aria-disabled')).toBe('true');
  });

  it('should not select a disabled option on click', () => {
    const options = fixture.nativeElement.querySelectorAll('[etSelectionOption]');
    options[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('should set aria-checked on selected option', () => {
    const options = fixture.nativeElement.querySelectorAll('[etSelectionOption]');
    options[0].click();
    fixture.detectChanges();
    expect(options[0].getAttribute('aria-checked')).toBe('true');
    expect(options[2].getAttribute('aria-checked')).toBe('false');
  });
});
