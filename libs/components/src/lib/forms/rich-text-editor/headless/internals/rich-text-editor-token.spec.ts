import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { htmlToMarkdown, markdownToHtml } from '@ethlete/core';
import '../../../../../test-helpers';
import { RichTextEditorTrigger } from '../../rich-text-editor-trigger';
import {
  buildChipHtml,
  createRichTextEditorTokenCodec,
  TOKEN_LABEL_CLASS,
  TOKEN_PREFIX_CLASS,
  tokenMarkdown,
} from './rich-text-editor-token';

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

  it('shows the trigger char as a prefix span ahead of the label', () => {
    const html = codec.render('{{block:firstName}}');

    expect(html).toContain(`<span class="${TOKEN_PREFIX_CLASS}">#</span>`);
    expect(html).toContain(`<span class="${TOKEN_LABEL_CLASS}">Block firstName</span>`);
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

  describe('parseTokenText', () => {
    const MERGE_FIELDS = [
      { id: 'firstName', label: 'User Name' },
      { id: 'user', label: 'User' },
      { id: 'email', label: 'Email' },
      { id: 'retired', label: 'Retired', disabled: true },
    ];
    const parser = createRichTextEditorTokenCodec(() => [
      { char: '#', type: 'block', items: MERGE_FIELDS },
      // a search source has no list to match against
      { char: '@', type: 'mention', items: () => [{ id: 'u1', label: 'Someone' }] },
    ]);

    it('turns a trigger char plus a label into token markdown', () => {
      expect(parser.parseTokenText('Hi #User Name, mail #Email please')).toBe(
        'Hi {{block:firstName}}, mail {{block:email}} please',
      );
    });

    it('prefers the longest label so a shorter one does not win', () => {
      expect(parser.parseTokenText('#User Name')).toBe('{{block:firstName}}');
      expect(parser.parseTokenText('#User')).toBe('{{block:user}}');
    });

    it('accepts the id form and ignores case', () => {
      expect(parser.parseTokenText('#firstName and #EMAIL')).toBe('{{block:firstName}} and {{block:email}}');
    });

    it('only matches at word boundaries', () => {
      expect(parser.parseTokenText('#Emails')).toBe('#Emails');
      expect(parser.parseTokenText('mail#Email')).toBe('mail#Email');
      expect(parser.parseTokenText('(#Email)')).toBe('({{block:email}})');
    });

    it('leaves disabled items, unknown labels and search-sourced triggers alone', () => {
      expect(parser.parseTokenText('#Retired #Nothing @Someone')).toBe('#Retired #Nothing @Someone');
    });

    it('renders what it parsed as a chip', () => {
      const html = parser.render(parser.parseTokenText('#Email'));

      expect(html).toContain('data-token-id="email"');
      expect(html).toContain('>Email</span>');
    });

    it('returns the text unchanged when there is nothing to recognize', () => {
      const text = 'plain text with a # and an @ in it';

      expect(parser.parseTokenText(text)).toBe(text);
    });
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
      // rebuilds purely from attributes - so the text must survive untouched either way.
      expect(serializeToString(codec.render(md))).toBe(md);
    }
  });
});
