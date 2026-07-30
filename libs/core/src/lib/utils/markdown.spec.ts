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

  it('renders a new-tab link (raw anchor) with forced rel', () => {
    expect(markdownToHtml('<a href="https://example.com" target="_blank" rel="noopener noreferrer">shop</a>')).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">shop</a></p>',
    );
  });

  it('processes inner markup of a new-tab link', () => {
    expect(markdownToHtml('<a href="https://example.com" target="_blank">**shop**</a>')).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer"><strong>shop</strong></a></p>',
    );
  });

  it('drops a new-tab link with an unsafe href (escaped as text)', () => {
    expect(markdownToHtml('<a href="javascript:alert(1)" target="_blank">x</a>')).toBe(
      '<p>&lt;a href=&quot;javascript:alert(1)&quot; target=&quot;_blank&quot;&gt;x&lt;/a&gt;</p>',
    );
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

  it('converts nested lists (two spaces per level)', () => {
    expect(markdownToHtml('- one\n  - two\n  - three\n- four')).toBe(
      '<ul><li>one<ul><li>two</li><li>three</li></ul></li><li>four</li></ul>',
    );
    // a nested list of the other type
    expect(markdownToHtml('- a\n  1. b')).toBe('<ul><li>a<ol><li>b</li></ol></li></ul>');
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

  it('applies GFM column alignment from the separator line to every cell', () => {
    const input = '| A | B | C |\n| :--- | :---: | ---: |\n| a | b | c |';
    expect(markdownToHtml(input)).toBe(
      '<table><thead><tr><th style="text-align: left">A</th><th style="text-align: center">B</th><th style="text-align: right">C</th></tr></thead>' +
        '<tbody><tr><td style="text-align: left">a</td><td style="text-align: center">b</td><td style="text-align: right">c</td></tr></tbody></table>',
    );
  });

  it('converts single-underscore emphasis but not inside a word', () => {
    expect(markdownToHtml('some _emphasis_ here')).toBe('<p>some <em>emphasis</em> here</p>');
    expect(markdownToHtml('a snake_case_name stays literal')).toBe('<p>a snake_case_name stays literal</p>');
  });

  it('leaves whitespace-flanked delimiters as literal text', () => {
    expect(markdownToHtml('2 * 3 * 4')).toBe('<p>2 * 3 * 4</p>');
    expect(markdownToHtml('a ** b ** c')).toBe('<p>a ** b ** c</p>');
    expect(markdownToHtml('a ~~ b ~~ c')).toBe('<p>a ~~ b ~~ c</p>');
  });

  it('escapes raw html instead of rendering it', () => {
    expect(markdownToHtml('hello <img src=x onerror=alert(1)> world')).toBe(
      '<p>hello &lt;img src=x onerror=alert(1)&gt; world</p>',
    );
    expect(markdownToHtml('a <b important thing')).toBe('<p>a &lt;b important thing</p>');
  });

  it('does not double-escape entities already present in the markdown', () => {
    expect(markdownToHtml('a &amp; b')).toBe('<p>a &amp; b</p>');
  });

  it('keeps links and images with script-running url schemes as literal text', () => {
    expect(markdownToHtml('[click](javascript:alert(1))')).toBe('<p>[click](javascript:alert(1))</p>');
    expect(markdownToHtml('[click](java\tscript:alert(1))')).toBe('<p>[click](java\tscript:alert(1))</p>');
    expect(markdownToHtml('![x](javascript:alert(1))')).toBe('<p>![x](javascript:alert(1))</p>');
  });

  it('strips foreign attributes and unsafe tags from an aligned block', () => {
    expect(markdownToHtml('<p style="text-align: center" onmouseover="alert(1)">hi <script>x</script></p>')).toBe(
      '<p style="text-align: center">hi x</p>',
    );
    expect(
      markdownToHtml(
        '<p style="text-align: right"><strong onclick="x()">b</strong> <a href="javascript:y()">l</a></p>',
      ),
    ).toBe('<p style="text-align: right"><strong>b</strong> <a>l</a></p>');
  });

  it('converts multi-line block quotes with inline formatting per line', () => {
    expect(markdownToHtml('> **a**\n> b')).toBe('<blockquote><strong>a</strong><br>b</blockquote>');
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

  it('hoists boundary whitespace out of emphasis delimiters (invalid CommonMark otherwise)', () => {
    expect(htmlToMarkdown('<p>test<strong> fett</strong></p>')).toBe('test **fett**');
    expect(htmlToMarkdown('<p><strong>fett </strong>rest</p>')).toBe('**fett** rest');
    expect(htmlToMarkdown('<p>a<em> kursiv </em>b</p>')).toBe('a *kursiv* b');
    expect(htmlToMarkdown('<p>a<del>&nbsp;weg</del></p>')).toBe('a ~~weg~~');
    expect(htmlToMarkdown('<p>a<strong><em> both</em></strong></p>')).toBe('a ***both***');
    // whitespace-only content has no markdown form — stays unwrapped
    expect(htmlToMarkdown('<p>a<strong> </strong>b</p>')).toBe('a b');
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

  it('preserves aligned blocks as raw native HTML (no Markdown form)', () => {
    const aligned = '<p style="text-align: center">Centered</p>';
    expect(htmlToMarkdown(aligned)).toBe(aligned);
    expect(markdownToHtml(aligned)).toBe(aligned);
    // an aligned heading round-trips too, and a normal paragraph beside it stays Markdown
    expect(htmlToMarkdown('<h2 style="text-align: right">Title</h2><p>body</p>')).toBe(
      '<h2 style="text-align: right">Title</h2>\n\nbody',
    );
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

  it('preserves a new-tab link as raw HTML', () => {
    expect(htmlToMarkdown('<a href="https://example.com" target="_blank" rel="noopener noreferrer">shop</a>')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">shop</a>',
    );
  });

  it('round-trips a new-tab link through both directions', () => {
    const md = '<a href="https://example.com" target="_blank" rel="noopener noreferrer">shop</a>';
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
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

  it('serializes nested lists with two-space indentation', () => {
    const input = '<ul><li>one<ul><li>two</li><li>three</li></ul></li><li>four</li></ul>';
    expect(htmlToMarkdown(input)).toBe('- one\n  - two\n  - three\n- four');
  });

  it('round-trips a nested list through both directions', () => {
    const md = '- one\n  - two\n    - three\n- four';
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
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

  it('serializes column alignment from the header cells into the GFM separator', () => {
    const input =
      '<table><thead><tr><th style="text-align: center">A</th><th>B</th><th style="text-align: right">C</th></tr></thead>' +
      '<tbody><tr><td style="text-align: center">a</td><td>b</td><td style="text-align: right">c</td></tr></tbody></table>';
    expect(htmlToMarkdown(input)).toBe('| A | B | C |\n| :---: | --- | ---: |\n| a | b | c |');
  });

  it('round-trips table column alignment through both directions', () => {
    const md = '| A | B |\n| :---: | ---: |\n| a | b |';
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
  });

  it('keeps br line breaks inside paragraphs and block quotes', () => {
    expect(htmlToMarkdown('<p>line a<br>line b</p>')).toBe('line a\nline b');
    expect(htmlToMarkdown('<blockquote>line a<br>line b</blockquote>')).toBe('> line a\n> line b');
  });

  it('degrades a br inside a table cell or list item to a space', () => {
    expect(htmlToMarkdown('<table><tr><th>H</th></tr><tr><td>a<br>b</td></tr></table>')).toBe(
      '| H |\n| --- |\n| a b |',
    );
    expect(htmlToMarkdown('<ul><li>a<br>b</li></ul>')).toBe('- a b');
  });

  it('round-trips a soft line break through both directions', () => {
    expect(htmlToMarkdown(markdownToHtml('line a\nline b'))).toBe('line a\nline b');
  });

  it('round-trips a multi-line block quote through both directions', () => {
    expect(htmlToMarkdown(markdownToHtml('> line one\n> line two'))).toBe('> line one\n> line two');
  });

  it('nests block quotes, one > per level', () => {
    expect(htmlToMarkdown('<blockquote>outer<blockquote>inner</blockquote></blockquote>')).toBe(
      '> outer\n> > inner',
    );
    expect(markdownToHtml('> outer\n> > inner')).toBe('<blockquote>outer<blockquote>inner</blockquote></blockquote>');
    expect(htmlToMarkdown(markdownToHtml('> a\n> > b\n> > > c'))).toBe('> a\n> > b\n> > > c');
  });

  it('keeps an empty block quote in the value', () => {
    expect(htmlToMarkdown('<blockquote><br></blockquote>')).toBe('>');
    expect(markdownToHtml('>')).toBe('<blockquote><br></blockquote>');
  });

  it('treats a paragraph boundary inside a block quote as a line break', () => {
    expect(htmlToMarkdown('<blockquote><p>a</p><p>b</p></blockquote>')).toBe('> a\n> b');
  });

  it('treats div boundaries as paragraph boundaries (clipboard html)', () => {
    expect(htmlToMarkdown('<div>first</div><div>second</div>')).toBe('first\n\nsecond');
    expect(htmlToMarkdown('<div><span>a</span></div><p>b</p>')).toBe('a\n\nb');
  });

  it('round-trips literal angle brackets typed by the user', () => {
    // the editor serializes typed `<` as markdown text; re-rendering must not treat it as a tag
    expect(htmlToMarkdown(markdownToHtml('a < b and c <b not a tag'))).toBe('a < b and c <b not a tag');
  });
});
