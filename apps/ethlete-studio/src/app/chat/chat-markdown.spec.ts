import { parseChatInlines, parseChatMarkdown } from './chat-markdown';

describe('parseChatInlines', () => {
  it('splits inline code and bold out of plain text', () => {
    expect(parseChatInlines('Run `yarn build` and **wait** now')).toEqual([
      { kind: 'text', text: 'Run ' },
      { kind: 'code', text: 'yarn build' },
      { kind: 'text', text: ' and ' },
      { kind: 'bold', text: 'wait' },
      { kind: 'text', text: ' now' },
    ]);
  });

  it('leaves unclosed markers, links, images and html as plain text', () => {
    const source = 'a `b **c** [x](http://y) ![i](z) <b>h</b>';

    expect(parseChatInlines(source)).toEqual([
      { kind: 'text', text: 'a `b ' },
      { kind: 'bold', text: 'c' },
      { kind: 'text', text: ' [x](http://y) ![i](z) <b>h</b>' },
    ]);
  });
});

describe('parseChatMarkdown', () => {
  it('reads paragraphs separated by blank lines and keeps single line breaks', () => {
    expect(parseChatMarkdown('one\ntwo\n\nthree')).toEqual([
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'one\ntwo' }] },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'three' }] },
    ]);
  });

  it('reads a fenced code block verbatim, without parsing its content', () => {
    expect(parseChatMarkdown('before\n```ts\nconst a = `**x**`;\n\n- not a list\n```\nafter')).toEqual([
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'before' }] },
      { kind: 'code', language: 'ts', text: 'const a = `**x**`;\n\n- not a list' },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'after' }] },
    ]);
  });

  it('treats an unclosed fence as code to the end', () => {
    expect(parseChatMarkdown('```\nopen')).toEqual([{ kind: 'code', language: '', text: 'open' }]);
  });

  it('reads unordered and ordered lists with inline markup and continuation lines', () => {
    expect(parseChatMarkdown('- a `b`\n- **c**\n  more\n\n3. x\n4. y')).toEqual([
      {
        kind: 'list',
        ordered: false,
        start: 1,
        items: [
          [
            { kind: 'text', text: 'a ' },
            { kind: 'code', text: 'b' },
          ],
          [
            { kind: 'bold', text: 'c' },
            { kind: 'text', text: '\nmore' },
          ],
        ],
      },
      {
        kind: 'list',
        ordered: true,
        start: 3,
        items: [[{ kind: 'text', text: 'x' }], [{ kind: 'text', text: 'y' }]],
      },
    ]);
  });

  it('ends a list at the next plain line', () => {
    expect(parseChatMarkdown('- a\nplain')).toMatchObject([{ kind: 'list' }, { kind: 'paragraph' }]);
  });
});
