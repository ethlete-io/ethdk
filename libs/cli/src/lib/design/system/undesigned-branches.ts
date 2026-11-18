import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import ts from 'typescript';
import { InputInitial } from './dropped-props';
import { sourceFileOf } from './ts-source';

type Compiler = typeof import('@angular/compiler', { with: { 'resolution-mode': 'import' } });

const UNKNOWN = Symbol('unknown');

const TEMPLATE_TYPE = /\bTemplateRef\b/u;

type Value = unknown;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const literalValueOf = (expression: ts.Expression | undefined | null): Value => {
  if (expression === undefined) return undefined;
  if (expression === null) return UNKNOWN;
  if (ts.isStringLiteralLike(expression)) return expression.text;
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (expression.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(expression) && expression.text === 'undefined') return undefined;
  if (ts.isArrayLiteralExpression(expression) && expression.elements.length === 0) return [];

  return UNKNOWN;
};

/** The template of the source's `@Component` decorator: its inline `template`, or the file its `templateUrl` names. */
export const componentTemplateOf = (file: string): string | null => {
  const text = readFileSync(file, 'utf8');
  let found: string | null = null;
  const visit = (node: ts.Node) => {
    if (found === null && ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
      const value = node.initializer;

      if (node.name.text === 'template' && ts.isStringLiteralLike(value)) found = value.text;
      if (node.name.text === 'templateUrl' && ts.isStringLiteralLike(value)) {
        const path = resolve(dirname(file), value.text);

        found = existsSync(path) ? readFileSync(path, 'utf8') : null;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFileOf(text));

  return found;
};

const evaluatorOf = (compiler: Compiler, read: (member: string) => Value) => {
  const evaluate = (node: unknown): Value => {
    if (node instanceof compiler.ASTWithSource) return evaluate(node.ast);
    if (node instanceof compiler.ParenthesizedExpression) return evaluate(node.expression);
    if (node instanceof compiler.LiteralPrimitive) return node.value;
    if (node instanceof compiler.PrefixNot) {
      const value = evaluate(node.expression);

      return value === UNKNOWN ? UNKNOWN : !value;
    }
    if (node instanceof compiler.Call) {
      const callee = node.receiver;

      return node.args.length === 0 &&
        callee instanceof compiler.PropertyRead &&
        (callee.receiver instanceof compiler.ImplicitReceiver || callee.receiver instanceof compiler.ThisReceiver)
        ? read(callee.name)
        : UNKNOWN;
    }
    if (node instanceof compiler.PropertyRead || node instanceof compiler.SafePropertyRead) {
      if (node.receiver instanceof compiler.ImplicitReceiver) return UNKNOWN;

      const owner = evaluate(node.receiver);

      if (owner === UNKNOWN) return UNKNOWN;
      if (owner === null || owner === undefined) return node instanceof compiler.SafePropertyRead ? undefined : UNKNOWN;

      return isRecord(owner) ? owner[node.name] : UNKNOWN;
    }
    if (node instanceof compiler.Binary) {
      const left = evaluate(node.left);
      const right = evaluate(node.right);

      switch (node.operation) {
        case '&&':
          return (left !== UNKNOWN && !left) || (right !== UNKNOWN && !right)
            ? false
            : left === UNKNOWN || right === UNKNOWN
              ? UNKNOWN
              : right;
        case '||':
          return (left !== UNKNOWN && left) || (right !== UNKNOWN && right)
            ? true
            : left === UNKNOWN || right === UNKNOWN
              ? UNKNOWN
              : right;
        case '===':
        case '==':
          return left === UNKNOWN || right === UNKNOWN ? UNKNOWN : left === right;
        case '!==':
        case '!=':
          return left === UNKNOWN || right === UNKNOWN ? UNKNOWN : left !== right;
        default:
          return UNKNOWN;
      }
    }

    return UNKNOWN;
  };

  return evaluate;
};

type Condition = { ast: unknown; negate: boolean };

type Branch = { label: string; path: Condition[] };

const CHILD_KEYS = ['children', 'cases', 'empty', 'placeholder', 'loading', 'error'] as const;

const branchesOf = (compiler: Compiler, scope: { nodes: unknown[]; path: Condition[] }): Branch[] =>
  scope.nodes.flatMap((node): Branch[] => {
    if (node instanceof compiler.TmplAstIfBlock) {
      const first = node.branches[0]?.expression;
      const earlier: Condition[] = [];

      const head = `@if (${first instanceof compiler.ASTWithSource ? (first.source ?? '') : ''})`;

      return node.branches.flatMap((branch, index) => {
        const label =
          branch.expression instanceof compiler.ASTWithSource
            ? `${index === 0 ? '@if' : `${head} @else if`} (${branch.expression.source ?? ''})`
            : `${head} @else`;
        const path = [
          ...scope.path,
          ...earlier,
          ...(branch.expression ? [{ ast: branch.expression, negate: false }] : []),
        ];

        if (branch.expression) earlier.push({ ast: branch.expression, negate: true });

        return [{ label, path }, ...branchesOf(compiler, { nodes: branch.children, path })];
      });
    }
    if (!isRecord(node)) return [];

    return CHILD_KEYS.flatMap((key) => {
      const value = node[key];
      const nodes = Array.isArray(value) ? value : isRecord(value) ? [value] : [];

      return branchesOf(compiler, { nodes, path: scope.path });
    });
  });

/**
 * `STATE-UNDESIGNED`: the `@if` and `@else` branches of an app component template that no design state takes. A branch
 * counts as taken when some state, with its props as the component's inputs and the other inputs at their literal
 * defaults, makes every condition on its path true or leaves one undecidable (a computed, a loop variable).
 */
export const undesignedBranchesOf = (options: {
  compiler: Compiler;
  template: string;
  inputs: ReadonlyMap<string, InputInitial>;
  states: Record<string, unknown>;
  sampled?: readonly string[];
}): string[] => {
  const { compiler, template, inputs, states, sampled = [] } = options;
  const parsed = compiler.parseTemplate(template, 'template.html', {});

  if (parsed.errors?.length) return [];

  const props = Object.values(states).filter(isRecord);

  if (props.length === 0) return [];

  const evaluators = props.map((state) =>
    evaluatorOf(compiler, (member) => {
      const input = inputs.get(member);

      if (!input || TEMPLATE_TYPE.test(input.type ?? '')) return UNKNOWN;
      if (input.input in state) return state[input.input];

      return sampled.includes(input.input) ? UNKNOWN : literalValueOf(input.initial);
    }),
  );
  const taken = (branch: Branch, evaluate: (node: unknown) => Value) =>
    branch.path.every(({ ast, negate }) => {
      const value = evaluate(ast);

      return value === UNKNOWN || (negate ? !value : !!value);
    });

  return [
    ...new Set(
      branchesOf(compiler, { nodes: parsed.nodes, path: [] })
        .filter((branch) => !evaluators.some((evaluate) => taken(branch, evaluate)))
        .map(({ label }) => label),
    ),
  ];
};

const kebabOf = (name: string) => name.replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase();

/** A state that takes `branch`: the first design state's props with the inputs its conditions read set to take it. */
export type MissingState = { state: string; props: Record<string, unknown> };

/**
 * The state the developer's build of an undesigned `branch` is drawn in (B251b): the first design state's props with
 * each input its conditions read set so the branch is taken, named after the last input set. `null` when a condition
 * is not an input read, a negation, an `&&` / `||` it can split, or a comparison with a literal.
 */
export const missingStateOf = (options: {
  compiler: Compiler;
  template: string;
  inputs: ReadonlyMap<string, InputInitial>;
  states: Record<string, unknown>;
  branch: string;
}): MissingState | null => {
  const { compiler, template, inputs, states, branch } = options;
  const parsed = compiler.parseTemplate(template, 'template.html', {});
  const found = parsed.errors?.length
    ? undefined
    : branchesOf(compiler, { nodes: parsed.nodes, path: [] }).find(({ label }) => label === branch);
  const base = Object.values(states).find(isRecord);

  if (!found || !base) return null;

  const props: Record<string, unknown> = { ...base };
  let named: string | null = null;
  const inputOf = (node: unknown) => {
    const callee = node instanceof compiler.Call && node.args.length === 0 ? node.receiver : null;

    return callee instanceof compiler.PropertyRead &&
      (callee.receiver instanceof compiler.ImplicitReceiver || callee.receiver instanceof compiler.ThisReceiver)
      ? inputs.get(callee.name)
      : undefined;
  };
  const solve = (node: unknown, want: boolean): boolean => {
    if (node instanceof compiler.ASTWithSource || node instanceof compiler.ParenthesizedExpression)
      return solve(node instanceof compiler.ASTWithSource ? node.ast : node.expression, want);
    if (node instanceof compiler.PrefixNot) return solve(node.expression, !want);
    if (node instanceof compiler.Binary && (node.operation === '&&' || node.operation === '||'))
      return (node.operation === '&&') === want && solve(node.left, want) && solve(node.right, want);
    if (node instanceof compiler.Binary && want && (node.operation === '===' || node.operation === '==')) {
      const input = inputOf(node.left);

      if (!input || !(node.right instanceof compiler.LiteralPrimitive)) return false;

      props[input.input] = node.right.value;
      named = input.input;

      return true;
    }

    const input = inputOf(node);

    if (!input || TEMPLATE_TYPE.test(input.type ?? '')) return false;

    if (want) {
      const initial = literalValueOf(input.initial);

      props[input.input] = typeof initial === 'string' || /\bstring\b/u.test(input.type ?? '') ? input.input : true;
      named = input.input;
    } else props[input.input] = false;

    return true;
  };

  if (!found.path.every(({ ast, negate }) => solve(ast, !negate)) || named === null) return null;
  if (undesignedBranchesOf({ compiler, template, inputs, states: { built: props } }).includes(branch)) return null;

  const name = kebabOf(named);

  return { state: name in states ? `${name}-built` : name, props };
};

export const undesignedBranchMessageOf = (branch: string, component: string) =>
  `${branch} in ${component} renders something no design state draws - draw a state for it: design serve opens the missing-state sketch of ADR 0048 with the built look as its variant, and the hit waits for the pick while it is open (ADR 0010)`;

/** Loads `@angular/compiler` from the checkout, or answers `null` when it is not installed. */
export const angularCompilerOf = async (): Promise<Compiler | null> => import('@angular/compiler').catch(() => null);
