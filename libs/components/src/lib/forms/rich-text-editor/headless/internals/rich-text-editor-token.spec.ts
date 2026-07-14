import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { htmlToMarkdown, markdownToHtml } from '@ethlete/core';
import '../../../../../test-helpers';
import { RichTextEditorTrigger } from '../../rich-text-editor-trigger';
import { buildChipHtml, createRichTextEditorTokenCodec, tokenMarkdown } from './rich-text-editor-token';

describe('rich text editor token codec', () => {
  let doc: Document;

  const triggers: RichTextEditorTrigger[] = [
    { char: '#', type: 'block', items: [], resolveItem: (id) => ({ id, label: `Block ${id}` }) },
    { char: '@', type: 'mention', items: [], resolveItem: (id) => ({ id, label: `@${id}` }) },
  ];

  const codec = createRichTextEditorTokenCodec(() => triggers);

  beforeEach(() => {
    TestBed.configureTestingModule({});
    doc = TestBed.inject(DOCUMENT);
  });

  const serializeToString = (html: string): string => {
    const container = doc.createElement('div');
    container.innerHTML = html;
    codec.serialize(container);
    return container.innerHTML;
  };

  it('renders a token markdown form into a chip carrying its type, id and resolved label', () => {
    const html = codec.render('<p>Hello {{block:firstName}}</p>');

    expect(html).toContain('data-token-type="block"');
    expect(html).toContain('data-token-id="firstName"');
    expect(html).toContain('>Block firstName</span>');
    expect(html).toContain('contenteditable="false"');
  });

  it('falls back to the raw id when no label resolves', () => {
    const bare = createRichTextEditorTokenCodec(() => [{ char: '$', type: 'raw', items: [] }]);

    expect(bare.render('{{raw:abc}}')).toContain('>abc</span>');
  });

  it('serialize reconstructs {{type:id}} from attributes, ignoring the visible label', () => {
    expect(
      serializeToString(buildChipHtml({ type: 'block', id: 'firstName', label: 'A totally different label' })),
    ).toBe('{{block:firstName}}');
  });

  it('round-trips token markdown through markdownToHtml → render → serialize → htmlToMarkdown', () => {
    const md = 'Hi {{block:firstName}}, ping {{mention:user-1}} now';
    const rendered = codec.render(markdownToHtml(md));

    expect(htmlToMarkdown(serializeToString(rendered))).toBe(md);
  });

  it('is idempotent (serialize ∘ render) across fuzzed type/id/label combinations', () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const typeChars = `${letters}0123456789-`;
    const idChars = 'ABCDEFabcdef0123456789._:-';
    const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
    const rand = (chars: string, min: number, max: number) =>
      Array.from({ length: min + Math.floor(Math.random() * (max - min + 1)) }, () => pick(chars)).join('');

    for (let i = 0; i < 200; i++) {
      const type = letters[Math.floor(Math.random() * 26)] + rand(typeChars, 0, 6);
      const id = rand(idChars, 1, 12);
      const md = `x ${tokenMarkdown(type, id)} y`;

      // render never sees the label for these random types (no matching resolver), and serialize
      // rebuilds purely from attributes — so the text must survive untouched either way.
      expect(serializeToString(codec.render(md))).toBe(md);
    }
  });
});
