import { Component, Injector, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FieldTree, form, FormField, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import { vi } from 'vitest';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { FormFieldComponent } from '../form-field/form-field.component';
import { LabelDirective } from '../form-field/headless';
import { InputComponent } from '../input';
import { FormDirective } from './form.directive';

type ProfileModel = { name: string };

@Component({
  template: `
    <form [etForm]="profileForm">
      <et-form-field>
        <et-label>Name</et-label>
        <et-input [formField]="profileForm.name" />
      </et-form-field>

      <button type="submit">Save</button>
    </form>
  `,
  imports: [FormDirective, FormFieldComponent, LabelDirective, InputComponent, FormField],
})
class ProfileFormTestHost {
  public model = signal<ProfileModel>({ name: '' });
  public saved: ProfileModel[] = [];

  public profileForm = form(
    this.model,
    (s) => {
      required(s.name, { message: 'Name is required' });
    },
    {
      injector: TestBed.inject(Injector),
      submission: {
        action: async (field: FieldTree<ProfileModel>) => {
          this.saved.push(field().value());

          return undefined;
        },
      },
    },
  );
}

describe('FormDirective', () => {
  let fixture: ComponentFixture<ProfileFormTestHost>;
  let host: ProfileFormTestHost;
  let formElement: HTMLFormElement;

  const submitForm = async () => {
    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
  };

  beforeEach(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
      writable: true,
    });
    Object.defineProperty(Element.prototype, 'getClientRects', {
      configurable: true,
      value: () => [new DOMRect(0, 0, 100, 20)] as unknown as DOMRectList,
      writable: true,
    });

    TestBed.configureTestingModule({
      imports: [ProfileFormTestHost],
      providers: [provideColorThemes([...TEST_COLOR_THEMES])],
    });

    fixture = TestBed.createComponent(ProfileFormTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();

    formElement = fixture.nativeElement.querySelector('form') as HTMLFormElement;
  });

  it('takes the native validation off the form', () => {
    expect(formElement.hasAttribute('novalidate')).toBe(true);
  });

  it('keeps the browser from submitting the form itself', () => {
    const event = new Event('submit', { bubbles: true, cancelable: true });

    formElement.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('shows every error and lands on the first one when the form is invalid', async () => {
    await submitForm();
    fixture.detectChanges();

    expect(host.saved).toEqual([]);
    expect(host.profileForm.name().touched()).toBe(true);
    expect(fixture.nativeElement.querySelector('et-form-error')?.textContent).toContain('Name is required');
    // the control component is what carries `[formField]`, so the focus has to reach the native input inside it
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('et-input input'));
  });

  it("runs the form's own submission action when it is valid", async () => {
    host.model.set({ name: 'Ada' });
    fixture.detectChanges();

    await submitForm();

    expect(host.saved).toEqual([{ name: 'Ada' }]);
  });
});
