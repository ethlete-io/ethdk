const escapeHtml = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const unescapeHtml = (str: string): string =>
  str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

const stripTags = (str: string): string => str.replace(/<[^>]+>/g, '');

const parseTableRow = (line: string): string[] =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

const isTableSeparatorLine = (line: string): boolean => /^\|?(\s*:?-+:?\s*\|)+\s*$/.test(line);

const makePlaceholder = (kind: string, idx: number) => `\u{E000}${kind}${idx}\u{E001}`;
const placeholderRe = (kind: string) => new RegExp(`\u{E000}${kind}(\\d+)\u{E001}`, 'gu');
const isPlaceholder = (kind: string, str: string) => new RegExp(`^\u{E000}${kind}\\d+\u{E001}$`, 'u').test(str);

const processInline = (text: string): string => {
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_, code: string) => {
    const idx = inlineCodes.push(`<code>${escapeHtml(code)}</code>`) - 1;
    return makePlaceholder('IC', idx);
  });

  // Bold + italic — *** before ** before *
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Images before links (order matters)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return text.replace(placeholderRe('IC'), (_, i) => inlineCodes[+i] ?? '');
};

/**
 * Converts a markdown string to HTML.
 * Covers headings, bold, italic, strikethrough, inline code, fenced code blocks,
 * links, images, block quotes, unordered/ordered lists, tables, horizontal rules, and paragraphs.
 */
export const markdownToHtml = (markdown: string): string => {
  if (!markdown) return '';

  let text = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Extract fenced code blocks before any other processing
  const codeBlocks: string[] = [];
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang: string, code: string) => {
    const langAttr = lang ? ` class="language-${lang}"` : '';
    const idx = codeBlocks.push(`<pre><code${langAttr}>${escapeHtml(code.trim())}</code></pre>`) - 1;
    return makePlaceholder('CODE', idx);
  });

  const html = text
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';

      if (isPlaceholder('CODE', trimmed)) return trimmed;

      // Heading
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch?.[1] && headingMatch?.[2]) {
        const level = headingMatch[1].length;
        return `<h${level}>${processInline(headingMatch[2].trim())}</h${level}>`;
      }

      // Horizontal rule
      if (/^(---|\*\*\*|___)\s*$/.test(trimmed)) return '<hr>';

      // Table (GFM)
      const tableLines = trimmed.split('\n');
      if (tableLines.length >= 2 && /\|/.test(tableLines[0] ?? '') && isTableSeparatorLine(tableLines[1] ?? '')) {
        const headers = parseTableRow(tableLines[0] ?? '');
        const thead = `<thead><tr>${headers.map((h) => `<th>${processInline(h)}</th>`).join('')}</tr></thead>`;
        const bodyRows = tableLines.slice(2);
        const tbody =
          bodyRows.length > 0
            ? `<tbody>${bodyRows
                .map(
                  (row) =>
                    `<tr>${parseTableRow(row)
                      .map((cell) => `<td>${processInline(cell)}</td>`)
                      .join('')}</tr>`,
                )
                .join('')}</tbody>`
            : '';
        return `<table>${thead}${tbody}</table>`;
      }

      // Blockquote
      if (/^> /.test(trimmed)) {
        const content = trimmed
          .split('\n')
          .map((l) => l.replace(/^>\s?/, ''))
          .join('<br>');
        return `<blockquote>${processInline(content)}</blockquote>`;
      }

      // Unordered list
      if (/^[-*+]\s/.test(trimmed)) {
        const items = trimmed
          .split('\n')
          .filter((l) => /^[-*+]\s/.test(l))
          .map((l) => `<li>${processInline(l.replace(/^[-*+]\s+/, '').trim())}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }

      // Ordered list
      if (/^\d+\.\s/.test(trimmed)) {
        const items = trimmed
          .split('\n')
          .filter((l) => /^\d+\.\s/.test(l))
          .map((l) => `<li>${processInline(l.replace(/^\d+\.\s+/, '').trim())}</li>`)
          .join('');
        return `<ol>${items}</ol>`;
      }

      // Paragraph — single newlines within a block become <br>
      return `<p>${trimmed
        .split('\n')
        .map((l) => processInline(l))
        .join('<br>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  return html.replace(placeholderRe('CODE'), (_, i) => codeBlocks[+i] ?? '');
};

/**
 * Converts an HTML string to markdown.
 * Covers headings, bold, italic, strikethrough, inline code, fenced code blocks,
 * links, images, block quotes, unordered/ordered lists, tables, horizontal rules, and paragraphs.
 */
export const htmlToMarkdown = (html: string): string => {
  if (!html) return '';

  let md = html;

  // Code blocks — process before inline code
  md = md.replace(
    /<pre[^>]*><code[^>]*class="language-([^"]+)"[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    (_, lang: string, code: string) => `\n\`\`\`${lang}\n${unescapeHtml(code.trim())}\n\`\`\`\n`,
  );
  md = md.replace(
    /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    (_, code: string) => `\n\`\`\`\n${unescapeHtml(code.trim())}\n\`\`\`\n`,
  );
  md = md.replace(
    /<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    (_, code: string) => `\n\`\`\`\n${unescapeHtml(code.trim())}\n\`\`\`\n`,
  );

  // Headings
  for (let i = 6; i >= 1; i--) {
    md = md.replace(
      new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi'),
      (_, content: string) => `\n${'#'.repeat(i)} ${stripTags(content).trim()}\n`,
    );
  }

  // Bold + italic (combined before individual)
  md = md.replace(/<strong[^>]*><em[^>]*>([\s\S]*?)<\/em><\/strong>/gi, '***$1***');
  md = md.replace(/<em[^>]*><strong[^>]*>([\s\S]*?)<\/strong><\/em>/gi, '***$1***');
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  md = md.replace(/<(del|s|strike)[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~');

  // Inline code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, code: string) => `\`${unescapeHtml(code)}\``);

  // Links and images
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]+alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Block quotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content: string) => {
    return (
      stripTags(content)
        .trim()
        .split('\n')
        .map((line) => `> ${line.trim()}`)
        .join('\n') + '\n'
    );
  });

  // Lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content: string) => {
    return (
      '\n' +
      content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, item: string) => `- ${stripTags(item).trim()}\n`)
    );
  });
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content: string) => {
    let n = 1;
    return (
      '\n' +
      content.replace(
        /<li[^>]*>([\s\S]*?)<\/li>/gi,
        (_m: string, item: string) => `${n++}. ${stripTags(item).trim()}\n`,
      )
    );
  });

  // Tables
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent: string) => {
    const extractCells = (row: string) =>
      [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => stripTags(m[1] ?? '').trim());

    const theadMatch = tableContent.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
    const firstTrMatch = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    const headerCells = theadMatch
      ? extractCells(theadMatch[1] ?? '')
      : firstTrMatch
        ? extractCells(firstTrMatch[1] ?? '')
        : [];

    if (headerCells.length === 0) return '';

    const separator = headerCells.map(() => '---').join(' | ');
    const bodySource = theadMatch
      ? tableContent.replace(theadMatch[0], '')
      : tableContent.replace(firstTrMatch?.[0] ?? '', '');

    const bodyRows = [...bodySource.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
      extractCells(m[1] ?? '').join(' | '),
    );

    const lines = [`| ${headerCells.join(' | ')} |`, `| ${separator} |`, ...bodyRows.map((r) => `| ${r} |`)];
    return `\n${lines.join('\n')}\n`;
  });

  // Block elements
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content: string) => `\n${stripTags(content).trim()}\n`);
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

  return unescapeHtml(stripTags(md))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
