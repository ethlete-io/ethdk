import ts from 'typescript';
import { sourceFileOf } from '../ts-source';

/** One interactive element written as markup in a source instead of embedded from a part's render. */
export type InlineUi = {
  /** The nearest enclosing declaration's name, `(module)` outside every one. */
  anchor: string;
  /** What makes the tag interactive: `<button>`, `<et-switch>`, `[et-button]`, `role="button"`, `tabindex` or `data-et-action`. */
  kind: string;
  line: number;
  /** The part to embed instead, `<layer>/<name>`. */
  part: string;
};

const NATIVE_CONTROLS = new Set(['button', 'input', 'select', 'textarea']);
const ROLES = 'button|checkbox|combobox|link|menuitem|option|radio|slider|switch|tab|textbox';
const TAG = /<([a-zA-Z][\w-]*)([^<>]*)/g;
const SDK_ATTRIBUTE = /(?:^|\s)et-([\w-]+)(?=[\s=/>]|$)/;
const ROLE = new RegExp(`(?:^|\\s)role\\s*=\\s*["'](${ROLES})["']`);
const TABINDEX = /(?:^|\s)tabindex\b/;
const ACTION = /(?:^|\s)data-et-action\b/;
const EMBEDDED = /(?:^|\s)data-et-part\b/;
const MODULE = '(module)';

const kebabOf = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'control';

const tagKindOf = (name: string, attributes: string): { kind: string; sdk?: string } | null => {
  if (EMBEDDED.test(attributes)) return null;

  const tag = name.toLowerCase();
  const sdkAttribute = SDK_ATTRIBUTE.exec(attributes)?.[1];

  if (tag.startsWith('et-')) return { kind: `<${tag}>`, sdk: tag.slice(3) };
  if (NATIVE_CONTROLS.has(tag)) return { kind: `<${tag}>`, sdk: sdkAttribute };
  if (sdkAttribute) return { kind: `[et-${sdkAttribute}]`, sdk: sdkAttribute };

  const role = ROLE.exec(attributes)?.[1];

  if (role) return { kind: `role="${role}"` };
  if (TABINDEX.test(attributes)) return { kind: 'tabindex' };
  if (ACTION.test(attributes)) return { kind: 'data-et-action' };

  return null;
};

const nameOf = (node: ts.Node) =>
  (ts.isVariableDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isClassDeclaration(node)) &&
  node.name &&
  ts.isIdentifier(node.name)
    ? node.name.text
    : null;

const anchorOf = (node: ts.Node) => {
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    const name = nameOf(current);

    if (name) return name;
  }

  return MODULE;
};

const markupOf = (node: ts.Node) => {
  if (ts.isTemplateExpression(node))
    return node.head.text + node.templateSpans.map((span) => `\${}${span.literal.text}`).join('');
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    const parent = node.parent;

    return parent && (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) ? null : node.text;
  }

  return null;
};

/**
 * Each interactive element a TS source writes as markup in a string or template literal: a native control, a raw SDK
 * tag or attribute, or bare markup made interactive with an interactive `role`, `tabindex` or `data-et-action`.
 * Markup that carries `data-et-part` is an embedded part's and is skipped; each tag counts once.
 */
export const inlineUiOf = (source: string): InlineUi[] => {
  const file = sourceFileOf(source);
  const found: InlineUi[] = [];
  const visit = (node: ts.Node) => {
    const markup = markupOf(node);

    if (markup !== null) {
      const anchor = anchorOf(node);

      for (const match of markup.matchAll(TAG)) {
        const kind = tagKindOf(match[1] ?? '', match[2] ?? '');

        if (!kind) continue;

        found.push({
          anchor,
          kind: kind.kind,
          line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
          part: `components/${kind.sdk ?? kebabOf(anchor === MODULE ? 'control' : anchor)}`,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return found;
};
