import * as ts from 'typescript';
import { applyReplacements, createSourceFile, Replacement } from './imports.js';

export type InlineSpan = {
  /** Absolute offset of the first character of the literal's content. */
  start: number;
  end: number;
  text: string;
};

export const lineOfIndex = (content: string, index: number) => content.slice(0, index).split('\n').length;

const stringLikeSpans = (node: ts.Node, sourceFile: ts.SourceFile, spans: InlineSpan[]) => {
  if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
    const start = node.getStart(sourceFile) + 1;
    const end = node.getEnd() - 1;

    spans.push({ start, end, text: sourceFile.text.slice(start, end) });

    return;
  }

  ts.forEachChild(node, (child) => stringLikeSpans(child, sourceFile, spans));
};

const inlineSpansFor = (content: string, filePath: string, propertyName: 'template' | 'styles') => {
  const sourceFile = createSourceFile(content, filePath);
  const spans: InlineSpan[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === propertyName) {
      stringLikeSpans(node.initializer, sourceFile, spans);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return spans;
};

export const findInlineTemplateSpans = (content: string, filePath: string) =>
  inlineSpansFor(content, filePath, 'template');

export const findInlineStyleSpans = (content: string, filePath: string) => inlineSpansFor(content, filePath, 'styles');

/** A `@Component`'s `templateUrl`, so an external template file can be traced back to the class that owns it. */
export const readTemplateUrl = (content: string, filePath: string) => {
  const sourceFile = createSourceFile(content, filePath);
  let templateUrl: string | null = null;

  const visit = (node: ts.Node) => {
    if (templateUrl) return;

    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'templateUrl' &&
      ts.isStringLiteralLike(node.initializer)
    ) {
      templateUrl = node.initializer.text;

      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return templateUrl;
};

export const transformInlineSpans = (
  content: string,
  spans: readonly InlineSpan[],
  transform: (text: string) => string,
) => {
  const replacements: Replacement[] = [];

  for (const span of spans) {
    const next = transform(span.text);

    if (next !== span.text) {
      replacements.push({ start: span.start, end: span.end, replacement: next });
    }
  }

  return applyReplacements(content, replacements);
};

/** Every opening tag of `tagName`, passed through `transform`. */
export const mapOpeningTags = (template: string, tagName: string, transform: (tag: string) => string) =>
  template.replace(new RegExp(`<${tagName}(?=[\\s/>])[^>]*>`, 'g'), transform);

export const PICTURE_TAG = 'et-picture';
export const SPINNER_TAG = 'et-spinner';
export const LEGACY_SPINNER_TAG = 'et-progress-spinner';
export const SKELETON_ITEM_TAG = 'et-skeleton-item';

const HAS_SHAPE = /(^|\s)\[?shape\]?\s*=/;

/** `shape` defaults to `text` in components, so the cdk's block behaviour has to be spelled out. */
const rewriteSkeletonItems = (template: string) =>
  mapOpeningTags(template, SKELETON_ITEM_TAG, (tag) =>
    HAS_SHAPE.test(tag) ? tag : tag.replace(`<${SKELETON_ITEM_TAG}`, `<${SKELETON_ITEM_TAG} shape="rect"`),
  );

const rewriteSpinnerTags = (template: string) =>
  template
    .replace(new RegExp(`<${LEGACY_SPINNER_TAG}(?=[\\s/>])`, 'g'), `<${SPINNER_TAG}`)
    .replace(new RegExp(`</${LEGACY_SPINNER_TAG}\\s*>`, 'g'), `</${SPINNER_TAG}>`);

const rewriteSpinnerAttributes = (template: string) =>
  mapOpeningTags(template, SPINNER_TAG, (tag) =>
    tag
      .replace(/\smode\s*=\s*(["'])indeterminate\1/g, '')
      .replace(/\s\[mode\]\s*=\s*(["'])'indeterminate'\1/g, '')
      .replace(/\smode\s*=\s*(["'])determinate\1/g, ' [determinate]="true"')
      .replace(/\s\[mode\]\s*=\s*(["'])'determinate'\1/g, ' [determinate]="true"')
      .replace(/(\s)\[renderBackground\]/g, '$1[track]')
      .replace(/(\s)renderBackground(?=[\s=/>])/g, '$1track')
      .replace(/\s\[?multiColor\]?\s*=\s*("[^"]*"|'[^']*')/g, '')
      .replace(/\smultiColor(?=[\s/>])/g, ''),
  );

const rewritePictureAttributes = (template: string) =>
  mapOpeningTags(template, PICTURE_TAG, (tag) =>
    tag
      .replace(/(\s)\[hasPriority\]/g, '$1[priority]')
      .replace(/(\s)hasPriority(?=[\s=/>])/g, '$1priority')
      .replace(/(\s)\(imgLoaded\)/g, '$1(imgLoad)'),
  );

const rewriteTooltipAttributes = (template: string) =>
  template
    .replace(/(\s)\[tooltipAriaDescription\]/g, '$1[etTooltipAriaDescription]')
    .replace(/(\s)tooltipAriaDescription(?=[\s=/>])/g, '$1etTooltipAriaDescription');

export type RewriteTemplateOptions = {
  /**
   * `<et-picture>`'s attributes only rename once its import has actually moved to
   * `@ethlete/components` - `PictureComponent` is a `reshape` row the generator never rewrites
   * mechanically, so a template still bound to cdk's component must keep cdk's attribute names.
   */
  pictureImportMoved?: boolean;
};

export const rewriteTemplate = (template: string, options: RewriteTemplateOptions = {}) => {
  const withSpinnerTags = rewriteSpinnerTags(template);
  const withSkeletonAndSpinner = rewriteSpinnerAttributes(rewriteSkeletonItems(withSpinnerTags));
  const withPicture =
    options.pictureImportMoved === false ? withSkeletonAndSpinner : rewritePictureAttributes(withSkeletonAndSpinner);

  return rewriteTooltipAttributes(withPicture);
};

export const LEGACY_SPINNER_COLOR_VARIABLE = '--et-progress-spinner-color';

export const rewriteStyleSheet = (styles: string) =>
  styles.replace(new RegExp(`${LEGACY_SPINNER_COLOR_VARIABLE}(?![\\w-])`, 'g'), '--et-spinner-color');
