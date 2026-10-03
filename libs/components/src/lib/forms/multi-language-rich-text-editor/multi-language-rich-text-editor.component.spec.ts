import { Component, ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import '../../../test-helpers';
import { flushFrames, latestPane, textOf, tick } from '../../testing/driver-core';
import { mountRichTextEditor, RichTextEditorDriver } from '../testing/rich-text-editor-driver';
import { FORM_FIELD_IMPORTS } from '../form-field/form-field.imports';
import { FormFieldDirective } from '../form-field/headless';
import { provideRichTextEditorDefaultTools, provideRichTextEditorTools } from '../rich-text-editor';
import { RichTextEditorDirective } from '../rich-text-editor/headless/rich-text-editor.directive';
import { RichTextEditorLabels } from '../rich-text-editor/rich-text-editor-labels';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';
import { MultiLanguageRichTextEditorDirective } from './headless/multi-language-rich-text-editor.directive';
import {
  MultiLanguageRichTextEditorLanguage,
  MultiLanguageRichTextEditorValue,
} from './multi-language-rich-text-editor-config';
import { MULTI_LANGUAGE_RICH_TEXT_EDITOR_ERROR_CODES } from './multi-language-rich-text-editor-errors';
import { requiredLanguages } from './multi-language-rich-text-editor-validators';
import { MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS } from './multi-language-rich-text-editor.imports';
import { provideRichTextEditorLanguageTool } from './tools/multi-language-rich-text-editor-language.provider';

@Component({
  template: `
    <et-multi-language-rich-text-editor
      [(value)]="value"
      [languages]="languages()"
      [readonly]="readonly()"
      [hidden]="hidden()"
      [labels]="labels()"
      aria-label="Body"
    />
  `,
  imports: [MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS],
  providers: [provideRichTextEditorDefaultTools()],
})
class MultiLanguageEditorTestHost {
  public value = signal<MultiLanguageRichTextEditorValue>({});
  public readonly = signal(false);
  public hidden = signal(false);
  public labels = signal<Partial<RichTextEditorLabels> | null>(null);
  public languages = signal<readonly MultiLanguageRichTextEditorLanguage[]>([
    { code: 'en', label: 'English' },
    { code: 'de', label: 'German' },
  ]);
}

@Component({
  template: `
    <et-form-field>
      <et-multi-language-rich-text-editor [formField]="entry.translations" [languages]="languages" aria-label="Body" />
    </et-form-field>
  `,
  imports: [MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS, FORM_FIELD_IMPORTS, FormField],
  providers: [provideRichTextEditorDefaultTools(), provideRichTextEditorTools(['bold', 'italic'])],
})
class MultiLanguageEditorFormHost {
  public model = signal<{ translations: MultiLanguageRichTextEditorValue }>({ translations: {} });
  public entry = form(this.model, (path) => {
    requiredLanguages(path.translations, { codes: ['en'] });
  });

  public languages: readonly MultiLanguageRichTextEditorLanguage[] = [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'German' },
  ];
}

const rewriteContent = (driver: RichTextEditorDriver<unknown>, html: string) => {
  driver.setHtml(html);
  driver.editor.syncFromDom({ boundary: true });
  tick();
};

const switchLanguage = async (driver: RichTextEditorDriver<unknown>, label: string) => {
  driver.query<HTMLElement>('.et-ml-rte-lang-trigger')!.click();
  tick();
  await flushFrames();
  tick();

  const items = Array.from(latestPane()?.querySelectorAll<HTMLElement>('et-menu-radio-item') ?? []);

  items.find((candidate) => textOf(candidate)?.startsWith(label))!.click();
  tick();
  await flushFrames();
  tick();
};

describe('MultiLanguageRichTextEditorComponent in a form', () => {
  let driver: RichTextEditorDriver<MultiLanguageEditorFormHost>;

  const field = () => driver.directive(FormFieldDirective, 'et-form-field');

  beforeEach(() => {
    driver = mountRichTextEditor(MultiLanguageEditorFormHost, { directiveSelector: 'et-rich-text-editor' });
  });

  it('shows the requiredLanguages error once the form marks the field touched', () => {
    expect(driver.editable().getAttribute('aria-invalid')).toBeNull();

    driver.host.entry.translations().markAsTouched();
    tick();

    expect(field().shouldDisplayError()).toBe(true);
    expect(driver.editable().getAttribute('aria-invalid')).toBe('true');
  });

  it('hides the error again when the form is reset', () => {
    driver.focus();
    driver.blur();

    expect(driver.editable().getAttribute('aria-invalid')).toBe('true');

    driver.host.entry().reset();
    tick();

    expect(field().shouldDisplayError()).toBe(false);
    expect(driver.editable().getAttribute('aria-invalid')).toBeNull();
  });

  it('builds its toolbar from provideRichTextEditorTools', () => {
    expect(driver.editor.resolvedTools()).toEqual(['language', 'divider', 'bold', 'italic']);
  });

  it('does not undo into text typed under the previous language', async () => {
    driver.caretAtStart();
    driver.type('Hello');
    rewriteContent(driver, '');

    expect(driver.host.model().translations['en']).toBe('');

    await switchLanguage(driver, 'German');

    driver.editor.undo();
    tick();

    expect(driver.editableText()).toBe('');
    expect(driver.host.model().translations['de'] ?? '').toBe('');
  });

  it('does not undo into the previous language when both hold the same text', async () => {
    driver.host.model.set({ translations: { en: 'Brand', de: 'Brand' } });
    tick();

    driver.caretAtEnd();
    driver.type('X');
    rewriteContent(driver, '<p>Brand</p>');

    await switchLanguage(driver, 'German');

    driver.editor.undo();
    tick();

    expect(driver.editableText()).toBe('Brand');
    expect(driver.host.model().translations).toEqual({ en: 'Brand', de: 'Brand' });
  });
});

describe('MultiLanguageRichTextEditorComponent', () => {
  let driver: RichTextEditorDriver<MultiLanguageEditorTestHost>;
  let wrapper: MultiLanguageRichTextEditorDirective;

  const mount = () => {
    driver = mountRichTextEditor(MultiLanguageEditorTestHost, { directiveSelector: 'et-rich-text-editor' });
    wrapper = driver.directive(MultiLanguageRichTextEditorDirective);
  };

  const trigger = () => driver.query('.et-ml-rte-lang-trigger')!;

  const switchTo = async (label: string) => {
    trigger().click();
    tick();
    await flushFrames();
    tick();

    const items = Array.from(latestPane()?.querySelectorAll<HTMLElement>('et-menu-radio-item') ?? []);
    const item = items.find((candidate) => textOf(candidate)?.startsWith(label));

    expect(items.length).toBeGreaterThan(0);
    expect(item).not.toBeUndefined();

    item!.click();
    tick();
    await flushFrames();
    tick();
  };

  beforeEach(() => mount());

  it('starts on the first configured language', () => {
    expect(wrapper.activeLanguage()).toBe('en');
    expect(textOf(trigger())).toBe('en');
    expect(trigger().getAttribute('aria-label')).toContain('English');
  });

  it('says in the trigger name that languages are missing', () => {
    expect(trigger().getAttribute('aria-label')).toBe('Language: English, 2 languages missing');

    driver.host.value.set({ en: 'Hello' });
    tick();

    expect(trigger().getAttribute('aria-label')).toBe('Language: English, 1 language missing');

    driver.host.value.set({ en: 'Hello', de: 'Hallo' });
    tick();

    expect(trigger().getAttribute('aria-label')).toBe('Language: English');
  });

  it('forwards labels, hidden and the accessible name to the embedded editor', () => {
    const inner = driver.directive(RichTextEditorDirective, 'et-rich-text-editor');

    expect(inner.ariaLabel()).toBe('Body');
    expect(inner.hidden()).toBe(false);

    driver.host.hidden.set(true);
    driver.host.labels.set({ languageTrigger: (language) => `Sprache: ${language}`, languageMissing: () => 'fehlt' });
    tick();

    expect(inner.hidden()).toBe(true);
    expect(trigger().getAttribute('aria-label')).toBe('Sprache: English, fehlt');
  });

  it('writes what is typed under the active language only', () => {
    driver.caretAtStart();
    driver.type('Hello');

    expect(driver.value()).toBe('Hello');
    expect(driver.host.value()).toEqual({ en: 'Hello' });
  });

  it('swaps the editor content per language, keeping the translation left behind', async () => {
    driver.caretAtStart();
    driver.type('Hello');

    await switchTo('German');

    expect(wrapper.activeLanguage()).toBe('de');
    expect(driver.editableText()).toBe('');

    driver.caretAtStart();
    driver.type('Hallo');

    expect(driver.host.value()).toEqual({ en: 'Hello', de: 'Hallo' });

    await switchTo('English');

    expect(driver.editableText()).toBe('Hello');
  });

  it('keeps a translation whose language is no longer configured', () => {
    driver.host.value.set({ en: 'Hello', fr: 'Bonjour' });
    tick();

    driver.caretAtEnd();
    driver.type('!');

    expect(driver.host.value()).toEqual({ en: 'Hello!', fr: 'Bonjour' });
  });

  it('falls back to the first remaining language when the active one is dropped', async () => {
    await switchTo('German');
    expect(wrapper.activeLanguage()).toBe('de');

    driver.host.languages.set([{ code: 'en', label: 'English' }]);
    tick();

    expect(wrapper.activeLanguage()).toBe('en');
  });

  it('flags the switcher while a language has no content', () => {
    expect(wrapper.missingLanguages().map((language) => language.code)).toEqual(['en', 'de']);
    expect(trigger().classList.contains('et-ml-rte-lang-trigger--flagged')).toBe(true);

    driver.host.value.set({ en: 'Hello', de: 'Hallo' });
    tick();

    expect(wrapper.filledCount()).toBe(wrapper.totalCount());
    expect(trigger().classList.contains('et-ml-rte-lang-trigger--flagged')).toBe(false);
  });

  it('reports blank markdown as missing content', () => {
    driver.host.value.set({ en: '   ', de: '' });
    tick();

    expect(wrapper.isFilled('en')).toBe(false);
    expect(wrapper.hasValue()).toBe(false);
  });

  it('reads a null translation from API data as missing content', () => {
    driver.host.value.set({ en: null, de: '' } as unknown as Record<string, string>);
    tick();

    expect(wrapper.isFilled('en')).toBe(false);
    expect(wrapper.hasValue()).toBe(false);
  });

  it('takes the embedded editor being blurred as touched', () => {
    expect(wrapper.touched()).toBe(false);

    driver.focus();
    driver.blur();

    expect(wrapper.touched()).toBe(true);
  });

  it('disables the switcher on a readonly editor', () => {
    expect(trigger().hasAttribute('disabled')).toBe(false);

    driver.host.readonly.set(true);
    tick();

    expect(trigger().hasAttribute('disabled')).toBe(true);
  });

  it('reports an empty language list and renders no editor', () => {
    const handleError = vi.spyOn(TestBed.inject(ErrorHandler), 'handleError').mockImplementation(() => undefined);

    driver.host.languages.set([]);

    expect(() => tick()).not.toThrow();
    expect(String(handleError.mock.calls[0]?.[0])).toContain(
      `ET${MULTI_LANGUAGE_RICH_TEXT_EDITOR_ERROR_CODES.NO_LANGUAGES_CONFIGURED}`,
    );
    expect(driver.fixture.nativeElement.querySelector('et-rich-text-editor')).toBeNull();
  });

  it('reports a duplicate language code and renders no editor', () => {
    const handleError = vi.spyOn(TestBed.inject(ErrorHandler), 'handleError').mockImplementation(() => undefined);

    driver.host.languages.set([
      { code: 'en', label: 'English' },
      { code: 'en', label: 'English (US)' },
    ]);

    expect(() => tick()).not.toThrow();
    expect(String(handleError.mock.calls[0]?.[0])).toContain(
      `ET${MULTI_LANGUAGE_RICH_TEXT_EDITOR_ERROR_CODES.DUPLICATE_LANGUAGE_CODE}`,
    );
    expect(driver.fixture.nativeElement.querySelector('et-rich-text-editor')).toBeNull();
  });
});

@Component({
  template: `<et-rich-text-editor [tools]="['language', 'bold']" aria-label="Body" />`,
  imports: [RichTextEditorComponent],
  providers: [provideRichTextEditorDefaultTools(), provideRichTextEditorLanguageTool()],
})
class BareEditorWithLanguageToolHost {}

describe('the language tool outside the multi-language editor', () => {
  it('reports ET2602', () => {
    const handleError = vi.fn();

    mountRichTextEditor(BareEditorWithLanguageToolHost, { directiveSelector: 'et-rich-text-editor' }, [
      { provide: ErrorHandler, useValue: { handleError } },
    ]);

    expect(handleError.mock.calls.map(([error]) => String(error))).toContainEqual(
      expect.stringContaining(`ET${MULTI_LANGUAGE_RICH_TEXT_EDITOR_ERROR_CODES.LANGUAGE_TOOL_OUTSIDE_EDITOR}`),
    );
  });
});

describe('requiredLanguages', () => {
  it('re-reads function codes on every validation and builds the message from a function', () => {
    const codes = signal<readonly string[]>(['en']);
    const model = signal<{ translations: MultiLanguageRichTextEditorValue }>({ translations: { en: 'Hi' } });
    const entry = TestBed.runInInjectionContext(() =>
      form(model, (path) => {
        requiredLanguages(path.translations, {
          codes: () => codes(),
          message: (missing) => `Fehlt: ${missing.join('/')}`,
        });
      }),
    );

    expect(entry.translations().errors()).toEqual([]);

    codes.set(['en', 'de', 'fr']);

    expect(
      entry
        .translations()
        .errors()
        .map((error) => error.message),
    ).toEqual(['Fehlt: de/fr']);
  });
});
