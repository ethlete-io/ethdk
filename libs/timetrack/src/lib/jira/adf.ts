/** Atlassian Document Format, the only shape `/rest/api/3` accepts for a rich-text field. */
export type AdfDocument = {
  type: 'doc';
  version: 1;
  content: { type: 'paragraph'; content?: { type: 'text'; text: string }[] }[];
};

/**
 * Turns plain text into an ADF document, one paragraph per line.
 *
 * A blank line becomes an empty paragraph rather than a paragraph holding an empty text node: Jira
 * rejects a text node whose `text` is empty, and the whole create call fails with it.
 */
export const adfDocument = (text: string): AdfDocument => ({
  type: 'doc',
  version: 1,
  content: text
    .split('\n')
    .map((line) => (line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' })),
});
