import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { CheckboxComponent } from '../checkbox';
import { InputDirective } from '../input/headless';
import { FormFieldComponent } from './form-field.component';
import { LabelDirective } from './headless';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';

const ensureResizeObserverMock = () => {
  if (globalThis.ResizeObserver) {
    return;
  }

  class ResizeObserverMock {
    constructor(callback: ResizeObserverCallback) {
      void callback;
    }

    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }

  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
    writable: true,
  });
};

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
    ensureResizeObserverMock();

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
    ensureResizeObserverMock();

    TestBed.configureTestingModule({
      imports: [InputFormFieldTestHost],
      providers: [provideColorThemes([...TEST_COLOR_THEMES])],
    });
    fixture = TestBed.createComponent(InputFormFieldTestHost);
    fixture.detectChanges();
  });

  // The disabled treatment is driven by the registered control's state (data-disabled), NOT by
  // :has(:disabled) - a composite control (e.g. the rich text editor) legitimately disables
  // individual toolbar buttons while fully enabled, and :has would dim the whole field over it.
  it('sets data-disabled from the registered control, not from arbitrary disabled descendants', () => {
    const field = fixture.nativeElement.querySelector('et-form-field') as HTMLElement;

    expect(field.hasAttribute('data-disabled')).toBe(false);

    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    expect(field.hasAttribute('data-disabled')).toBe(true);
  });
});
