import { AuthProvider } from './auth-provider.types';
import { BasicAuthProvider } from './basic-auth-provider';
import { BearerAuthProvider } from './bearer-auth-provider';
import { CustomHeaderAuthProvider } from './custom-header-auth-provider';

export const isBasicAuthProvider = (authProvider: AuthProvider): authProvider is BasicAuthProvider =>
  authProvider instanceof BasicAuthProvider;

export const isBearerAuthProvider = (authProvider: AuthProvider): authProvider is BearerAuthProvider =>
  authProvider instanceof BearerAuthProvider;

export const isCustomHeaderAuthProvider = (authProvider: AuthProvider): authProvider is CustomHeaderAuthProvider =>
  authProvider instanceof CustomHeaderAuthProvider;

export const decryptBearer = <Result = Record<string, unknown>>(token: string) => {
  try {
    const base64Url = token.split('.')[1];
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
