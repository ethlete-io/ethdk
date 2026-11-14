import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import ts from 'typescript';
import { INTERACTIONS } from '../force-interactions';
import { DesignConfig } from '../design-config';
import { DROPPED_PROP_RULE, STATE_NO_SOURCE_RULE } from './build-ready-contract';
import { productSampledPropsOf } from './harness-samples';
import { designOnlyPropsOf } from './part-compare';
import { Problem } from './problem';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { appSourcesOf, selectorOf } from './rules/implemented-components';
import { KNOWN_UNBOUND_INPUTS } from './rules/unbound-input-known';
import { partLinkOf } from './sketch/part-definition';
import { productModuleIdOf } from './system-modules';
import { sourceFileOf } from './ts-source';
import { loadingOn, WarmDraw } from '../warm-draw';

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const tagsOf = (selector: string, texts: string[]): string[] => {
  const tag = new RegExp(`<${escaped(selector)}(?=[\\s/>])((?:[^>"']|"[^"]*"|'[^']*')*)>`, 'gu');

  return texts.flatMap((text) => [...text.matchAll(tag)].map((match) => match[1] as string));
};

const isBound = (name: string, tags: string[]) =>
  tags.some((attributes) => new RegExp(`(?:\\[\\(?${name}\\)?\\]|(?<![\\w\\[(-])${name}\\s*=)`, 'u').test(attributes));

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
const componentClassOf = (source: string) =>
  sourceFileOf(source).statements.find(
    (statement): statement is ts.ClassDeclaration =>
      ts.isClassDeclaration(statement) &&
      (ts.getDecorators(statement) ?? []).some(
        (decorator) =>
          ts.isCallExpression(decorator.expression) &&
          ts.isIdentifier(decorator.expression.expression) &&
          decorator.expression.expression.text === 'Component',
      ),
  );

export const componentInputsOf = (source: string): string[] | null => {
  const component = componentClassOf(source);

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

const literalOf = (expression: ts.Expression | undefined): string | null => {
  if (!expression) return null;
  if (ts.isStringLiteralLike(expression) || ts.isNumericLiteral(expression)) return expression.text;
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return 'true';
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return 'false';

  return null;
};

/** The literal default of each signal input of the source's `@Component` class (`input('100%')` gives `'100%'`), by input name. */
export const inputDefaultsOf = (source: string): Record<string, string> => {
  const defaults: Record<string, string> = {};

  for (const member of componentClassOf(source)?.members ?? []) {
    if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) continue;

    const call = signalInputOf(member.initializer);
    const value = call ? literalOf(call.arguments[0]) : null;

    if (call && value !== null) defaults[aliasOf(call) ?? member.name.text] = value;
  }

  return defaults;
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

/** Whether the component in `source` takes every design prop of `states`, by the check DROPPED-PROP runs. */
export const takesEveryPropOf = (options: {
  states: Record<string, unknown>;
  sampled: readonly string[];
  source: string;
}) => {
  const inputs = componentInputsOf(options.source);

  return (
    inputs !== null && droppedStatePropsOf({ states: options.states, inputs, sampled: options.sampled }).size === 0
  );
};

/** Answers whether the app component at `path` takes every design prop of the page part `page` of `product`. */
export const pagePropTakerOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  warm?: WarmDraw;
}): Promise<(page: string, path: string) => boolean> => {
  const { target, config, product } = options;
  const pages = product.parts.filter((part) => part.layer === 'pages');
  const states = await loadingOn({ target, config, warm: options.warm }, async (server) => {
    const loaded = new Map<string, Record<string, unknown>>();

    for (const part of pages) {
      const module = (await server
        .ssrLoadModule(productModuleIdOf({ file: part.file, product: product.name }))
        .catch(() => null)) as { default?: { states?: unknown } } | null;
      const found = module?.default?.states;

      if (isRecord(found)) loaded.set(partKeyOf(part), found);
    }

    return loaded;
  });

  return (page, path) => {
    const pageStates = states.get(page);
    const file = resolve(target, path);

    return (
      pageStates !== undefined &&
      existsSync(file) &&
      takesEveryPropOf({
        states: pageStates,
        sampled: productSampledPropsOf({ target, product, part: page }),
        source: readFileSync(file, 'utf8'),
      })
    );
  };
};

const CONSTANT_BINDING = /^(?:'([^']*)'|"([^"]*)"|true|false|null|undefined|-?\d+(?:\.\d+)?)$/u;

type Binding = { expression: string; fixed: boolean };

const bindingOf = (name: string, attributes: string): Binding | null => {
  const quoted = '(?:"([^"]*)"|\'([^\']*)\')';
  const bound = attributes.match(new RegExp(`\\[\\(?${name}\\)?\\]\\s*=\\s*${quoted}`, 'u'));
  const fixed = attributes.match(new RegExp(`(?<![\\w\\[(-])${name}\\s*=\\s*${quoted}`, 'u'));

  if (bound) return { expression: (bound[1] ?? bound[2] ?? '').trim(), fixed: false };

  return fixed ? { expression: fixed[1] ?? fixed[2] ?? '', fixed: true } : null;
};

const constantOf = (binding: Binding): string | null => {
  if (binding.fixed) return binding.expression;

  const match = binding.expression.match(CONSTANT_BINDING);

  return match ? (match[1] ?? match[2] ?? match[0]) : null;
};

/**
 * The state props that name an input no consumer template feeds: no tag of `selector` binds it, or every tag binds a
 * constant (a tag that leaves it out feeds its literal default from `defaults`) that differs from the value the state
 * sets, so the app can never reach that state.
 */
export const statesWithoutSourceOf = (options: {
  states: Record<string, unknown>;
  inputs: readonly string[];
  selector: string;
  templates: readonly string[];
  defaults?: Readonly<Record<string, string>>;
}): Map<string, string[]> => {
  const { states, inputs, selector, templates, defaults = {} } = options;
  const tags = tagsOf(selector, [...templates]);
  const missing = new Map<string, string[]>();

  for (const [state, props] of Object.entries(states)) {
    if (!isRecord(props)) continue;

    const keys = Object.entries(props)
      .filter(([key]) => inputs.includes(key))
      .filter(([key, value]) => {
        if (!isBound(key, tags)) return true;

        const constants = tags.map((attributes) => {
          const binding = bindingOf(key, attributes);

          return binding ? constantOf(binding) : (defaults[key] ?? null);
        });

        return constants.length > 0 && constants.every((constant) => constant !== null && constant !== String(value));
      })
      .map(([key]) => key);

    if (keys.length > 0) missing.set(state, keys);
  }

  return missing;
};

export const stateNoSourceMessageOf = (props: readonly string[], selector: string) =>
  `the design prop${props.length > 1 ? 's' : ''} ${props.join(', ')} ${props.length > 1 ? 'have' : 'has'} no data source in the app - no template feeds ${props.length > 1 ? 'them' : 'it'} on ${selector} with anything but a different fixed value, so the app can never reach this state`;

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

    const text = readFileSync(file, 'utf8');
    const inputs = componentInputsOf(text);
    const src = path?.match(/^(.*?\/src)\//u)?.[1];

    return inputs === null
      ? []
      : [
          {
            part,
            inputs,
            defaults: inputDefaultsOf(text),
            unbound: KNOWN_UNBOUND_INPUTS.filter((known) => resolve(target, known.file) === file).map(
              (known) => known.input,
            ),
            selector: selectorOf(text),
            appDir: src ? resolve(target, src) : null,
          },
        ];
  });

  if (candidates.length === 0) return [];

  return loadingOn({ target, config, warm: options.warm }, async (server) => {
    const problems: Problem[] = [];

    for (const { part, inputs, defaults, unbound, selector, appDir } of candidates) {
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

      if (selector === null || appDir === null || !existsSync(appDir)) continue;

      const templates = appSourcesOf(appDir).map(({ text }) => text);

      for (const [state, props] of statesWithoutSourceOf({
        states,
        inputs: inputs.filter((input) => !unbound.includes(input)),
        selector,
        templates,
        defaults,
      }))
        problems.push({
          rule: STATE_NO_SOURCE_RULE,
          file: part.file,
          message: `${state}: ${stateNoSourceMessageOf(props, selector)}`,
          at: state,
        });
    }

    return problems;
  });
};
