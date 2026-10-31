import ts from 'typescript';
import { DesignConfig } from '../../paths';
import { renderPackagesOf, typePathsOf } from '../../render-packages';
import { ResolvedPart } from '../resolve-product';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const optionValuesChecker = (options: { target: string; config: DesignConfig; parts: ResolvedPart[] }) => {
  const candidates = options.parts.filter((part) => /\b(?:MockOptions|omits)\b|\w+MockOptions\b/u.test(part.source));

  if (candidates.length === 0) return () => [];

  const paths = typePathsOf({ target: options.target, packages: renderPackagesOf(options) });
  const program = ts.createProgram(
    candidates.map((part) => part.file),
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      skipLibCheck: true,
      strictNullChecks: true,
      baseUrl: options.target,
      paths,
    },
  );
  const checker = program.getTypeChecker();

  return (part: ResolvedPart, definition: { states?: unknown; grid?: unknown }) => {
    const source = program.getSourceFile(part.file);
    if (!source) return [];
    const values = new Map<string, Set<string>>();
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const binding of bindings.elements) {
        if (!(binding.propertyName ?? binding.name).text.endsWith('MockOptions')) continue;
        const symbol = checker.getSymbolAtLocation(binding.name);
        if (!symbol) continue;
        const type = checker.getDeclaredTypeOfSymbol(checker.getAliasedSymbol(symbol));
        for (const property of checker.getPropertiesOfType(type)) {
          const propertyType = checker.getTypeOfSymbolAtLocation(property, binding);
          const variants = propertyType.isUnion()
            ? propertyType.types.filter((item) => !(item.flags & ts.TypeFlags.Undefined))
            : [];
          if (variants.length < 2 || !variants.every((item) => item.isStringLiteral())) continue;
          const known = values.get(property.name) ?? new Set<string>();
          for (const variant of variants) if (variant.isStringLiteral()) known.add(variant.value);
          values.set(property.name, known);
        }
      }
    }
    let definitionNode: ts.ObjectLiteralExpression | undefined;
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'definePart' &&
        node.arguments[0] &&
        ts.isObjectLiteralExpression(node.arguments[0])
      )
        definitionNode = node.arguments[0];
      ts.forEachChild(node, visit);
    };
    visit(source);
    const omits = definitionNode?.properties.find(
      (property) => property.name && property.name.getText(source) === 'omits',
    );
    const problems: { code: string; detail: string }[] = [];
    const ignored = new Set<string>();
    if (omits) {
      if (!ts.isPropertyAssignment(omits) || !ts.isArrayLiteralExpression(omits.initializer))
        problems.push({ code: 'OPTION-OMITS-LITERAL', detail: 'omits must be an array literal' });
      else
        for (const entry of omits.initializer.elements) {
          const fields = ts.isObjectLiteralExpression(entry)
            ? ['option', 'value', 'reason'].map((name) => {
                const field = entry.properties.find(
                  (property) => property.name && property.name.getText(source) === name,
                );
                return field && ts.isPropertyAssignment(field) && ts.isStringLiteralLike(field.initializer)
                  ? field.initializer.text
                  : null;
              })
            : [];
          const [option, value, reason] = fields;
          if (
            option === null ||
            option === undefined ||
            value === null ||
            value === undefined ||
            reason === null ||
            reason === undefined ||
            !ts.isObjectLiteralExpression(entry) ||
            !entry.properties.every(ts.isPropertyAssignment)
          ) {
            problems.push({
              code: 'OPTION-OMITS-LITERAL',
              detail: 'an omits entry needs option, value and reason as string literals',
            });
            continue;
          }
          if (!reason.trim())
            problems.push({ code: 'OPTION-OMITS-REASON', detail: `omits ${option} ${value} gives no reason` });
          if (!values.get(option)?.has(value))
            problems.push({
              code: 'OPTION-OMITS-VALUE',
              detail: `omits ${option} ${value} names no mock option value`,
            });
          else if (reason.trim()) ignored.add(JSON.stringify([option, value]));
        }
    }
    const states = record(definition.states) ? definition.states : {};
    const grid = definition.grid;
    const shown = new Set<string>();
    if (record(grid) && Array.isArray(grid['columns']) && record(grid['rows'])) {
      for (const cells of Object.values(grid['rows']))
        if (record(cells))
          for (const column of grid['columns']) {
            if (typeof column !== 'string') continue;
            const name = cells[column];
            if (typeof name === 'string' && Object.prototype.hasOwnProperty.call(states, name)) shown.add(name);
          }
    }
    for (const [option, variants] of values) {
      const displayed = new Set(
        [...shown].flatMap((name) =>
          record(states[name]) && typeof states[name][option] === 'string' ? [states[name][option]] : [],
        ),
      );
      const missing = [...variants].filter(
        (value) => !displayed.has(value) && !ignored.has(JSON.stringify([option, value])),
      );
      if (missing.length)
        problems.push({
          code: 'OPTION-VALUE-MISSING',
          detail: `${option} is missing ${missing.join(', ')} on the grid - add a state, or an omits entry with a reason`,
        });
    }
    return problems;
  };
};
