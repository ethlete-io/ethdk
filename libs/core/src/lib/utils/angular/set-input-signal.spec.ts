import { Component, input, InputSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setInputSignal } from './set-input-signal';

@Component({
  selector: 'et-test-set-input',
  template: '{{ label() }}',
})
class SetInputComponent {
  label = input('initial');
  count = input(0, { transform: (value: unknown) => Number(value) });
}

describe('setInputSignal', () => {
  it('overrides an input signal and updates dependents', () => {
    const fixture = TestBed.createComponent(SetInputComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toBe('initial');

    setInputSignal(fixture.componentInstance.label, 'changed');
    fixture.detectChanges();

    expect(fixture.componentInstance.label()).toBe('changed');
    expect(fixture.nativeElement.textContent).toBe('changed');
  });

  it('writes the value as-is for an input with a transform', () => {
    const fixture = TestBed.createComponent(SetInputComponent);

    setInputSignal(fixture.componentInstance.count, 7);

    expect(fixture.componentInstance.count()).toBe(7);
  });

  it('lets a later template binding win again', () => {
    const fixture = TestBed.createComponent(SetInputComponent);
    const label: InputSignal<string> = fixture.componentInstance.label;

    setInputSignal(label, 'first');
    fixture.componentRef.setInput('label', 'bound');

    expect(label()).toBe('bound');
  });
});
