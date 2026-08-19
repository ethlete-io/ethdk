import { effect, inject, Injector } from '@angular/core';
import {
  CanActivateFn,
  CanMatchFn,
  NavigationBehaviorOptions,
  RedirectCommand,
  Router,
  UrlTree,
} from '@angular/router';
import { defer, from, Observable } from 'rxjs';
import { AnyCreateBearerAuthProviderResult } from './bearer-auth-provider';

/** Anything {@link createAuthGuard} accepts as a navigation target. */
export type AuthGuardTarget = string | readonly unknown[] | UrlTree | ((router: Router) => UrlTree);

export type AuthGuardConfig = {
  /**
   * Where a visitor without a session is sent. The attempted URL is appended as
   * {@link returnUrlParam}.
   */
  loginUrl: AuthGuardTarget;

  /**
   * Where `navigateAfterLogin()` and the anonymous guards go when no return URL was captured.
   * @default '/'
   */
  defaultUrl?: AuthGuardTarget;

  /**
   * The query param the attempted URL is written to on the way out and read back from on the way in.
   * Pass `false` to redirect without one, so a login always lands on {@link defaultUrl}.
   *
   * @default 'returnUrl'
   */
  returnUrlParam?: string | false;

  /**
   * How a guard's redirect navigates.
   * @default { replaceUrl: true }
   */
  navigationBehaviorOptions?: NavigationBehaviorOptions;
};

export type AuthGuard = {
  /**
   * Requires a session. On a lazy route this is the one to use - a visitor without a session never
   * downloads the child bundle.
   */
  canMatch: CanMatchFn;

  /** Requires a session, as a `canActivate` guard. */
  canActivate: CanActivateFn;

  /** Requires _no_ session - keeps a signed-in visitor off the login route. */
  canMatchAnonymous: CanMatchFn;

  /** Requires _no_ session, as a `canActivate` guard. */
  canActivateAnonymous: CanActivateFn;

  /**
   * The URL the guard captured before redirecting here, or `null`. Call from an injection context.
   */
  returnUrl: () => string | null;

  /**
   * Navigates to {@link returnUrl}, or to the configured `defaultUrl` when there is none. Call from
   * an injection context; the navigation starts on subscribe.
   */
  navigateAfterLogin: () => Observable<boolean>;
};

const DEFAULT_RETURN_URL_PARAM = 'returnUrl';
const DEFAULT_URL = '/';

const resolveTarget = (router: Router, target: AuthGuardTarget): UrlTree => {
  if (target instanceof UrlTree) return target;
  if (typeof target === 'function') return target(router);
  if (typeof target === 'string') return router.parseUrl(target);

  return router.createUrlTree([...target]);
};

const withQueryParam = (tree: UrlTree, param: string, value: string) =>
  new UrlTree(tree.root, { ...tree.queryParams, [param]: value }, tree.fragment);

// A return URL arrives in the query string, so it is only followed when it points back into this
// app: a leading `//` is a protocol-relative URL to another origin, and anything not starting with
// `/` would resolve against wherever the login page happens to sit.
const readReturnUrl = (router: Router, url: string, param: string | null) => {
  if (!param) return null;

  const value = router.parseUrl(url).queryParams[param];

  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null;
};

/**
 * The route guards for a {@link createBearerAuthProvider} session, and the redirect back once the
 * visitor signs in. Both halves share the return-URL param, so the two cannot drift apart.
 *
 * ```ts
 * export const authGuard = createAuthGuard(authProviderRef, { loginUrl: '/login' });
 *
 * export const ROUTES: Routes = [
 *   { path: 'login', canMatch: [authGuard.canMatchAnonymous], loadComponent: … },
 *   { path: 'app', canMatch: [authGuard.canMatch], loadChildren: … },
 * ];
 * ```
 *
 * A guard pends while a session restore is in flight rather than redirecting against a session that
 * is about to exist, so a hard reload of a protected URL stays on that URL.
 */
export const createAuthGuard = (providerRef: AnyCreateBearerAuthProviderResult, config: AuthGuardConfig): AuthGuard => {
  const param = config.returnUrlParam === false ? null : (config.returnUrlParam ?? DEFAULT_RETURN_URL_PARAM);
  const behavior = config.navigationBehaviorOptions ?? { replaceUrl: true };

  const guardFor = (requiresSession: boolean) => () => {
    const router = inject(Router);
    const injector = inject(Injector);
    const provider = providerRef.inject();

    // Captured before the wait below: once the session settles the router has moved on, and the URL
    // the visitor actually asked for is no longer reachable from it.
    const attemptedUrl = router.currentNavigation()?.extractedUrl.toString() ?? router.url;

    const settled = () => {
      const status = provider.sessionStatus();

      return status !== 'unknown' && status !== 'restoring';
    };

    const decide = () => {
      const authenticated = provider.sessionStatus() === 'authenticated';

      if (authenticated === requiresSession) return true;

      if (requiresSession) {
        const loginTree = resolveTarget(router, config.loginUrl);

        return new RedirectCommand(param ? withQueryParam(loginTree, param, attemptedUrl) : loginTree, behavior);
      }

      const returnUrl = readReturnUrl(router, attemptedUrl, param);

      return new RedirectCommand(
        returnUrl ? router.parseUrl(returnUrl) : resolveTarget(router, config.defaultUrl ?? DEFAULT_URL),
        behavior,
      );
    };

    if (settled()) return decide();

    return new Observable<true | RedirectCommand>((subscriber) => {
      const watcher = effect(
        () => {
          if (!settled()) return;

          subscriber.next(decide());
          subscriber.complete();
        },
        { injector },
      );

      return () => watcher.destroy();
    });
  };

  const requireSession = guardFor(true);
  const requireAnonymous = guardFor(false);

  return {
    canMatch: requireSession,
    canActivate: requireSession,
    canMatchAnonymous: requireAnonymous,
    canActivateAnonymous: requireAnonymous,

    returnUrl: () => {
      const router = inject(Router);

      return readReturnUrl(router, router.url, param);
    },

    navigateAfterLogin: () => {
      const router = inject(Router);

      return defer(() => {
        const returnUrl = readReturnUrl(router, router.url, param);

        return from(router.navigateByUrl(returnUrl ?? resolveTarget(router, config.defaultUrl ?? DEFAULT_URL)));
      });
    },
  };
};
