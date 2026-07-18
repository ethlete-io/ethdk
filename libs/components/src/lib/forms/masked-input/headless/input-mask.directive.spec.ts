import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { INPUT_IMPORTS } from '../../input/input.imports';
import { MASKED_INPUT_IMPORTS } from '../masked-input.imports';
import { createCurrencyMask } from '../masks/currency-mask';
import { MaskSpec, MaskValueMode } from './input-mask.types';

@Component({
  template: `
    <et-input
      [etInputMask]="mask()"
      [maskValueMode]="mode()"
      [placeholderChar]="placeholderChar()"
      [value]="value()"
      (valueChange)="value.set($event)"
    />
  `,
  imports: [INPUT_IMPORTS, MASKED_INPUT_IMPORTS],
})
class MaskTestHost {
  mask = signal<string | MaskSpec>('00-00-0000');
  mode = signal<MaskValueMode>('raw');
  placeholderChar = signal<string | null>(null);
  value = signal('');
}

describe('InputMaskDirective', () => {
  let fixture: ComponentFixture<MaskTestHost>;

  const element = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;

  const focus = async () => {
    element().dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();
  };

  const edit = async (mutate: (el: HTMLInputElement) => void, inputType: string) => {
    const el = element();

    mutate(el);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType }));
    await fixture.whenStable();
  };

  const type = (char: string) =>
    edit((el) => {
      const caret = el.selectionStart ?? el.value.length;

      el.value = el.value.slice(0, caret) + char + el.value.slice(caret);
      el.setSelectionRange(caret + 1, caret + 1);
    }, 'insertText');

  const backspace = () =>
    edit((el) => {
      const caret = el.selectionStart ?? el.value.length;

      if (caret > 0) {
        el.value = el.value.slice(0, caret - 1) + el.value.slice(caret);
        el.setSelectionRange(caret - 1, caret - 1);
      }
    }, 'deleteContentBackward');

  const paste = (text: string) =>
    edit((el) => {
      el.value = text;
      el.setSelectionRange(text.length, text.length);
    }, 'insertFromPaste');

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [MaskTestHost] });
    fixture = TestBed.createComponent(MaskTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('masks typed characters, glides past literals and keeps the model raw', async () => {
    await focus();
    await type('3');
    await type('1');

    expect(element().value).toBe('31-');
    expect(element().selectionStart).toBe(3);
    expect(fixture.componentInstance.value()).toBe('31');

    await type('1');
    await type('2');
    await type('2');

    expect(element().value).toBe('31-12-2');
    expect(fixture.componentInstance.value()).toBe('31122');
  });

  it('rejects characters that do not fit the mask', async () => {
    await focus();
    await type('3');
    await type('x');

    expect(element().value).toBe('3');
    expect(fixture.componentInstance.value()).toBe('3');
  });

  it('extracts a pasted value through the mask', async () => {
    await focus();
    await paste('31.12.2024');

    expect(element().value).toBe('31-12-2024');
    expect(fixture.componentInstance.value()).toBe('31122024');
  });

  it('backspace over a literal deletes the content character before it', async () => {
    await focus();
    await paste('3112');

    expect(element().value).toBe('31-12-');

    element().setSelectionRange(3, 3);
    await backspace();

    expect(element().value).toBe('31-2');
    expect(element().selectionStart).toBe(1);
    expect(fixture.componentInstance.value()).toBe('312');
  });

  it('renders a programmatic (form) write masked while keeping the model raw', async () => {
    fixture.componentInstance.value.set('31122024');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element().value).toBe('31-12-2024');
    expect(fixture.componentInstance.value()).toBe('31122024');
  });

  it('normalizes a programmatic masked write down to the raw value', async () => {
    fixture.componentInstance.value.set('31-12-2024');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('31122024');
    expect(element().value).toBe('31-12-2024');
  });

  it('keeps the masked text as the model in masked mode', async () => {
    fixture.componentInstance.mode.set('masked');
    fixture.detectChanges();
    await fixture.whenStable();

    await focus();
    await type('3');
    await type('1');
    await type('1');

    expect(element().value).toBe('31-1');
    expect(fixture.componentInstance.value()).toBe('31-1');

    fixture.componentInstance.value.set('31122024');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('31-12-2024');
  });

  it('shows the guide display only while focused', async () => {
    fixture.componentInstance.placeholderChar.set('_');
    fixture.componentInstance.value.set('3112');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element().value).toBe('31-12-');

    await focus();

    expect(element().value).toBe('31-12-____');

    element().dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();

    expect(element().value).toBe('31-12-');
  });

  it('drives an end-anchored currency mask', async () => {
    fixture.componentInstance.mask.set(createCurrencyMask());
    fixture.detectChanges();
    await fixture.whenStable();

    await focus();
    await type('1');
    await type('2');
    await type('3');
    await type('4');

    expect(element().value).toBe('1.234');
    expect(element().selectionStart).toBe(5);
    expect(fixture.componentInstance.value()).toBe('1234');

    await type(',');
    await type('5');

    expect(element().value).toBe('1.234,5');
    expect(fixture.componentInstance.value()).toBe('1234,5');
  });
});
