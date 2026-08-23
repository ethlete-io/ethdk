import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { mountRichTextEditor, RichTextEditorDriver } from '../testing/rich-text-editor-driver';
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
  });
});
