import { gqlDataPropertyMissingInResponse, gqlErrorsInResponse } from '../http';

export const unwrapGqlResponse = (rawResponse: unknown): unknown => {
  if (!rawResponse || typeof rawResponse !== 'object') throw gqlDataPropertyMissingInResponse();

  const data = 'data' in rawResponse ? rawResponse.data : undefined;
  const errors = 'errors' in rawResponse ? rawResponse.errors : undefined;

  if ((data === null || data === undefined) && Array.isArray(errors) && errors.length > 0)
    throw gqlErrorsInResponse(errors);
  if (!('data' in rawResponse)) throw gqlDataPropertyMissingInResponse();

  return data;
};
