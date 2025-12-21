import { isDevMode } from '@angular/core';

const getOpName = /(query|mutation) ?([\w\d-_]+)? ?\(.*?\)? \{/;

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
      const operationName = name[2];
      if (operationName) {
        data['operationName'] = operationName;
      }
    }

    if (!isDevMode()) {
      // minify the query
      data.query = data.query.replace(/\s+/g, ' ').trim();
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
