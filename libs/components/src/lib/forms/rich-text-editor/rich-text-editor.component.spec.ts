import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { caretIn, mountRichTextEditor, RichTextEditorDriver } from '../testing/rich-text-editor-driver';
import { FORM_FIELD_IMPORTS } from '../form-field/form-field.imports';
import { RichTextEditorTrigger, RichTextEditorTriggerItem } from './rich-text-editor-trigger';
import { RICH_TEXT_EDITOR_TRIGGERS_IMPORTS } from './rich-text-editor-triggers.imports';
import { provideRichTextEditorDefaultTools } from './tools/rich-text-editor-default-tools.provider';
import { RICH_TEXT_EDITOR_IMPORTS } from './rich-text-editor.imports';

@Component({
  template: `
    <et-form-field>
      <et-label>Description</et-label>
      <et-rich-text-editor required />
    </et-form-field>
  `,
  imports: [FORM_FIELD_IMPORTS, RICH_TEXT_EDITOR_IMPORTS],
})
class RequiredEditorTestHost {}

@Component({
  template: `<et-rich-text-editor placeholder="Write something…" />`,
  imports: [RICH_TEXT_EDITOR_IMPORTS],
  providers: [provideRichTextEditorDefaultTools()],
})
class TypingEditorTestHost {}

const MERGE_FIELDS: RichTextEditorTriggerItem[] = [{ id: 'firstName', label: 'First name' }];

@Component({
  template: `<et-rich-text-editor [triggers]="triggers" etRichTextEditorTriggers />`,
  imports: [RICH_TEXT_EDITOR_IMPORTS, RICH_TEXT_EDITOR_TRIGGERS_IMPORTS],
  providers: [provideRichTextEditorDefaultTools()],
})
class TriggerEditorTestHost {
  public triggers: RichTextEditorTrigger[] = [
    {
      char: '#',
      type: 'block',
      items: MERGE_FIELDS,
      resolveItem: (id) => MERGE_FIELDS.find((item) => item.id === id) ?? null,
    },
  ];
}

describe('RichTextEditorComponent', () => {
  it('announces that a required editor is required', () => {
    TestBed.configureTestingModule({
      imports: [RequiredEditorTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });

    const fixture = TestBed.createComponent(RequiredEditorTestHost);

    fixture.detectChanges();

    const editable = (fixture.nativeElement as HTMLElement).querySelector('[role="textbox"]');

    expect(editable?.getAttribute('aria-required')).toBe('true');
  });

  it('announces a toggle tool as a toggle and an action tool as a plain button', () => {
    const driver = mountRichTextEditor(TypingEditorTestHost);
    const toolbarButton = (label: string) => driver.query(`.et-rte-toolbar button[aria-label="${label}"]`);

    expect(toolbarButton('Bold')?.getAttribute('aria-pressed')).toBe('false');
    expect(toolbarButton('Undo')).not.toBeNull();
    expect(toolbarButton('Undo')?.hasAttribute('aria-pressed')).toBe(false);
  });

  describe('soft keyboard inset', () => {
    const keyboardInset = (fixture: { nativeElement: HTMLElement }) =>
      fixture.nativeElement
        .querySelector<HTMLElement>('et-rich-text-editor')
        ?.style.getPropertyValue('--_et-rte-keyboard-inset');

    const mountWithPointer = async (coarse: boolean) => {
      const viewport = Object.assign(new EventTarget(), { offsetTop: 0, height: 800, width: 400 });

      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
          ({
            matches: coarse && query === '(pointer: coarse)',
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
          }) as MediaQueryList,
      );

      TestBed.configureTestingModule({ imports: [TypingEditorTestHost] });

      const fixture = TestBed.createComponent(TypingEditorTestHost);

      await fixture.whenStable();
      window.dispatchEvent(new Event('scroll'));

      return fixture;
    };

    afterEach(() => {
      vi.restoreAllMocks();
      Reflect.deleteProperty(window, 'visualViewport');
    });

    it('is not tracked without touch input', async () => {
      const fixture = await mountWithPointer(false);

      expect(keyboardInset(fixture)).toBe('');
    });

    it('is tracked with touch input', async () => {
      const fixture = await mountWithPointer(true);

      expect(keyboardInset(fixture)).toBe('0px');
    });
  });

  describe('typing', () => {
    let driver: RichTextEditorDriver<TypingEditorTestHost>;

    beforeEach(() => {
      driver = mountRichTextEditor(TypingEditorTestHost);
      driver.caretAtStart();
    });

    it('serializes each keystroke into the markdown value', () => {
      driver.type('hi');

      expect(driver.editableText()).toBe('hi');
      expect(driver.value()).toBe('hi');
    });

    it('autoformats a heading prefix on the space that closes it', () => {
      driver.type('# ');

      expect(driver.query('h1')).not.toBeNull();

      driver.type('Title');

      expect(driver.value()).toBe('# Title');
    });

    it('autoformats a list prefix on the space that closes it', () => {
      driver.type('- item');

      expect(driver.query('ul li')).not.toBeNull();
      expect(driver.value()).toBe('- item');
    });

    it('keeps the paragraph break Enter adds after a first line typed into an empty editor', () => {
      driver.setHtml('first<div>second</div>');
      driver.editable().dispatchEvent(new Event('input'));

      expect(driver.value()).toBe('first\n\nsecond');
    });

    it('leaves an unclosed inline run as literal text', () => {
      driver.type('*not bold');

      expect(driver.query('em')).toBeNull();
      expect(driver.editableText()).toBe('*not bold');
    });
  });

  describe('with a registered trigger char', () => {
    let driver: RichTextEditorDriver<TriggerEditorTestHost>;

    beforeEach(() => {
      driver = mountRichTextEditor(TriggerEditorTestHost);
      driver.caretAtStart();
    });

    it('reserves the trigger char, so its prefix never autoformats into a heading', () => {
      expect(driver.editor.autoformatReservedChars()).toEqual(['#']);

      driver.type('# ');

      expect(driver.query('h1')).toBeNull();
      expect(driver.editableText()).toBe('# ');
    });

    it('still autoformats a prefix that is not a trigger char', () => {
      driver.type('- item');

      expect(driver.query('ul li')).not.toBeNull();
    });

    it('takes a picked chip and its trailing space back in one undo', () => {
      driver.type('a b');
      driver.caretAt(2);
      driver.type('#');
      driver.press('Enter');
      driver.type('x');

      expect(driver.value()).toBe('a {{block:firstName}} xb');

      driver.editor.undo();

      expect(driver.value()).toBe('a {{block:firstName}} b');

      driver.editor.undo();

      expect(driver.value()).toBe('a #b');
    });

    it('commits a chip deleted by Backspace as its own undo step', () => {
      driver.type('#');
      driver.press('Enter');
      driver.type('ab');
      caretIn(driver.query('[data-et-token]')!.nextSibling!, 0);
      driver.press('Backspace');

      expect(driver.value()).toBe('ab');

      driver.editor.undo();

      expect(driver.value()).toBe('{{block:firstName}} ab');
    });
  });
});
