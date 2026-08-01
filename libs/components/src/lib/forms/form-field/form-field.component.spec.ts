import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { CheckboxComponent } from '../checkbox';
import { InputDirective } from '../input/headless';
import { FormFieldComponent } from './form-field.component';
import { LabelDirective } from './headless';

const TEST_COLOR_THEMES = [
  {
    name: 'default',
    isDefault: true,
    primary: {
      color: {
        default: '0 255 161',
        hover: '76 247 184',
        focus: '76 247 184',
        active: '0 198 126',
        disabled: '0 122 77',
      },
      onColor: {
        default: '0 0 0',
        disabled: '0 36 23',
      },
    },
  },
  {
    name: 'red',
    type: 'error' as const,
    primary: {
      color: {
        default: '255 0 0',
        hover: '255 76 76',
        focus: '255 76 76',
        active: '198 0 0',
        disabled: '128 32 32',
      },
      onColor: {
        default: '0 0 0',
        disabled: '48 0 0',
      },
    },
  },
] as const;

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
