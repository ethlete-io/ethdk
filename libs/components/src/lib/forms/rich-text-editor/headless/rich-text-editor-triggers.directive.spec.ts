import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { tick } from '../../../testing/driver-core';
import {
  attachEditable,
  caretIn,
  mountRichTextEditor,
  RichTextEditorDriver,
} from '../../testing/rich-text-editor-driver';
import { RICH_TEXT_EDITOR_ERROR_CODES } from '../rich-text-editor-errors';
import { RichTextEditorTrigger, RichTextEditorTriggerItem } from '../rich-text-editor-trigger';
import { RichTextEditorTriggersDirective } from './rich-text-editor-triggers.directive';
import { RichTextEditorDirective } from './rich-text-editor.directive';

const MERGE_FIELDS: RichTextEditorTriggerItem[] = [{ id: 'firstName', label: 'First name' }];

@Component({
  template: `<div [triggers]="triggers()" [readonly]="readonly()" etRichTextEditor etRichTextEditorTriggers></div>`,
  imports: [RichTextEditorDirective, RichTextEditorTriggersDirective],
})
class TriggersTestHost {
  public readonly = signal(false);
  public triggers = signal<RichTextEditorTrigger[]>([
    {
      char: '#',
      type: 'block',
      items: MERGE_FIELDS,
      resolveItem: (id) => MERGE_FIELDS.find((item) => item.id === id) ?? null,
    },
  ]);
}

describe('RichTextEditorTriggersDirective', () => {
  let driver: RichTextEditorDriver<TriggersTestHost>;

  beforeEach(() => {
    driver = mountRichTextEditor(TriggersTestHost, { attachEditable: true });
  });

  it.each([
    [
      'a char longer than one character',
      { char: '{{', type: 'field' },
      RICH_TEXT_EDITOR_ERROR_CODES.INVALID_TRIGGER_CHAR,
    ],
    ['an empty char', { char: '', type: 'field' }, RICH_TEXT_EDITOR_ERROR_CODES.INVALID_TRIGGER_CHAR],
    ['a malformed type', { char: '@', type: 'Mention' }, RICH_TEXT_EDITOR_ERROR_CODES.INVALID_TOKEN_TYPE],
  ])('reports %s as soon as the triggers are set', (_, trigger, code) => {
    driver.host.triggers.set([{ ...trigger, items: [] }]);

    expect(() => tick()).toThrow(`ET${code}`);
  });

  it('keeps a chip on Backspace while the editor is readonly', () => {
    driver.editor.value.set('{{block:firstName}} ab');
    driver.host.readonly.set(true);
    driver.detectChanges();

    const chip = () => driver.editable().querySelector('[data-et-token]');
    const nextSibling = chip()?.nextSibling;

    if (!nextSibling) throw new Error('The chip has no text after it.');

    caretIn(nextSibling, 0);
    driver.press('Backspace');

    expect(chip()).not.toBeNull();
    expect(driver.value()).toBe('{{block:firstName}} ab');
  });

  it('moves its key handling to a newly attached editable element', () => {
    driver.editor.editorDom.root.set(attachEditable());
    driver.detectChanges();
    driver.editor.value.set('{{block:firstName}} ab');
    driver.detectChanges();

    const chip = () => driver.editable().querySelector('[data-et-token]');
    const nextSibling = chip()?.nextSibling;

    if (!nextSibling) throw new Error('The chip has no text after it.');

    caretIn(nextSibling, 0);
    driver.press('Backspace');

    expect(chip()).toBeNull();
  });

  it('points aria-activedescendant at an option only while the popup lists one', () => {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(),
    });
    onTestFinished(() => {
      Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
    });

    driver.focus();
    driver.caretAtEnd();
    driver.type('#');
    driver.detectChanges();

    expect(driver.editable().getAttribute('aria-activedescendant')).toMatch(/-option-0$/);

    driver.type('zzz');
    driver.detectChanges();

    expect(driver.editable().getAttribute('aria-expanded')).toBe('true');
    expect(driver.editable().hasAttribute('aria-activedescendant')).toBe(false);
  });
});
