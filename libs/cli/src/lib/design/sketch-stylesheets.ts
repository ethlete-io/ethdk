import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { ChildNode, Container, Message, Plugin } from 'postcss';

const PLUGIN = 'ethlete-sketch-stylesheets';

const RELATIVE_IMPORT = /^(url\(\s*)?(['"])(\.{1,2}\/[^'"]+)\2/u;

/** `root`, parsed from `file`, with each relative `@import` made absolute: the inlined rules leave `file`'s folder. */
const withAbsoluteImports = <T extends Container>(root: T, file: string) => {
  root.walkAtRules('import', (rule) => {
    rule.params = rule.params.replace(
      RELATIVE_IMPORT,
      (...[, open = '', quote = '', specifier = '']: string[]) =>
        `${open}${quote}${resolve(dirname(file), specifier)}${quote}`,
    );
  });

  return root;
};

/** The files the `@import`s of `files` inline that no other stylesheet imports, as postcss-import's messages tell. */
const importedOnlyBy = (files: Set<string>, messages: Message[]) => {
  const importers = new Map<string, Set<string>>();

  for (const message of messages) {
    if (message.type !== 'dependency' || typeof message['file'] !== 'string' || typeof message['parent'] !== 'string')
      continue;

    const file = resolve(message['file']);
    const parents = importers.get(file) ?? new Set<string>();

    importers.set(file, parents.add(resolve(message['parent'])));
  }

  const owned = new Set(files);
  const dropped = new Set<string>();

  for (let grew = true; grew;) {
    grew = false;

    for (const [file, parents] of importers) {
      if (owned.has(file) || ![...parents].every((parent) => owned.has(parent))) continue;

      owned.add(file);
      dropped.add(file);
      grew = true;
    }
  }

  return dropped;
};

/**
 * A PostCSS plugin that swaps the rules each stylesheet inlined through an `@import` of a file `replacementsOf`
 * maps, called with the stylesheet's module id, for the rules of the file it maps to. It must run after the
 * `@import`s are inlined and before Tailwind compiles the sheet.
 */
export const sketchStylesheetsPlugin = (
  replacementsOf: (id: string) => Map<string, string> | Promise<Map<string, string>>,
): Plugin => ({
  postcssPlugin: PLUGIN,
  Once: async (root, { result, postcss }) => {
    const from = result.opts.from;
    const replacements = from ? await replacementsOf(from) : new Map<string, string>();

    if (!from || replacements.size === 0) return;

    const fileOf = (node: ChildNode | Container) => {
      const file = node.source?.input.file;

      return file ? resolve(file) : null;
    };
    // postcss-import wraps a file imported with `layer()`, `supports()` or a media query in at-rules it builds
    // with that file's source; only a parsed at-rule has `raws.afterName`.
    const isWrapper = (node: ChildNode | Container) => node.type === 'atrule' && node.raws.afterName === undefined;
    const dropped = importedOnlyBy(new Set(replacements.keys()), result.messages);
    const runs = new Map<string, { file: string; nodes: ChildNode[] }>();
    const parents = new Map<Container, number>();

    root.walk((node) => {
      const file = fileOf(node);

      if (!file || !(replacements.has(file) || dropped.has(file)) || isWrapper(node) || !node.parent) return;
      if (fileOf(node.parent) === file && !isWrapper(node.parent)) return;

      const parent = node.parent;
      const id = parents.get(parent) ?? parents.size;

      parents.set(parent, id);

      const run = runs.get(`${id} ${file}`) ?? { file, nodes: [] };

      run.nodes.push(node);
      runs.set(`${id} ${file}`, run);
    });

    for (const { file, nodes } of runs.values()) {
      const replacement = replacements.get(file);

      if (!replacement) {
        nodes.forEach((node) => node.remove());
        continue;
      }

      const parsed = withAbsoluteImports(
        postcss.parse(readFileSync(replacement, 'utf8'), { from: replacement }),
        replacement,
      );

      nodes[0]?.before(parsed.nodes);
      nodes.forEach((node) => node.remove());
      result.messages.push({ type: 'dependency', plugin: PLUGIN, file: replacement, parent: from });
    }
  },
});

/**
 * A PostCSS plugin that turns each `url(@assets/<file>)` a stylesheet inlined through an `@import` into the URL
 * `rewrite` answers for the stylesheet's module id and the file the declaration came from. It must run after the
 * `@import`s are inlined and swapped.
 */
export const importedAssetUrlsPlugin = (
  rewrite: (code: string, from: { id: string; sourceFile?: string }) => string | null,
): Plugin => ({
  postcssPlugin: 'ethlete-imported-asset-urls',
  Once: (root, { result }) => {
    const from = result.opts.from;

    if (!from) return;

    root.walkDecls((decl) => {
      if (decl.value.includes('@assets/'))
        decl.value = rewrite(decl.value, { id: from, sourceFile: decl.source?.input.file }) ?? decl.value;
    });
  },
});
