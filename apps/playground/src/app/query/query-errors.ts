/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-empty-function */

import { RuntimeError } from '@ethlete/core';
import { QueryMethod } from './query-creator';
import { QueryFeatureType } from './query-features';

export const enum RuntimeErrorCode {
  QUERY_FEATURE_USED_MULTIPLE_TIMES = 0,
  WITH_ARGS_QUERY_FEATURE_MISSING_BUT_ROUTE_IS_FUNCTION = 1,
  WITH_POLLING_USED_ON_UNSUPPORTED_HTTP_METHOD = 2,
  WITH_AUTO_REFRESH_USED_ON_UNSUPPORTED_HTTP_METHOD = 3,
  WITH_AUTO_REFRESH_USED_IN_MANUAL_QUERY = 4,
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

export const withPollingUsedOnUnsupportedHttpMethod = (method: QueryMethod) => {
  return new RuntimeError(
    RuntimeErrorCode.WITH_POLLING_USED_ON_UNSUPPORTED_HTTP_METHOD,
    `This is a "${method}" request, "withPolling()" is only supported for GET, HEAD, OPTIONS requests and GQL queries.`,
  );
};

export const withAutoRefreshUsedOnUnsupportedHttpMethod = (method: QueryMethod) => {
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
