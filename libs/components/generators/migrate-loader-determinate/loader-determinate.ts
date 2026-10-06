import { ATTRIBUTE, START_TAG } from '../migrate-select-input-renames/select-input-renames.js';

export type LoaderFinding = { line: number; message: string };

export type LoaderMigrationResult = { content: string | null; findings: LoaderFinding[] };

type Attribute = { text: string; name: string; bound: boolean; expression: string };

type Flag = { kind: 'constant'; on: boolean } | { kind: 'dynamic'; expression: string };

const LOADERS = {
  'et-spinner': { flag: 'determinate', flagMeansDeterminate: true },
  'et-progress-bar': { flag: 'indeterminate', flagMeansDeterminate: false },
} as const;

const SIMPLE_EXPRESSION = /^!?[\w$.]+(\(\))?$/;

const parseAttributes = (attributes: string): Attribute[] =>
  [...attributes.matchAll(ATTRIBUTE)].map((match) => {
    const rawName = match[2] ?? '';
    const rawValue = (match[3] ?? '').replace(/^\s*=\s*/, '');
    const expression = /^(["'])([\s\S]*)\1$/.exec(rawValue)?.[2] ?? rawValue;
    const bracketed = /^\[([^\]]+)\]$/.exec(rawName)?.[1];

    if (bracketed) return { text: match[0], name: bracketed, bound: true, expression: expression.trim() };
    if (rawName.startsWith('bind-')) {
      return { text: match[0], name: rawName.slice(5), bound: true, expression: expression.trim() };
    }

    return { text: match[0], name: rawName, bound: false, expression };
  });

const readFlag = (attribute: Attribute): Flag => {
  if (!attribute.bound) return { kind: 'constant', on: attribute.expression !== 'false' };
  if (attribute.expression === 'true' || attribute.expression === 'false') {
    return { kind: 'constant', on: attribute.expression === 'true' };
  }

  return { kind: 'dynamic', expression: attribute.expression };
};

const valueExpression = (attribute: Attribute) => {
  if (attribute.bound) return attribute.expression;

  return /^-?\d+(\.\d+)?$/.test(attribute.expression.trim())
    ? attribute.expression.trim()
    : `'${attribute.expression}'`;
};

const wrapCondition = (expression: string) => (SIMPLE_EXPRESSION.test(expression) ? expression : `(${expression})`);

const wrapBranch = (expression: string) => (/[?|]/.test(expression) ? `(${expression})` : expression);

const bindValue = (expression: string) =>
  expression.includes('"') ? `[value]='${expression}'` : `[value]="${expression}"`;

export const migrateLoaderDeterminate = (
  content: string,
  options: { skipSpinner?: boolean } = {},
): LoaderMigrationResult => {
  const findings: LoaderFinding[] = [];

  const next = content.replace(START_TAG, (tag, tagName: string, attributes: string, offset: number) => {
    const loader = LOADERS[tagName as keyof typeof LOADERS];

    if (!loader || (tagName === 'et-spinner' && options.skipSpinner)) return tag;

    const parsed = parseAttributes(attributes);

    if (parsed.some((attribute) => attribute.name === 'mode')) return tag;

    const flagAttribute = parsed.find((attribute) => attribute.name === loader.flag);
    const valueAttribute = parsed.find((attribute) => attribute.name === 'value');
    const line = content.slice(0, offset).split('\n').length;
    const report = (message: string) => findings.push({ line, message: `<${tagName}> ${message}` });

    let rewritten = attributes;
    const remove = (attribute: Attribute) => (rewritten = rewritten.replace(attribute.text, ''));
    const replace = (attribute: Attribute, expression: string) =>
      (rewritten = rewritten.replace(
        attribute.text,
        `${/^\s+/.exec(attribute.text)?.[0] ?? ' '}${bindValue(expression)}`,
      ));

    if (!flagAttribute) {
      if (loader.flagMeansDeterminate && valueAttribute) {
        report(
          'binds value without determinate. A bound value now makes it determinate; drop it to stay indeterminate.',
        );
      }
      if (!loader.flagMeansDeterminate && !valueAttribute) {
        report('has no value binding, so it now renders indeterminate instead of an empty bar. Bind [value].');
      }
    } else {
      const flag = readFlag(flagAttribute);

      remove(flagAttribute);

      if (flag.kind === 'constant') {
        const determinate = flag.on === loader.flagMeansDeterminate;

        if (!determinate && valueAttribute) remove(valueAttribute);
        if (determinate && !valueAttribute) {
          report(`had a constant ${loader.flag} binding but no value, so it now renders indeterminate. Bind [value].`);
        }
      } else if (valueAttribute) {
        const condition = wrapCondition(flag.expression);
        const value = wrapBranch(valueExpression(valueAttribute));

        replace(
          valueAttribute,
          loader.flagMeansDeterminate ? `${condition} ? ${value} : undefined` : `${condition} ? undefined : ${value}`,
        );
      } else {
        report(
          `had [${loader.flag}]="${flag.expression}" but no value. It is removed; bind [value] to a number while the loader is determinate and to undefined otherwise.`,
        );
      }
    }

    return rewritten === attributes
      ? tag
      : `<${tagName}${rewritten}${tag.slice(tagName.length + attributes.length + 1)}`;
  });

  return { content: next === content ? null : next, findings };
};
