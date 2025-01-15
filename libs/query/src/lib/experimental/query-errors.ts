import { RuntimeError } from '@ethlete/core';
import { QueryFeatureType } from './query-features';

export const enum RuntimeErrorCode {
  // Query
  QUERY_FEATURE_USED_MULTIPLE_TIMES = 0,

  // Query features
  WITH_ARGS_QUERY_FEATURE_MISSING_BUT_ROUTE_IS_FUNCTION = 100,
  WITH_POLLING_USED_ON_UNSUPPORTED_HTTP_METHOD = 101,
  WITH_AUTO_REFRESH_USED_ON_UNSUPPORTED_HTTP_METHOD = 102,
  WITH_AUTO_REFRESH_USED_IN_MANUAL_QUERY = 103,

  // Auth provider
  COOKIE_LOGIN_TRIED_BUT_COOKIE_DISABLED = 200,
  ENABLE_COOKIE_CALLED_WITHOUT_COOKIE_CONFIG = 201,
  DISABLE_COOKIE_CALLED_WITHOUT_COOKIE_CONFIG = 202,
  LOGIN_CALLED_WITHOUT_CONFIG = 203,
  LOGIN_WITH_TOKEN_CALLED_WITHOUT_CONFIG = 204,
  REFRESH_TOKEN_CALLED_WITHOUT_CONFIG = 205,
  SELECT_ROLE_CALLED_WITHOUT_CONFIG = 206,
  DEFAULT_RESPONSE_TRANSFORMER_RESPONSE_NOT_OBJECT = 207,
  DEFAULT_RESPONSE_TRANSFORMER_RESPONSE_NOT_CONTAINING_ACCESS_TOKEN = 208,
  DEFAULT_RESPONSE_TRANSFORMER_RESPONSE_NOT_CONTAINING_REFRESH_TOKEN = 209,
  UNABLE_TO_DECRYPT_BEARER_TOKEN = 210,
  BEARER_EXPIRES_IN_PROPERTY_NOT_NUMBER = 211,

  // Query Repository
  UNCACHEABLE_REQUEST_HAS_CACHE_KEY_PARAM = 300,
  UNCACHEABLE_REQUEST_HAS_ALLOW_CACHE_PARAM = 301,

  // Paged Query Stack
  PAGED_QUERY_STACK_PAGE_BIGGER_THAN_TOTAL_PAGES = 400,
  PAGED_QUERY_STACK_NEXT_PAGE_CALLED_WITHOUT_PREVIOUS_PAGE = 401,
  PAGED_QUERY_STACK_PREVIOUS_PAGE_CALLED_BUT_ALREADY_AT_FIRST_PAGE = 402,

  // Query Stack
  QUERY_STACK_WITH_ARGS_USED = 500,
}

export const queryFeatureUsedMultipleTimes = (type: QueryFeatureType) => {
  return new RuntimeError(
    RuntimeErrorCode.QUERY_FEATURE_USED_MULTIPLE_TIMES,
    `The query feature "${type}()" was used multiple times.`,
  );
};

export const withArgsQueryFeatureMissingButRouteIsFunction = () => {
  return new RuntimeError(
    RuntimeErrorCode.WITH_ARGS_QUERY_FEATURE_MISSING_BUT_ROUTE_IS_FUNCTION,
    `This queries route is a function, but a "withArgs()" feature is missing.`,
  );
};

export const withPollingUsedOnUnsupportedHttpMethod = (method: string) => {
  return new RuntimeError(
    RuntimeErrorCode.WITH_POLLING_USED_ON_UNSUPPORTED_HTTP_METHOD,
    `This is a "${method}" request, "withPolling()" is only supported for GET, HEAD, OPTIONS requests and GQL queries.`,
  );
};

export const withAutoRefreshUsedOnUnsupportedHttpMethod = (method: string) => {
  return new RuntimeError(
    RuntimeErrorCode.WITH_AUTO_REFRESH_USED_ON_UNSUPPORTED_HTTP_METHOD,
    `This is a "${method}" request, "withAutoRefresh()" is only supported for GET, HEAD, OPTIONS requests and GQL queries.`,
  );
};

export const withAutoRefreshUsedInManualQuery = () => {
  return new RuntimeError(
    RuntimeErrorCode.WITH_AUTO_REFRESH_USED_IN_MANUAL_QUERY,
    `"withAutoRefresh()" has been used inside a query that has "onlyManualExecution" set to true.` +
      ` If this is intentional, set "ignoreOnlyManualExecution" to true inside the auto refresh config.`,
  );
};

export const cookieLoginTriedButCookieDisabled = () => {
  return new RuntimeError(
    RuntimeErrorCode.COOKIE_LOGIN_TRIED_BUT_COOKIE_DISABLED,
    `Cookie login has been tried, but the cookie is disabled.`,
  );
};

export const enableCookieCalledWithoutCookieConfig = () => {
  return new RuntimeError(
    RuntimeErrorCode.ENABLE_COOKIE_CALLED_WITHOUT_COOKIE_CONFIG,
    `enableCookie() has been called but there is no cookie config. Please set it during the auth provider creation.`,
  );
};

export const disableCookieCalledWithoutCookieConfig = () => {
  return new RuntimeError(
    RuntimeErrorCode.DISABLE_COOKIE_CALLED_WITHOUT_COOKIE_CONFIG,
    `disableCookie() has been called but there is no cookie config. Please set it during the auth provider creation.`,
  );
};

export const loginCalledWithoutConfig = () => {
  return new RuntimeError(
    RuntimeErrorCode.LOGIN_CALLED_WITHOUT_CONFIG,
    `login() has been called without a config. Please set it during the auth provider creation.`,
  );
};

export const loginWithTokenCalledWithoutConfig = () => {
  return new RuntimeError(
    RuntimeErrorCode.LOGIN_WITH_TOKEN_CALLED_WITHOUT_CONFIG,
    `loginWithToken() has been called without a config. Please set it during the auth provider creation.`,
  );
};

export const refreshTokenCalledWithoutConfig = () => {
  return new RuntimeError(
    RuntimeErrorCode.REFRESH_TOKEN_CALLED_WITHOUT_CONFIG,
    `refreshToken() has been called without a config. Please set it during the auth provider creation.`,
  );
};

export const selectRoleCalledWithoutConfig = () => {
  return new RuntimeError(
    RuntimeErrorCode.SELECT_ROLE_CALLED_WITHOUT_CONFIG,
    `selectRole() has been called without a config. Please set it during the auth provider creation.`,
  );
};

export const defaultResponseTransformerResponseNotObject = (currentType: string) => {
  return new RuntimeError(
    RuntimeErrorCode.DEFAULT_RESPONSE_TRANSFORMER_RESPONSE_NOT_OBJECT,
    `The default response transformer expects the response to be an object, but it is a "${currentType}".`,
  );
};

export const defaultResponseTransformerResponseNotContainingAccessToken = () => {
  return new RuntimeError(
    RuntimeErrorCode.DEFAULT_RESPONSE_TRANSFORMER_RESPONSE_NOT_CONTAINING_ACCESS_TOKEN,
    `The default response transformer expects the response to contain an "accessToken" property.`,
  );
};

export const defaultResponseTransformerResponseNotContainingRefreshToken = () => {
  return new RuntimeError(
    RuntimeErrorCode.DEFAULT_RESPONSE_TRANSFORMER_RESPONSE_NOT_CONTAINING_REFRESH_TOKEN,
    `The default response transformer expects the response to contain a "refreshToken" property.`,
  );
};

export const unableToDecryptBearerToken = (token: string) => {
  return new RuntimeError(
    RuntimeErrorCode.UNABLE_TO_DECRYPT_BEARER_TOKEN,
    `The bearer token could not be decrypted: ${token}`,
  );
};

export const bearerExpiresInPropertyNotNumber = (expiresIn: unknown) => {
  return new RuntimeError(
    RuntimeErrorCode.BEARER_EXPIRES_IN_PROPERTY_NOT_NUMBER,
    `The expires in property is not a number: ${expiresIn}`,
  );
};

export const uncacheableRequestHasCacheKeyParam = (key: string) => {
  return new RuntimeError(
    RuntimeErrorCode.UNCACHEABLE_REQUEST_HAS_CACHE_KEY_PARAM,
    `This request is uncacheable, but a cache key was provided: ${key}. Please remove it.`,
  );
};

export const uncacheableRequestHasAllowCacheParam = () => {
  return new RuntimeError(
    RuntimeErrorCode.UNCACHEABLE_REQUEST_HAS_ALLOW_CACHE_PARAM,
    `This request is uncacheable, but allowCache is set to true. Please remove it.`,
  );
};

export const pagedQueryStackPageBiggerThanTotalPages = (page: number, totalPages: number) => {
  return new RuntimeError(
    RuntimeErrorCode.PAGED_QUERY_STACK_PAGE_BIGGER_THAN_TOTAL_PAGES,
    `The page "${page}" is bigger than the total pages "${totalPages}".`,
  );
};

export const pagedQueryStackNextPageCalledWithoutPreviousPage = () => {
  return new RuntimeError(
    RuntimeErrorCode.PAGED_QUERY_STACK_NEXT_PAGE_CALLED_WITHOUT_PREVIOUS_PAGE,
    `fetchNextPage() has been called but the current page is not yet loaded. Please call it after the previous page has been loaded.`,
  );
};

export const pagedQueryStackPreviousPageCalledButAlreadyAtFirstPage = () => {
  return new RuntimeError(
    RuntimeErrorCode.PAGED_QUERY_STACK_PREVIOUS_PAGE_CALLED_BUT_ALREADY_AT_FIRST_PAGE,
    `fetchPreviousPage() has been called but the current page is already the first page.`,
  );
};

export const queryStackWithArgsUsed = () => {
  return new RuntimeError(
    RuntimeErrorCode.QUERY_STACK_WITH_ARGS_USED,
    `withArgs() has been used in a query stack or a paged query stack. This is not supported.`,
  );
};
