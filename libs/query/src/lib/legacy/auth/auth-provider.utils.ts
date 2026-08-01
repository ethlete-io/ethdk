import { AnyV2QueryCreator } from '../query-creator';
import { AuthProvider } from './auth-provider.types';
import { BasicAuthProvider } from './basic-auth-provider';
import { V2BearerAuthProvider } from './bearer-auth-provider';
import { CustomHeaderAuthProvider } from './custom-header-auth-provider';

export const isBasicAuthProvider = (authProvider: AuthProvider): authProvider is BasicAuthProvider =>
  authProvider instanceof BasicAuthProvider;

export const isBearerAuthProvider = <T extends AnyV2QueryCreator>(
  authProvider: AuthProvider,
): authProvider is V2BearerAuthProvider<T> => authProvider instanceof V2BearerAuthProvider;

export const isCustomHeaderAuthProvider = (authProvider: AuthProvider): authProvider is CustomHeaderAuthProvider =>
  authProvider instanceof CustomHeaderAuthProvider;
export { decryptBearer } from '../../http/internal/request-route';
