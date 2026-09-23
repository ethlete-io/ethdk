import { ApplicationRef, effect, inject, Injector, runInInjectionContext, untracked } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  CanMatchFn,
  NavigationBehaviorOptions,
  RedirectCommand,
  Router,
  UrlTree,
} from '@angular/router';
import { defer, from, Observable } from 'rxjs';
import {
  AnyCreateBearerAuthProviderResult,
  BearerAuthExecutionState,
  BearerAuthProviderOf,
  BearerAuthSessionEndCause,
} from './bearer-auth-provider';

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

  /**
   * How long a guard waits for a session restore before it decides on the session as it stands, which
   * sends the visitor to {@link loginUrl}. `false` waits for as long as the restore takes.
   *
   * @default 10000
   */
  restoreTimeoutMs?: number | false;

  /**
   * The session end causes that send a visitor on a route this guard protects to {@link loginUrl}, with
   * the URL they were on as the return URL (except for `'user'`). Nothing is redirected by default.
   *
   * @example
   * createAuthGuard(authProviderRef, { loginUrl: '/login', redirectOnSessionEnd: ['expired', 'inactivity', 'otherTab'] });
   */
  redirectOnSessionEnd?: readonly BearerAuthSessionEndCause[];
};

/** Decides whether an authenticated visitor may enter a route. Runs in the guard's injection context. */
export type AuthGuardPermission<TRef extends AnyCreateBearerAuthProviderResult = AnyCreateBearerAuthProviderResult> = (
  provider: BearerAuthProviderOf<TRef>,
) => boolean;

export type AuthGuardPermissionOptions = {
  /**
   * Where an authenticated visitor the permission turns away is sent.
   * @default the guard's `defaultUrl`
   */
  redirectTo?: AuthGuardTarget;
};

export type AuthGuard<TRef extends AnyCreateBearerAuthProviderResult = AnyCreateBearerAuthProviderResult> = {
  /**
   * Requires a session. On a lazy route this is the one to use - a visitor without a session never
   * downloads the child bundle.
   */
  canMatch: CanMatchFn;

  /** Requires a session, as a `canActivate` guard. */
  canActivate: CanActivateFn;

  /**
   * Requires a session the permission accepts. Without a session the visitor goes to the login, like
   * {@link canMatch}; with one the permission rejects, to `options.redirectTo`.
   *
   * ```ts
   * { path: 'admin', canMatch: [authGuard.canMatchWith((auth) => !!auth.bearerData()?.isAdmin)], loadChildren: … }
   * ```
   */
  canMatchWith: (permission: AuthGuardPermission<TRef>, options?: AuthGuardPermissionOptions) => CanMatchFn;

  /** {@link canMatchWith}, as a `canActivate` guard. */
  canActivateWith: (permission: AuthGuardPermission<TRef>, options?: AuthGuardPermissionOptions) => CanActivateFn;

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
const DEFAULT_RESTORE_TIMEOUT_MS = 10000;

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
 * A guard pends while a session restore is in flight, for up to `restoreTimeoutMs`, rather than
 * redirecting against a session that is about to exist, so a hard reload of a protected URL stays on
 * that URL.
 */
export const createAuthGuard = <TRef extends AnyCreateBearerAuthProviderResult>(
  providerRef: TRef,
  config: AuthGuardConfig,
): AuthGuard<TRef> => {
  const param = config.returnUrlParam === false ? null : (config.returnUrlParam ?? DEFAULT_RETURN_URL_PARAM);
  const behavior = config.navigationBehaviorOptions ?? { replaceUrl: true };
  const restoreTimeoutMs = config.restoreTimeoutMs ?? DEFAULT_RESTORE_TIMEOUT_MS;
  const sessionGuards = new Set<unknown>();
  const watchedRouters = new WeakSet<Router>();
  const timedOutRestores = new WeakSet<object>();

  const loginRedirect = (router: Router, returnUrl: string | null) => {
    const loginTree = resolveTarget(router, config.loginUrl);

    return param && returnUrl ? withQueryParam(loginTree, param, returnUrl) : loginTree;
  };

  const isSessionRoute = (route: ActivatedRouteSnapshot): boolean => {
    const guards = [...(route.routeConfig?.canMatch ?? []), ...(route.routeConfig?.canActivate ?? [])];

    return guards.some((guard) => sessionGuards.has(guard)) || route.children.some(isSessionRoute);
  };

  const watchSessionEnd = (router: Router, provider: BearerAuthProviderOf<TRef>) => {
    const causes = config.redirectOnSessionEnd;

    if (!causes?.length || watchedRouters.has(router)) return;

    watchedRouters.add(router);

    const appRef = inject(ApplicationRef);

    let handled: BearerAuthExecutionState | null = untracked(provider.executionState);

    effect(
      () => {
        const state = provider.executionState();
        const cause = provider.sessionEndCause();

        if (state === handled || state?.type !== 'logout') return;

        handled = state;

        if (!cause || !causes.includes(cause)) return;

        untracked(() => {
          if (!isSessionRoute(router.routerState.snapshot.root)) return;

          void router.navigateByUrl(loginRedirect(router, cause === 'user' ? null : router.url), behavior);
        });
      },
      { injector: appRef.injector },
    );
  };

  const guardFor =
    (requiresSession: boolean, permission?: AuthGuardPermission<TRef>, options?: AuthGuardPermissionOptions) => () => {
      const router = inject(Router);
      const injector = inject(Injector);
      const provider = providerRef.inject() as BearerAuthProviderOf<TRef>;

      if (requiresSession) watchSessionEnd(router, provider);

      // Captured before the wait below: once the session settles the router has moved on, and the URL
      // the visitor actually asked for is no longer reachable from it.
      const attemptedUrl = router.currentNavigation()?.extractedUrl.toString() ?? router.url;

      // A restore a guard stopped waiting for is not waited for again, or the redirect to the login
      // would wait out a second timeout on the login route's own guard.
      const settled = () => {
        const status = provider.sessionStatus();

        if (status === 'unknown' || status === 'restoring') return timedOutRestores.has(provider);

        timedOutRestores.delete(provider);

        return true;
      };

      const decide = () => {
        const authenticated = provider.sessionStatus() === 'authenticated';

        if (authenticated !== requiresSession) {
          if (requiresSession) return new RedirectCommand(loginRedirect(router, attemptedUrl), behavior);

          const returnUrl = readReturnUrl(router, attemptedUrl, param);

          return new RedirectCommand(
            returnUrl ? router.parseUrl(returnUrl) : resolveTarget(router, config.defaultUrl ?? DEFAULT_URL),
            behavior,
          );
        }

        if (!permission || untracked(() => runInInjectionContext(injector, () => permission(provider)))) return true;

        return new RedirectCommand(
          resolveTarget(router, options?.redirectTo ?? config.defaultUrl ?? DEFAULT_URL),
          behavior,
        );
      };

      if (settled()) return decide();

      return new Observable<true | RedirectCommand>((subscriber) => {
        const finish = () => {
          subscriber.next(decide());
          subscriber.complete();
        };

        const timeout =
          restoreTimeoutMs === false
            ? null
            : setTimeout(() => {
                timedOutRestores.add(provider);
                finish();
              }, restoreTimeoutMs);

        const watcher = effect(
          () => {
            if (settled()) untracked(finish);
          },
          { injector },
        );

        return () => {
          watcher.destroy();

          if (timeout !== null) clearTimeout(timeout);
        };
      });
    };

  const sessionGuard = <T>(guard: T) => {
    sessionGuards.add(guard);

    return guard;
  };

  const requireSession = sessionGuard(guardFor(true));
  const requireAnonymous = guardFor(false);

  return {
    canMatch: requireSession,
    canActivate: requireSession,
    canMatchWith: (permission, options) => sessionGuard(guardFor(true, permission, options)),
    canActivateWith: (permission, options) => sessionGuard(guardFor(true, permission, options)),
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
