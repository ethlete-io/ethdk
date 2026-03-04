import { RuntimeError } from '@ethlete/core';
import { QueryFeatureType } from './query-features';

// codes 0-999
export const QueryRuntimeErrorCode = {
  // Query
  QUERY_FEATURE_USED_MULTIPLE_TIMES: 0,

  // Query features
  WITH_ARGS_QUERY_FEATURE_MISSING_BUT_ROUTE_IS_FUNCTION: 100,
  WITH_POLLING_USED_ON_UNSUPPORTED_HTTP_METHOD: 101,
  WITH_AUTO_REFRESH_USED_ON_UNSUPPORTED_HTTP_METHOD: 102,
  WITH_AUTO_REFRESH_USED_IN_MANUAL_QUERY: 103,
  SILENCE_MISSING_WITH_ARGS_FEATURE_ERROR_USED_BUT_WITH_ARGS_PRESENT: 104,

  // Auth provider
  AUTH_EXTRACT_TOKENS_RESPONSE_NOT_OBJECT: 200,
  AUTH_EXTRACT_TOKENS_RESPONSE_MISSING_ACCESS_TOKEN: 201,
  AUTH_EXTRACT_TOKENS_RESPONSE_MISSING_REFRESH_TOKEN: 202,
  AUTH_PROVIDER_FEATURE_USED_MULTIPLE_TIMES: 203,

  // Query Repository
  UNCACHEABLE_REQUEST_HAS_CACHE_KEY_PARAM: 300,
  UNCACHEABLE_REQUEST_HAS_ALLOW_CACHE_PARAM: 301,

  // Paged Query Stack
  PAGED_QUERY_STACK_PAGE_BIGGER_THAN_TOTAL_PAGES: 400,
  PAGED_QUERY_STACK_NEXT_PAGE_CALLED_WITHOUT_PREVIOUS_PAGE: 401,
  PAGED_QUERY_STACK_PREVIOUS_PAGE_CALLED_BUT_ALREADY_AT_FIRST_PAGE: 402,

  // Query Stack
  QUERY_STACK_WITH_ARGS_USED: 500,
  QUERY_STACK_WITH_RESPONSE_UPDATE_USED: 501,
  QUERY_STACK_TOTAL_QUERIES_AND_EXPECTED_QUERIES_MISMATCH: 502,

  // GQL
  GQL_DATA_PROPERTY_MISSING_IN_RESPONSE: 600,

  // Secure Execute
  TOKENS_NOT_AVAILABLE_INSIDE_AUTH_AND_EXEC: 700,
  INVALID_STATE_INSIDE_SECURE_EXECUTE_FACTORY: 701,

  // Query Execution
  CIRCULAR_QUERY_DEPENDENCY: 800,
} as const;

export type QueryRuntimeErrorCode = (typeof QueryRuntimeErrorCode)[keyof typeof QueryRuntimeErrorCode];

export const queryFeatureUsedMultipleTimes = (type: QueryFeatureType) => {
  return new RuntimeError(
    QueryRuntimeErrorCode.QUERY_FEATURE_USED_MULTIPLE_TIMES,
    `The query feature "${type}()" was used multiple times.`,
  );
};

export const withArgsQueryFeatureMissingButRouteIsFunction = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.WITH_ARGS_QUERY_FEATURE_MISSING_BUT_ROUTE_IS_FUNCTION,
    `This queries route is a function, but a "withArgs()" feature is missing.`,
  );
};

export const withPollingUsedOnUnsupportedHttpMethod = (method: string) => {
  return new RuntimeError(
    QueryRuntimeErrorCode.WITH_POLLING_USED_ON_UNSUPPORTED_HTTP_METHOD,
    `This is a "${method}" request, "withPolling()" is only supported for GET, HEAD, OPTIONS requests and GQL queries.`,
  );
};

export const withAutoRefreshUsedOnUnsupportedHttpMethod = (method: string) => {
  return new RuntimeError(
    QueryRuntimeErrorCode.WITH_AUTO_REFRESH_USED_ON_UNSUPPORTED_HTTP_METHOD,
    `This is a "${method}" request, "withAutoRefresh()" is only supported for GET, HEAD, OPTIONS requests and GQL queries.`,
  );
};

export const withAutoRefreshUsedInManualQuery = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.WITH_AUTO_REFRESH_USED_IN_MANUAL_QUERY,
    `"withAutoRefresh()" has been used inside a query that has "onlyManualExecution" set to true.` +
      ` If this is intentional, set "ignoreOnlyManualExecution" to true inside the auto refresh config.`,
  );
};

export const silenceMissingWithArgsFeatureErrorUsedButWithArgsPresent = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.SILENCE_MISSING_WITH_ARGS_FEATURE_ERROR_USED_BUT_WITH_ARGS_PRESENT,
    `The "silenceMissingWithArgsFeatureError" config is set to true, but a "withArgs()" feature is present.`,
  );
};

export const authExtractTokensResponseNotObject = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.AUTH_EXTRACT_TOKENS_RESPONSE_NOT_OBJECT,
    `The auth token extractor expects the response to be an object.`,
  );
};

export const authExtractTokensResponseMissingAccessToken = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.AUTH_EXTRACT_TOKENS_RESPONSE_MISSING_ACCESS_TOKEN,
    `The auth token extractor expects the response to contain a string "accessToken" property.`,
  );
};

export const authExtractTokensResponseMissingRefreshToken = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.AUTH_EXTRACT_TOKENS_RESPONSE_MISSING_REFRESH_TOKEN,
    `The auth token extractor expects the response to contain a string "refreshToken" property.`,
  );
};

export const authProviderFeatureUsedMultipleTimes = (type: string) => {
  return new RuntimeError(
    QueryRuntimeErrorCode.AUTH_PROVIDER_FEATURE_USED_MULTIPLE_TIMES,
    `Bearer auth feature "${type}" was used multiple times.`,
  );
};

export const uncacheableRequestHasCacheKeyParam = (key: string) => {
  return new RuntimeError(
    QueryRuntimeErrorCode.UNCACHEABLE_REQUEST_HAS_CACHE_KEY_PARAM,
    `This request is uncacheable, but a cache key was provided: ${key}. Please remove it.`,
  );
};

export const uncacheableRequestHasAllowCacheParam = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.UNCACHEABLE_REQUEST_HAS_ALLOW_CACHE_PARAM,
    `This request is uncacheable, but allowCache is set to true. Please remove it.`,
  );
};

export const pagedQueryStackPageBiggerThanTotalPages = (page: number, totalPages: number) => {
  return new RuntimeError(
    QueryRuntimeErrorCode.PAGED_QUERY_STACK_PAGE_BIGGER_THAN_TOTAL_PAGES,
    `The page "${page}" is bigger than the total pages "${totalPages}".`,
  );
};

export const pagedQueryStackNextPageCalledWithoutPreviousPage = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.PAGED_QUERY_STACK_NEXT_PAGE_CALLED_WITHOUT_PREVIOUS_PAGE,
    `fetchNextPage() has been called but the current page is not yet loaded. Please call it after the previous page has been loaded.`,
  );
};

export const pagedQueryStackPreviousPageCalledButAlreadyAtFirstPage = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.PAGED_QUERY_STACK_PREVIOUS_PAGE_CALLED_BUT_ALREADY_AT_FIRST_PAGE,
    `fetchPreviousPage() has been called but the current page is already the first page.`,
  );
};

export const queryStackWithArgsUsed = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.QUERY_STACK_WITH_ARGS_USED,
    `withArgs() has been used in a query stack or a paged query stack. This is not supported.`,
  );
};

export const queryStackWithResponseUpdateUsed = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.QUERY_STACK_WITH_RESPONSE_UPDATE_USED,
    `withResponseUpdate() has been used in a query stack or a paged query stack. This is not supported.`,
  );
};

export const queryStackTotalQueriesAndExpectedQueriesMismatch = (totalQueries: number, expectedQueries: number) => {
  return new RuntimeError(
    QueryRuntimeErrorCode.QUERY_STACK_TOTAL_QUERIES_AND_EXPECTED_QUERIES_MISMATCH,
    `The total queries "${totalQueries}" and the expected queries "${expectedQueries}" do not match. This usually happens if a query depends on the response of the previous query to calculate its pagination values. Set blockExecutionDuringLoading to true to prevent this.`,
  );
};

export const gqlDataPropertyMissingInResponse = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.GQL_DATA_PROPERTY_MISSING_IN_RESPONSE,
    `The GraphQL response is missing the required "data" property. Please add a custom transformResponse param to the query creator to handle this response format.`,
  );
};

export const tokensNotAvailableInsideAuthAndExec = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.TOKENS_NOT_AVAILABLE_INSIDE_AUTH_AND_EXEC,
    `Tokens are not available inside authAndExec.`,
  );
};

export const invalidStateInsideSecureExecuteFactory = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.INVALID_STATE_INSIDE_SECURE_EXECUTE_FACTORY,
    `An invalid state occurred inside the secure execute factory.`,
  );
};

export const circularQueryDependency = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.CIRCULAR_QUERY_DEPENDENCY,
    `Query was executed more than 5 times in less than 100ms. This is usually a sign of a circular dependency.`,
  );
};
