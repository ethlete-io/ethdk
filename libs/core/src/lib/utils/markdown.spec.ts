import { htmlToMarkdown, markdownToHtml } from './markdown';

describe('markdownToHtml', () => {
  it('returns empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('');
    expect(markdownToHtml(null as unknown as string)).toBe('');
  });

  it('converts headings', () => {
    expect(markdownToHtml('# Heading 1')).toBe('<h1>Heading 1</h1>');
    expect(markdownToHtml('## Heading 2')).toBe('<h2>Heading 2</h2>');
    expect(markdownToHtml('### Heading 3')).toBe('<h3>Heading 3</h3>');
    expect(markdownToHtml('#### Heading 4')).toBe('<h4>Heading 4</h4>');
  });

  it('converts inline formatting inside headings', () => {
    expect(markdownToHtml('# **bold** title')).toBe('<h1><strong>bold</strong> title</h1>');
  });

  it('converts a heading directly followed by a list (no blank line)', () => {
    const input = '### Branding\n- item one\n- item two';
    expect(markdownToHtml(input)).toBe('<h3>Branding</h3>\n<ul><li>item one</li><li>item two</li></ul>');
  });

  it('converts a heading directly followed by a paragraph (no blank line)', () => {
    const input = '## Title\nsome text';
    expect(markdownToHtml(input)).toBe('<h2>Title</h2>\n<p>some text</p>');
  });

  it('converts bold and italic', () => {
    expect(markdownToHtml('**bold**')).toBe('<p><strong>bold</strong></p>');
    expect(markdownToHtml('__bold__')).toBe('<p><strong>bold</strong></p>');
    expect(markdownToHtml('*italic*')).toBe('<p><em>italic</em></p>');
    expect(markdownToHtml('***bold italic***')).toBe('<p><strong><em>bold italic</em></strong></p>');
  });

  it('converts strikethrough', () => {
    expect(markdownToHtml('~~strikethrough~~')).toBe('<p><del>strikethrough</del></p>');
  });

  it('converts inline code', () => {
    expect(markdownToHtml('`code`')).toBe('<p><code>code</code></p>');
  });

  it('escapes html inside inline code', () => {
    expect(markdownToHtml('`<div>`')).toBe('<p><code>&lt;div&gt;</code></p>');
  });

  it('converts fenced code blocks', () => {
    const input = '```typescript\nconst x = 1;\n```';
    expect(markdownToHtml(input)).toBe('<pre><code class="language-typescript">const x = 1;</code></pre>');
  });

  it('converts fenced code block without language', () => {
    const input = '```\nsome code\n```';
    expect(markdownToHtml(input)).toBe('<pre><code>some code</code></pre>');
  });

  it('converts links', () => {
    expect(markdownToHtml('[text](https://example.com)')).toBe('<p><a href="https://example.com">text</a></p>');
  });

  it('converts images', () => {
    expect(markdownToHtml('![alt text](https://example.com/img.png)')).toBe(
      '<p><img src="https://example.com/img.png" alt="alt text"></p>',
    );
  });

  it('converts horizontal rules', () => {
    expect(markdownToHtml('---')).toBe('<hr>');
    expect(markdownToHtml('***')).toBe('<hr>');
  });

  it('converts block quotes', () => {
    expect(markdownToHtml('> some quote')).toBe('<blockquote>some quote</blockquote>');
  });

  it('converts unordered lists', () => {
    const input = '- item one\n- item two\n- item three';
    expect(markdownToHtml(input)).toBe('<ul><li>item one</li><li>item two</li><li>item three</li></ul>');
  });

  it('converts ordered lists', () => {
    const input = '1. first\n2. second\n3. third';
    expect(markdownToHtml(input)).toBe('<ol><li>first</li><li>second</li><li>third</li></ol>');
  });

  it('wraps plain text in paragraphs', () => {
    expect(markdownToHtml('hello world')).toBe('<p>hello world</p>');
  });

  it('separates paragraphs on double newline', () => {
    const input = 'first paragraph\n\nsecond paragraph';
    expect(markdownToHtml(input)).toBe('<p>first paragraph</p>\n<p>second paragraph</p>');
  });

  it('converts single newlines in a paragraph to br', () => {
    const input = 'line one\nline two';
    expect(markdownToHtml(input)).toBe('<p>line one<br>line two</p>');
  });

  it('does not process markdown inside code blocks', () => {
    const input = '```\n**not bold**\n```';
    expect(markdownToHtml(input)).toBe('<pre><code>**not bold**</code></pre>');
  });

  it('converts a table', () => {
    const input = '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |';
    expect(markdownToHtml(input)).toBe(
      '<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr></tbody></table>',
    );
  });

  it('converts a table with only a header row', () => {
    const input = '| Name | Age |\n| --- | --- |';
    expect(markdownToHtml(input)).toBe('<table><thead><tr><th>Name</th><th>Age</th></tr></thead></table>');
  });

  it('converts inline formatting inside table cells', () => {
    const input = '| Col |\n| --- |\n| **bold** |';
    expect(markdownToHtml(input)).toBe(
      '<table><thead><tr><th>Col</th></tr></thead><tbody><tr><td><strong>bold</strong></td></tr></tbody></table>',
    );
  });
});

describe('htmlToMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
    expect(htmlToMarkdown(null as unknown as string)).toBe('');
  });

  it('converts headings', () => {
    expect(htmlToMarkdown('<h1>Heading 1</h1>')).toBe('# Heading 1');
    expect(htmlToMarkdown('<h2>Heading 2</h2>')).toBe('## Heading 2');
    expect(htmlToMarkdown('<h3>Heading 3</h3>')).toBe('### Heading 3');
  });

  it('preserves inline formatting inside headings', () => {
    expect(htmlToMarkdown('<h1><strong>bold</strong> title</h1>')).toBe('# **bold** title');
    expect(htmlToMarkdown('<h2>a <a href="https://example.com">link</a></h2>')).toBe(
      '## a [link](https://example.com)',
    );
  });

  it('converts bold and italic', () => {
    expect(htmlToMarkdown('<strong>bold</strong>')).toBe('**bold**');
    expect(htmlToMarkdown('<b>bold</b>')).toBe('**bold**');
    expect(htmlToMarkdown('<em>italic</em>')).toBe('*italic*');
    expect(htmlToMarkdown('<i>italic</i>')).toBe('*italic*');
    expect(htmlToMarkdown('<strong><em>both</em></strong>')).toBe('***both***');
  });

  it('converts strikethrough', () => {
    expect(htmlToMarkdown('<del>struck</del>')).toBe('~~struck~~');
    expect(htmlToMarkdown('<s>struck</s>')).toBe('~~struck~~');
  });

  it('converts inline code', () => {
    expect(htmlToMarkdown('<code>snippet</code>')).toBe('`snippet`');
  });

  it('preserves underline as raw <u> (no Markdown form)', () => {
    expect(htmlToMarkdown('<p><u>under</u></p>')).toBe('<u>under</u>');
    // round-trips through both directions, keeping inner Markdown marks
    expect(htmlToMarkdown('<p>a <u><strong>b</strong></u> c</p>')).toBe('a <u>**b**</u> c');
    expect(markdownToHtml('a <u>**b**</u> c')).toBe('<p>a <u><strong>b</strong></u> c</p>');
  });

  it('converts code blocks with language', () => {
    const input = '<pre><code class="language-typescript">const x = 1;</code></pre>';
    expect(htmlToMarkdown(input)).toBe('```typescript\nconst x = 1;\n```');
  });

  it('converts code blocks without language', () => {
    const input = '<pre><code>some code</code></pre>';
    expect(htmlToMarkdown(input)).toBe('```\nsome code\n```');
  });

  it('converts links', () => {
    expect(htmlToMarkdown('<a href="https://example.com">text</a>')).toBe('[text](https://example.com)');
  });

  it('converts images', () => {
    expect(htmlToMarkdown('<img src="https://example.com/img.png" alt="alt text">')).toBe(
      '![alt text](https://example.com/img.png)',
    );
  });

  it('converts horizontal rules', () => {
    expect(htmlToMarkdown('<hr>')).toBe('---');
    expect(htmlToMarkdown('<hr />')).toBe('---');
  });

  it('converts block quotes', () => {
    expect(htmlToMarkdown('<blockquote>some quote</blockquote>')).toBe('> some quote');
  });

  it('converts unordered lists', () => {
    const input = '<ul><li>item one</li><li>item two</li></ul>';
    expect(htmlToMarkdown(input)).toBe('- item one\n- item two');
  });

  it('converts ordered lists', () => {
    const input = '<ol><li>first</li><li>second</li></ol>';
    expect(htmlToMarkdown(input)).toBe('1. first\n2. second');
  });

  it('converts paragraphs', () => {
    expect(htmlToMarkdown('<p>hello world</p>')).toBe('hello world');
  });

  it('converts br to newline', () => {
    expect(htmlToMarkdown('line one<br>line two')).toBe('line one\nline two');
    expect(htmlToMarkdown('line one<br/>line two')).toBe('line one\nline two');
  });

  it('unescapes html entities', () => {
    expect(htmlToMarkdown('&amp; &lt; &gt; &quot;')).toBe('& < > "');
  });

  it('strips unknown tags', () => {
    expect(htmlToMarkdown('<div><span>text</span></div>')).toBe('text');
  });

  it('converts a table with thead/tbody', () => {
    const input =
      '<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr></tbody></table>';
    expect(htmlToMarkdown(input)).toBe('| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |');
  });

  it('converts a table without thead (first row becomes header)', () => {
    const input = '<table><tr><th>Name</th><th>Age</th></tr><tr><td>Alice</td><td>30</td></tr></table>';
    expect(htmlToMarkdown(input)).toBe('| Name | Age |\n| --- | --- |\n| Alice | 30 |');
  });
});
