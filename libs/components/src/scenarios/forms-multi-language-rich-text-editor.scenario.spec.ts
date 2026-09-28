import { Component, getDebugNode, inject, signal, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  MULTI_LANGUAGE_RICH_TEXT_EDITOR_ERROR_CODES,
  MultiLanguageRichTextEditorComponent,
  MultiLanguageRichTextEditorDirective,
  MultiLanguageRichTextEditorLanguage,
  MultiLanguageRichTextEditorLanguageToolComponent,
  MultiLanguageRichTextEditorValue,
  provideOverlay,
  provideRichTextEditorLabels,
  provideRichTextEditorLanguageTool,
  RICH_TEXT_EDITOR_IMPORTS,
  RICH_TEXT_EDITOR_LANGUAGE_TOOL,
  requiredLanguages,
} from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

const LANGUAGES: MultiLanguageRichTextEditorLanguage[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
];

const UNSTYLED_BLOCKS = 'et-scrollbar { display: block; }';

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const textbox = (root: ParentNode) => query('[role="textbox"]', root);

const trigger = (root: ParentNode) => query<HTMLButtonElement>('.et-ml-rte-lang-trigger', root);

const toolbarLabels = (root: ParentNode) =>
  Array.from(root.querySelectorAll('.et-rte-toolbar button')).map((button) => button.getAttribute('aria-label'));

const languageItems = () =>
  Array.from(document.querySelectorAll<HTMLElement>('et-menu-radio-item')).map((item) => ({
    label: item.querySelector('.et-ml-rte-lang-item-label')?.textContent?.trim(),
    content: item.querySelector('.et-ml-rte-lang-status')?.textContent?.trim(),
    checked: item.getAttribute('aria-checked'),
  }));

const pickLanguage = (s: Scenario, label: string) => {
  const item = Array.from(document.querySelectorAll<HTMLElement>('et-menu-radio-item')).find(
    (candidate) => candidate.querySelector('.et-ml-rte-lang-item-label')?.textContent?.trim() === label,
  );

  if (!item) throw new Error(`no language ${label}`);

  item.click();
  s.flush();
};

const caretAtEnd = (root: HTMLElement) => {
  const range = document.createRange();

  range.selectNodeContents(root.querySelector('p') ?? root);
  range.collapse(false);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
};

const typeText = (s: Scenario, root: HTMLElement, text: string) => {
  for (const char of text) {
    const before = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: char,
    });

    root.dispatchEvent(before);
    s.tick();

    if (before.defaultPrevented) continue;

    const range = document.getSelection()!.getRangeAt(0);

    if (range.startContainer instanceof Text) {
      const offset = range.startOffset;

      range.startContainer.insertData(offset, char);
      range.setStart(range.startContainer, offset + char.length);
    } else {
      const node = document.createTextNode(char);

      range.insertNode(node);
      range.setStart(node, char.length);
    }

    range.collapse(true);
    root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
    s.tick();
  }
};

@Component({
  selector: 'et-scenario-translated-article',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [MultiLanguageRichTextEditorComponent, FormField],
  template: `
    <et-multi-language-rich-text-editor
      [formField]="articleForm.body"
      [languages]="languages()"
      [tools]="['bold']"
      aria-label="Body"
    />
  `,
})
class TranslatedArticleComponent {
  languages = signal<readonly MultiLanguageRichTextEditorLanguage[]>(LANGUAGES);
  model = signal<{ body: MultiLanguageRichTextEditorValue }>({ body: { en: 'Hello', legacy: 'keep me' } });
  articleForm = form(this.model, (path) => {
    requiredLanguages(path.body, { codes: ['en', 'de'] });
  });
}

@Component({
  selector: 'et-scenario-localized-article',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [MultiLanguageRichTextEditorComponent],
  providers: [provideRichTextEditorLabels({ languageFilled: 'Übersetzt', languageEmpty: 'Fehlt' })],
  template: ` <et-multi-language-rich-text-editor [(value)]="body" [languages]="languages" aria-label="Body" /> `,
})
class LocalizedArticleComponent {
  languages = LANGUAGES.slice(0, 2);
  body = signal<MultiLanguageRichTextEditorValue>({ de: 'Hallo' });
}

@Component({
  selector: 'et-scenario-custom-translation-box',
  imports: [RICH_TEXT_EDITOR_IMPORTS],
  providers: [provideRichTextEditorLanguageTool()],
  hostDirectives: [{ directive: MultiLanguageRichTextEditorDirective, inputs: ['languages'] }],
  template: `
    <et-rich-text-editor
      [value]="translations.activeMarkdown()"
      [tools]="tools"
      (valueChange)="translations.writeActiveMarkdown($event)"
      aria-label="Note"
    />
    <output class="progress">{{ translations.filledCount() }}/{{ translations.totalCount() }}</output>
  `,
})
class CustomTranslationBoxComponent {
  translations = inject(MultiLanguageRichTextEditorDirective);
  tools = ['bold', RICH_TEXT_EDITOR_LANGUAGE_TOOL];
}

@Component({
  selector: 'et-scenario-custom-translation-page',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [CustomTranslationBoxComponent],
  template: `<et-scenario-custom-translation-box [languages]="languages()" />`,
})
class CustomTranslationPageComponent {
  languages = signal<readonly MultiLanguageRichTextEditorLanguage[]>(LANGUAGES.slice(0, 2));
}

describe('forms multi-language rich-text-editor scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('switches languages, writes each translation back into the form and validates the required ones', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TranslatedArticleComponent);
    const host = fixture.nativeElement as HTMLElement;
    const page = fixture.componentInstance;

    s.flush();

    const editor = query('et-multi-language-rich-text-editor', host);
    const editable = textbox(host);

    expect(getDebugNode(editor)?.componentInstance).toBeInstanceOf(MultiLanguageRichTextEditorComponent);
    expect(
      getDebugNode(query('et-multi-language-rich-text-editor-language-tool', host))?.componentInstance,
    ).toBeInstanceOf(MultiLanguageRichTextEditorLanguageToolComponent);
    expect(toolbarLabels(host)[0]).toBe('Language: English');
    expect(toolbarLabels(host)).toContain('Bold');
    expect(editable.textContent).toBe('Hello');
    expect(trigger(host).textContent?.trim()).toBe('en');
    expect(trigger(host).classList).toContain('et-ml-rte-lang-trigger--flagged');
    expect(
      page.articleForm
        .body()
        .errors()
        .map((error) => error.message),
    ).toEqual(['Missing translations: de']);

    trigger(host).click();
    s.flush();

    expect(languageItems()).toEqual([
      { label: 'English', content: 'has content', checked: 'true' },
      { label: 'Deutsch', content: 'empty', checked: 'false' },
      { label: 'Français', content: 'empty', checked: 'false' },
    ]);

    pickLanguage(s, 'Deutsch');

    expect(document.querySelector('et-menu-radio-item')).toBeNull();
    expect(trigger(host).getAttribute('aria-label')).toBe('Language: Deutsch');
    expect(editable.textContent).toBe('');

    editable.focus();
    caretAtEnd(editable);
    typeText(s, editable, 'Hallo');

    expect(page.model().body).toEqual({ en: 'Hello', legacy: 'keep me', de: 'Hallo' });
    expect(page.articleForm.body().errors()).toEqual([]);
    expect(trigger(host).classList).toContain('et-ml-rte-lang-trigger--flagged');

    page.languages.set(LANGUAGES.slice(0, 2));
    s.flush();
    expect(trigger(host).classList).not.toContain('et-ml-rte-lang-trigger--flagged');

    page.languages.set([LANGUAGES[0]!, LANGUAGES[2]!]);
    s.flush();
    expect(trigger(host).textContent?.trim()).toBe('en');
    expect(editable.textContent).toBe('Hello');
    expect(page.model().body['de']).toBe('Hallo');

    page.model.set({ body: { en: '', fr: 'Bonjour' } });
    s.flush();
    expect(editable.textContent).toBe('');
    expect(
      page.articleForm
        .body()
        .errors()
        .map((error) => error.message),
    ).toEqual(['Missing translations: en, de']);
    expect(s.errors).toEqual([]);
  });

  it('announces each language status dot with the consumer-provided labels', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LocalizedArticleComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();
    trigger(host).click();
    s.flush();

    expect(languageItems().map((item) => item.content)).toEqual(['Fehlt', 'Übersetzt']);

    pickLanguage(s, 'Deutsch');
    expect(s.errors).toEqual([]);
  });

  it('composes the language tool into a bare editor on a consumer that hosts the headless directive', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CustomTranslationPageComponent);
    const host = fixture.nativeElement as HTMLElement;
    const box = getDebugNode(query('et-scenario-custom-translation-box', host))?.componentInstance as
      CustomTranslationBoxComponent | undefined;

    s.flush();

    expect(box?.translations).toBeInstanceOf(MultiLanguageRichTextEditorDirective);
    expect(toolbarLabels(host)).toEqual(['Bold', 'Language: English']);
    expect(query('.progress', host).textContent).toBe('0/2');

    const editable = textbox(host);

    editable.focus();
    caretAtEnd(editable);
    typeText(s, editable, 'Hi');
    expect(box?.translations.value()).toEqual({ en: 'Hi' });
    expect(box?.translations.hasValue()).toBe(true);
    expect(query('.progress', host).textContent).toBe('1/2');

    trigger(host).click();
    s.flush();
    pickLanguage(s, 'Deutsch');

    expect(box?.translations.activeLanguage()).toBe('de');
    expect(box?.translations.missingLanguages().map((language) => language.code)).toEqual(['de']);
    expect(editable.textContent).toBe('');
    expect(s.errors).toEqual([]);
  });

  it('reports an empty language list and a duplicate language code and renders no editor', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TranslatedArticleComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    fixture.componentInstance.languages.set([]);
    expect(() => fixture.detectChanges()).not.toThrow();
    s.tick();
    s.expectError(`ET${MULTI_LANGUAGE_RICH_TEXT_EDITOR_ERROR_CODES.NO_LANGUAGES_CONFIGURED}`);
    expect(host.querySelector('et-rich-text-editor')).toBeNull();

    fixture.componentInstance.languages.set([...LANGUAGES, { code: 'de', label: 'German' }]);
    expect(() => fixture.detectChanges()).not.toThrow();
    s.tick();
    s.expectError(
      `ET${MULTI_LANGUAGE_RICH_TEXT_EDITOR_ERROR_CODES.DUPLICATE_LANGUAGE_CODE}: [etMultiLanguageRichTextEditor] has a duplicate language code "de"`,
    );
    expect(host.querySelector('et-rich-text-editor')).toBeNull();

    fixture.componentInstance.languages.set(LANGUAGES);
    s.tick();
    expect(host.querySelector('et-rich-text-editor')).not.toBeNull();
    s.flush();
  });
});
