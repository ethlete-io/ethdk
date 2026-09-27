import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, maxLength, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import { FORM_FIELD_IMPORTS, TextareaComponent, TextareaDirective } from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-match-report',
  imports: [FORM_FIELD_IMPORTS, TextareaComponent, FormField],
  template: `
    <et-form-field>
      <et-label>Report</et-label>
      <et-textarea [formField]="report.summary" autosize="false" placeholder="What happened?" rows="5" />
    </et-form-field>
  `,
})
class MatchReportComponent {
  model = signal({ summary: '' });
  report = form(this.model, (path) => {
    maxLength(path.summary, 10, { message: 'Keep it short' });
  });
  textarea = viewChild.required(TextareaComponent);
}

@Component({
  selector: 'et-scenario-native-notes',
  imports: [TextareaDirective],
  template: `<textarea [(value)]="notes" autosize="false" etTextarea aria-label="Notes" rows="2"></textarea>`,
})
class NativeNotesComponent {
  notes = signal('Half time');
  textarea = viewChild.required(TextareaDirective);
}

@Component({
  selector: 'et-scenario-native-bound-notes',
  imports: [TextareaDirective],
  template: `
    <textarea
      [placeholder]="hint()"
      [disabled]="locked()"
      [readonly]="frozen()"
      [required]="needed()"
      autosize="false"
      etTextarea
      aria-label="Notes"
    ></textarea>
  `,
})
class NativeBoundNotesComponent {
  hint = signal('What happened?');
  locked = signal(false);
  frozen = signal(false);
  needed = signal(false);
}

@Component({
  selector: 'et-scenario-native-required-notes',
  imports: [FORM_FIELD_IMPORTS, TextareaDirective, FormField],
  template: `
    <et-form-field>
      <et-label>Notes</et-label>
      <textarea [formField]="report.notes" autosize="false" etTextarea></textarea>
    </et-form-field>
  `,
})
class NativeRequiredNotesComponent {
  model = signal({ notes: '' });
  report = form(this.model, (path) => {
    required(path.notes, { message: 'Notes are required' });
  });
  textarea = viewChild.required(TextareaDirective);
}

const typeInto = (s: Scenario, textarea: HTMLTextAreaElement, value: string) => {
  textarea.focus();
  textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

describe('textarea scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] });

  it('writes typed text into the form, focuses from the component and shows the error on blur', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MatchReportComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const textarea = host.querySelector('textarea')!;

    expect(textarea.rows).toBe(5);
    expect(textarea.placeholder).toBe('What happened?');
    expect(textarea.getAttribute('data-resize')).toBe('vertical');
    expect(host.querySelector(`#${textarea.getAttribute('aria-labelledby')}`)?.textContent).toContain('Report');

    app.textarea().focus();
    expect(document.activeElement).toBe(textarea);

    typeInto(s, textarea, 'A long first half');
    expect(app.model().summary).toBe('A long first half');

    textarea.blur();
    s.tick();

    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(host.textContent).toContain('Keep it short');

    app.model.set({ summary: 'Draw' });
    s.tick();

    expect(textarea.value).toBe('Draw');
    expect(textarea.hasAttribute('aria-invalid')).toBe(false);
    s.flush();
  });

  it('keeps a native textarea and its two-way value in sync', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativeNotesComponent);
    const app = fixture.componentInstance;
    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;

    s.tick();

    expect(app.textarea().nativeControl()).toBe(textarea);
    expect(app.textarea().value()).toBe('Half time');

    typeInto(s, textarea, 'Full time');

    expect(app.notes()).toBe('Full time');
    expect(app.textarea().hasValue()).toBe(true);
  });

  it('marks a native textarea touched on blur and shows its signal-form error', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativeRequiredNotesComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;
    const textarea = host.querySelector('textarea')!;

    s.tick();

    textarea.focus();
    s.tick();
    expect(app.textarea().focused()).toBe(true);
    expect(host.querySelector('et-form-error')).toBeNull();

    textarea.blur();
    s.tick();
    expect(app.textarea().focused()).toBe(false);
    expect(app.report.notes().touched()).toBe(true);
    expect(host.querySelector('et-form-error')?.textContent).toContain('Notes are required');
    s.flush();
  });

  it('renders the bound value into a native textarea', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativeNotesComponent);
    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;

    s.tick();

    expect(textarea.value).toBe('Half time');

    fixture.componentInstance.notes.set('Full time');
    s.tick();
    expect(textarea.value).toBe('Full time');
  });

  it('renders the bound placeholder into a native textarea', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativeBoundNotesComponent);
    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;

    s.tick();
    expect(textarea.placeholder).toBe('What happened?');

    fixture.componentInstance.hint.set('');
    s.tick();
    expect(textarea.hasAttribute('placeholder')).toBe(false);
  });

  it('renders the bound disabled, readonly and required state into a native textarea', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativeBoundNotesComponent);
    const app = fixture.componentInstance;
    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;

    s.tick();
    expect([textarea.disabled, textarea.readOnly, textarea.required]).toEqual([false, false, false]);

    app.locked.set(true);
    app.frozen.set(true);
    app.needed.set(true);
    s.tick();
    expect([textarea.disabled, textarea.readOnly, textarea.required]).toEqual([true, true, true]);
  });
});
