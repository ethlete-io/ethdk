import { Component, Directive, ElementRef, inject, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import {
  createCardMask,
  createCurrencyMask,
  createIbanMask,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  INPUT_MASK_HOST,
  InputMaskDirective,
  InputMaskHost,
  MASK_VALUE_MODES,
  MASKED_INPUT_ERROR_CODES,
  MASKED_INPUT_IMPORTS,
  MaskSpec,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const code = (value: number) => `ET${value}`;

const field = (selector: string) => {
  const element = document.querySelector<HTMLInputElement>(`${selector} input`) ?? document.querySelector(selector);

  if (!(element instanceof HTMLInputElement)) throw new Error(`No input in ${selector}`);

  return element;
};

const settle = (s: Scenario) => {
  s.tick();
  s.frame(3);
};

const edit = (s: Scenario, element: HTMLInputElement, mutate: () => void, inputType: string) => {
  mutate();
  element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType }));
  settle(s);
};

const type = (s: Scenario, element: HTMLInputElement, chars: string) => {
  for (const char of chars) {
    edit(
      s,
      element,
      () => {
        const caret = element.selectionStart ?? element.value.length;

        element.value = element.value.slice(0, caret) + char + element.value.slice(caret);
        element.setSelectionRange(caret + 1, caret + 1);
      },
      'insertText',
    );
  }
};

const paste = (s: Scenario, element: HTMLInputElement, text: string) =>
  edit(
    s,
    element,
    () => {
      element.value = text;
      element.setSelectionRange(text.length, text.length);
    },
    'insertFromPaste',
  );

const focus = (s: Scenario, element: HTMLInputElement) => {
  element.focus();
  element.dispatchEvent(new FocusEvent('focus'));
  settle(s);
};

const blur = (s: Scenario, element: HTMLInputElement) => {
  element.blur();
  element.dispatchEvent(new FocusEvent('blur'));
  settle(s);
};

@Component({
  selector: 'et-scenario-payment-form',
  imports: [INPUT_IMPORTS, FORM_FIELD_IMPORTS, MASKED_INPUT_IMPORTS, FormField],
  template: `
    <et-form-field class="birthday">
      <et-label>Birthday</et-label>
      <et-input
        #birthdayMask="etInputMask"
        [formField]="payment.birthday"
        etInputMask="00.00.0000"
        placeholderChar="_"
      />
    </et-form-field>
    <et-form-field class="iban">
      <et-label>IBAN</et-label>
      <et-input [formField]="payment.iban" [etInputMask]="ibanMask" [maskValueMode]="maskedMode" />
    </et-form-field>
    <et-form-field class="card">
      <et-label>Card</et-label>
      <et-input [formField]="payment.card" [etInputMask]="cardMask" />
    </et-form-field>
    <et-form-field class="amount">
      <et-label>Amount</et-label>
      <et-input [formField]="payment.amount" [etInputMask]="amountMask()" />
    </et-form-field>
  `,
})
class PaymentFormComponent {
  birthdayMask = viewChild.required<InputMaskDirective>('birthdayMask');
  ibanMask = createIbanMask();
  cardMask = createCardMask();
  maskedMode = MASK_VALUE_MODES.MASKED;
  amountMask = signal<MaskSpec | null>(createCurrencyMask({ prefix: '€ ', allowNegative: true }));
  model = signal({ birthday: '', iban: '', card: '', amount: '' });
  payment = form(this.model, (path) => {
    required(path.birthday);
  });
}

@Directive({
  selector: 'input[etScenarioPinField]',
  providers: [{ provide: INPUT_MASK_HOST, useExisting: PinFieldDirective }],
  host: {
    '(focus)': 'focused.set(true)',
    '(blur)': 'focused.set(false)',
  },
})
class PinFieldDirective implements InputMaskHost {
  value = signal('');
  focused = signal(false);
  nativeControl = signal<HTMLInputElement | null>(inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement);
  suppressNativeSync() {
    return;
  }
}

@Component({
  selector: 'et-scenario-pin',
  imports: [PinFieldDirective, InputMaskDirective],
  template: `<input #pin="etInputMask" class="pin" aria-label="PIN" etInputMask="000 000" etScenarioPinField />`,
})
class PinComponent {
  pinField = viewChild.required(PinFieldDirective);
  pin = viewChild.required<InputMaskDirective>('pin');
}

@Component({
  selector: 'et-scenario-stray-mask',
  imports: [InputMaskDirective],
  template: `<input class="stray" aria-label="Stray" etInputMask="00" />`,
})
class StrayMaskComponent {}

@Component({
  selector: 'et-scenario-keyboard-hints',
  imports: [INPUT_IMPORTS, MASKED_INPUT_IMPORTS],
  template: `
    <et-input [etInputMask]="codeMask()" class="code" aria-label="Code" />
    <input
      [etInputMask]="codeMask()"
      class="consumer"
      aria-label="Consumer"
      etInput
      inputmode="decimal"
      autocorrect="on"
      spellcheck="true"
    />
  `,
})
class KeyboardHintsComponent {
  codeMask = signal<string | null>('00-00-0000');
}

describe('forms masked-input scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

  it('types a birthday through a guided pattern mask and keeps the form value raw', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PaymentFormComponent);
    const page = fixture.componentInstance;

    settle(s);

    const input = field('.birthday');

    expect(page.payment.birthday().valid()).toBe(false);

    focus(s, input);
    type(s, input, '31');

    expect(input.value).toBe('31.__.____');
    expect(input.selectionStart).toBe(3);
    expect(page.model().birthday).toBe('31');
    expect(page.birthdayMask().complete()).toBe(false);

    type(s, input, '1x2');
    expect(input.value).toBe('31.12.____');
    expect(page.model().birthday).toBe('3112');

    type(s, input, '2024');
    expect(input.value).toBe('31.12.2024');
    expect(page.birthdayMask().rawValue()).toBe('31122024');
    expect(page.birthdayMask().complete()).toBe(true);
    expect(page.payment.birthday().valid()).toBe(true);

    input.setSelectionRange(6, 6);
    edit(
      s,
      input,
      () => {
        input.value = input.value.slice(0, 5) + input.value.slice(6);
        input.setSelectionRange(5, 5);
      },
      'deleteContentBackward',
    );
    expect(page.model().birthday).toBe('3112024');
    expect(page.birthdayMask().complete()).toBe(false);

    blur(s, input);
    expect(input.value).toBe('31.12.024');
  });

  it('renders a loaded model masked and normalizes a masked write back to raw', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PaymentFormComponent);
    const page = fixture.componentInstance;

    page.model.set({
      birthday: '01.02.2003',
      iban: 'de89370400440532013000',
      card: '4111111111111111',
      amount: '1234,5',
    });
    settle(s);

    expect(page.model().birthday).toBe('01022003');
    expect(field('.birthday').value).toBe('01.02.2003');
    expect(page.model().iban).toBe('DE89 3704 0044 0532 0130 00');
    expect(field('.iban').value).toBe('DE89 3704 0044 0532 0130 00');
    expect(field('.card').value).toBe('4111 1111 1111 1111');
    expect(page.model().card).toBe('4111111111111111');
    expect(field('.amount').value).toBe('€ 1.234,5');
    expect(page.model().amount).toBe('1234,5');
  });

  it('uppercases a pasted IBAN, caps a card number and grows an amount from the right', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PaymentFormComponent);
    const page = fixture.componentInstance;

    settle(s);

    const iban = field('.iban');

    focus(s, iban);
    paste(s, iban, 'de89 3704-0044.0532 0130 00');
    expect(iban.value).toBe('DE89 3704 0044 0532 0130 00');
    expect(page.model().iban).toBe('DE89 3704 0044 0532 0130 00');

    const card = field('.card');

    focus(s, card);
    paste(s, card, '4111-1111-1111-1111-9999');
    expect(page.model().card).toBe('4111111111111111999');
    expect(card.value).toBe('4111 1111 1111 1111 999');

    const amount = field('.amount');

    focus(s, amount);
    type(s, amount, '-1234,567');
    expect(amount.value).toBe('€ -1.234,56');
    expect(page.model().amount).toBe('-1234,56');
    expect(Number(page.model().amount.replace(',', '.'))).toBe(-1234.56);
  });

  it('waits for an IME composition to end before masking', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PaymentFormComponent);

    settle(s);

    const card = field('.card');

    focus(s, card);
    card.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    card.value = '12３4';
    card.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', isComposing: true }),
    );
    settle(s);

    expect(card.value).toBe('12３4');
    expect(fixture.componentInstance.model().card).toBe('');

    card.value = '12345';
    card.setSelectionRange(5, 5);
    card.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '345' }));
    settle(s);

    expect(card.value).toBe('1234 5');
    expect(fixture.componentInstance.model().card).toBe('12345');
  });

  it('keeps a composition that starts before the previous keystroke rendered', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PaymentFormComponent);

    settle(s);

    const card = field('.card');

    focus(s, card);
    type(s, card, '123');

    const insertAtCaret = (text: string) => {
      const caret = card.selectionStart ?? card.value.length;

      card.value = card.value.slice(0, caret) + text + card.value.slice(caret);
      card.setSelectionRange(caret + text.length, caret + text.length);
    };

    insertAtCaret('4');
    card.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '4' }));
    card.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    insertAtCaret('5');
    card.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: '5', isComposing: true }),
    );
    settle(s);

    expect(card.value).toBe('12345');
    expect(fixture.componentInstance.model().card).toBe('1234');

    card.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '5' }));
    settle(s);

    expect(card.value).toBe('1234 5');
    expect(fixture.componentInstance.model().card).toBe('12345');
  });

  it('switches a mask off at runtime and hands the value back to the input', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PaymentFormComponent);
    const page = fixture.componentInstance;

    settle(s);

    const amount = field('.amount');

    page.amountMask.set(null);
    settle(s);

    focus(s, amount);
    type(s, amount, 'n/a');
    expect(amount.value).toBe('n/a');
    expect(page.model().amount).toBe('n/a');

    page.amountMask.set(createCurrencyMask({ suffix: ' €' }));
    settle(s);
    settle(s);

    expect(page.model().amount).toBe('');
    type(s, amount, '5');
    expect(page.model().amount).toBe('5');
    expect(amount.value).toBe('5 €');
  });

  it('masks a custom field that provides INPUT_MASK_HOST', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PinComponent);
    const page = fixture.componentInstance;

    settle(s);

    const input = field('.pin');

    focus(s, input);
    type(s, input, '123456');

    expect(input.value).toBe('123 456');
    expect(page.pinField().value()).toBe('123456');
    expect(page.pin().complete()).toBe(true);
  });

  it('reports a mask placed on an element that is not an input control', () => {
    const s = scenario();

    TestBed.createComponent(StrayMaskComponent);
    s.tick(1);

    s.expectError(code(MASKED_INPUT_ERROR_CODES.MASK_OUTSIDE_INPUT));

    const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');
    const context = s.errors.splice(index, 1)[0]?.error as { element?: HTMLElement } | undefined;

    expect(context?.element).toBe(document.querySelector('.stray'));
  });

  it('turns off autocorrect and asks for a numeric keyboard while a digit-only mask is attached', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(KeyboardHintsComponent);
    const page = fixture.componentInstance;

    settle(s);

    const input = field('.code');
    const hints = () => ({
      autocorrect: input.getAttribute('autocorrect'),
      autocapitalize: input.getAttribute('autocapitalize'),
      spellcheck: input.getAttribute('spellcheck'),
      inputmode: input.getAttribute('inputmode'),
    });

    expect(hints()).toEqual({ autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', inputmode: 'numeric' });

    page.codeMask.set('aaa-000');
    settle(s);

    expect(hints()).toEqual({ autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', inputmode: null });

    page.codeMask.set(null);
    settle(s);

    expect(hints()).toEqual({ autocorrect: null, autocapitalize: null, spellcheck: null, inputmode: null });

    page.codeMask.set('000');
    settle(s);

    expect(hints().inputmode).toBe('numeric');
  });

  it('keeps keyboard hints the consumer set on the native input', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(KeyboardHintsComponent);
    const page = fixture.componentInstance;

    settle(s);

    const input = field('.consumer');

    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(input.getAttribute('autocorrect')).toBe('on');
    expect(input.getAttribute('spellcheck')).toBe('true');
    expect(input.getAttribute('autocapitalize')).toBe('off');

    page.codeMask.set(null);
    settle(s);

    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(input.getAttribute('autocorrect')).toBe('on');
    expect(input.getAttribute('spellcheck')).toBe('true');
    expect(input.getAttribute('autocapitalize')).toBeNull();
  });
});
