import { gqlDataPropertyMissingInResponse, gqlErrorsInResponse } from '../http';

/** One entry of a GraphQL response's `errors` array, as the GraphQL specification defines it. */
export type GqlError = {
  message: string;
  locations?: { line: number; column: number }[];
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
};

/** The GraphQL-over-HTTP envelope: `data`, and the `errors` a server may send next to it. */
export type GqlEnvelope<TData> = {
  data?: TData | null;
  errors?: GqlError[];
};

/**
 * The response of a query whose creator passes `transformResponse: unwrapGqlResponseWithErrors`:
 * the data plus the `errors` the server sent next to it (empty when it sent none).
 */
export type GqlDataWithErrors<TData> = {
  data: TData;
  errors: GqlError[];
};

const readGqlEnvelope = (rawResponse: unknown) => {
  if (!rawResponse || typeof rawResponse !== 'object') throw gqlDataPropertyMissingInResponse();

  const data = 'data' in rawResponse ? rawResponse.data : undefined;
  const errors = 'errors' in rawResponse ? rawResponse.errors : undefined;

  if ((data === null || data === undefined) && Array.isArray(errors) && errors.length > 0)
    throw gqlErrorsInResponse(errors);
  if (!('data' in rawResponse)) throw gqlDataPropertyMissingInResponse();

  return { data, errors: Array.isArray(errors) ? (errors as GqlError[]) : [] };
};

export const unwrapGqlResponse = (rawResponse: unknown): unknown => readGqlEnvelope(rawResponse).data;

/**
 * A GQL `transformResponse` that keeps the server's `errors` next to partial data. Declare the
 * args' `response` as `GqlDataWithErrors<TData>`; a response without data still fails with ET601.
 */
export const unwrapGqlResponseWithErrors = <TData>(rawResponse: GqlEnvelope<TData>): GqlDataWithErrors<TData> =>
  readGqlEnvelope(rawResponse) as GqlDataWithErrors<TData>;
