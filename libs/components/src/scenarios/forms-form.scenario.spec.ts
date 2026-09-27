import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FieldTree, form, FormField, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import {
  FORM_FIELD_IMPORTS,
  FORM_IMPORTS,
  focusFirstInvalidField,
  FormDirective,
  INPUT_IMPORTS,
  TEXTAREA_IMPORTS,
  TEXTAREA_RESIZE_MODES,
  TextareaResizeMode,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { useScenario } from './harness';

type Feedback = { name: string; comment: string };

@Component({
  selector: 'et-scenario-feedback-form',
  imports: [FORM_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS, TEXTAREA_IMPORTS, FormField],
  template: `
    <form [etForm]="feedback">
      <et-form-field class="comment">
        <et-label>Comment</et-label>
        <et-textarea [formField]="feedback.comment" [autosize]="autosize()" [resize]="resize()" rows="4" />
      </et-form-field>
      <et-form-field class="name">
        <et-label>Name</et-label>
        <et-input [formField]="feedback.name" />
      </et-form-field>
      <button type="submit">Send</button>
    </form>
  `,
})
class FeedbackFormComponent {
  autosize = signal(true);
  resize = signal<TextareaResizeMode>(TEXTAREA_RESIZE_MODES.VERTICAL);
  model = signal<Feedback>({ name: '', comment: '' });
  sent: Feedback[] = [];
  feedback = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Name is required' });
      required(path.comment, { message: 'Tell us something' });
    },
    {
      submission: {
        action: async (field: FieldTree<Feedback>) => {
          this.sent.push(field().value());

          return undefined;
        },
      },
    },
  );
}

@Component({
  selector: 'et-scenario-signup-steps',
  imports: [FormDirective, FORM_FIELD_IMPORTS, INPUT_IMPORTS, FormField],
  template: `
    <form [etForm]="signup">
      @if (showEmail()) {
        <et-form-field class="email">
          <et-label>Email</et-label>
          <et-input [formField]="signup.email" />
        </et-form-field>
      }
      <et-form-field class="team">
        <et-label>Team</et-label>
        <et-input [formField]="signup.team" />
      </et-form-field>
    </form>
  `,
})
class SignupStepsComponent {
  showEmail = signal(false);
  model = signal({ email: '', team: '' });
  signup = form(this.model, (path) => {
    required(path.email, { message: 'Email is required' });
    required(path.team, { message: 'Team is required' });
  });
  formDirective = viewChild.required(FormDirective);
}

describe('form scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] });
  const scrolled: Element[] = [];

  beforeEach(() => {
    scrolled.length = 0;
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value(this: Element) {
        scrolled.push(this);
      },
    });
    Object.defineProperty(Element.prototype, 'getClientRects', {
      configurable: true,
      writable: true,
      value: () => [new DOMRect(0, 0, 100, 20)],
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    Reflect.deleteProperty(Element.prototype, 'getClientRects');
  });

  it('submits without native validation and lands on the first invalid field in DOM order', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(FeedbackFormComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const formElement = host.querySelector('form')!;

    expect(formElement.hasAttribute('novalidate')).toBe(true);

    host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await s.settle();

    expect(fixture.componentInstance.sent).toEqual([]);
    expect(fixture.componentInstance.feedback.name().touched()).toBe(true);
    expect(host.querySelector('.comment et-form-error, .comment .et-form-field-errors')?.textContent).toContain(
      'Tell us something',
    );
    expect(host.querySelector('.name')?.textContent).toContain('Name is required');
    expect(scrolled).toEqual([host.querySelector('et-form-field.comment')]);
    expect(document.activeElement).toBe(host.querySelector('.comment textarea'));
  });

  it('sends the typed values through the form action, once, without a page submit', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(FeedbackFormComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const textarea = host.querySelector<HTMLTextAreaElement>('textarea')!;
    const input = host.querySelector<HTMLInputElement>('.name input')!;

    textarea.value = 'Great match';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = 'Ada';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    s.tick();

    const event = new Event('submit', { bubbles: true, cancelable: true });
    host.querySelector('form')!.dispatchEvent(event);
    await s.settle();

    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.sent).toEqual([{ name: 'Ada', comment: 'Great match' }]);
    expect(scrolled).toEqual([]);
  });

  it('honours the resize mode only once the textarea stops autosizing', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(FeedbackFormComponent);
    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;

    s.tick();

    expect(textarea.rows).toBe(4);
    expect(textarea.getAttribute('data-resize')).toBe(TEXTAREA_RESIZE_MODES.NONE);

    fixture.componentInstance.autosize.set(false);
    s.tick();

    expect(textarea.getAttribute('data-resize')).toBe(TEXTAREA_RESIZE_MODES.VERTICAL);

    fixture.componentInstance.resize.set(TEXTAREA_RESIZE_MODES.NONE);
    s.tick();

    expect(textarea.getAttribute('data-resize')).toBe('none');
    s.flush();
  });

  it('lands a hand-written submit on the first rendered invalid field', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SignupStepsComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    expect(app.formDirective().field()).toBe(app.signup);
    expect(focusFirstInvalidField(app.signup, { focus: false, behavior: 'auto' })).toBe(true);
    expect(scrolled).toEqual([host.querySelector('et-form-field.team')]);
    expect(document.activeElement).not.toBe(host.querySelector('.team input'));

    app.showEmail.set(true);
    s.tick();

    expect(focusFirstInvalidField(app.signup)).toBe(true);
    expect(scrolled.at(-1)).toBe(host.querySelector('et-form-field.email'));
    expect(document.activeElement).toBe(host.querySelector('.email input'));

    app.model.set({ email: 'coach@team-a.test', team: 'team-a' });
    s.tick();

    expect(focusFirstInvalidField(app.signup)).toBe(false);
    expect(scrolled.length).toBe(2);
    s.flush();
  });
});
