export interface RichTextRenderCommand {
  payload: string | (new () => unknown);
  data?: unknown;
  attributes?: Record<string, string>;
  children: RichTextRenderCommand[];
}
