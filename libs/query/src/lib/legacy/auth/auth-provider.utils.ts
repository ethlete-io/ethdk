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

export const decryptBearer = <Result = Record<string, unknown>>(token: string) => {
  try {
    const base64Url = token.split('.')[1];

    if (!base64Url) {
      return null;
    }

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );

    return JSON.parse(jsonPayload) as Result;
  } catch (error) {
    console.error(`Invalid bearer token: ${token}`, error);

    return null;
  }
};
