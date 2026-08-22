import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { mountPasswordInput, PasswordInputDriver } from '../../testing/password-input-driver';
import { PASSWORD_INPUT_IMPORTS } from '../input.imports';

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

@Component({
  template: `
    <et-password-input
      [value]="value()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      mixedLabel="Mixed values"
      placeholder="Enter password"
    />
  `,
  imports: [PASSWORD_INPUT_IMPORTS],
})
class MixedPasswordInputTestHost {
  value = signal('');
  mixed = signal(false);
}

describe('PasswordInputDirective', () => {
  let driver: PasswordInputDriver<PasswordInputTestHost>;

  beforeEach(() => {
    driver = mountPasswordInput(PasswordInputTestHost);
  });

  it('renders a password input and syncs typed text into the model', () => {
    expect(driver.fieldType()).toBe('password');

    driver.type('hunter2');

    expect(driver.host.value()).toBe('hunter2');
    expect(driver.passwordInput.hasValue()).toBe(true);
  });

  it('reveals and re-hides the value via the toggle button', () => {
    expect(driver.revealButton()!.getAttribute('aria-pressed')).toBe('false');

    driver.clickReveal();

    expect(driver.fieldType()).toBe('text');
    expect(driver.revealButton()!.getAttribute('aria-pressed')).toBe('true');

    driver.clickReveal();

    expect(driver.fieldType()).toBe('password');
    expect(driver.revealButton()!.getAttribute('aria-pressed')).toBe('false');
  });

  it('omits the reveal button when not revealable', () => {
    driver.host.revealable.set(false);
    driver.tick();

    expect(driver.revealButton()).toBeNull();
  });

  it('shows the caps-lock warning only while focused with Caps Lock on (opt-in)', () => {
    driver.host.capsLockWarning.set(true);
    driver.tick();

    driver.focus();
    driver.pressWithCapsLock(true);

    expect(driver.capsWarning()).toBeTruthy();

    driver.pressWithCapsLock(false);

    expect(driver.capsWarning()).toBeNull();

    driver.pressWithCapsLock(true);
    driver.blur();

    expect(driver.capsWarning()).toBeNull();
  });

  it('drops the warning on the Caps Lock key itself, whatever state that event reports', () => {
    driver.host.capsLockWarning.set(true);
    driver.tick();

    driver.focus();
    driver.pressWithCapsLock(true);

    expect(driver.capsWarning()).toBeTruthy();

    driver.pressWithCapsLock(true, 'CapsLock');

    expect(driver.capsWarning()).toBeNull();

    driver.pressWithCapsLock(true);

    expect(driver.capsWarning()).toBeTruthy();
  });

  it('does not bring a stale warning back when focus returns without a keystroke', () => {
    driver.host.capsLockWarning.set(true);
    driver.tick();

    driver.focus();
    driver.pressWithCapsLock(true);
    driver.blur();
    driver.focus();

    expect(driver.capsWarning()).toBeNull();
  });

  it('never renders the warning without the opt-in', () => {
    driver.focus();
    driver.pressWithCapsLock(true);

    expect(driver.capsWarning()).toBeNull();
  });

  it('exposes the typing-feedback strength score', () => {
    expect(driver.passwordInput.strength()).toBe(0);

    driver.host.value.set('Abcdefgh1!xy');
    driver.tick();

    expect(driver.passwordInput.strength()).toBe(4);
  });

  it('blocks the reveal toggle while disabled', () => {
    driver.host.disabled.set(true);
    driver.tick();

    expect(driver.revealButton()!.disabled).toBe(true);

    driver.passwordInput.toggleRevealed();
    driver.tick();

    expect(driver.fieldType()).toBe('password');
  });
});

describe('PasswordInputDirective mixed state', () => {
  const setup = () => {
    const driver = mountPasswordInput(MixedPasswordInputTestHost);

    return {
      driver,
      enterMixed: (rawValue: string) => {
        driver.host.value.set(rawValue);
        driver.host.mixed.set(true);
        driver.tick();
      },
    };
  };

  describeMixedStateContract(() => {
    const { driver, enterMixed } = setup();

    return {
      enterMixed: () => enterMixed('hunter2'),
      rawValue: () => 'hunter2',
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.element(),
      writeValueExternally: () => {
        driver.host.value.set('correct horse');
        driver.tick();
      },
      externallyWrittenValue: () => 'correct horse',
      resolveMixedFromConsumer: () => {
        driver.host.mixed.set(false);
        driver.tick();
      },
      mixedLabel: () => 'Mixed values',
      mixedDisplayText: () => driver.placeholder(),
      commit: () => driver.type('new password'),
      committedValue: () => 'new password',
      assertMasked: () => {
        expect(driver.fieldValue()).toBe('');
        expect(driver.placeholder()).toBe('Mixed values');
      },
    };
  });

  it('never reveals the hidden raw value, even with the reveal toggle', () => {
    const { driver, enterMixed } = setup();

    enterMixed('hunter2');
    driver.passwordInput.toggleRevealed();
    driver.tick();

    expect(driver.fieldType()).toBe('text');
    expect(driver.fieldValue()).toBe('');
  });

  it('reports zero strength while mixed instead of scoring the hidden raw value', () => {
    const { driver, enterMixed } = setup();

    enterMixed('Abcdefgh1!xy');

    expect(driver.passwordInput.strength()).toBe(0);
  });

  it('keeps mixed and the raw value when an edit produces no content', () => {
    const { driver, enterMixed } = setup();

    enterMixed('hunter2');
    driver.type('');

    expect(driver.host.mixed()).toBe(true);
    expect(driver.host.value()).toBe('hunter2');
  });
});
