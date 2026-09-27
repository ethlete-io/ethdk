import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, maxLength } from '@angular/forms/signals';
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

  it.fails('renders the bound value into a native textarea', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativeNotesComponent);
    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;

    s.tick();

    expect(textarea.value).toBe('Half time');
  });
});
