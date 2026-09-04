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

  const name = getOpName.exec(normalizedStr);

  return (variables: Record<string, unknown> | null | undefined): TransformedGqlQuery => {
    const data: TransformedGqlQuery = { query: normalizedStr };

    if (variables) {
      data['variables'] = JSON.stringify(variables);
    }

    if (name && name.length) {
      const operationName = name[1];
      if (operationName) {
        data['operationName'] = operationName;
      }
    }

    if (!isDevMode()) {
      data.query = minifyGql(data.query);
    }

    return data;
  };
};

export type GQL = string & { readonly __gql: unique symbol };

export const gql = (strings: TemplateStringsArray, ...values: unknown[]): GQL => {
  const str = strings.reduce((acc, cur, i) => {
    return acc + cur + (values[i] ?? '');
  }, '');
  return str as GQL;
};
