import { Component, Injector, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import { vi } from 'vitest';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { FormFieldComponent } from '../form-field/form-field.component';
import { LabelDirective } from '../form-field/headless';
import { InputDirective } from '../input/headless';
import { focusFirstInvalidField } from './focus-first-invalid-field';

@Component({
  template: `
    <et-form-field>
      <et-label>Last name</et-label>
      <input [formField]="nameForm.lastName" etInput />
    </et-form-field>

    <et-form-field>
      <et-label>First name</et-label>
      <input [formField]="nameForm.firstName" etInput />
    </et-form-field>
  `,
  imports: [FormFieldComponent, LabelDirective, InputDirective, FormField],
})
class NameFormTestHost {
  public model = signal({ firstName: '', lastName: '' });

  public nameForm = form(
    this.model,
    (s) => {
      required(s.firstName, { message: 'First name is required' });
      required(s.lastName, { message: 'Last name is required' });
    },
    { injector: TestBed.inject(Injector) },
  );
}

describe('focusFirstInvalidField', () => {
  let fixture: ComponentFixture<NameFormTestHost>;
  let scrollIntoView: ReturnType<typeof vi.fn>;
  let lastNameInput: HTMLInputElement;
  let firstNameInput: HTMLInputElement;

  beforeEach(() => {
    scrollIntoView = vi.fn();

    // jsdom has neither: no layout to scroll, and every element measures 0×0 - which the util reads
    // as "not rendered", so without this it skips every field
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
      writable: true,
    });
    Object.defineProperty(Element.prototype, 'getClientRects', {
      configurable: true,
      value: () => [new DOMRect(0, 0, 100, 20)] as unknown as DOMRectList,
      writable: true,
    });

    TestBed.configureTestingModule({
      imports: [NameFormTestHost],
      providers: [provideColorThemes([...TEST_COLOR_THEMES])],
    });

    fixture = TestBed.createComponent(NameFormTestHost);
    fixture.detectChanges();

    const inputs = fixture.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>;

    lastNameInput = inputs[0]!;
    firstNameInput = inputs[1]!;
  });

  it('takes the first invalid field in DOM order, not in field-tree order', () => {
    expect(focusFirstInvalidField(fixture.componentInstance.nameForm)).toBe(true);

    // `lastName` comes second in the form, but first in the template
    expect(document.activeElement).toBe(lastNameInput);
  });

  it('scrolls the whole field shell into view, not just the control', () => {
    focusFirstInvalidField(fixture.componentInstance.nameForm, { block: 'start' });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(fixture.nativeElement.querySelector('et-form-field'));
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
  });

  it('skips a field that is not rendered', () => {
    Object.defineProperty(lastNameInput, 'getClientRects', {
      configurable: true,
      value: () => [] as unknown as DOMRectList,
    });

    expect(focusFirstInvalidField(fixture.componentInstance.nameForm)).toBe(true);
    expect(document.activeElement).toBe(firstNameInput);
  });

  it('leaves focus alone when asked to', () => {
    focusFirstInvalidField(fixture.componentInstance.nameForm, { focus: false });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(document.body);
  });

  it('reports that it found nothing when the form is valid', () => {
    fixture.componentInstance.model.set({ firstName: 'Ada', lastName: 'Lovelace' });
    fixture.detectChanges();

    expect(focusFirstInvalidField(fixture.componentInstance.nameForm)).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
