const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escapes HTML-special characters but leaves existing entity references intact - for input that
 *  may already contain entities (e.g. Markdown serialized from the editor's DOM, where `&` is
 *  stored as `&amp;`), where plain escaping would double-escape them. */
const escapeHtmlPreservingEntities = (str: string) =>
  str
    .replace(/&(?![a-z]+;|#\d+;|#x[0-9a-f]+;)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Rejects URL schemes that execute script when navigated. Whitespace/control characters are
 *  stripped before checking - browsers ignore them inside URLs, so `java\tscript:` would
 *  otherwise slip through. */
const isSafeUrl = (url: string) =>
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point: browsers ignore them inside URLs
  !/^(javascript|data|vbscript):/i.test(url.replace(/[\s\u0000-\u001f]/g, ''));

const unescapeHtml = (str: string) =>
  str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

const stripTags = (str: string) => str.replace(/<[^>]+>/g, '');

const parseTableRow = (line: string): string[] =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

const isTableSeparatorLine = (line: string) => /^\|?(\s*:?-+:?\s*\|)+\s*$/.test(line);

type TableAlign = 'left' | 'center' | 'right' | null;

/** Column alignments from a GFM separator line: `:---` left, `:---:` center, `---:` right. */
const parseSeparatorAligns = (line: string): TableAlign[] =>
  parseTableRow(line).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');

    return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
  });

/** The GFM separator token for a column alignment. */
const separatorFor = (align: TableAlign) =>
  align === 'center' ? ':---:' : align === 'right' ? '---:' : align === 'left' ? ':---' : '---';

const alignStyle = (align: TableAlign) => (align ? ` style="text-align: ${align}"` : '');

/** Wraps `content` in an emphasis `marker`, hoisting boundary whitespace outside the delimiters -
 *  CommonMark emphasis must not face whitespace on the inside (`** fett**` doesn't parse), and
 *  `&nbsp;` counts as whitespace there too. Whitespace-only content stays unwrapped. */
const emphasize = (marker: string, content: string) => {
  const lead = /^(?:\s|&nbsp;)+/i.exec(content)?.[0] ?? '';
  const rest = content.slice(lead.length);
  const trail = /(?:\s|&nbsp;)+$/i.exec(rest)?.[0] ?? '';
  const core = rest.slice(0, rest.length - trail.length);

  return core ? `${lead}${marker}${core}${marker}${trail}` : content;
};

const makePlaceholder = (kind: string, idx: number) => `\u{E000}${kind}${idx}\u{E001}`;
const placeholderRe = (kind: string) => new RegExp(`\u{E000}${kind}(\\d+)\u{E001}`, 'gu');
const isPlaceholder = (kind: string, str: string) => new RegExp(`^\u{E000}${kind}\\d+\u{E001}$`, 'u').test(str);

/** Tags allowed to survive inside an aligned block's raw-HTML passthrough. */
const SAFE_INLINE_TAGS = /* @__PURE__ */ new Set(['strong', 'em', 'b', 'i', 'del', 's', 'u', 'code', 'br']);

/** Reduces raw inline HTML to the editor's own vocabulary: allowed tags lose all their attributes
 *  (`<a>` keeps a safe `href`), everything else - including any event-handler attribute - is
 *  dropped, and the remaining text is escaped. */
const sanitizeInlineHtml = (html: string) => {
  const kept: string[] = [];

  const stashed = html.replace(/<\s*(\/?)\s*([a-z][a-z0-9]*)\b[^>]*>/gi, (full, closing: string, tag: string) => {
    const name = tag.toLowerCase();

    if (name === 'a') {
      const href = closing ? null : /\bhref\s*=\s*"([^"]*)"/i.exec(full)?.[1];
      const anchor = closing ? '</a>' : href && isSafeUrl(href) ? `<a href="${href}">` : '<a>';

      return makePlaceholder('TAG', kept.push(anchor) - 1);
    }

    if (!SAFE_INLINE_TAGS.has(name)) return '';

    return makePlaceholder('TAG', kept.push(closing ? `</${name}>` : `<${name}>`) - 1);
  });

  return escapeHtmlPreservingEntities(stashed).replace(placeholderRe('TAG'), (_, i) => kept[+i] ?? '');
};

const processInline = (text: string): string => {
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_, code: string) => {
    const idx = inlineCodes.push(`<code>${escapeHtml(code)}</code>`) - 1;
    return makePlaceholder('IC', idx);
  });

  // "Open in new tab" links round-trip as raw HTML because Markdown has no `target` syntax. Extract
  // them before the raw-HTML escape below, keeping only a safe href, `target="_blank"` and a forced
  // `rel="noopener noreferrer"` (any other attribute - including event handlers - is dropped); their
  // inner markup is processed recursively. Anything else that looks like raw HTML is still escaped.
  const newTabLinks: string[] = [];
  text = text.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs: string, inner: string) => {
    const href = /\bhref\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
    const newTab = /\btarget\s*=\s*"_blank"/i.test(attrs);

    if (!newTab || !href || !isSafeUrl(href)) return full;

    const anchor = `<a href="${href}" target="_blank" rel="noopener noreferrer">${processInline(inner)}</a>`;

    return makePlaceholder('NTLINK', newTabLinks.push(anchor) - 1);
  });

  // Raw HTML in Markdown text is escaped, not rendered - the editor writes this HTML straight
  // into the DOM via innerHTML, so anything else would let a crafted value inject markup. `<u>`
  // is the one deliberate exception: underline has no Markdown form and round-trips as raw <u>.
  text = escapeHtmlPreservingEntities(text).replace(/&lt;(\/?)u&gt;/gi, '<$1u>');

  // Bold + italic - *** before ** before *. A delimiter flanking whitespace doesn't open/close a
  // run (CommonMark's flanking rule), so literal asterisks as in `2 * 3 * 4` stay text.
  text = text.replace(/\*\*\*([^\s*](?:.*?[^\s*])?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*([^\s*](?:.*?[^\s*])?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^\s_](?:.*?[^\s_])?)__/g, '<strong>$1</strong>');
  text = text.replace(/\*([^\s*](?:.*?[^\s*])?)\*/g, '<em>$1</em>');
  // Single-underscore emphasis must not fire inside a word (snake_case identifiers).
  text = text.replace(/(?<![\w*_])_([^\s_](?:.*?[^\s_])?)_(?![\w_])/g, '<em>$1</em>');
  text = text.replace(/~~([^\s~](?:.*?[^\s~])?)~~/g, '<del>$1</del>');

  // Images before links (order matters); URLs with script-running schemes stay literal text
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt: string, src: string) =>
    isSafeUrl(src) ? `<img src="${src}" alt="${alt}">` : match,
  );
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label: string, href: string) =>
    isSafeUrl(href) ? `<a href="${href}">${label}</a>` : match,
  );

  return text
    .replace(placeholderRe('IC'), (_, i) => inlineCodes[+i] ?? '')
    .replace(placeholderRe('NTLINK'), (_, i) => newTabLinks[+i] ?? '');
};

// --- Nested list helpers (regex can't match balanced nesting, so these scan by tag depth) ---

/** The first top-level `<ul>`/`<ol>` in `html`, matched with balanced nesting. */
const findList = (html: string): { start: number; end: number; ordered: boolean; inner: string } | null => {
  const open = /<(ul|ol)\b[^>]*>/i.exec(html);

  if (!open) return null;

  const openTagName = open[1] ?? '';
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
        ordered: openTagName.toLowerCase() === 'ol',
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

/** The first top-level `<blockquote>` in `html`, matched with balanced nesting. */
const findBlockquote = (html: string): { start: number; end: number; inner: string } | null => {
  const open = /<blockquote\b[^>]*>/i.exec(html);

  if (!open) return null;

  const innerStart = open.index + open[0].length;
  const tag = /<(\/?)blockquote\b[^>]*>/gi;
  tag.lastIndex = innerStart;

  let depth = 1;
  let match: RegExpExecArray | null;

  while ((match = tag.exec(html))) {
    depth += match[1] ? -1 : 1;

    if (depth === 0) {
      return { start: open.index, end: tag.lastIndex, inner: html.slice(innerStart, match.index) };
    }
  }

  return null;
};

/** The lines of quoted text in a blockquote's own (non-nested) HTML, each with its `> ` prefix.
 *  `<br>` and paragraph boundaries are the line breaks - the tag-strip would swallow them. */
const quotedLines = (html: string, prefix: string): string[] => {
  const text = stripTags(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p\s*>/gi, '\n')).trim();

  return text ? text.split('\n').map((line) => `${prefix}${line.trim()}`) : [];
};

/** Serializes a blockquote's inner HTML to Markdown, one `>` per nesting level. */
const blockquoteToMarkdown = (inner: string, depth: number): string => {
  const prefix = '> '.repeat(depth + 1);
  const lines: string[] = [];
  let rest = inner;

  for (let nested = findBlockquote(rest); nested; nested = findBlockquote(rest)) {
    lines.push(...quotedLines(rest.slice(0, nested.start), prefix));
    lines.push(blockquoteToMarkdown(nested.inner, depth + 1));
    rest = rest.slice(nested.end);
  }

  lines.push(...quotedLines(rest, prefix));

  // An empty quote still needs its marker, or it would vanish from the value entirely.
  return lines.length > 0 ? lines.join('\n') : prefix.trim();
};

/** Builds a `<blockquote>` from `> `-prefixed lines, recursing into runs of deeper (`>>`) lines. */
const buildBlockquoteHtml = (lines: string[]): string => {
  let html = '';
  let run: string[] = [];

  const flushRun = () => {
    if (run.length > 0) html += run.map(processInline).join('<br>');
    run = [];
  };

  for (let i = 0; i < lines.length;) {
    const stripped = (lines[i] ?? '').replace(/^>[ \t]?/, '');

    if (!stripped.startsWith('>')) {
      run.push(stripped);
      i++;
      continue;
    }

    flushRun();

    const nested: string[] = [];

    while (i < lines.length) {
      const line = (lines[i] ?? '').replace(/^>[ \t]?/, '');

      if (!line.startsWith('>')) break;

      nested.push(line);
      i++;
    }

    html += buildBlockquoteHtml(nested);
  }

  flushRun();

  // `<br>` so an empty quote has a line box the caret can sit in (the editor writes this HTML live)
  return `<blockquote>${html || '<br>'}</blockquote>`;
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

      // list items are single-line in this serializer, so a <br> degrades to a space
      return `${indent}${marker}${stripTags(content.replace(/<br\s*\/?>/gi, ' ')).trim()}${nestedMarkdown}`;
    })
    .join('\n');
};

type ParsedListLine = { indent: number; ordered: boolean; text: string };

/** Parses list lines into (indent-level, ordered, text) - two leading spaces per nesting level. */
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

  for (let line = lines[i]; line?.indent === baseIndent; line = lines[i]) {
    let item = processInline(line.text);
    i++;

    const nested = lines[i];

    if (nested && nested.indent > baseIndent) {
      const built = buildListHtml(lines, i, nested.indent);
      item += built.html;
      i = built.next;
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
export const markdownToHtml = (markdown: string) => {
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

      // Aligned block: text-align has no Markdown form, so it round-trips as raw native HTML.
      // Rebuild it instead of passing it through verbatim: only the alignment survives on the tag
      // (no other attributes, e.g. event handlers) and the inner markup is reduced to the editor's
      // own inline vocabulary.
      const aligned = /^<(p|h[1-6]|div)\b[^>]*\bstyle=["'][^"']*text-align:\s*([a-z]+)[^>]*>([\s\S]*)<\/\1>$/i.exec(
        trimmed,
      );

      if (aligned) {
        const tag = (aligned[1] ?? 'p').toLowerCase();
        const align = (aligned[2] ?? 'left').toLowerCase();

        return `<${tag} style="text-align: ${align}">${sanitizeInlineHtml(aligned[3] ?? '')}</${tag}>`;
      }

      // Heading
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch?.[1] && headingMatch?.[2]) {
        const level = headingMatch[1].length;

        return `<h${level}>${processInline(headingMatch[2].trim())}</h${level}>`;
      }

      // Horizontal rule
      if (/^(---|\*\*\*|___)\s*$/.test(trimmed)) return '<hr>';

      // Table (GFM) - column alignment from the separator line lands as text-align on every cell
      const tableLines = trimmed.split('\n');
      if (tableLines.length >= 2 && /\|/.test(tableLines[0] ?? '') && isTableSeparatorLine(tableLines[1] ?? '')) {
        const aligns = parseSeparatorAligns(tableLines[1] ?? '');
        const headers = parseTableRow(tableLines[0] ?? '');
        const thead = `<thead><tr>${headers
          .map((h, i) => `<th${alignStyle(aligns[i] ?? null)}>${processInline(h)}</th>`)
          .join('')}</tr></thead>`;
        const bodyRows = tableLines.slice(2);
        const tbody =
          bodyRows.length > 0
            ? `<tbody>${bodyRows
                .map(
                  (row) =>
                    `<tr>${parseTableRow(row)
                      .map((cell, i) => `<td${alignStyle(aligns[i] ?? null)}>${processInline(cell)}</td>`)
                      .join('')}</tr>`,
                )
                .join('')}</tbody>`
            : '';

        return `<table>${thead}${tbody}</table>`;
      }

      // Blockquote - each line runs through the inline pass on its own (processInline escapes raw
      // HTML, so joining first would escape the <br> separators too), and a `>>` run nests
      if (/^>/.test(trimmed)) return buildBlockquoteHtml(trimmed.split('\n'));

      // List (unordered/ordered, with indentation-based nesting)
      if (/^([-*+]|\d+\.)\s/.test(trimmed)) {
        const lines = parseListLines(trimmed.split('\n'));
        const [firstLine] = lines;

        if (firstLine) {
          return buildListHtml(lines, 0, firstLine.indent).html;
        }
      }

      // Paragraph - single newlines within a block become <br>
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
export const htmlToMarkdown = (html: string) => {
  if (!html) return '';

  let md = html;

  // Aligned blocks: text-align has no Markdown form, so preserve them verbatim as native HTML (their
  // inner markup stays HTML) and round-trip via a placeholder - extracted before the block passes
  // below rewrite them, restored after the final tag-strip.
  const alignedBlocks: string[] = [];
  md = md.replace(/<(p|h[1-6]|div)\b[^>]*\bstyle="[^"]*text-align[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, (match) =>
    makePlaceholder('ALIGN', alignedBlocks.push(match) - 1),
  );

  // Code blocks - process before inline code
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

  // Headings - keep the inner markup so the inline passes below turn any nested
  // bold/italic/link/code into markdown; leftover tags are stripped at the end.
  for (let i = 6; i >= 1; i--) {
    md = md.replace(
      new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi'),
      (_, content: string) => `\n${'#'.repeat(i)} ${content.trim()}\n`,
    );
  }

  // Bold + italic (combined before individual). Boundary whitespace is hoisted out of the
  // delimiters (emphasize) - `<strong> x</strong>` must become ` **x**`, not the invalid `** x**`.
  md = md.replace(/<strong[^>]*><em[^>]*>([\s\S]*?)<\/em><\/strong>/gi, (_, c: string) => emphasize('***', c));
  md = md.replace(/<em[^>]*><strong[^>]*>([\s\S]*?)<\/strong><\/em>/gi, (_, c: string) => emphasize('***', c));
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, c: string) => emphasize('**', c));
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, c: string) => emphasize('*', c));
  md = md.replace(/<(del|s|strike)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, c: string) => emphasize('~~', c));

  // Inline code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, code: string) => `\`${unescapeHtml(code)}\``);

  // Links and images. A link with `target="_blank"` has no Markdown form, so it round-trips as raw
  // HTML (keeping only href + target + rel) via a placeholder - like underline below; ordinary links
  // become `[text](url)`.
  const newTabLinks: string[] = [];
  md = md.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs: string, inner: string) => {
    const href = /\bhref\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? '';

    if (/\btarget\s*=\s*"_blank"/i.test(attrs) && href) {
      const anchor = `<a href="${href}" target="_blank" rel="noopener noreferrer">${inner}</a>`;

      return makePlaceholder('NTLINK', newTabLinks.push(anchor) - 1);
    }

    return href ? `[${inner}](${href})` : inner;
  });
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]+alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Underline has no Markdown form - preserve it as raw <u> so it round-trips. Extract it now (its
  // inner markup is already converted above) so the block passes below don't strip the tag; the
  // placeholder is restored after the final tag-strip.
  const underlines: string[] = [];
  md = md.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, (_, inner: string) => makePlaceholder('U', underlines.push(inner) - 1));

  // Block quotes - replace each top-level <blockquote> with its recursively-serialized Markdown, so
  // a quote inside a quote becomes `>>` (regex alone can't match balanced nesting).
  for (let quote = findBlockquote(md); quote; quote = findBlockquote(md)) {
    md = `${md.slice(0, quote.start)}\n${blockquoteToMarkdown(quote.inner, 0)}\n${md.slice(quote.end)}`;
  }

  // Lists - replace each top-level list with its recursively-serialized Markdown (handles nesting).
  for (let list = findList(md); list; list = findList(md)) {
    md = `${md.slice(0, list.start)}\n${listToMarkdown(list.inner, list.ordered, 0)}\n${md.slice(list.end)}`;
  }

  // Tables
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent: string) => {
    // GFM cells are single-line, so a <br> inside one degrades to a space (not silently dropped)
    const extractCells = (row: string) =>
      [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) =>
        stripTags((m[1] ?? '').replace(/<br\s*\/?>/gi, ' ')).trim(),
      );

    // GFM alignment is per column, read from the header cells' text-align styles
    const extractAligns = (row: string): TableAlign[] =>
      [...row.matchAll(/<t[hd]([^>]*)>/gi)].map((m) => {
        const align = /text-align:\s*(left|center|right)/i.exec(m[1] ?? '')?.[1]?.toLowerCase();

        return (align as TableAlign) ?? null;
      });

    const theadMatch = tableContent.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
    const firstTrMatch = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    const headerRow = theadMatch?.[1] ?? firstTrMatch?.[1] ?? '';
    const headerCells = headerRow ? extractCells(headerRow) : [];

    if (headerCells.length === 0) return '';

    const aligns = extractAligns(headerRow);
    const separator = headerCells.map((_cell, i) => separatorFor(aligns[i] ?? null)).join(' | ');
    const bodySource = theadMatch
      ? tableContent.replace(theadMatch[0], '')
      : tableContent.replace(firstTrMatch?.[0] ?? '', '');

    const bodyRows = [...bodySource.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
      extractCells(m[1] ?? '').join(' | '),
    );

    const lines = [`| ${headerCells.join(' | ')} |`, `| ${separator} |`, ...bodyRows.map((r) => `| ${r} |`)];
    return `\n${lines.join('\n')}\n`;
  });

  // Block elements - a <br> inside a paragraph is a soft line break; turn it into a newline before
  // the tag-strip removes it, so it round-trips (a single newline within a block renders as <br>)
  md = md.replace(
    /<p[^>]*>([\s\S]*?)<\/p>/gi,
    (_, content: string) => `\n${stripTags(content.replace(/<br\s*\/?>/gi, '\n')).trim()}\n`,
  );
  // A <div> boundary acts as a paragraph boundary - clipboard HTML commonly uses divs as
  // paragraphs, and silently stripping them would merge adjacent blocks into one.
  md = md.replace(/<\/div\s*>/gi, '\n\n').replace(/<div[^>]*>/gi, '\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

  md = unescapeHtml(stripTags(md)).replace(placeholderRe('U'), (_, i) => `<u>${underlines[+i] ?? ''}</u>`);
  // new-tab links survive the tag-strip as raw HTML (restored after it, like underline)
  md = md.replace(placeholderRe('NTLINK'), (_, i) => newTabLinks[+i] ?? '');
  // aligned blocks are block-level, so pad with blank lines before collapsing so they survive as
  // their own Markdown block
  md = md.replace(placeholderRe('ALIGN'), (_, i) => `\n\n${alignedBlocks[+i] ?? ''}\n\n`);

  return md.replace(/\n{3,}/g, '\n\n').trim();
};
