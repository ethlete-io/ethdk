import { AsyncPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, isDevMode } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Sort, SortDirection } from '@ethlete/cdk';
import { createDestroy } from '@ethlete/core';
import {
  BearerAuthProvider,
  QueryClient,
  QueryDirective,
  QueryField,
  QueryForm,
  def,
  filterSuccess,
  isBearerAuthProvider,
  resetPageOnError,
  takeUntilResponse,
  transformToSort,
  transformToSortQueryParam,
} from '@ethlete/query';
import { Paginated } from '@ethlete/types';
import { filter, map, switchMap, take, takeUntil, tap } from 'rxjs';

export interface GetUsersArgs {
  queryParams: {
    regionKey?: string;
    query?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: SortDirection;
  };
}

export interface PostLoginArgs {
  body: {
    username: string | null;
    password: string | null;
  };
}

export interface AuthorizationTokenView {
  token: string;
  refresh_token: string;
}

export interface PostRefreshTokenArgs {
  body: {
    refresh_token: string;
  };
}

interface User {
  uuid: string;
  firstName: string | null;
  lastName: string | null;
}

export const client = new QueryClient({
  baseRoute: 'https://items-staging-api.braune-digital.com',
  logging: {
    preparedQuerySubscriptions: isDevMode(),
  },
  request: {
    autoRefreshQueriesOnWindowFocus: false,
    enableSmartPolling: false,
    cacheAdapter: () => 0,
  },
});

export const getUsers = client.get({
  route: `/users`,
  secure: true,
  types: {
    args: def<GetUsersArgs>(),
    response: def<Paginated<User>>(),
  },
});

export const postLogin = client.post({
  route: '/auth/login',
  secure: false,
  types: {
    args: def<PostLoginArgs>(),
    response: def<AuthorizationTokenView>(),
  },
});

export const postRefreshToken = client.post({
  route: '/auth/refresh-token',
  secure: false,
  types: {
    args: def<PostRefreshTokenArgs>(),
    response: def<AuthorizationTokenView>(),
  },
});

@Component({
  selector: 'ethlete-query-form',
  template: `
    <h1>Login</h1>
    <form [formGroup]="loginForm" (ngSubmit)="login()">
      <input [formControl]="loginForm.controls.username" type="text" placeholder="User" />
      <input [formControl]="loginForm.controls.password" type="text" placeholder="Password" />
      <button type="submit">Login</button>
    </form>

    <h1>Form</h1>
    <form [formGroup]="form.form">
      <input [formControl]="form.controls.query" type="text" placeholder="Query" />
      <input [formControl]="form.controls.page" type="number" placeholder="Page" />
      <input [formControl]="form.controls.limit" type="number" placeholder="Limit" />
    </form>

    <pre *etQuery="usersQuery$ | async as users">

    {{ users | json }}

    </pre
    >
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ReactiveFormsModule, QueryDirective, JsonPipe, AsyncPipe],
})
export class QueryFormComponent {
  protected readonly usersQuery$ = getUsers.behaviorSubject();
  private readonly _destroy$ = createDestroy();

  form = new QueryForm({
    query: new QueryField({
      control: new FormControl<string>(''),
      debounce: 300,
      disableDebounceIfFalsy: true,
    }),
    page: new QueryField({
      control: new FormControl<number>(1),
      isResetBy: ['query', 'limit'],
    }),
    limit: new QueryField({ control: new FormControl<number>(10) }),
    sort: new QueryField<Sort | null>({
      control: new FormControl(),
      queryParamToValueTransformFn: transformToSort,
      valueToQueryParamTransformFn: transformToSortQueryParam,
    }),
  });

  loginForm = new FormGroup({
    username: new FormControl<string>(''),
    password: new FormControl<string>(''),
  });

  constructor() {
    this._setAp();

    client.authProvider$
      .pipe(
        takeUntilDestroyed(),
        filter((ap): ap is BearerAuthProvider<typeof postRefreshToken> => !!ap && isBearerAuthProvider(ap)),
        switchMap((ap) => ap.tokens$),
        filter((tokens) => !!tokens.token && !!tokens.refreshToken),
        tap(() => {
          this.form.observe();

          this.form.changes$
            .pipe(
              takeUntil(this._destroy$),
              map(({ currentValue }) => {
                this.usersQuery$.value?.abort();

                return getUsers
                  .prepare({
                    queryParams: {
                      page: currentValue.page ?? 1,
                      limit: currentValue.limit ?? 10,
                      query: currentValue.query ?? undefined,
                      sortBy: currentValue.sort?.active ?? undefined,
                      sortOrder: currentValue.sort?.direction ?? 'asc',
                    },
                  })
                  .execute();
              }),
              tap((query) => this.usersQuery$.next(query)),
              resetPageOnError({ queryForm: this.form }),
            )
            .subscribe();
        }),
        take(1),
      )
      .subscribe();
  }

  login() {
    const query = postLogin
      .prepare({
        body: {
          username: this.loginForm.controls.username.value,
          password: this.loginForm.controls.password.value,
        },
      })
      .execute();

    query.state$
      .pipe(
        takeUntilResponse(),
        filterSuccess(),
        tap((s) => this._setAp(s.response.token, s.response.refresh_token)),
      )
      .subscribe();
  }

  private _setAp(token?: string, rToken?: string) {
    if (token) {
      client.clearAuthProvider();
    }

    const ap = new BearerAuthProvider({
      token: token,
      refreshConfig: {
        token: rToken,
        queryCreator: postRefreshToken,
        cookieName: 'playground-refresh-token',
        cookieEnabled: true,
        responseAdapter: (x) => ({ token: x.token, refreshToken: x.refresh_token }),
        requestArgsAdapter: (token) => ({ body: { refresh_token: token.refreshToken } }),
      },
    });

    client.setAuthProvider(ap);
  }
}
