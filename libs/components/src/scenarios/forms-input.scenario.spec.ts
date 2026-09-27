import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, max, min, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import {
  DEFAULT_INPUT_LABELS,
  FORM_FIELD_IMPORTS,
  injectInputLabels,
  INPUT_LABELS,
  INPUT_TEXT_ALIGNMENTS,
  INPUT_TYPES,
  InputComponent,
  InputDirective,
  NumberInputComponent,
  NumberInputDirective,
  numberInputStepMultiplierFrom,
  PasswordInputComponent,
  PasswordInputDirective,
  provideInputLabels,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-player-signup',
  imports: [FORM_FIELD_IMPORTS, InputComponent, NumberInputComponent, PasswordInputComponent, FormField],
  template: `
    <et-form-field>
      <et-label>Email</et-label>
      <et-input [formField]="signup.email" [type]="emailType" autocomplete="email" placeholder="you@team-a.test" />
    </et-form-field>
    <et-form-field>
      <et-label>Shirt number</et-label>
      <et-number-input [formField]="signup.shirt" [step]="1" [textAlign]="alignEnd" stepper />
    </et-form-field>
    <et-form-field>
      <et-label>Password</et-label>
      <et-password-input [(revealed)]="revealed" [formField]="signup.password" capsLockWarning />
    </et-form-field>
  `,
})
class PlayerSignupComponent {
  emailType = INPUT_TYPES.EMAIL;
  alignEnd = INPUT_TEXT_ALIGNMENTS.END;
  model = signal({ email: '', shirt: null as number | null, password: '' });
  signup = form(this.model, (path) => {
    required(path.email, { message: 'Email is required' });
    min(path.shirt, 1);
    max(path.shirt, 3);
    required(path.password);
  });
  revealed = signal(false);
  passwordDir = viewChild.required(PasswordInputDirective);
}

@Component({
  selector: 'et-scenario-native-inputs',
  imports: [InputDirective, NumberInputDirective, PasswordInputDirective],
  template: `
    <input [(value)]="search" etInput type="search" aria-label="Search teams" />
    <input [(value)]="goals" [step]="0.5" [min]="0" etNumberInput aria-label="Goals" type="number" />
    <input #pw="etPasswordInput" [(value)]="secret" [type]="pw.inputType()" etPasswordInput aria-label="Secret" />
  `,
})
class NativeInputsComponent {
  search = signal('');
  goals = signal<number | null>(1);
  secret = signal('');
  password = viewChild.required(PasswordInputDirective);
  number = viewChild.required(NumberInputDirective);
}

@Component({
  selector: 'et-scenario-native-required-inputs',
  imports: [FORM_FIELD_IMPORTS, InputDirective, NumberInputDirective, PasswordInputDirective, FormField],
  template: `
    <et-form-field>
      <et-label>Team</et-label>
      <input [formField]="entry.team" etInput />
    </et-form-field>
    <et-form-field>
      <et-label>Squad size</et-label>
      <input [formField]="entry.squad" etNumberInput type="number" />
    </et-form-field>
    <et-form-field>
      <et-label>Code</et-label>
      <input [formField]="entry.code" etPasswordInput type="password" />
    </et-form-field>
  `,
})
class NativeRequiredInputsComponent {
  model = signal({ team: '', squad: null as number | null, code: '' });
  entry = form(this.model, (path) => {
    required(path.team, { message: 'Team is required' });
    required(path.squad, { message: 'Squad size is required' });
    required(path.code, { message: 'Code is required' });
  });
  text = viewChild.required(InputDirective);
  number = viewChild.required(NumberInputDirective);
  password = viewChild.required(PasswordInputDirective);
}

@Component({
  selector: 'et-scenario-german-inputs',
  imports: [FORM_FIELD_IMPORTS, NumberInputComponent, PasswordInputComponent],
  providers: [provideInputLabels({ increment: 'Erhöhen', showPassword: 'Passwort anzeigen' })],
  template: `
    <et-form-field>
      <et-label>Alter</et-label>
      <et-number-input [(value)]="age" decrementLabel="Weniger" stepper />
    </et-form-field>
    <et-form-field>
      <et-label>Passwort</et-label>
      <et-password-input [(value)]="secret" hideLabel="Verbergen" />
    </et-form-field>
    <p class="probe">{{ labels().capsLockOn }}</p>
  `,
})
class GermanInputsComponent {
  age = signal<number | null>(null);
  secret = signal('');
  labels = injectInputLabels();
}

@Component({
  selector: 'et-scenario-token-inputs',
  imports: [FORM_FIELD_IMPORTS, PasswordInputComponent],
  providers: [{ provide: INPUT_LABELS, useValue: { showPassword: 'Mot de passe' } }],
  template: `
    <et-form-field>
      <et-label>Mot de passe</et-label>
      <et-password-input [(value)]="secret" [revealable]="revealable()" />
    </et-form-field>
  `,
})
class TokenInputsComponent {
  secret = signal('');
  revealable = signal(true);
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const typeInto = (s: Scenario, input: HTMLInputElement, value: string) => {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

const pointer = (type: string, init: MouseEventInit = {}) =>
  new MouseEvent(type, { bubbles: true, cancelable: true, ...init });

describe('forms input scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

  it('fills a signup form through the default text, number and password inputs', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlayerSignupComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const email = query<HTMLInputElement>('.et-input-native', host);
    const shirt = query<HTMLInputElement>('.et-number-input-native', host);
    const password = query<HTMLInputElement>('.et-password-input-native', host);

    expect(email.type).toBe('email');
    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(email.placeholder).toBe('you@team-a.test');
    expect(email.required).toBe(true);
    expect(email.getAttribute('aria-labelledby')).toBe(query('et-label', host).id);

    typeInto(s, email, 'coach@team-a.test');
    expect(app.model().email).toBe('coach@team-a.test');
    email.blur();
    s.tick();
    expect(app.signup.email().touched()).toBe(true);

    expect(shirt.getAttribute('data-text-align')).toBe('end');
    expect([shirt.getAttribute('min'), shirt.getAttribute('max'), shirt.getAttribute('step')]).toEqual(['1', '3', '1']);

    const [decrement, increment] = Array.from(
      host.querySelectorAll<HTMLButtonElement>('.et-number-input-stepper-button'),
    );

    expect(decrement?.getAttribute('aria-label')).toBe(DEFAULT_INPUT_LABELS.decrement);
    expect(increment?.getAttribute('aria-label')).toBe(DEFAULT_INPUT_LABELS.increment);

    shirt.focus();
    s.keydown('ArrowUp', shirt);
    s.tick();
    expect(app.model().shirt).toBe(1);
    expect(app.signup.shirt().touched()).toBe(true);
    expect(decrement?.disabled).toBe(true);

    increment?.dispatchEvent(pointer('pointerdown'));
    s.tick();
    expect(app.model().shirt).toBe(2);
    s.tick(400);
    expect(app.model().shirt).toBe(3);
    expect(increment?.disabled).toBe(true);
    document.dispatchEvent(pointer('pointerup'));
    s.tick(500);
    expect(app.model().shirt).toBe(3);

    typeInto(s, shirt, '');
    expect(app.model().shirt).toBeNull();

    expect(password.type).toBe('password');
    expect(password.getAttribute('autocomplete')).toBe('current-password');

    const reveal = query<HTMLButtonElement>('.et-password-input-reveal', host);

    expect(reveal.getAttribute('aria-label')).toBe('Show password');
    expect(reveal.getAttribute('aria-pressed')).toBe('false');
    typeInto(s, password, 'Kick0ff!Kick0ff');
    expect(app.model().password).toBe('Kick0ff!Kick0ff');
    expect(app.passwordDir().strength()).toBeGreaterThan(0);

    reveal.click();
    s.tick();
    expect(app.revealed()).toBe(true);
    expect(password.type).toBe('text');
    expect(reveal.getAttribute('aria-label')).toBe('Hide password');

    password.focus();
    password.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, modifierCapsLock: true }));
    s.tick();
    expect(query('.et-password-input-caps-warning', host).getAttribute('role')).toBe('status');
    expect(query('.et-password-input-caps-warning-text', host).textContent?.trim()).toBe('Caps Lock might be on');

    password.dispatchEvent(new KeyboardEvent('keydown', { key: 'CapsLock', bubbles: true, modifierCapsLock: true }));
    s.tick();
    expect(host.querySelector('.et-password-input-caps-warning')).toBeNull();
    s.flush();
  });

  it('drives native inputs with the headless directives', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativeInputsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();

    const [search, goals, secret] = Array.from(host.querySelectorAll('input'));

    if (!search || !goals || !secret) throw new Error('missing inputs');

    expect(search.type).toBe('search');
    typeInto(s, search, 'team-a');
    expect(app.search()).toBe('team-a');

    typeInto(s, goals, '3');
    expect(app.goals()).toBe(3);
    typeInto(s, goals, '1');
    s.keydown('ArrowUp', goals);
    expect(app.goals()).toBe(1.5);
    goals.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }));
    expect(app.goals()).toBe(6.5);
    goals.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    expect(app.goals()).toBe(6.45);
    goals.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    expect(app.goals()).toBe(0);
    expect(app.number().canStepDown()).toBe(false);

    const withCtrl = new KeyboardEvent('keydown', { key: 'ArrowUp', ctrlKey: true, bubbles: true, cancelable: true });

    goals.dispatchEvent(withCtrl);
    expect(withCtrl.defaultPrevented).toBe(false);
    expect(app.goals()).toBe(0);

    expect(numberInputStepMultiplierFrom({ shiftKey: true, altKey: true })).toBe(10);
    expect(numberInputStepMultiplierFrom({ shiftKey: false, altKey: true })).toBe(0.1);
    expect(numberInputStepMultiplierFrom({ shiftKey: false, altKey: false })).toBe(1);

    expect(secret.type).toBe('password');
    typeInto(s, secret, 'abc');
    expect(app.secret()).toBe('abc');
    app.password().toggleRevealed();
    s.tick();
    expect(secret.type).toBe('text');
  });

  it('marks a bare native input touched on blur and shows its signal-form error', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativeRequiredInputsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const fields = Array.from(host.querySelectorAll('et-form-field'));
    const cases = [
      { dir: app.text(), field: app.entry.team, message: 'Team is required' },
      { dir: app.number(), field: app.entry.squad, message: 'Squad size is required' },
      { dir: app.password(), field: app.entry.code, message: 'Code is required' },
    ];

    expect(host.querySelector('et-form-error')).toBeNull();

    cases.forEach(({ dir, field, message }, index) => {
      const formField = fields[index]!;
      const input = query<HTMLInputElement>('input', formField);

      input.focus();
      s.tick();
      expect(dir.focused()).toBe(true);
      expect(field().touched()).toBe(false);

      input.blur();
      s.tick();
      expect(dir.focused()).toBe(false);
      expect(dir.touched()).toBe(true);
      expect(field().touched()).toBe(true);
      expect(query('et-form-error', formField).textContent).toContain(message);
    });

    s.flush();
  });

  it('localizes stepper and reveal labels app-wide, per instance and through the token', () => {
    const s = scenario();
    const german = TestBed.createComponent(GermanInputsComponent);
    const host = german.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    const [decrement, increment] = Array.from(host.querySelectorAll('.et-number-input-stepper-button'));

    expect(decrement?.getAttribute('aria-label')).toBe('Weniger');
    expect(increment?.getAttribute('aria-label')).toBe('Erhöhen');
    expect(query('.probe', host).textContent).toBe(DEFAULT_INPUT_LABELS.capsLockOn);

    const reveal = query<HTMLButtonElement>('.et-password-input-reveal', host);

    expect(reveal.getAttribute('aria-label')).toBe('Passwort anzeigen');
    reveal.click();
    s.tick();
    expect(reveal.getAttribute('aria-label')).toBe('Verbergen');

    const token = TestBed.createComponent(TokenInputsComponent);
    const tokenHost = token.nativeElement as HTMLElement;

    s.tick();
    s.flush();
    expect(query('.et-password-input-reveal', tokenHost).getAttribute('aria-label')).toBe('Mot de passe');

    token.componentInstance.revealable.set(false);
    s.tick();
    s.flush();
    expect(tokenHost.querySelector('.et-password-input-reveal')).toBeNull();
  });
});
