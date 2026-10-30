import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ChildNode, Container, Plugin } from 'postcss';

const PLUGIN = 'ethlete-sketch-stylesheets';

/**
 * A PostCSS plugin that swaps the rules each stylesheet inlined through an `@import` of a file `replacementsOf`
 * maps, called with the stylesheet's module id, for the rules of the file it maps to. It must run after the
 * `@import`s are inlined and before Tailwind compiles the sheet.
 */
export const sketchStylesheetsPlugin = (replacementsOf: (id: string) => Map<string, string>): Plugin => ({
  postcssPlugin: PLUGIN,
  Once: (root, { result, postcss }) => {
    const from = result.opts.from;
    const replacements = from ? replacementsOf(from) : new Map<string, string>();

    if (!from || replacements.size === 0) return;

    const fileOf = (node: ChildNode | Container) => {
      const file = node.source?.input.file;

      return file ? resolve(file) : null;
    };
    // postcss-import wraps a file imported with `layer()`, `supports()` or a media query in at-rules it builds
    // with that file's source; only a parsed at-rule has `raws.afterName`.
    const isWrapper = (node: ChildNode | Container) => node.type === 'atrule' && node.raws.afterName === undefined;
    const runs = new Map<string, { file: string; nodes: ChildNode[] }>();
    const parents = new Map<Container, number>();

    root.walk((node) => {
      const file = fileOf(node);

      if (!file || !replacements.has(file) || isWrapper(node) || !node.parent) return;
      if (fileOf(node.parent) === file && !isWrapper(node.parent)) return;

      const parent = node.parent;
      const id = parents.get(parent) ?? parents.size;

      parents.set(parent, id);

      const run = runs.get(`${id} ${file}`) ?? { file, nodes: [] };

      run.nodes.push(node);
      runs.set(`${id} ${file}`, run);
    });

    for (const { file, nodes } of runs.values()) {
      const replacement = replacements.get(file) ?? file;
      const parsed = postcss.parse(readFileSync(replacement, 'utf8'), { from: replacement });

      nodes[0]?.before(parsed.nodes);
      nodes.forEach((node) => node.remove());
      result.messages.push({ type: 'dependency', plugin: PLUGIN, file: replacement, parent: from });
    }
  },
});
