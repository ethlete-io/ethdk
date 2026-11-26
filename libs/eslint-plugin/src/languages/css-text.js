// @ts-check
'use strict';

/**
 * A minimal ESLint language for `.css` / `.scss` files: the whole file is one `Root` node holding the text.
 * Rules read `sourceCode.text` and report with an explicit `loc`; there is no CSS AST.
 */

/** @param {string} text */
const lineStarts = (text) => {
  const starts = [0];

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1);
  }

  return starts;
};

class CssTextSourceCode {
  /** @param {{ text: string; ast: any }} init */
  constructor({ text, ast }) {
    this.text = text;
    this.ast = ast;
    this.hasBOM = false;
    this.lines = text.split(/\r\n|\r|\n/u);
    this.starts = lineStarts(text);
  }

  getLoc(node) {
    return node.loc;
  }

  getRange(node) {
    return node.range;
  }

  getParent() {
    return undefined;
  }

  getAncestors() {
    return [];
  }

  getText(node) {
    return node ? this.text.slice(node.range[0], node.range[1]) : this.text;
  }

  /** @param {number} index */
  getLocFromIndex(index) {
    let line = this.starts.length - 1;

    while (this.starts[line] > index) line--;

    return { line: line + 1, column: index - this.starts[line] };
  }

  getIndexFromLoc(loc) {
    return this.starts[loc.line - 1] + loc.column;
  }

  applyInlineConfig() {
    return { configs: [], problems: [], disableDirectives: [] };
  }

  getDisableDirectives() {
    return { problems: [], directives: [] };
  }

  getInlineConfigNodes() {
    return [];
  }

  traverse() {
    const ast = this.ast;

    return [
      { kind: 1, target: ast, phase: 1, args: [ast] },
      { kind: 1, target: ast, phase: 2, args: [ast] },
    ];
  }
}

/** @type {import('eslint').Language} */
const cssTextLanguage = /** @type {any} */ ({
  fileType: 'text',
  lineStart: 1,
  columnStart: 0,
  nodeTypeKey: 'type',
  visitorKeys: { Root: [] },
  defaultLanguageOptions: {},
  validateLanguageOptions: () => undefined,
  normalizeLanguageOptions: (/** @type {any} */ options) => options,
  matchesSelectorClass: () => false,
  parse(/** @type {{ body: string }} */ file) {
    const text = String(file.body);
    const starts = lineStarts(text);
    const lastLine = starts.length;

    return {
      ok: true,
      ast: {
        type: 'Root',
        range: [0, text.length],
        loc: {
          start: { line: 1, column: 0 },
          end: { line: lastLine, column: text.length - starts[lastLine - 1] },
        },
      },
    };
  },
  createSourceCode(/** @type {{ body: string }} */ file, /** @type {any} */ parseResult) {
    return new CssTextSourceCode({ text: String(file.body), ast: parseResult.ast });
  },
});

module.exports = { cssTextLanguage };
