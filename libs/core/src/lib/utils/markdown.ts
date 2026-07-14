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

// --- Nested list helpers (regex can't match balanced nesting, so these scan by tag depth) ---

/** The first top-level `<ul>`/`<ol>` in `html`, matched with balanced nesting. */
const findList = (html: string): { start: number; end: number; ordered: boolean; inner: string } | null => {
  const open = /<(ul|ol)\b[^>]*>/i.exec(html);

  if (!open) return null;

  const innerStart = open.index + open[0].length;
  const tag = /<(\/?)(?:ul|ol)\b[^>]*>/gi;
  tag.lastIndex = innerStart;

  let depth = 1;
  let match: RegExpExecArray | null;

  while ((match = tag.exec(html))) {
    depth += match[1] ? -1 : 1;

    if (depth === 0) {
      return {
        start: open.index,
        end: tag.lastIndex,
        ordered: open[1]!.toLowerCase() === 'ol',
        inner: html.slice(innerStart, match.index),
      };
    }
  }

  return null;
};

/** The inner HTML of each direct `<li>` child of a list's inner HTML (balanced over nested lists). */
const findListItems = (inner: string): string[] => {
  const items: string[] = [];
  const tag = /<(\/?)li\b[^>]*>/gi;

  let depth = 0;
  let start = -1;
  let match: RegExpExecArray | null;

  while ((match = tag.exec(inner))) {
    if (match[1]) {
      depth--;
      if (depth === 0 && start >= 0) {
        items.push(inner.slice(start, match.index));
        start = -1;
      }
    } else {
      if (depth === 0) start = match.index + match[0].length;
      depth++;
    }
  }

  return items;
};

/** Serializes a list's inner HTML to Markdown, indenting nested lists two spaces per level. */
const listToMarkdown = (inner: string, ordered: boolean, depth: number): string => {
  const indent = '  '.repeat(depth);
  let n = 1;

  return findListItems(inner)
    .map((itemInner) => {
      let content = itemInner;
      let nestedMarkdown = '';

      for (let nested = findList(content); nested; nested = findList(content)) {
        nestedMarkdown += `\n${listToMarkdown(nested.inner, nested.ordered, depth + 1)}`;
        content = content.slice(0, nested.start) + content.slice(nested.end);
      }

      const marker = ordered ? `${n++}. ` : '- ';

      return `${indent}${marker}${stripTags(content).trim()}${nestedMarkdown}`;
    })
    .join('\n');
};

type ParsedListLine = { indent: number; ordered: boolean; text: string };

/** Parses list lines into (indent-level, ordered, text) — two leading spaces per nesting level. */
const parseListLines = (lines: string[]): ParsedListLine[] =>
  lines
    .map((line): ParsedListLine | null => {
      const match = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line);

      return match
        ? { indent: Math.floor((match[1] ?? '').length / 2), ordered: /\d/.test(match[2] ?? ''), text: match[3] ?? '' }
        : null;
    })
    .filter((line): line is ParsedListLine => line !== null);

/** Builds nested `<ul>`/`<ol>` HTML from parsed list lines starting at `start`, for one indent level. */
const buildListHtml = (lines: ParsedListLine[], start: number, baseIndent: number): { html: string; next: number } => {
  const ordered = lines[start]?.ordered ?? false;
  let items = '';
  let i = start;

  while (i < lines.length && (lines[i]?.indent ?? -1) === baseIndent) {
    let item = processInline(lines[i]!.text);
    i++;

    if (i < lines.length && (lines[i]?.indent ?? -1) > baseIndent) {
      const nested = buildListHtml(lines, i, lines[i]!.indent);
      item += nested.html;
      i = nested.next;
    }

    items += `<li>${item}</li>`;
  }

  const tag = ordered ? 'ol' : 'ul';

  return { html: `<${tag}>${items}</${tag}>`, next: i };
};

/**
 * Converts a markdown string to HTML.
 * Covers headings, bold, italic, strikethrough, inline code, fenced code blocks,
 * links, images, block quotes, unordered/ordered (and nested) lists, tables, horizontal rules, and paragraphs.
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

  // Markdown headings don't require blank lines around them, but blocks are
  // split on blank lines below. Isolate each heading line into its own block so
  // a heading directly followed by a list/paragraph isn't swallowed into it.
  text = text.replace(/^(#{1,6}\s+.+)$/gm, '\n\n$1\n\n');

  const html = text
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';

      if (isPlaceholder('CODE', trimmed)) return trimmed;

      // Aligned block: text-align has no Markdown form, so it round-trips as raw native HTML — pass
      // it through verbatim instead of re-wrapping it in a plain paragraph.
      if (/^<(?:p|h[1-6]|div)\b[^>]*\bstyle=["'][^"']*text-align/i.test(trimmed)) return trimmed;

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

      // List (unordered/ordered, with indentation-based nesting)
      if (/^([-*+]|\d+\.)\s/.test(trimmed)) {
        const lines = parseListLines(trimmed.split('\n'));

        if (lines.length > 0) {
          return buildListHtml(lines, 0, lines[0]!.indent).html;
        }
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

  // Aligned blocks: text-align has no Markdown form, so preserve them verbatim as native HTML (their
  // inner markup stays HTML) and round-trip via a placeholder — extracted before the block passes
  // below rewrite them, restored after the final tag-strip.
  const alignedBlocks: string[] = [];
  md = md.replace(/<(p|h[1-6]|div)\b[^>]*\bstyle="[^"]*text-align[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, (match) =>
    makePlaceholder('ALIGN', alignedBlocks.push(match) - 1),
  );

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

  // Headings — keep the inner markup so the inline passes below turn any nested
  // bold/italic/link/code into markdown; leftover tags are stripped at the end.
  for (let i = 6; i >= 1; i--) {
    md = md.replace(
      new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi'),
      (_, content: string) => `\n${'#'.repeat(i)} ${content.trim()}\n`,
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

  // Underline has no Markdown form — preserve it as raw <u> so it round-trips. Extract it now (its
  // inner markup is already converted above) so the block passes below don't strip the tag; the
  // placeholder is restored after the final tag-strip.
  const underlines: string[] = [];
  md = md.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, (_, inner: string) => makePlaceholder('U', underlines.push(inner) - 1));

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

  // Lists — replace each top-level list with its recursively-serialized Markdown (handles nesting).
  for (let list = findList(md); list; list = findList(md)) {
    md = `${md.slice(0, list.start)}\n${listToMarkdown(list.inner, list.ordered, 0)}\n${md.slice(list.end)}`;
  }

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

  md = unescapeHtml(stripTags(md)).replace(placeholderRe('U'), (_, i) => `<u>${underlines[+i] ?? ''}</u>`);
  // aligned blocks are block-level, so pad with blank lines before collapsing so they survive as
  // their own Markdown block
  md = md.replace(placeholderRe('ALIGN'), (_, i) => `\n\n${alignedBlocks[+i] ?? ''}\n\n`);

  return md.replace(/\n{3,}/g, '\n\n').trim();
};
