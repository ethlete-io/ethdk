import { ContentfulAsset, ContentfulEntryBase } from '../../types';

export interface RichTextRenderCommand {
  payload: string | (new () => unknown);
  data?: unknown;
  attributes?: Record<string, string>;
  children: RichTextRenderCommand[];
}

export interface ContentfulResourceMap {
  readonly assetsBlock: Map<string, ContentfulAsset>;
  readonly entriesInline: Map<string, ContentfulEntryBase>;
  readonly entriesBlock: Map<string, ContentfulEntryBase>;
}
