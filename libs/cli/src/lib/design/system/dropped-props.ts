import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import ts from 'typescript';
import { INTERACTIONS } from '../force-interactions';
import { DesignConfig } from '../paths';
import { DROPPED_PROP_RULE } from './build-ready-contract';
import { productSampledPropsOf } from './harness-samples';
import { designOnlyPropsOf } from './part-compare';
import { Problem } from './problem';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { partLinkOf } from './sketch/part-definition';
import { productModuleIdOf } from './system-modules';
import { sourceFileOf } from './ts-source';
import { loadingOn, WarmDraw } from '../warm-draw';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const aliasOf = (call: ts.CallExpression) => {
  for (const argument of call.arguments) {
    if (!ts.isObjectLiteralExpression(argument)) continue;

    for (const property of argument.properties)
      if (
        ts.isPropertyAssignment(property) &&
        ts.isIdentifier(property.name) &&
        property.name.text === 'alias' &&
        ts.isStringLiteralLike(property.initializer)
      )
        return property.initializer.text;
  }

  return null;
};

const signalInputOf = (expression: ts.Expression | undefined) => {
  if (!expression || !ts.isCallExpression(expression)) return null;

  const callee = ts.isPropertyAccessExpression(expression.expression)
    ? expression.expression.expression
    : expression.expression;

  return ts.isIdentifier(callee) && (callee.text === 'input' || callee.text === 'model') ? expression : null;
};

/**
 * The input names of the one `@Component` class a source declares (`input()`, `input.required()`, `model()` and
 * `@Input()`, aliases applied), or `null` when the class extends another or uses host directives, so its inputs are not all in the source.
 */
export const componentInputsOf = (source: string): string[] | null => {
  const component = sourceFileOf(source).statements.find(
    (statement): statement is ts.ClassDeclaration =>
      ts.isClassDeclaration(statement) &&
      (ts.getDecorators(statement) ?? []).some(
        (decorator) =>
          ts.isCallExpression(decorator.expression) &&
          ts.isIdentifier(decorator.expression.expression) &&
          decorator.expression.expression.text === 'Component',
      ),
  );

  if (!component || component.heritageClauses?.some((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword))
    return null;
  if (/hostDirectives[\s\S]*\binputs\s*:/.test(component.getText())) return null;

  const names: string[] = [];

  for (const member of component.members) {
    if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) continue;

    const decorator = (ts.getDecorators(member) ?? []).find(
      (candidate) =>
        ts.isCallExpression(candidate.expression) &&
        ts.isIdentifier(candidate.expression.expression) &&
        candidate.expression.expression.text === 'Input',
    );
    const call = signalInputOf(member.initializer);
    const alias = call
      ? aliasOf(call)
      : decorator && ts.isCallExpression(decorator.expression)
        ? (decorator.expression.arguments.map((argument) =>
            ts.isStringLiteralLike(argument) ? argument.text : null,
          )[0] ?? aliasOf(decorator.expression))
        : null;

    if (call || decorator) names.push(alias ?? member.name.text);
  }

  return names;
};

/**
 * The props of each state that no component input takes and compare could not reproduce either: `designOnlyPropsOf`
 * with no drawn markup, so a state that sets an interaction value counts as forcing it.
 */
export const droppedStatePropsOf = (options: {
  states: Record<string, unknown>;
  inputs: readonly string[];
  sampled?: readonly string[];
}): Map<string, string[]> => {
  const { states, inputs, sampled = [] } = options;
  const forcedOf = (state: string, props: unknown): string[] => [
    ...INTERACTIONS.filter((known) => state.endsWith(`-${known}`)),
    ...Object.values(isRecord(props) ? props : {}).flatMap((value) => {
      const named = isRecord(value) ? value['interaction'] : value;

      return typeof named === 'string' && INTERACTIONS.some((known) => known === named) ? [named] : [];
    }),
  ];
  const forcing = new Set(
    Object.entries(states).flatMap(([state, props]) => (forcedOf(state, props).length > 0 ? [state] : [])),
  );
  const dropped = new Map<string, string[]>();

  for (const [state, props] of Object.entries(states)) {
    const designOnly = designOnlyPropsOf({
      states,
      opens: {},
      state,
      forced: forcedOf(state, props),
      forcing,
      selected: true,
    });
    const keys = Object.keys(isRecord(props) ? props : {}).filter(
      (key) => !inputs.includes(key) && !sampled.includes(key) && !designOnly.has(key),
    );

    if (keys.length > 0) dropped.set(state, keys);
  }

  return dropped;
};

export const droppedPropsMessageOf = (dropped: readonly string[]) =>
  `the design prop${dropped.length > 1 ? 's' : ''} ${dropped.join(', ')} ${dropped.length > 1 ? 'have' : 'has'} no input on the app component - the harness drops ${dropped.length > 1 ? 'them' : 'it'}, so compare cannot check this state`;

/** `DROPPED-PROP` for each part whose design states set a prop its app component has no input for, loading the states without drawing. */
export const droppedPropProblemsOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part?: string;
  parts?: readonly string[];
  warm?: WarmDraw;
}): Promise<Problem[]> => {
  const { target, config, product } = options;
  const candidates = product.parts.flatMap((part) => {
    const key = partKeyOf(part);
    const link = partLinkOf(part.source);
    const path = link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;
    const file = path === null ? null : resolve(target, path);

    if (
      (options.part && key !== options.part) ||
      (options.parts && !options.parts.includes(key)) ||
      part.origin === 'base' ||
      file === null ||
      !existsSync(file)
    )
      return [];

    const inputs = componentInputsOf(readFileSync(file, 'utf8'));

    return inputs === null ? [] : [{ part, inputs }];
  });

  if (candidates.length === 0) return [];

  return loadingOn({ target, config, warm: options.warm }, async (server) => {
    const problems: Problem[] = [];

    for (const { part, inputs } of candidates) {
      const module = (await server
        .ssrLoadModule(productModuleIdOf({ file: part.file, product: product.name }))
        .catch(() => null)) as { default?: { states?: unknown } } | null;
      const states = module?.default?.states;

      if (!isRecord(states)) continue;

      const sampled = productSampledPropsOf({ target, product, part: partKeyOf(part) });

      for (const [state, dropped] of droppedStatePropsOf({ states, inputs, sampled }))
        problems.push({
          rule: DROPPED_PROP_RULE,
          file: part.file,
          message: `${state}: ${droppedPropsMessageOf(dropped)}`,
          at: state,
        });
    }

    return problems;
  });
};
