import { Component, Directive, ElementRef, inject, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { INPUT_IMPORTS } from '../../input/input.imports';
import { MASKED_INPUT_IMPORTS } from '../masked-input.imports';
import { createCurrencyMask } from '../masks/currency-mask';
import { INPUT_MASK_HOST, InputMaskHost } from './input-mask-host';
import { InputMaskDirective } from './input-mask.directive';
import { MaskSpec, MaskValueMode } from './input-mask.types';

// a minimal non-InputDirective mask host - the generalized contract in action
@Directive({
  selector: '[etSbCustomMaskHost]',
  providers: [{ provide: INPUT_MASK_HOST, useExisting: CustomMaskHostDirective }],
})
class CustomMaskHostDirective implements InputMaskHost {
  public value = signal('');
  public focused = signal(false);
  public nativeControl = signal<HTMLInputElement | null>(null);
  public suppressed = false;

  constructor() {
    this.nativeControl.set(inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement);
  }

  public suppressNativeSync() {
    this.suppressed = true;
  }
}

@Component({
  template: `<input etInputMask="00-00" etSbCustomMaskHost />`,
  imports: [CustomMaskHostDirective, InputMaskDirective],
})
class CustomHostTestHost {}

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
  mask = signal<string | MaskSpec | null>('00-00-0000');
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

  it('exposes completeness for pattern masks and null for factory masks', async () => {
    const directive = fixture.debugElement.children[0]!.injector.get(InputMaskDirective);

    await focus();
    await type('1');
    expect(directive.complete()).toBe(false);

    for (const char of '2042026') {
      await type(char);
    }
    expect(directive.complete()).toBe(true);

    fixture.componentInstance.mask.set(createCurrencyMask());
    fixture.detectChanges();
    expect(directive.complete()).toBeNull();
  });

  it('is inert while the mask is null and takes over/hands back native sync on toggle', async () => {
    fixture.componentInstance.mask.set(null);
    fixture.detectChanges();
    await fixture.whenStable();

    // native sync is in charge - arbitrary text passes through untouched
    await focus();
    await type('a');
    await type('b');

    expect(element().value).toBe('ab');
    expect(fixture.componentInstance.value()).toBe('ab');

    // applying a mask takes over: the model is normalized through the new spec
    fixture.componentInstance.mask.set('00-00');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('');

    await type('1');
    await type('2');

    expect(element().value).toBe('12-');
    expect(fixture.componentInstance.value()).toBe('12');

    // back to null: the masked text is kept as-is and native sync resumes
    fixture.componentInstance.mask.set(null);
    fixture.detectChanges();
    await fixture.whenStable();

    await type('x');

    expect(element().value).toBe('12-x');
    expect(fixture.componentInstance.value()).toBe('12-x');
  });

  it('attaches to a custom INPUT_MASK_HOST provider (no et-input required)', async () => {
    const customFixture = TestBed.createComponent(CustomHostTestHost);

    customFixture.detectChanges();
    await customFixture.whenStable();

    const input = customFixture.nativeElement.querySelector('input') as HTMLInputElement;
    const host = customFixture.debugElement.children[0]!.injector.get(CustomMaskHostDirective);

    input.value = '1204';
    input.setSelectionRange(4, 4);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    await customFixture.whenStable();

    expect(input.value).toBe('12-04');
    expect(host.value()).toBe('1204');
    expect(host.suppressed).toBe(true);
  });
});
