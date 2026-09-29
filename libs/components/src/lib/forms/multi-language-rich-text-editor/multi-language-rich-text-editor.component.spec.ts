import { Component, ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { flushFrames, latestPane, textOf, tick } from '../../testing/driver-core';
import { mountRichTextEditor, RichTextEditorDriver } from '../testing/rich-text-editor-driver';
import { provideRichTextEditorDefaultTools } from '../rich-text-editor';
import { RichTextEditorDirective } from '../rich-text-editor/headless/rich-text-editor.directive';
import { RichTextEditorLabels } from '../rich-text-editor/rich-text-editor-labels';
import { MultiLanguageRichTextEditorDirective } from './headless/multi-language-rich-text-editor.directive';
import {
  MultiLanguageRichTextEditorLanguage,
  MultiLanguageRichTextEditorValue,
} from './multi-language-rich-text-editor-config';
import { MULTI_LANGUAGE_RICH_TEXT_EDITOR_ERROR_CODES } from './multi-language-rich-text-editor-errors';
import { MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS } from './multi-language-rich-text-editor.imports';

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
