import { HttpContextToken } from '@angular/common/http';

/**
 * `true` on every request `@ethlete/query` sends through `HttpClient`, so an app interceptor can skip
 * query requests: `if (req.context.get(IS_QUERY_REQUEST)) return next(req);`.
 */
export const IS_QUERY_REQUEST = /* @__PURE__ */ new HttpContextToken<boolean>(() => false);
