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
  selector: 'et-scenario-native-prefilled-inputs',
  imports: [InputDirective, NumberInputDirective, PasswordInputDirective],
  template: `
    <input [(value)]="contact" [type]="kind()" etInput aria-label="Contact" />
    <input [(value)]="goals" etNumberInput aria-label="Goals" type="number" />
    <input
      #pw="etPasswordInput"
      [(value)]="secret"
      (keydown)="pw.syncCapsLock($event)"
      etPasswordInput
      aria-label="Secret"
      type="password"
    />
  `,
})
class NativePrefilledInputsComponent {
  contact = signal('coach@team-a.test');
  kind = signal<(typeof INPUT_TYPES)[keyof typeof INPUT_TYPES]>(INPUT_TYPES.EMAIL);
  goals = signal<number | null>(2);
  secret = signal('Kick0ff');
  password = viewChild.required(PasswordInputDirective);
}

@Component({
  selector: 'et-scenario-native-bound-attributes',
  imports: [InputDirective, NumberInputDirective, PasswordInputDirective],
  template: `
    <input
      [placeholder]="hint()"
      [disabled]="locked()"
      [readonly]="frozen()"
      [required]="needed()"
      [name]="fieldName()"
      etInput
      aria-label="Club"
      aria-describedby="club-note"
    />
    <input
      [placeholder]="hint()"
      [disabled]="locked()"
      [readonly]="frozen()"
      [required]="needed()"
      [min]="lowest()"
      [max]="highest()"
      [step]="stride()"
      etNumberInput
      aria-label="Goals"
      type="number"
    />
    <input
      [placeholder]="hint()"
      [disabled]="locked()"
      [readonly]="frozen()"
      [required]="needed()"
      etPasswordInput
      aria-label="Secret"
      type="password"
    />
  `,
})
class NativeBoundAttributesComponent {
  hint = signal('Team A');
  locked = signal(false);
  frozen = signal(false);
  needed = signal(false);
  lowest = signal<number | undefined>(0);
  highest = signal<number | undefined>(9);
  stride = signal<number | null>(0.5);
  fieldName = signal('club');
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

  it('holds a model write back from the native input until an IME composition ends', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlayerSignupComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();

    const email = query<HTMLInputElement>('.et-input-native', host);

    typeInto(s, email, 'coach');
    email.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    email.value = 'coachか';
    email.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', isComposing: true }),
    );
    app.model.update((model) => ({ ...model, email: 'reset@team-a.test' }));
    s.tick();

    expect(email.value).toBe('coachか');

    email.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'か' }));
    s.tick();

    expect(email.value).toBe('reset@team-a.test');
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

  it('renders the bound value and type into native inputs and clears Caps Lock on blur', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativePrefilledInputsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();

    const [contact, goals, secret] = Array.from(host.querySelectorAll('input'));

    if (!contact || !goals || !secret) throw new Error('missing inputs');

    expect([contact.value, goals.value, secret.value]).toEqual(['coach@team-a.test', '2', 'Kick0ff']);
    expect(contact.type).toBe('email');

    app.kind.set(INPUT_TYPES.TEL);
    app.contact.set('+49 30 1234');
    app.goals.set(null);
    s.tick();
    expect(contact.type).toBe('tel');
    expect(contact.value).toBe('+49 30 1234');
    expect(goals.value).toBe('');

    secret.focus();
    secret.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, modifierCapsLock: true }));
    s.tick();
    expect(app.password().capsLockOn()).toBe(true);

    secret.blur();
    s.tick();
    expect(app.password().capsLockOn()).toBe(false);
    expect(app.password().touched()).toBe(true);
  });

  it('renders the bound placeholder into native inputs', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativeBoundAttributesComponent);
    const inputs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('input'));

    s.tick();
    expect(inputs.map((input) => input.placeholder)).toEqual(['Team A', 'Team A', 'Team A']);

    fixture.componentInstance.hint.set('');
    s.tick();
    expect(inputs.map((input) => input.hasAttribute('placeholder'))).toEqual([false, false, false]);
  });

  it('renders the bound disabled, readonly and required state into native inputs', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativeBoundAttributesComponent);
    const app = fixture.componentInstance;
    const inputs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('input'));
    const states = () => inputs.map((input) => [input.disabled, input.readOnly, input.required]);

    s.tick();
    expect(states()).toEqual([
      [false, false, false],
      [false, false, false],
      [false, false, false],
    ]);

    app.locked.set(true);
    app.frozen.set(true);
    app.needed.set(true);
    s.tick();
    expect(states()).toEqual([
      [true, true, true],
      [true, true, true],
      [true, true, true],
    ]);

    app.locked.set(false);
    s.tick();
    expect(inputs.map((input) => input.disabled)).toEqual([false, false, false]);
  });

  it('renders the bound min, max and step into a native number input', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativeBoundAttributesComponent);
    const app = fixture.componentInstance;
    const goals = (fixture.nativeElement as HTMLElement).querySelectorAll('input')[1]!;

    s.tick();
    expect([goals.min, goals.max, goals.step]).toEqual(['0', '9', '0.5']);

    app.lowest.set(undefined);
    app.highest.set(3);
    app.stride.set(null);
    s.tick();
    expect(goals.hasAttribute('min')).toBe(false);
    expect(goals.max).toBe('3');
    expect(goals.hasAttribute('step')).toBe(false);
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

  it('renders the name, invalid state and description ids into native inputs', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativeRequiredInputsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const fields = Array.from(host.querySelectorAll('et-form-field'));
    const dirs = [app.text(), app.number(), app.password()];

    fields.forEach((formField, index) => {
      const input = query<HTMLInputElement>('input', formField);

      expect(input.getAttribute('name')).toBe(dirs[index]!.name() || null);
      expect(input.hasAttribute('aria-invalid')).toBe(false);
      expect(input.hasAttribute('aria-describedby')).toBe(false);

      input.focus();
      input.blur();
      s.tick();

      expect(input.getAttribute('aria-invalid')).toBe('true');
      const describedBy = input.getAttribute('aria-describedby')!;

      expect(query(`[id="${describedBy}"]`, formField).textContent).toContain('required');
    });

    s.flush();
  });

  it('keeps a static aria-describedby and a bound name on a native input', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativeBoundAttributesComponent);
    const club = (fixture.nativeElement as HTMLElement).querySelector('input')!;

    s.tick();
    expect(club.getAttribute('name')).toBe('club');
    expect(club.getAttribute('aria-describedby')).toBe('club-note');

    fixture.componentInstance.fieldName.set('');
    s.tick();
    expect(club.hasAttribute('name')).toBe(false);
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
