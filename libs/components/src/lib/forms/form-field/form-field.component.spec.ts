import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { CheckboxComponent } from '../checkbox';
import { InputDirective } from '../input/headless';
import { PASSWORD_INPUT_IMPORTS } from '../input/input.imports';
import { TextareaDirective } from '../textarea/headless';
import { FormFieldComponent } from './form-field.component';
import { LabelDirective } from './headless';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';

@Component({
  template: `
    <et-form-field>
      <et-checkbox />
      <et-label>Accept terms</et-label>
    </et-form-field>
  `,
  imports: [FormFieldComponent, CheckboxComponent, LabelDirective],
})
class CheckboxFormFieldTestHost {}

describe('FormFieldComponent', () => {
  let fixture: ComponentFixture<CheckboxFormFieldTestHost>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CheckboxFormFieldTestHost],
      providers: [provideColorThemes([...TEST_COLOR_THEMES])],
    });
    fixture = TestBed.createComponent(CheckboxFormFieldTestHost);
    fixture.detectChanges();
    fixture.detectChanges();
  });

  it('renders the checkbox label inside the label area', () => {
    const labelArea = fixture.nativeElement.querySelector('.et-form-field-label-area') as HTMLElement | null;

    expect(labelArea?.textContent?.trim()).toBe('Accept terms');
  });
});

@Component({
  template: `
    <et-form-field>
      <et-label>Name</et-label>
      <input [disabled]="disabled()" etInput />
    </et-form-field>
  `,
  imports: [FormFieldComponent, InputDirective, LabelDirective],
})
class InputFormFieldTestHost {
  public disabled = signal(false);
}

describe('FormFieldComponent disabled state', () => {
  let fixture: ComponentFixture<InputFormFieldTestHost>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InputFormFieldTestHost],
      providers: [provideColorThemes([...TEST_COLOR_THEMES])],
    });
    fixture = TestBed.createComponent(InputFormFieldTestHost);
    fixture.detectChanges();
  });

  it('sets data-disabled from the registered control, not from arbitrary disabled descendants', () => {
    const field = fixture.nativeElement.querySelector('et-form-field') as HTMLElement;

    expect(field.hasAttribute('data-disabled')).toBe(false);

    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    expect(field.hasAttribute('data-disabled')).toBe(true);
  });
});

@Component({
  template: `
    <et-form-field>
      <et-label>Password</et-label>
      <et-password-input />
    </et-form-field>
  `,
  imports: [FormFieldComponent, LabelDirective, PASSWORD_INPUT_IMPORTS],
})
class PasswordFormFieldTestHost {}

describe('FormFieldComponent control frame pointerdown', () => {
  let fixture: ComponentFixture<PasswordFormFieldTestHost>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PasswordFormFieldTestHost],
      providers: [provideColorThemes([...TEST_COLOR_THEMES])],
    });
    fixture = TestBed.createComponent(PasswordFormFieldTestHost);
    fixture.detectChanges();
  });

  it('activates the field on a plain frame click', () => {
    const frame = fixture.nativeElement.querySelector('.et-form-field-control-frame') as HTMLElement;
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

    frame.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves a click on an icon inside the reveal button alone, so the button keeps focus', () => {
    const icon = fixture.nativeElement.querySelector('.et-password-input-reveal i') as HTMLElement;
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

    icon.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});

@Component({
  template: `
    <textarea aria-label="Standalone" etTextarea></textarea>
    @if (inField()) {
      <et-form-field>
        <et-label>Message</et-label>
        <textarea etTextarea></textarea>
      </et-form-field>
    }
  `,
  imports: [FormFieldComponent, LabelDirective, TextareaDirective],
})
class TextareaStylesTestHost {
  public inField = signal(false);
}

describe('FormFieldComponent textarea styles', () => {
  const textareaStyles = () => document.querySelector('et-form-field-textarea-styles');

  it('injects the textarea frame styles only once a textarea sits in a form field', () => {
    TestBed.configureTestingModule({
      imports: [TextareaStylesTestHost],
      providers: [provideColorThemes([...TEST_COLOR_THEMES])],
    });

    const fixture = TestBed.createComponent(TextareaStylesTestHost);

    fixture.detectChanges();

    expect(textareaStyles()).toBeNull();

    fixture.componentInstance.inField.set(true);
    fixture.detectChanges();

    expect(textareaStyles()).not.toBeNull();
  });
});
