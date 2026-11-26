import { decryptBearer as decryptBearerInternal } from '../../http/internal/request-route';
import { AnyV2QueryCreator } from '../query-creator';
import { AuthProvider } from './auth-provider.types';
import { BasicAuthProvider } from './basic-auth-provider';
import { V2BearerAuthProvider } from './bearer-auth-provider';
import { CustomHeaderAuthProvider } from './custom-header-auth-provider';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const isBasicAuthProvider = (authProvider: AuthProvider): authProvider is BasicAuthProvider =>
  authProvider instanceof BasicAuthProvider;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const isBearerAuthProvider = <T extends AnyV2QueryCreator>(
  authProvider: AuthProvider,
): authProvider is V2BearerAuthProvider<T> => authProvider instanceof V2BearerAuthProvider;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const isCustomHeaderAuthProvider = (authProvider: AuthProvider): authProvider is CustomHeaderAuthProvider =>
  authProvider instanceof CustomHeaderAuthProvider;
/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const decryptBearer = decryptBearerInternal;
