import { Component, signal } from '@angular/core';
import '../../../test-helpers';
import { tick } from '../../testing/driver-core';
import { mountRichTextEditor, RichTextEditorDriver } from '../testing/rich-text-editor-driver';
import { RichTextEditorTrigger, RichTextEditorTriggerItem } from './rich-text-editor-trigger';
import { RICH_TEXT_EDITOR_TRIGGERS_IMPORTS } from './rich-text-editor-triggers.imports';
import { provideRichTextEditorDefaultTools } from './tools/rich-text-editor-default-tools.provider';
import { RICH_TEXT_EDITOR_IMPORTS } from './rich-text-editor.imports';

const FIELDS: RichTextEditorTriggerItem[] = [{ id: 'firstName', label: 'First name' }];
const USERS: RichTextEditorTriggerItem[] = [{ id: 'ada', label: 'Ada' }];

@Component({
  template: `
    <et-rich-text-editor
      [(value)]="value"
      [readonly]="readonly()"
      [disabled]="disabled()"
      [triggers]="triggers"
      etRichTextEditorTriggers
    />
  `,
  imports: [RICH_TEXT_EDITOR_IMPORTS, RICH_TEXT_EDITOR_TRIGGERS_IMPORTS],
  providers: [provideRichTextEditorDefaultTools()],
})
class EdgeCaseEditorTestHost {
  public value = signal<string>('');
  public readonly = signal(false);
  public disabled = signal(false);
  public triggers: RichTextEditorTrigger[] = [
    {
      char: '#',
      type: 'block',
      items: FIELDS,
      resolveItem: (id) => FIELDS.find((item) => item.id === id) ?? null,
    },
    {
      char: '@',
      type: 'user',
      items: USERS,
      resolveItem: (id) => USERS.find((item) => item.id === id) ?? null,
    },
  ];
}

describe('RichTextEditorComponent edge cases', () => {
  let driver: RichTextEditorDriver<EdgeCaseEditorTestHost>;
  let host: EdgeCaseEditorTestHost;

  beforeEach(() => {
    driver = mountRichTextEditor(EdgeCaseEditorTestHost);
    host = driver.fixture.componentInstance;
    driver.caretAtStart();
  });

  describe('pasting html with disallowed markup', () => {
    it('keeps no script, iframe, event handler or javascript: link', () => {
      driver.paste({
        html: '<p>safe<script>alert(1)</script><iframe src="https://x.test"></iframe><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">bad</a> <a href="https://ok.test">good</a></p>',
      });

      const html = driver.html();

      expect(html).not.toContain('<script');
      expect(html).not.toContain('<iframe');
      expect(html).not.toContain('onerror');
      expect(html).not.toContain('javascript:');
      expect(driver.value()).not.toContain('javascript:');
      expect(driver.value()).toContain('safe');
      expect(driver.value()).toContain('[good](https://ok.test)');
    });

    it('drops the text of a style block pasted from Word', () => {
      driver.paste({ html: '<style>p { color: red }</style><p>hello</p>' });

      expect(driver.value()).toBe('hello');
    });
  });

  describe('trigger chars', () => {
    it('turns `#` and `@` into chips of their own trigger type', () => {
      driver.type('#');
      driver.press('Enter');
      driver.type('@');
      driver.press('Enter');

      expect(driver.value()).toBe('{{block:firstName}} {{user:ada}}');
    });

    it('redoes a chip insertion that was undone', () => {
      driver.type('#');
      driver.press('Enter');

      const withChip = driver.value();

      driver.editor.undo();

      expect(driver.editableText()).toBe('#');

      driver.editor.redo();

      expect(driver.value()).toBe(withChip);
      expect(driver.query('[data-et-token]')).not.toBeNull();
    });
  });

  describe('empty document', () => {
    it('emits an empty string, not null, once all content is deleted', () => {
      driver.type('hi');
      driver.setHtml('');
      driver.editor.syncFromDom();
      tick();

      expect(host.value()).toBe('');
      expect(driver.editor.hasValue()).toBe(false);
    });

    it('renders a null value from API data as an empty document', () => {
      host.value.set(null as unknown as string);
      tick();

      expect(driver.editableText()).toBe('');
      expect(driver.editor.hasValue()).toBe(false);
    });
  });

  describe.each(['readonly', 'disabled'] as const)('when %s', (state) => {
    beforeEach(() => {
      driver.type('hi');
      host[state].set(true);
      tick();
    });

    it('marks the editable as not editable', () => {
      expect(driver.editable().getAttribute('contenteditable')).toBe('false');
    });

    it('ignores a paste', () => {
      driver.paste({ html: '<p>pasted</p>' });

      expect(driver.value()).toBe('hi');
    });

    it('ignores undo', () => {
      driver.editor.undo();

      expect(driver.value()).toBe('hi');
    });

    it('ignores a token insert', () => {
      driver.editor.insertToken('block', 'firstName', { focus: false });

      expect(driver.value()).toBe('hi');
    });
  });
});
