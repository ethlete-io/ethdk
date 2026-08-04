import { InjectionToken } from '@angular/core';
import { RichTextEditorDomAutoformat } from './rich-text-editor-dom-autoformat';
import { RichTextEditorDomBlockquote } from './rich-text-editor-dom-blockquote';
import { RichTextEditorDomCodeBlock } from './rich-text-editor-dom-code-block';
import { RichTextEditorDomCore } from './rich-text-editor-dom-core';
import { RichTextEditorDomLists } from './rich-text-editor-dom-lists';
import { RichTextEditorDomHeadings } from './rich-text-editor-dom-headings';
import { RichTextEditorDomLinks } from './rich-text-editor-dom-links';

/**
 * The DOM domains an editor only has when something provided them. Every slot is absent unless the
 * matching provider is registered, which is what keeps the domain's code out of a bundle that never
 * asks for it - so nothing outside a provider may import the implementations, only these types.
 */
export type RichTextEditorDomFeatures = {
  headings?: RichTextEditorDomHeadings;
  links?: RichTextEditorDomLinks;
  blockquote?: RichTextEditorDomBlockquote;
  codeBlock?: RichTextEditorDomCodeBlock;
  autoformat?: RichTextEditorDomAutoformat;
};

/**
 * What a feature factory gets. `features` is the editor's **live** feature record, so a feature that
 * builds on others (autoformat needs the block domains) must read it when it runs, never destructure
 * it at construction - registration order is a consumer's provider order, not something to rely on.
 */
export type RichTextEditorDomFeatureContext = {
  core: RichTextEditorDomCore;
  lists: RichTextEditorDomLists;
  features: RichTextEditorDomFeatures;
};

/** One registered domain: which slot it fills, and how to build it for an editor instance. */
export type RichTextEditorDomFeature = {
  [K in keyof RichTextEditorDomFeatures]-?: {
    key: K;
    create: (ctx: RichTextEditorDomFeatureContext) => NonNullable<RichTextEditorDomFeatures[K]>;
  };
}[keyof RichTextEditorDomFeatures];

/** Multi-provider token the opt-in DOM domains register through. */
export const RICH_TEXT_EDITOR_DOM_FEATURE = new InjectionToken<RichTextEditorDomFeature[]>('RichTextEditorDomFeature');
