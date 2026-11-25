import ts from 'typescript';
import { classifyImport, folderModulesOf, partsReachedFrom } from '../imports';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { skipRule } from '../rule-skips';
import { sourceFileOf } from '../ts-source';

const RULE = 'OWN-PART-IN-FRAME';

type Read = { key: string; line: number };

const ownPartImportsOf = (source: ts.SourceFile, own: Set<string>) => {
  const locals = new Map<string, string>();

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const imported = classifyImport(statement.moduleSpecifier.text);
    const local = statement.importClause?.name?.text;

    if (imported.kind !== 'part' || imported.stylesheet || local === undefined) continue;

    const key = partKeyOf(imported);

    if (own.has(key)) locals.set(local, key);
  }

  return locals;
};

const picksOneState = (states: ts.PropertyAccessExpression) => {
  const parent = states.parent;

  return (
    (ts.isPropertyAccessExpression(parent) && parent.expression === states) ||
    (ts.isElementAccessExpression(parent) &&
      parent.expression === states &&
      ts.isStringLiteralLike(parent.argumentExpression))
  );
};

const stateReadsOf = (text: string, own: Set<string>): Read[] => {
  const source = sourceFileOf(text);
  const locals = ownPartImportsOf(source, own);
  const reads: Read[] = [];

  if (locals.size === 0) return reads;

  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'states' &&
      ts.isIdentifier(node.expression) &&
      locals.has(node.expression.text) &&
      !picksOneState(node)
    ) {
      reads.push({
        key: locals.get(node.expression.text) ?? '',
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(source);

  return reads;
};

const reachesCanvas = (options: { product: ResolvedProduct; part: ResolvedPart; canvas: string }) =>
  partKeyOf(options.part) === options.canvas ||
  partsReachedFrom({ product: options.product, from: options.part }).some(
    (found) => partKeyOf(found) === options.canvas,
  );

/**
 * A part that draws the product's canvas and fills its frames with another of the product's own parts across that
 * part's states (the whole `states` map, or a state picked by a computed key): the frames of a design tool's own
 * sketch view show sample content, never the tool's own parts. One state picked by its literal name is chrome and
 * passes. Off unless the product config names a `canvas`.
 */
export const ownPartsInFramesOf = (product: ResolvedProduct): Problem[] => {
  const canvas = product.config.canvas;

  if (!canvas) {
    skipRule({ rule: RULE, product: product.name, kind: 'not-applicable', reason: 'config.json names no canvas part' });

    return [];
  }

  const own = new Set(product.parts.filter((part) => part.origin !== 'base').map(partKeyOf));
  const seen = new Set<string>();

  return product.parts
    .filter((part) => part.origin !== 'base' && reachesCanvas({ product, part, canvas: canvas.part }))
    .flatMap((part) =>
      [{ file: part.file, source: part.source }, ...folderModulesOf(part)].flatMap((module) =>
        stateReadsOf(module.source, own)
          .filter((read) => read.key !== partKeyOf(part))
          .flatMap((read): Problem[] => {
            const place = `${module.file}:${read.line}`;

            if (seen.has(place)) return [];

            seen.add(place);

            return [
              {
                rule: RULE,
                file: module.file,
                at: `${read.key}:${read.line}`,
                message: `line ${read.line} draws ${read.key} across its states as frame content on the canvas - a frame shows an invented sample product, not a part of ${product.name}: render the sample's markup instead`,
              },
            ];
          }),
      ),
    );
};
