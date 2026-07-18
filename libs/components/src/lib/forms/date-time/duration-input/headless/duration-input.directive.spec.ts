import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { DURATION_INPUT_IMPORTS } from '../duration-input.imports';
import { DurationInputDirective } from './duration-input.directive';

@Component({
  template: `
    <et-duration-input
      [value]="value()"
      [durationFormat]="durationFormat()"
      [disabled]="disabled()"
      (valueChange)="value.set($event)"
      (touchedChange)="touched.set($event)"
      placeholder="mm:ss"
    />
  `,
  imports: [DURATION_INPUT_IMPORTS],
})
class DurationInputTestHost {
  value = signal<number | null>(null);
  touched = signal(false);
  disabled = signal(false);
  durationFormat = signal('mm:ss');
}

describe('DurationInputDirective', () => {
  let fixture: ComponentFixture<DurationInputTestHost>;
  let directive: DurationInputDirective;
  let field: HTMLInputElement;

  const type = (text: string) => {
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };

  const blur = () => {
    field.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
  };

  const enter = () => {
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DurationInputTestHost] });
    fixture = TestBed.createComponent(DurationInputTestHost);
    fixture.detectChanges();
    directive = fixture.debugElement.children[0]!.injector.get(DurationInputDirective);
    field = fixture.nativeElement.querySelector('input');
  });

  it('renders a numeric text field', () => {
    expect(field.getAttribute('type')).toBe('text');
    expect(field.getAttribute('inputmode')).toBe('numeric');
  });

  it('displays a preset value formatted', () => {
    fixture.componentInstance.value.set(90_000);
    fixture.detectChanges();

    expect(field.value).toBe('01:30');
  });

  it('commits a lenient bare-digit entry on blur (130 → 1:30)', () => {
    field.dispatchEvent(new FocusEvent('focus'));
    type('130');
    blur();

    expect(fixture.componentInstance.value()).toBe(90_000);
    expect(field.value).toBe('01:30');
  });

  it('commits and reformats in place on Enter', () => {
    field.dispatchEvent(new FocusEvent('focus'));
    type('90');
    enter();

    expect(fixture.componentInstance.value()).toBe(90_000);
    expect(field.value).toBe('01:30');
  });

  it('respects a custom format layout', () => {
    fixture.componentInstance.durationFormat.set('hh:mm:ss');
    fixture.detectChanges();

    field.dispatchEvent(new FocusEvent('focus'));
    type('12345');
    blur();

    expect(fixture.componentInstance.value()).toBe(5_025_000);
    expect(field.value).toBe('01:23:45');
  });

  it('keeps unparseable text visible and flags a parse error', () => {
    field.dispatchEvent(new FocusEvent('focus'));
    type('abc');
    blur();

    expect(fixture.componentInstance.value()).toBeNull();
    expect(directive.parseError()).toBe(true);
    expect(field.value).toBe('abc');
    expect(directive.shouldDisplayError()).toBe(true);
  });

  it('clears the value on an empty commit', () => {
    fixture.componentInstance.value.set(90_000);
    fixture.detectChanges();

    field.dispatchEvent(new FocusEvent('focus'));
    type('');
    blur();

    expect(fixture.componentInstance.value()).toBeNull();
    expect(directive.parseError()).toBe(false);
  });

  it('marks the control touched on blur', () => {
    field.dispatchEvent(new FocusEvent('focus'));
    blur();

    expect(fixture.componentInstance.touched()).toBe(true);
  });

  it('ignores input while disabled', () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    expect(field.disabled).toBe(true);

    directive.commitInput('130');
    expect(fixture.componentInstance.value()).toBeNull();
  });
});
