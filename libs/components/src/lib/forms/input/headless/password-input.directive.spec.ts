import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { PASSWORD_INPUT_IMPORTS } from '../input.imports';
import { PasswordInputDirective } from './password-input.directive';

@Component({
  template: `
    <et-password-input
      [value]="value()"
      [revealable]="revealable()"
      [capsLockWarning]="capsLockWarning()"
      [disabled]="disabled()"
      (valueChange)="value.set($event)"
    />
  `,
  imports: [PASSWORD_INPUT_IMPORTS],
})
class PasswordInputTestHost {
  value = signal('');
  revealable = signal(true);
  capsLockWarning = signal(false);
  disabled = signal(false);
}

describe('PasswordInputDirective', () => {
  let fixture: ComponentFixture<PasswordInputTestHost>;
  let directive: PasswordInputDirective;

  const nativeInput = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;
  const revealButton = () =>
    fixture.nativeElement.querySelector('.et-password-input-reveal') as HTMLButtonElement | null;
  const capsWarning = () => fixture.nativeElement.querySelector('.et-password-input-caps-warning');

  const keydown = (capsLock: boolean) => {
    nativeInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, modifierCapsLock: capsLock }));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PasswordInputTestHost] });
    fixture = TestBed.createComponent(PasswordInputTestHost);
    fixture.detectChanges();
    directive = fixture.debugElement.children[0]!.injector.get(PasswordInputDirective);
  });

  it('renders a password input and syncs typed text into the model', () => {
    expect(nativeInput().type).toBe('password');

    nativeInput().value = 'hunter2';
    nativeInput().dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe('hunter2');
    expect(directive.hasValue()).toBe(true);
  });

  it('reveals and re-hides the value via the toggle button', () => {
    const button = revealButton()!;

    expect(button.getAttribute('aria-pressed')).toBe('false');

    button.click();
    fixture.detectChanges();

    expect(nativeInput().type).toBe('text');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    fixture.detectChanges();

    expect(nativeInput().type).toBe('password');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('omits the reveal button when not revealable', () => {
    fixture.componentInstance.revealable.set(false);
    fixture.detectChanges();

    expect(revealButton()).toBeNull();
  });

  it('shows the caps-lock warning only while focused with Caps Lock on (opt-in)', () => {
    fixture.componentInstance.capsLockWarning.set(true);
    fixture.detectChanges();

    nativeInput().dispatchEvent(new FocusEvent('focus'));
    keydown(true);

    expect(capsWarning()).toBeTruthy();

    keydown(false);

    expect(capsWarning()).toBeNull();

    keydown(true);
    nativeInput().dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(capsWarning()).toBeNull();
  });

  it('never renders the warning without the opt-in', () => {
    nativeInput().dispatchEvent(new FocusEvent('focus'));
    keydown(true);

    expect(capsWarning()).toBeNull();
  });

  it('exposes the typing-feedback strength score', () => {
    expect(directive.strength()).toBe(0);

    fixture.componentInstance.value.set('Abcdefgh1!xy');
    fixture.detectChanges();

    expect(directive.strength()).toBe(4);
  });

  it('blocks the reveal toggle while disabled', () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    expect(revealButton()!.disabled).toBe(true);

    directive.toggleRevealed();
    fixture.detectChanges();

    expect(nativeInput().type).toBe('password');
  });
});
