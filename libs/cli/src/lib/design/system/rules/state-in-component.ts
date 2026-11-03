import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import ts from 'typescript';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { partLinkOf, stateLiteralPropsOf } from '../sketch/part-definition';
import { sourceFileOf } from '../ts-source';

export const STATE_NOT_IN_COMPONENT = 'STATE-NOT-IN-COMPONENT';

type PhaseUnion = { name: string; values: string[] };

const PHASE_NAME = /(?:phase|state)$/iu;

const literalsOf = (type: ts.TypeNode): string[] | null => {
  if (!ts.isUnionTypeNode(type)) return null;

  const values = type.types.flatMap((member) =>
    ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal) ? [member.literal.text] : [],
  );

  return values.length > 1 ? values : null;
};

const SIGNAL_INPUTS = new Set(['input', 'model']);

const inputTypeOf = (initializer: ts.Expression | undefined) => {
  if (!initializer || !ts.isCallExpression(initializer)) return undefined;

  const callee = initializer.expression;
  const name = ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)
      ? callee.expression.text
      : null;

  return name !== null && SIGNAL_INPUTS.has(name) ? initializer.typeArguments?.[0] : undefined;
};

/** @internal The phase and state unions an app component takes as signal inputs, read without running it. */
export const phaseUnionsOf = (source: string): PhaseUnion[] => {
  const file = sourceFileOf(source);
  const aliases = new Map<string, string[]>();
  const found: PhaseUnion[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isTypeAliasDeclaration(node)) {
      const values = literalsOf(node.type);

      if (values) aliases.set(node.name.text, values);
    }

    ts.forEachChild(node, visit);
  };
  const collect = (node: ts.Node) => {
    if (ts.isPropertyDeclaration(node) && ts.isIdentifier(node.name)) {
      const type = inputTypeOf(node.initializer);
      const members = type && ts.isUnionTypeNode(type) ? type.types : type ? [type] : [];

      for (const member of members) {
        if (ts.isTypeReferenceNode(member) && ts.isIdentifier(member.typeName)) {
          const values = aliases.get(member.typeName.text);

          if (values && PHASE_NAME.test(member.typeName.text)) found.push({ name: member.typeName.text, values });
        }
      }

      const inline = type ? literalsOf(type) : null;

      if (inline && PHASE_NAME.test(node.name.text)) found.push({ name: node.name.text, values: inline });
    }

    ts.forEachChild(node, collect);
  };

  visit(file);
  collect(file);

  return found;
};

const namedAfter = (state: string, value: string) => state === value || state.startsWith(`${value}-`);

const componentOf = (part: ResolvedProduct['parts'][number]) => {
  const link = partLinkOf(part.source);

  return link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;
};

/**
 * A state of a part with an `implements` component that sets a value of one of that component's phase or state input
 * unions but is not named after it (`STATE-NOT-IN-COMPONENT`): the sketch state name must be the value the app uses,
 * optionally followed by `-<detail>`.
 */
export const statesNotInComponentOf = (product: ResolvedProduct): Problem[] => {
  const checkout = resolve(product.configFile, '../../..');

  return product.parts.flatMap((part): Problem[] => {
    const path = componentOf(part);
    const file = path ? resolve(checkout, path) : null;

    if (!path || !file || !existsSync(file)) return [];

    const unions = phaseUnionsOf(readFileSync(file, 'utf8'));

    return Object.entries(stateLiteralPropsOf(part.source)).flatMap(([state, props]) =>
      Object.entries(props).flatMap(([prop, value]) => {
        const union = unions.find(({ values }) => values.includes(value));

        if (!union || namedAfter(state, value)) return [];

        return [
          {
            rule: STATE_NOT_IN_COMPONENT,
            file: part.file,
            message: `state "${state}" sets ${prop}: '${value}' of ${union.name} in ${path} (${union.values.join(' | ')}) - name the state "${value}" as the app does`,
          },
        ];
      }),
    );
  });
};
