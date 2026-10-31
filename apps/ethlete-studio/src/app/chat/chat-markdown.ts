export type ChatInline =
  { kind: 'text'; text: string } | { kind: 'code'; text: string } | { kind: 'bold'; text: string };

export type ChatBlock =
  | { kind: 'paragraph'; inlines: ChatInline[] }
  | { kind: 'code'; language: string; text: string }
  | { kind: 'list'; ordered: boolean; start: number; items: ChatInline[][] };

const FENCE = /^\s*```\s*([^\s`]*)\s*$/;
const ITEM = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/;

export const parseChatInlines = (source: string): ChatInline[] => {
  const inlines: ChatInline[] = [];
  let text = '';
  let index = 0;

  const flush = () => {
    if (text) inlines.push({ kind: 'text', text });
    text = '';
  };

  while (index < source.length) {
    if (source[index] === '`') {
      const end = source.indexOf('`', index + 1);

      if (end > index + 1) {
        flush();
        inlines.push({ kind: 'code', text: source.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    } else if (source.startsWith('**', index)) {
      const end = source.indexOf('**', index + 2);

      if (end > index + 2) {
        flush();
        inlines.push({ kind: 'bold', text: source.slice(index + 2, end) });
        index = end + 2;
        continue;
      }
    }

    text += source[index];
    index++;
  }

  flush();

  return inlines;
};

export const parseChatMarkdown = (source: string): ChatBlock[] => {
  const blocks: ChatBlock[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let paragraph: string[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | null = null;

  const closeParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', inlines: parseChatInlines(paragraph.join('\n')) });
    paragraph = [];
  };

  const closeList = () => {
    if (list) {
      blocks.push({
        kind: 'list',
        ordered: list.ordered,
        start: list.start,
        items: list.items.map(parseChatInlines),
      });
    }
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const fence = FENCE.exec(line);

    if (fence) {
      closeParagraph();
      closeList();

      const body: string[] = [];

      for (i++; i < lines.length && !FENCE.test(lines[i] ?? ''); i++) body.push(lines[i] ?? '');

      blocks.push({ kind: 'code', language: fence[1] ?? '', text: body.join('\n') });
      continue;
    }

    if (line.trim() === '') {
      closeParagraph();
      closeList();
      continue;
    }

    const item = ITEM.exec(line);

    if (item) {
      const ordered = item[2] !== undefined;

      closeParagraph();

      if (list && list.ordered !== ordered) closeList();

      if (list) list.items.push(item[3] ?? '');
      else list = { ordered, start: ordered ? Number(item[2]) : 1, items: [item[3] ?? ''] };
      continue;
    }

    if (list && /^\s/.test(line)) {
      list.items[list.items.length - 1] += `\n${line.trim()}`;
      continue;
    }

    closeList();
    paragraph.push(line);
  }

  closeParagraph();
  closeList();

  return blocks;
};
