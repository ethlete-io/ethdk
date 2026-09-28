import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { caretIn, mountRichTextEditor, RichTextEditorDriver } from '../../testing/rich-text-editor-driver';
import { RichTextEditorTrigger, RichTextEditorTriggerItem } from '../rich-text-editor-trigger';
import { RichTextEditorTriggersDirective } from './rich-text-editor-triggers.directive';
import { RichTextEditorDirective } from './rich-text-editor.directive';

const MERGE_FIELDS: RichTextEditorTriggerItem[] = [{ id: 'firstName', label: 'First name' }];

@Component({
  template: `<div [triggers]="triggers" [readonly]="readonly()" etRichTextEditor etRichTextEditorTriggers></div>`,
  imports: [RichTextEditorDirective, RichTextEditorTriggersDirective],
})
class TriggersTestHost {
  public readonly = signal(false);
  public triggers: RichTextEditorTrigger[] = [
    {
      char: '#',
      type: 'block',
      items: MERGE_FIELDS,
      resolveItem: (id) => MERGE_FIELDS.find((item) => item.id === id) ?? null,
    },
  ];
}

describe('RichTextEditorTriggersDirective', () => {
  let driver: RichTextEditorDriver<TriggersTestHost>;

  beforeEach(() => {
    driver = mountRichTextEditor(TriggersTestHost, { attachEditable: true });
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
});
