import { htmlToMarkdown, isSafeLinkUrl, isSafeUrl, MARKDOWN_VERBATIM_ATTR, markdownToHtml } from '../index';
import { useScenario } from './harness';

const roundTrip = (html: string) => markdownToHtml(htmlToMarkdown(html));

describe('markdown scenarios', () => {
  const scenario = useScenario();

  it('keeps Markdown syntax typed as text literal through a save and a reload', () => {
    scenario();

    const typed: [html: string, stored: string][] = [
      ['<p>- not a list</p>', '\\- not a list'],
      ['<p>+ not a list</p>', '\\+ not a list'],
      ['<p>* not a list</p>', '\\* not a list'],
      ['<p>1. not a list</p>', '1\\. not a list'],
      ['<p># not a heading</p>', '\\# not a heading'],
      ['<p>&gt; not a quote</p>', '\\> not a quote'],
      ['<p>---</p>', '\\---'],
      [
        '<p>**not bold** and _not italic_ and ~~not struck~~</p>',
        '\\*\\*not bold\\*\\* and \\_not italic\\_ and \\~\\~not struck\\~\\~',
      ],
      ['<p>`not code` and [not](a-link)</p>', '\\`not code\\` and \\[not\\](a-link)'],
      ['<p>&lt;u&gt;not underlined&lt;/u&gt;</p>', '\\<u>not underlined\\</u>'],
      ['<p>first<br>- second<br># third</p>', 'first\n\\- second\n\\# third'],
      ['<blockquote>&gt; one level</blockquote>', '> \\> one level'],
      ['<ul><li>- item</li></ul>', '- - item'],
      ['<p>| a | b |<br>--- | ---</p>', '\\| a | b |\n\\--- | ---'],
    ];

    for (const [html, stored] of typed) {
      expect(htmlToMarkdown(html)).toBe(stored);
      expect(roundTrip(html)).toBe(html);
    }
  });

  it('leaves ordinary text and formatting unescaped', () => {
    scenario();

    const clean = '<p>snake_case, 2 * 3, #tag, 5 - 3, a &lt; b, -5 and 3.14</p>';

    expect(htmlToMarkdown(clean)).toBe('snake_case, 2 * 3, #tag, 5 - 3, a < b, -5 and 3.14');
    expect(roundTrip(clean)).toBe(clean);
    expect(htmlToMarkdown('<h2><strong>Plan</strong></h2><ul><li>one</li></ul>')).toBe('## **Plan**\n\n- one');
  });

  it('round-trips backslashes that are already in the text', () => {
    scenario();

    const html = '<p>C:\\temp\\ and \\*kept\\* and \\\\</p>';

    expect(htmlToMarkdown(html)).toBe('C:\\\\temp\\\\ and \\\\\\*kept\\\\\\* and \\\\\\\\');
    expect(roundTrip(html)).toBe(html);
  });

  it('never escapes the content of code spans and code blocks', () => {
    scenario();

    const span = '<p>run <code>**x** [a](b) \\n _y_</code> now</p>';

    expect(htmlToMarkdown(span)).toBe('run `**x** [a](b) \\n _y_` now');
    expect(roundTrip(span)).toBe(span);

    const block = '<pre><code class="language-md">- a\n# b\n**c** \\d</code></pre>';

    expect(htmlToMarkdown(block)).toBe('```md\n- a\n# b\n**c** \\d\n```');
    expect(roundTrip(block)).toBe(block);
  });

  it('writes text marked verbatim without escaping it', () => {
    scenario();

    const html = `<p>a_ <span ${MARKDOWN_VERBATIM_ATTR}="">{{user:_x*y}}</span> *b <span ${MARKDOWN_VERBATIM_ATTR}>&lt;[c]&gt;</span></p>`;

    expect(htmlToMarkdown(html)).toBe('a\\_ {{user:_x*y}} \\*b <[c]>');
    expect(
      markdownToHtml(htmlToMarkdown(`<p><span ${MARKDOWN_VERBATIM_ATTR}="">{{user:_first_name}}</span></p>`)),
    ).toBe('<p>{{user:_first_name}}</p>');
  });

  it('leaves text matching the verbatim pattern out of Markdown parsing', () => {
    scenario();

    const verbatim = /\{\{[a-z]+:[^}]+\}\}/;
    const markdown = '{{field:_a_b_}} *b* {{field:__x__}} {{field:\\*<y>}}';

    expect(markdownToHtml(markdown, { verbatim })).toBe(
      '<p>{{field:_a_b_}} <em>b</em> {{field:__x__}} {{field:\\*&lt;y&gt;}}</p>',
    );
    expect(markdownToHtml('- {{field:__x__}}\n- `{{field:_a_}}`', { verbatim })).toBe(
      '<ul><li>{{field:__x__}}</li><li><code>{{field:_a_}}</code></li></ul>',
    );
    expect(markdownToHtml(markdown)).toBe(
      '<p>{{field:<em>a_b</em>}} <em>b</em> {{field:<strong>x</strong>}} {{field:*&lt;y&gt;}}</p>',
    );
  });

  it('escapes link labels but not link targets', () => {
    scenario();

    const html = '<p><a href="https://example.com/a_b_c?x=*">[see] *docs*</a></p>';

    expect(htmlToMarkdown(html)).toBe('[\\[see\\] \\*docs\\*](https://example.com/a_b_c?x=*)');
    expect(roundTrip(html)).toBe(html);
  });

  it('keeps only the text of a link whose url scheme is not safe', () => {
    scenario();

    for (const href of [
      'javascript:steal()',
      ' JaVaScRiPt:steal()',
      'java\tscript:steal()',
      '&#106;avascript:steal()',
      'data:text/html,x',
      'vbscript:x',
      'file:///etc/passwd',
    ]) {
      expect(htmlToMarkdown(`<p><a href="${href}">x</a></p>`)).toBe('x');
      expect(htmlToMarkdown(`<p><a href="${href}" target="_blank">x</a></p>`)).toBe('x');
      expect(isSafeLinkUrl(href)).toBe(false);
    }

    for (const href of [
      'https://a.dev',
      'http://a.dev',
      'mailto:a@b.dev',
      'tel:+49123',
      '/docs',
      '../up',
      '#top',
      '?q=1',
    ]) {
      expect(htmlToMarkdown(`<p><a href="${href}">x</a></p>`)).toBe(`[x](${href})`);
      expect(isSafeLinkUrl(href)).toBe(true);
    }
  });

  it('renders a markdown link the link editor would refuse as its text', () => {
    scenario();

    for (const href of ['file:///etc/passwd', 'intent://scan#Intent;end', 'ftp://a.dev/f']) {
      expect(isSafeLinkUrl(href)).toBe(false);
      expect(markdownToHtml(`[docs](${href})`)).toBe('<p>docs</p>');
      expect(markdownToHtml(`<a href="${href}" target="_blank">docs</a>`)).toBe('<p>docs</p>');
    }

    expect(markdownToHtml('[docs](https://a.dev)')).toBe('<p><a href="https://a.dev">docs</a></p>');
  });

  it('refuses image sources that can run script and keeps real images', () => {
    scenario();

    for (const src of ['javascript:alert(1)', ' JaVa\tScript:alert(1)', 'vbscript:x', 'data:text/html,<b>x</b>']) {
      expect(isSafeUrl(src)).toBe(false);
    }

    for (const src of ['https://a.dev/i.png', '/i.png', 'data:image/png;base64,AAAA']) {
      expect(isSafeUrl(src)).toBe(true);
    }
  });
});
