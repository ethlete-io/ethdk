/**
 * The rich text editor no longer mounts the toolbar that follows the selection — it is an opt-in
 * `provideRichTextEditorFloatingToolbar()`, and without it an editor keeps its static toolbar only.
 * Whether an app wants it back is its own call, so this migration only finds the affected sites and
 * reports them; it rewrites nothing.
 */

export type RichTextEditorFloatingToolbarTask = {
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

const OPT_IN_MARKER = 'provideRichTextEditorFloatingToolbar';

export type RichTextEditorFloatingToolbarScan = {
  usages: RichTextEditorFloatingToolbarTask[];
  hasFloatingToolbarProvider: boolean;
};

export const scanRichTextEditorFloatingToolbarInFile = (
  filePath: string,
  content: string,
): RichTextEditorFloatingToolbarScan => {
  const usages: RichTextEditorFloatingToolbarTask[] = [];

  const marker = USAGE_MARKERS.find((m) => content.includes(m));

  if (marker) {
    const line = content.slice(0, content.indexOf(marker)).split('\n').length;

    usages.push({
      id: `rich-text-editor-floating-toolbar--${filePath.replace(/[^a-zA-Z0-9]+/g, '-')}`,
      file: filePath,
      line,
      message: `Uses the rich text editor (\`${marker}\`). Selecting text no longer floats a toolbar over the selection unless it is provided.`,
    });
  }

  return { usages, hasFloatingToolbarProvider: content.includes(OPT_IN_MARKER) };
};
