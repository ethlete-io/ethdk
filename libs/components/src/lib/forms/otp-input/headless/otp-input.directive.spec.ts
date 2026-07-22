import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { LabelDirective } from '../../form-field/headless';
import { OTP_INPUT_IMPORTS } from '../otp-input.imports';
import { OtpInputCharset } from './otp-input.directive';

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

@Component({
  template: `
    <et-otp-input
      [value]="value()"
      [length]="4"
      [charset]="charset()"
      [masked]="masked()"
      (valueChange)="value.set($event)"
      (complete)="completions.push($event)"
    >
      <et-label>Test label</et-label>
    </et-otp-input>
  `,
  imports: [OTP_INPUT_IMPORTS, LabelDirective],
})
class OtpTestHost {
  value = signal('');
  charset = signal<OtpInputCharset>('numeric');
  masked = signal(false);
  completions: string[] = [];
}

describe('OtpInputDirective', () => {
  let fixture: ComponentFixture<OtpTestHost>;
  let native: HTMLInputElement;

  const type = (raw: string) => {
    native.value = raw;
    native.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };

  const segments = () => Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>('.et-otp-input-segment'));
  const segmentTexts = () => segments().map((segment) => segment.textContent?.trim() || null);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OtpTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(OtpTestHost);
    fixture.detectChanges();
    native = fixture.nativeElement.querySelector('.et-otp-input-native');
  });

  it('renders one segment per character and a single autofill-ready input', () => {
    expect(segments().length).toBe(4);
    expect(native.getAttribute('autocomplete')).toBe('one-time-code');
    expect(native.getAttribute('inputmode')).toBe('numeric');
    expect(native.getAttribute('maxlength')).toBe('4');
  });

  it('builds the value from typed characters and fills the segments', () => {
    type('12');

    expect(fixture.componentInstance.value()).toBe('12');
    expect(segmentTexts()).toEqual(['1', '2', null, null]);
  });

  it('strips characters outside the charset (pastes with separators included)', () => {
    type('12-3 4x');

    expect(fixture.componentInstance.value()).toBe('1234');
    expect(native.value).toBe('1234');
  });

  it('truncates to the configured length', () => {
    type('1234567');

    expect(fixture.componentInstance.value()).toBe('1234');
  });

  it('emits completed exactly once per completion', () => {
    type('123');
    expect(fixture.componentInstance.completions).toEqual([]);

    type('1234');
    expect(fixture.componentInstance.completions).toEqual(['1234']);

    // editing within the completed state does not re-emit
    type('1234');
    expect(fixture.componentInstance.completions).toEqual(['1234']);

    // deleting and completing again emits again
    type('123');
    type('1235');
    expect(fixture.componentInstance.completions).toEqual(['1234', '1235']);
  });

  it('masks the rendered characters, not the value', () => {
    fixture.componentInstance.masked.set(true);
    fixture.detectChanges();

    type('12');

    expect(segmentTexts()).toEqual(['•', '•', null, null]);
    expect(fixture.componentInstance.value()).toBe('12');
  });

  it('supports alphanumeric and custom charsets', () => {
    fixture.componentInstance.charset.set('alphanumeric');
    fixture.detectChanges();
    type('a1-b2');
    expect(fixture.componentInstance.value()).toBe('a1b2');

    fixture.componentInstance.charset.set(/[a-f]/);
    fixture.detectChanges();
    type('abc123def');
    expect(fixture.componentInstance.value()).toBe('abcd');
  });

  it('marks the caret segment while focused', () => {
    native.dispatchEvent(new FocusEvent('focus'));
    type('12');

    expect(segments().map((segment) => segment.hasAttribute('data-caret'))).toEqual([false, false, true, false]);

    type('1234');
    expect(segments().map((segment) => segment.hasAttribute('data-caret'))).toEqual([false, false, false, true]);

    native.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(segments().some((segment) => segment.hasAttribute('data-caret'))).toBe(false);
  });
});
