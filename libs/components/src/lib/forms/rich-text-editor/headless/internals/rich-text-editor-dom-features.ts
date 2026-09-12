import { InjectionToken } from '@angular/core';
import { RichTextEditorDomAutoformat } from './rich-text-editor-dom-autoformat';
import { RichTextEditorDomBlockquote } from './rich-text-editor-dom-blockquote';
import { RichTextEditorDomCodeBlock } from './rich-text-editor-dom-code-block';
import { RichTextEditorDomCore } from './rich-text-editor-dom-core';
import { RichTextEditorDomLists } from './rich-text-editor-dom-lists';
import { RichTextEditorDomHeadings } from './rich-text-editor-dom-headings';
import { RichTextEditorDomLinks } from './rich-text-editor-dom-links';

/**
 * Nothing outside a provider may import these implementations, only these types: an eager import
 * pulls the domain's code into a bundle that never asks for it.
 */
export type RichTextEditorDomFeatures = {
  headings?: RichTextEditorDomHeadings;
  links?: RichTextEditorDomLinks;
  blockquote?: RichTextEditorDomBlockquote;
  codeBlock?: RichTextEditorDomCodeBlock;
  autoformat?: RichTextEditorDomAutoformat;
};

/**
 * `features` is the editor's **live** record, so a feature that builds on others must read it when
 * it runs, never destructure it at construction - registration order is the consumer's provider order.
 */
export type RichTextEditorDomFeatureContext = {
  core: RichTextEditorDomCore;
  lists: RichTextEditorDomLists;
  features: RichTextEditorDomFeatures;
};

export type RichTextEditorDomFeature = {
  [K in keyof RichTextEditorDomFeatures]-?: {
    key: K;
    create: (ctx: RichTextEditorDomFeatureContext) => NonNullable<RichTextEditorDomFeatures[K]>;
  };
}[keyof RichTextEditorDomFeatures];

export const RICH_TEXT_EDITOR_DOM_FEATURE = new InjectionToken<RichTextEditorDomFeature[]>('RichTextEditorDomFeature');
