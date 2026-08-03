import { DocPage, DocsIndex, normalizeDocPath, searchDocs, suggestPaths } from './docs-index';

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

const DEFAULT_SEARCH_LIMIT = 8;
const MAX_SEARCH_LIMIT = 25;

/**
 * `get_doc` cap. The largest guide (the table) is ~77 kB, which is roughly 20k tokens - too
 * much to hand back unasked, so oversized pages are answered with their outline instead.
 */
const MAX_PAGE_CHARS = 40_000;

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_docs',
    title: 'Search the Ethlete SDK docs',
    description:
      'Full-text search across the Ethlete SDK documentation (@ethlete/components, core, query, cdk, contentful, types, cli, eslint-plugin). ' +
      'Call this first when you need to know how an Ethlete API, component, directive, token or option behaves. ' +
      'Returns ranked page sections with snippets; read a result in full with get_doc.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural-language query or keywords, e.g. "overlay animation" or "injectErrorTheme".',
        },
        limit: {
          type: 'integer',
          description: `Maximum number of results (default ${DEFAULT_SEARCH_LIMIT}, max ${MAX_SEARCH_LIMIT}).`,
          minimum: 1,
          maximum: MAX_SEARCH_LIMIT,
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_doc',
    title: 'Read an Ethlete SDK docs page',
    description:
      'Return the markdown of one documentation page. Pass a path from search_docs or list_docs, e.g. "/components/button". ' +
      'Long pages are returned as an outline instead - pass a section heading to read just that part.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Site-relative page path, with or without a leading slash and `.md` suffix.',
        },
        section: {
          type: 'string',
          description: 'Optional section heading (or its anchor) to return instead of the whole page.',
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_docs',
    title: 'List Ethlete SDK docs pages',
    description:
      'List every documentation page with its title, grouped by library. Use it to get oriented before searching.',
    inputSchema: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string',
          description: 'Optional path prefix to filter by, e.g. "/components".',
        },
      },
      additionalProperties: false,
    },
  },
];

const text = (value: string): ToolResult => ({ content: [{ type: 'text', text: value }] });
const failure = (value: string): ToolResult => ({ content: [{ type: 'text', text: value }], isError: true });

const asString = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

const outline = (page: DocPage) =>
  page.sections
    .filter((section) => section.anchor)
    .map((section) => `- ${section.heading}`)
    .join('\n');

const runSearch = (index: DocsIndex, args: Record<string, unknown>): ToolResult => {
  const query = asString(args['query']);

  if (!query) {
    return failure('search_docs requires a non-empty `query`.');
  }

  const requested = typeof args['limit'] === 'number' ? Math.floor(args['limit']) : DEFAULT_SEARCH_LIMIT;
  const limit = Math.min(Math.max(requested, 1), MAX_SEARCH_LIMIT);
  const hits = searchDocs(index, { query, limit });

  if (!hits.length) {
    return text(
      `No results for "${query}".\n\nTry fewer or more general keywords, or call list_docs to see what is documented.`,
    );
  }

  const body = hits
    .map((hit, position) => {
      const anchor = hit.anchor ? `${hit.path}#${hit.anchor}` : hit.path;
      const where = hit.heading === hit.title ? hit.title : `${hit.title} › ${hit.heading}`;

      return `${position + 1}. ${anchor}\n   ${where}\n   ${hit.snippet}`;
    })
    .join('\n\n');

  return text(
    `${hits.length} result${hits.length === 1 ? '' : 's'} for "${query}":\n\n${body}\n\n` +
      'Read one in full with get_doc({ path, section }).',
  );
};

const runGetDoc = (index: DocsIndex, args: Record<string, unknown>): ToolResult => {
  const rawPath = asString(args['path']);

  if (!rawPath) {
    return failure('get_doc requires a `path`, e.g. "/components/button".');
  }

  const path = normalizeDocPath(rawPath);
  const page = index.pageByPath.get(path);

  if (!page) {
    const suggestions = suggestPaths(index, { path });
    const hint = suggestions.length ? `\n\nDid you mean:\n${suggestions.map((entry) => `- ${entry}`).join('\n')}` : '';

    return failure(`No documentation page at "${path}".${hint}`);
  }

  const section = asString(args['section']);

  if (section) {
    const needle = section.toLowerCase().replace(/^#/, '');
    const match = page.sections.find(
      (candidate) => candidate.heading.toLowerCase() === needle || candidate.anchor === needle,
    );

    if (!match) {
      return failure(`Page "${path}" has no section "${section}". Available sections:\n${outline(page)}`);
    }

    return text(`# ${page.title} › ${match.heading}\nSource: ${path}\n\n${match.markdown}`);
  }

  if (page.markdown.length > MAX_PAGE_CHARS) {
    return text(
      `"${page.title}" (${path}) is ${Math.round(page.markdown.length / 1000)} kB - too long to return whole.\n\n` +
        `Sections:\n${outline(page)}\n\n` +
        'Call get_doc again with `section` set to one of these headings.',
    );
  }

  return text(`Source: ${path}\n\n${page.markdown}`);
};

const runListDocs = (index: DocsIndex, args: Record<string, unknown>): ToolResult => {
  const prefix = asString(args['prefix']);
  const normalizedPrefix = prefix ? normalizeDocPath(prefix) : null;
  const pages = normalizedPrefix
    ? index.pages.filter((page) => page.path === normalizedPrefix || page.path.startsWith(`${normalizedPrefix}/`))
    : index.pages;

  if (!pages.length) {
    return failure(`No documentation pages under "${normalizedPrefix}".`);
  }

  const groups = new Map<string, string[]>();

  for (const page of pages) {
    const group = page.path.split('/')[1] ?? 'root';
    const lines = groups.get(group) ?? [];

    lines.push(`- ${page.path} — ${page.title}`);
    groups.set(group, lines);
  }

  const body = [...groups.entries()].map(([group, lines]) => `## ${group}\n${lines.join('\n')}`).join('\n\n');

  return text(`${pages.length} documentation page${pages.length === 1 ? '' : 's'}:\n\n${body}`);
};

export const callTool = (
  index: DocsIndex,
  { name, args }: { name: string; args: Record<string, unknown> },
): ToolResult => {
  switch (name) {
    case 'search_docs':
      return runSearch(index, args);
    case 'get_doc':
      return runGetDoc(index, args);
    case 'list_docs':
      return runListDocs(index, args);
    default:
      return failure(`Unknown tool "${name}". Available tools: ${TOOL_DEFINITIONS.map((t) => t.name).join(', ')}.`);
  }
};
