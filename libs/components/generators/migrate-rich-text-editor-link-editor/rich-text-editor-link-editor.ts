/**
 * The rich text editor no longer mounts the link editor popover itself — it is an opt-in
 * `provideRichTextEditorLinkEditor()`, and without it the `'link'` tool falls back to
 * `window.prompt`. Whether an app wants the popover back is its own call, so this migration only
 * finds the affected sites and reports them; it rewrites nothing.
 */

export type RichTextEditorLinkEditorTask = {
  id: string;
  file: string;
  line: number;
  message: string;
};

const USAGE_MARKERS = [
  'et-rich-text-editor',
  'RICH_TEXT_EDITOR_IMPORTS',
  'RichTextEditorComponent',
  'etRichTextEditor',
] as const;

const OPT_IN_MARKER = 'provideRichTextEditorLinkEditor';

export type RichTextEditorLinkEditorScan = {
  usages: RichTextEditorLinkEditorTask[];
  hasLinkEditorProvider: boolean;
};

export const scanRichTextEditorLinkEditorInFile = (filePath: string, content: string): RichTextEditorLinkEditorScan => {
  const usages: RichTextEditorLinkEditorTask[] = [];

  const marker = USAGE_MARKERS.find((m) => content.includes(m));

  if (marker) {
    const line = content.slice(0, content.indexOf(marker)).split('\n').length;

    usages.push({
      id: `rich-text-editor-link-editor--${filePath.replace(/[^a-zA-Z0-9]+/g, '-')}`,
      file: filePath,
      line,
      message: `Uses the rich text editor (\`${marker}\`). Its link tool opens \`window.prompt\` now unless the link editor popover is provided.`,
    });
  }

  return { usages, hasLinkEditorProvider: content.includes(OPT_IN_MARKER) };
};
