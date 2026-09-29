import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, maxLength } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { INPUT_IMPORTS } from '../input';
import { FORM_FIELD_IMPORTS } from './form-field.imports';

@Component({
  template: `
    <et-form-field>
      <et-label>Bio</et-label>
      <et-input [formField]="bioForm.bio" />
      <et-counter [max]="max()" />
    </et-form-field>

    <et-form-field>
      <et-label>Handle</et-label>
      <et-input [formField]="handleForm.handle" />
      <et-counter />
    </et-form-field>

    <et-form-field>
      <et-label>Note</et-label>
      <et-input [formField]="noteForm.note" />
      <et-counter />
    </et-form-field>
  `,
  imports: [FORM_FIELD_IMPORTS, INPUT_IMPORTS, FormField],
})
class CounterHost {
  max = signal<number | undefined>(10);
  bio = signal({ bio: '' });
  handle = signal({ handle: '' });
  note = signal({ note: '' });

  bioForm = form(this.bio, (s) => maxLength(s.bio, 20));
  handleForm = form(this.handle, (s) => maxLength(s.handle, 5));
  noteForm = form(this.note);
}

describe('CounterComponent', () => {
  const setup = () => {
    TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

    const fixture = TestBed.createComponent(CounterHost);
    const host = fixture.componentInstance;
    const counters = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('et-counter'));
    const text = (counter: HTMLElement) => counter.querySelector('[aria-hidden]')?.textContent?.trim();
    const announcement = (counter: HTMLElement) =>
      counter.querySelector('.et-counter-announcement')?.textContent?.trim() ?? '';
    const type = (index: number, value: string) => {
      const input = (fixture.nativeElement as HTMLElement).querySelectorAll('input')[index]!;

      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
    };

    fixture.detectChanges();

    return { fixture, host, counters, text, announcement, type };
  };

  it('counts towards the explicit max and stays quiet below 90 percent', () => {
    const { counters, text, announcement, type } = setup();

    type(0, 'abcde');

    const [bio] = counters();

    expect(text(bio!)).toBe('5 / 10');
    expect(bio!.hasAttribute('data-over-limit')).toBe(false);
    expect(announcement(bio!)).toBe('');
  });

  it('announces the remaining characters near the limit and the limit once reached', () => {
    const { counters, announcement, type } = setup();

    type(0, 'abcdefghi');
    expect(announcement(counters()[0]!)).toBe('1 characters remaining');

    type(0, 'abcdefghij');
    expect(announcement(counters()[0]!)).toBe('Character limit of 10 reached');
  });

  it('flags and announces an over-limit value against the explicit max', () => {
    const { counters, text, announcement, type } = setup();

    type(0, 'abcdefghijkl');

    const [bio] = counters();

    expect(text(bio!)).toBe('12 / 10');
    expect(bio!.hasAttribute('data-over-limit')).toBe(true);
    expect(announcement(bio!)).toBe('2 characters over the limit of 10');
  });

  it('prefers the explicit max over the schema maxLength', () => {
    const { host, counters, text, fixture } = setup();

    host.max.set(3);
    fixture.detectChanges();

    expect(text(counters()[0]!)).toBe('0 / 3');
  });

  it('falls back to the schema maxLength and reads over-limit from its validation error', () => {
    const { counters, text, announcement, type } = setup();

    type(1, 'abcdef');

    const handle = counters()[1]!;

    expect(text(handle)).toBe('6 / 5');
    expect(handle.hasAttribute('data-over-limit')).toBe(true);
    expect(announcement(handle)).toBe('1 characters over the limit of 5');
  });

  it('renders the bare count without any limit', () => {
    const { counters, text, announcement, type } = setup();

    type(2, 'hello');

    const note = counters()[2]!;

    expect(text(note)).toBe('5');
    expect(announcement(note)).toBe('');
  });
});
