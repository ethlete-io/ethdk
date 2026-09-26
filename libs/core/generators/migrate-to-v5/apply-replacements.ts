const IDENTIFIER_CHAR = /[\w$]/;

export function applyReplacements(content: string, replacements: Map<string, string>): string {
  return [...replacements]
    .sort(([a], [b]) => b.length - a.length)
    .reduce((result, [original, replacement]) => result.replace(snippetPattern(original), () => replacement), content);
}

function snippetPattern(snippet: string): RegExp {
  const start = IDENTIFIER_CHAR.test(snippet.charAt(0)) ? '(?<![\\w$])' : '';
  const end = IDENTIFIER_CHAR.test(snippet.charAt(snippet.length - 1)) ? '(?![\\w$])' : '';

  return new RegExp(`${start}${escapeRegExp(snippet)}${end}`, 'g');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
