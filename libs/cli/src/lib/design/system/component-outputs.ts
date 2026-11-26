import ts from 'typescript';
import { sourceFileOf } from './ts-source';

const SIGNAL_OUTPUTS = new Set(['output', 'outputFromObservable']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const calleeOf = (expression: ts.Expression | undefined) => {
  if (!expression || !ts.isCallExpression(expression)) return null;

  const callee = ts.isPropertyAccessExpression(expression.expression)
    ? expression.expression.expression
    : expression.expression;

  return ts.isIdentifier(callee) ? { call: expression, name: callee.text } : null;
};

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

/**
 * The outputs and `model()` names of the one `@Component` class a source declares, the way Angular binds them: each
 * `model()` is an input plus a `<name>Change` output. `null` when the class extends another or uses host directives.
 */
export const componentOutputsOf = (source: string): { outputs: string[]; models: string[] } | null => {
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
  if (/hostDirectives[\s\S]*\boutputs\s*:/.test(component.getText())) return null;

  const outputs: string[] = [];
  const models: string[] = [];

  for (const member of component.members) {
    if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) continue;

    const signal = calleeOf(member.initializer);
    const decorator = (ts.getDecorators(member) ?? [])
      .map((candidate) => calleeOf(candidate.expression))
      .find((candidate) => candidate?.name === 'Output');

    if (signal?.name === 'model') {
      const name = aliasOf(signal.call) ?? member.name.text;

      models.push(name);
      outputs.push(`${name}Change`);
    } else if (signal && SIGNAL_OUTPUTS.has(signal.name)) {
      outputs.push(aliasOf(signal.call) ?? member.name.text);
    } else if (decorator) {
      const [first] = decorator.call.arguments;

      outputs.push(first && ts.isStringLiteralLike(first) ? first.text : member.name.text);
    }
  }

  return { outputs, models };
};

/**
 * The `<model>Change` outputs that stand for a declared `emit:<output>` the app component does not have: the change
 * outputs of its models that the design states set as a prop.
 */
export const modelChangesForOf = (options: {
  output: string;
  app: { outputs: readonly string[]; models: readonly string[] } | null;
  states: Record<string, unknown>;
}): string[] => {
  const { output, app, states } = options;

  if (app === null || app.outputs.includes(output)) return [];

  const props = new Set(Object.values(states).flatMap((props) => (isRecord(props) ? Object.keys(props) : [])));

  return app.models.filter((model) => props.has(model)).map((model) => `${model}Change`);
};
