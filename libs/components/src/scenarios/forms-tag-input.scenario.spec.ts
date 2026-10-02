import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, maxLength } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import {
  FORM_FIELD_IMPORTS,
  TAG_INPUT_ERROR_CODES,
  TAG_INPUT_IMPORTS,
  TagInputComponent,
  TagInputDirective,
  TagInputFieldDirective,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-team-tags',
  imports: [FORM_FIELD_IMPORTS, TAG_INPUT_IMPORTS, FormField],
  template: `
    <form (submit)="$event.preventDefault(); submits = submits + 1">
      <et-form-field>
        <et-label>Tags</et-label>
        <et-tag-input
          [formField]="team.tags"
          [maxTags]="maxTags()"
          [normalizeTag]="lowercase"
          [separators]="separators()"
          placeholder="Add a tag"
        />
      </et-form-field>
    </form>
  `,
})
class TeamTagsComponent {
  model = signal({ tags: ['team-a'] });
  team = form(this.model, (path) => maxLength(path.tags, 4, { message: 'Pick up to 4 tags' }));
  maxTags = signal<number | undefined>(undefined);
  separators = signal(['Enter', ',']);
  submits = 0;
  lowercase = (raw: string) => raw.trim().toLowerCase() || null;
}

@Component({
  selector: 'et-scenario-stray-tag-field',
  imports: [TAG_INPUT_IMPORTS],
  template: `<input class="stray" etTagInputField aria-label="Stray" />`,
})
class StrayTagFieldComponent {}

@Component({
  selector: 'et-scenario-custom-tags',
  imports: [TagInputComponent, TagInputDirective, TagInputFieldDirective],
  template: `
    <et-tag-input [(value)]="labels" [readonly]="readonly()" class="labels" aria-label="Labels" />
    <div #tags="etTagInput" [(value)]="skills" [separators]="[';']" [maxTags]="2" class="skills" etTagInput>
      @for (skill of tags.effectiveValues(); track skill) {
        <button (click)="tags.remove(skill)" class="skill" type="button">{{ skill }}</button>
      }
      <input class="skill-field" etTagInputField aria-label="Skills" />
    </div>
  `,
})
class CustomTagsComponent {
  labels = signal(['keeper']);
  skills = signal<string[]>([]);
  readonly = signal(false);
  labelInput = viewChild.required(TagInputComponent);
  skillInput = viewChild.required('tags', { read: TagInputDirective });
  skillField = viewChild.required(TagInputFieldDirective);
}

const code = (value: number) => `ET${value}`;

const field = () => document.querySelector<HTMLInputElement>('.et-tag-input-field')!;

const chips = () =>
  Array.from(document.querySelectorAll('et-tag-input et-chip')).map((chip) =>
    chip.textContent?.replace(/\s+/g, ' ').trim(),
  );

const type = (s: Scenario, text: string) => {
  for (const char of text) {
    field().value += char;
    field().dispatchEvent(new Event('input', { bubbles: true }));
  }

  s.tick();
  s.frame(2);
};

const paste = (s: Scenario, text: string) => {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;

  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  field().dispatchEvent(event);
  s.tick();

  return event;
};

const render = (s: Scenario) => {
  const fixture = TestBed.createComponent(TeamTagsComponent);

  document.body.appendChild(fixture.nativeElement);
  s.tick();
  s.frame(2);

  return fixture;
};

describe('tag input scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] });

  it('commits tags on a comma, Enter and blur, normalized and without duplicates', () => {
    const s = scenario();
    const fixture = render(s);
    const page = fixture.componentInstance;

    expect(chips()).toEqual(['team-a']);
    expect(field().getAttribute('placeholder')).toBe('Add a tag');
    expect(field().getAttribute('aria-labelledby')).toBe(document.querySelector('et-label')?.id);

    type(s, 'Forward,');
    expect(field().value).toBe('');
    expect(page.model().tags).toEqual(['team-a', 'forward']);

    type(s, 'TEAM-A');
    expect(s.keydown('Enter', field()).defaultPrevented).toBe(true);
    s.tick();

    expect(page.model().tags).toEqual(['team-a', 'forward']);
    expect(field().value).toBe('TEAM-A');

    field().value = 'Keeper';
    field().dispatchEvent(new Event('input'));
    field().dispatchEvent(new Event('blur'));
    s.tick();

    expect(chips()).toEqual(['team-a', 'forward', 'keeper']);
    expect(field().value).toBe('');
    expect(page.team.tags().touched()).toBe(true);

    expect(s.keydown('Enter', field()).defaultPrevented).toBe(false);
  });

  it('splits a paste, removes the last tag on Backspace and through a chip', () => {
    const s = scenario();
    const fixture = render(s);
    const page = fixture.componentInstance;

    expect(paste(s, 'Left wing, Right wing\nStriker').defaultPrevented).toBe(true);
    expect(page.model().tags).toEqual(['team-a', 'left wing', 'right wing', 'striker']);

    expect(paste(s, 'single').defaultPrevented).toBe(false);

    s.keydown('Backspace', field());
    s.tick();
    expect(page.model().tags).toEqual(['team-a', 'left wing', 'right wing']);

    document.querySelector<HTMLButtonElement>('et-tag-input et-chip .et-chip-remove-button')!.click();
    s.tick();
    expect(chips()).toEqual(['left wing', 'right wing']);
  });

  it('focuses the text field once the last chip is removed through its remove button', () => {
    const s = scenario();
    const fixture = render(s);
    const removeButton = document.querySelector<HTMLButtonElement>('et-tag-input et-chip .et-chip-remove-button')!;

    removeButton.focus();
    removeButton.click();
    s.tick();

    expect(fixture.componentInstance.model().tags).toEqual([]);
    expect(document.activeElement).toBe(field());
  });

  it('locks the field once maxTags is reached', () => {
    const s = scenario();
    const fixture = render(s);
    const page = fixture.componentInstance;

    page.maxTags.set(2);
    s.tick();

    type(s, 'one,');
    expect(page.model().tags).toEqual(['team-a', 'one']);
    expect(field().readOnly).toBe(true);

    type(s, 'two,');
    expect(page.model().tags).toEqual(['team-a', 'one']);

    s.keydown('Backspace', field());
    s.tick();
    expect(field().readOnly).toBe(false);
  });

  it('uses only the separators the app configures', () => {
    const s = scenario();
    const fixture = render(s);
    const page = fixture.componentInstance;

    page.separators.set(['Tab', ';']);
    s.tick();

    type(s, 'a,b;');
    expect(page.model().tags).toEqual(['team-a', 'a,b']);

    type(s, 'c');
    expect(s.keydown('Tab', field()).defaultPrevented).toBe(true);
    s.tick();
    expect(page.model().tags).toEqual(['team-a', 'a,b', 'c']);
  });

  it('reports a tag field outside a tag input', () => {
    const s = scenario();

    TestBed.createComponent(StrayTagFieldComponent);
    s.tick(1);

    s.expectError(code(TAG_INPUT_ERROR_CODES.FIELD_OUTSIDE_TAG_INPUT));

    const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');
    const context = s.errors.splice(index, 1)[0]?.error as { element?: HTMLElement } | undefined;

    expect(context?.element?.classList).toContain('stray');
  });

  it('drives custom chips with the headless directives and keeps a readonly one untouched', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CustomTagsComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    document.body.appendChild(host);
    s.tick();
    s.frame(2);

    const skillField = host.querySelector<HTMLInputElement>('.skill-field')!;
    const skills = () => Array.from(host.querySelectorAll('.skill')).map((skill) => skill.textContent?.trim());

    expect(app.skillField().elementRef.nativeElement).toBe(skillField);

    skillField.value = 'Passing;';
    skillField.dispatchEvent(new Event('input', { bubbles: true }));
    s.tick();

    expect(app.skills()).toEqual(['Passing']);

    skillField.value = 'Tackling';
    app.skillField().commitPending();
    s.tick();

    expect(skills()).toEqual(['Passing', 'Tackling']);
    expect(app.skillInput().isFull()).toBe(true);
    expect(skillField.readOnly).toBe(true);

    host.querySelector<HTMLButtonElement>('.skill')!.click();
    s.tick();

    expect(app.skills()).toEqual(['Tackling']);
    expect(skillField.readOnly).toBe(false);

    app.readonly.set(true);
    s.tick();

    const labels = host.querySelector<HTMLElement>('.labels')!;
    const labelField = labels.querySelector<HTMLInputElement>('input')!;

    app.labelInput().focus();
    expect(document.activeElement).toBe(labelField);

    s.keydown('Backspace', labelField);
    s.tick();

    expect(app.labels()).toEqual(['keeper']);
    expect(labels.getAttribute('data-readonly')).toBe('true');
    s.flush();
  });
});
