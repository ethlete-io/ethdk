import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { FormFieldDirective, LabelDirective } from '../../../form-field/headless';
import { DURATION_INPUT_IMPORTS } from '../duration-input.imports';
import { DurationInputDirective } from './duration-input.directive';

@Component({
  template: `
    <et-duration-input
      [value]="value()"
      [mixed]="mixed()"
      [durationFormat]="durationFormat()"
      [disabled]="disabled()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      (touchedChange)="touched.set($event)"
      placeholder="mm:ss"
    />
  `,
  imports: [DURATION_INPUT_IMPORTS],
})
class DurationInputTestHost {
  value = signal<number | null>(null);
  mixed = signal(false);
  touched = signal(false);
  disabled = signal(false);
  durationFormat = signal('mm:ss');
}

@Component({
  template: `<et-duration-input aria-label="Time logged" />`,
  imports: [DURATION_INPUT_IMPORTS],
})
class AriaLabelDurationInputTestHost {}

@Component({
  template: `
    <div etFormField>
      <et-label>Projected label</et-label>
      <et-duration-input aria-labelledby="external-label-id" />
    </div>
  `,
  imports: [DURATION_INPUT_IMPORTS, FormFieldDirective, LabelDirective],
})
class AriaLabelledbyOverrideTestHost {}

describe('DurationInputDirective accessible name forwarding', () => {
  it('forwards a consumer aria-label onto the field', () => {
    TestBed.configureTestingModule({ imports: [AriaLabelDurationInputTestHost] });
    const fixture = TestBed.createComponent(AriaLabelDurationInputTestHost);
    fixture.detectChanges();

    const native = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    expect(native.getAttribute('aria-label')).toBe('Time logged');
  });

  it('lets a consumer aria-labelledby override the projected label id', () => {
    TestBed.configureTestingModule({ imports: [AriaLabelledbyOverrideTestHost] });
    const fixture = TestBed.createComponent(AriaLabelledbyOverrideTestHost);
    fixture.detectChanges();

    const native = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    expect(native.getAttribute('aria-labelledby')).toBe('external-label-id');
  });
});

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
