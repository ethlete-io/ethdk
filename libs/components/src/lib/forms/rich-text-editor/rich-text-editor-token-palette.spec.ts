import { Component, signal } from '@angular/core';
import { throwError } from 'rxjs';
import '../../../test-helpers';
import { tick } from '../../testing/driver-core';
import { mountRichTextEditor, RichTextEditorDriver } from '../testing/rich-text-editor-driver';
import { RichTextEditorTriggersDirective } from './headless/rich-text-editor-triggers.directive';
import { RichTextEditorDirective } from './headless/rich-text-editor.directive';
import { RichTextEditorTrigger, RichTextEditorTriggerItem } from './rich-text-editor-trigger';
import { RichTextEditorTokenPaletteComponent } from './rich-text-editor-token-palette.component';

const FIELDS: RichTextEditorTriggerItem[] = [
  { id: 'first-name', label: 'First name' },
  { id: 'legacy', label: 'Legacy', disabled: true },
];

const resolveField = (id: string) => FIELDS.find((item) => item.id === id) ?? null;

@Component({
  template: `
    <div
      #rte="etRichTextEditor"
      [triggers]="triggers()"
      [disabled]="disabled()"
      etRichTextEditor
      etRichTextEditorTriggers
    ></div>
    <et-rich-text-editor-token-palette
      [triggers]="triggers()"
      [focusEditorOnInsert]="focusEditorOnInsert()"
      [editor]="rte"
    />
  `,
  imports: [RichTextEditorDirective, RichTextEditorTriggersDirective, RichTextEditorTokenPaletteComponent],
})
class PaletteTestHost {
  public disabled = signal(false);
  public focusEditorOnInsert = signal(true);
  public triggers = signal<RichTextEditorTrigger[]>([
    { char: '#', type: 'field', items: FIELDS, resolveItem: resolveField },
  ]);
}

describe('RichTextEditorTokenPaletteComponent', () => {
  let driver: RichTextEditorDriver<PaletteTestHost>;

  const chips = () => driver.queryAll<HTMLButtonElement>('et-rich-text-editor-token-palette button');
  const chipLabels = () => chips().map((chip) => chip.textContent?.replace(/\s+/g, ' ').trim());

  beforeEach(() => {
    driver = mountRichTextEditor(PaletteTestHost, { attachEditable: true });
  });

  it('renders one chip per item', () => {
    expect(chipLabels()).toEqual(['# First name', '# Legacy']);
  });

  it('does not insert a disabled item', () => {
    expect(chips()[1]?.disabled).toBe(true);

    chips()[1]?.click();
    tick();

    expect(driver.editor.value()).toBe('');
    expect(driver.editable().querySelector('[data-et-token]')).toBeNull();
  });

  it('inserts an enabled item as a token', () => {
    chips()[0]?.click();
    tick();

    expect(driver.editor.value()).toBe('{{field:first-name}}');
    expect(driver.editable().querySelectorAll('[data-et-token]').length).toBe(1);
  });

  it('disables every chip while the editor is disabled', () => {
    driver.host.disabled.set(true);
    driver.detectChanges();

    expect(chips().map((chip) => chip.disabled)).toEqual([true, true]);

    chips()[0]?.click();
    tick();

    expect(driver.editor.value()).toBe('');
  });

  it('drops only the run of an observable source that errors', () => {
    driver.host.triggers.set([
      {
        char: '@',
        type: 'mention',
        items: () => throwError(() => new Error('boom')),
      },
      { char: '#', type: 'field', items: FIELDS, resolveItem: resolveField },
    ]);
    driver.detectChanges();
    tick();

    expect(chipLabels()).toEqual(['# First name', '# Legacy']);
  });

  it('drops only the run of a source that throws synchronously', () => {
    driver.host.triggers.set([
      {
        char: '@',
        type: 'mention',
        items: () => {
          throw new Error('boom');
        },
      },
      { char: '#', type: 'field', items: FIELDS, resolveItem: resolveField },
    ]);
    driver.detectChanges();
    tick();

    expect(chipLabels()).toEqual(['# First name', '# Legacy']);
  });

  it('drops only the run of a source that rejects', async () => {
    driver.host.triggers.set([
      { char: '@', type: 'mention', items: () => Promise.reject(new Error('boom')) },
      { char: '#', type: 'field', items: FIELDS, resolveItem: resolveField },
    ]);
    driver.detectChanges();
    await driver.fixture.whenStable();
    tick();

    expect(chipLabels()).toEqual(['# First name', '# Legacy']);
  });

  describe('focusEditorOnInsert', () => {
    it('focuses the editor after an insert by default', () => {
      expect(document.activeElement).not.toBe(driver.editable());

      chips()[0]?.click();
      tick();

      expect(document.activeElement).toBe(driver.editable());
    });

    it('leaves focus where it was when turned off', () => {
      driver.host.focusEditorOnInsert.set(false);
      driver.detectChanges();

      chips()[0]?.click();
      tick();

      expect(driver.editor.value()).toBe('{{field:first-name}}');
      expect(document.activeElement).not.toBe(driver.editable());
    });
  });
});
