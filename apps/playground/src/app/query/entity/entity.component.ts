/* eslint-disable @angular-eslint/template/use-track-by-function */
import { AsyncPipe, NgForOf, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { QueryButtonComponent } from '@ethlete/components';
import { DestroyService } from '@ethlete/core';
import {
  BearerAuthProvider,
  filterSuccess,
  isQueryStateSuccess,
  QueryDirective,
  switchQueryState,
} from '@ethlete/query';
import { takeUntil, tap } from 'rxjs';
import { client, getMediaByUuidWithDetails, getMediaSearchWithDetails, postLogin } from './queries';

@Component({
  selector: 'ethlete-entity-test',
  template: `
    <h2>Query with entity store</h2>
    <form [formGroup]="form" (ngSubmit)="login()">
      <div>
        <label for="username">Username</label>
        <input id="username" type="text" formControlName="username" />
      </div>
      <div>
        <label for="password">Password</label>
        <input id="password" type="password" formControlName="password" />
      </div>

      <button [etQuery]="loginQuery$ | async" type="submit" et-query-button>Login</button>
    </form>

    <button [etQuery]="mediaQuery$ | async" (click)="loadMedia()" type="button" et-query-button>Load media list</button>
    <ng-container *query="mediaQuery$ | async as response; cache: true">
      <button *ngIf="response" [etQuery]="firstMediaQuery$ | async" (click)="loadFirst()" type="button" et-query-button>
        Load first
      </button>

      <ul>
        <!-- eslint-disable-next-line @angular-eslint/template/use-track-by-function -->
        <li *ngFor="let item of response?.items">
          {{ item.uuid }}
        </li>
      </ul>
    </ng-container>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ReactiveFormsModule, QueryButtonComponent, AsyncPipe, NgForOf, QueryDirective, NgIf],
  hostDirectives: [],
  providers: [DestroyService],
})
export class EntityTestComponent implements OnInit {
  private readonly _destroy$ = inject(DestroyService, { host: true }).destroy$;

  form = new FormGroup({
    username: new FormControl('mario-manager@dyncdx.dev', { nonNullable: true }),
    password: new FormControl('TestTest20-', { nonNullable: true }),
  });

  loginQuery$ = postLogin.behaviorSubject();
  mediaQuery$ = getMediaSearchWithDetails.behaviorSubject();
  firstMediaQuery$ = getMediaByUuidWithDetails.behaviorSubject();

  ngOnInit(): void {
    this.loginQuery$
      .pipe(
        takeUntil(this._destroy$),
        switchQueryState(),
        filterSuccess(),
        tap((state) => {
          const authProvider = new BearerAuthProvider({ token: state.response.token });
          client.clearAuthProvider();
          client.setAuthProvider(authProvider);
        }),
      )
      .subscribe();
  }

  login() {
    const query = postLogin.prepare({ body: this.form.getRawValue() }).execute();

    this.loginQuery$.next(query);
  }

  loadMedia() {
    const query = getMediaSearchWithDetails.prepare({ queryParams: {} }).execute();

    this.mediaQuery$.next(query);
  }

  loadFirst() {
    if (!isQueryStateSuccess(this.mediaQuery$.value?.state)) {
      return;
    }

    const firstItem = this.mediaQuery$.value?.state.response.items[0];

    if (!firstItem) {
      return;
    }

    const query = getMediaByUuidWithDetails.prepare({ pathParams: { uuid: firstItem.uuid } }).execute();

    this.firstMediaQuery$.next(query);
  }
}
