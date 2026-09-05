import { isDevMode } from '@angular/core';

const getOpName = /\b(?:query|mutation)\s+([\w-]+)(?:\s*\([^)]*\))?\s*\{/;

const STRING_LITERAL = '"""[\\s\\S]*?"""|"(?:[^"\\\\\\n]|\\\\.)*"';
const commentOutsideString = /* @__PURE__ */ new RegExp(`(${STRING_LITERAL})|#[^\\n\\r]*`, 'g');
const whitespaceOutsideString = /* @__PURE__ */ new RegExp(`(${STRING_LITERAL})|\\s+`, 'g');

const minifyGql = (document: string) =>
  document
    .replace(commentOutsideString, (_match, literal?: string) => literal ?? '')
    .replace(whitespaceOutsideString, (_match, literal?: string) => literal ?? ' ')
    .trim();

export type TransformedGqlQuery = {
  query: string;
  variables?: string;
  operationName?: string;
};

export type GqlTransformer = (variables: Record<string, unknown> | null | undefined) => TransformedGqlQuery;

export const transformGql = (str: string | string[]): GqlTransformer => {
  const normalizedStr = Array.isArray(str) ? str.join('') : str;

  const operationName = getOpName.exec(normalizedStr)?.[1];
  let minified: string | undefined;

  return (variables: Record<string, unknown> | null | undefined): TransformedGqlQuery => {
    const data: TransformedGqlQuery = { query: isDevMode() ? normalizedStr : (minified ??= minifyGql(normalizedStr)) };

    if (variables) {
      data['variables'] = JSON.stringify(variables);
    }

    if (operationName) {
      data['operationName'] = operationName;
    }

    return data;
  };
};

const transformerByCreator = /* @__PURE__ */ new WeakMap<object, GqlTransformer>();

/**
 * Returns the {@link GqlTransformer} of a gql creator. The document is fixed when the creator is
 * built, so it is parsed and minified once and reused by every execution.
 *
 * @internal
 */
export const gqlTransformerFor = (creatorInternals: { query: string }): GqlTransformer => {
  const cached = transformerByCreator.get(creatorInternals);

  if (cached) {
    return cached;
  }

  const transformer = transformGql(creatorInternals.query);
  transformerByCreator.set(creatorInternals, transformer);

  return transformer;
};

export type GQL = string & { readonly __gql: unique symbol };

export const gql = (strings: TemplateStringsArray, ...values: unknown[]): GQL => {
  const str = strings.reduce((acc, cur, i) => {
    return acc + cur + (values[i] ?? '');
  }, '');
  return str as GQL;
};
