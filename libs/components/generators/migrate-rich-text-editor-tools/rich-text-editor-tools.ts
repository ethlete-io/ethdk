/**
 * The rich text editor's heading, quote, code-block, link and autoformat behaviour is opt-in. An
 * editor that provides none of it silently renders four fewer toolbar buttons and stops converting
 * markdown as you type - no error, just less UI - so this migration finds the affected sites and
 * reports them; it rewrites nothing.
 */

export type RichTextEditorToolsTask = {
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

/** Any one of these means the app already knows about the split - `DefaultTools` or a single tool. */
const OPT_IN_MARKERS = [
  'provideRichTextEditorDefaultTools',
  'provideRichTextEditorHeadingTool',
  'provideRichTextEditorBlockquoteTool',
  'provideRichTextEditorCodeBlockTool',
  'provideRichTextEditorLinkTool',
  'provideRichTextEditorAutoformat',
] as const;

export type RichTextEditorToolsScan = {
  usages: RichTextEditorToolsTask[];
  hasToolProvider: boolean;
};

export const scanRichTextEditorToolsInFile = (filePath: string, content: string): RichTextEditorToolsScan => {
  const usages: RichTextEditorToolsTask[] = [];

  const marker = USAGE_MARKERS.find((m) => content.includes(m));

  if (marker) {
    const line = content.slice(0, content.indexOf(marker)).split('\n').length;

    usages.push({
      id: `rich-text-editor-tools--${filePath.replace(/[^a-zA-Z0-9]+/g, '-')}`,
      file: filePath,
      line,
      message: `Uses the rich text editor (\`${marker}\`). Its heading, quote, code-block and link tools and its markdown autoformat only render/run when provided now.`,
    });
  }

  return { usages, hasToolProvider: OPT_IN_MARKERS.some((m) => content.includes(m)) };
};
