/* eslint-disable @angular-eslint/template/use-track-by-function */
import { AsyncPipe, NgForOf, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  Injectable,
  OnInit,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { QueryButtonComponent } from '@ethlete/cdk';
import { createDestroy } from '@ethlete/core';
import {
  BearerAuthProvider,
  QueryDirective,
  filterSuccess,
  isQueryStateSuccess,
  switchQueryState,
} from '@ethlete/query';
import { of, switchMap, takeUntil, tap } from 'rxjs';
import { client, getMediaByUuidWithDetails, getMediaSearchWithDetails, postLogin } from './queries';

@Injectable({
  providedIn: 'root',
})
export class TestService {
  mediaQuery$ = getMediaSearchWithDetails.createSubject();

  media() {
    const query = getMediaSearchWithDetails.prepare({ queryParams: {} }).execute();

    this.mediaQuery$.next(query);
  }
}

@Directive({
  selector: '[ethleteTest]',
  standalone: true,
})
export class TestDirective {
  mediaQuery$ = getMediaSearchWithDetails.createSubject();

  constructor() {
    this.media();
  }

  media() {
    const query = getMediaSearchWithDetails.prepare({ queryParams: {} }).execute();

    this.mediaQuery$.next(query);
  }
}

@Component({
  selector: 'ethlete-entity-test',
  template: `
    <h2 ethleteTest>Query with entity store</h2>
    <form [formGroup]="form" (ngSubmit)="login()">
      <div>
        <label for="username">Username</label>
        <input id="username" type="text" formControlName="username" />
      </div>
      <div>
        <label for="password">Password</label>
        <input id="password" type="password" formControlName="password" />
      </div>

      <button [query]="loginQuery$ | async" type="submit" et-query-button>Login</button>
    </form>

    <button (click)="loadMedia()" type="button">Load media list</button>
    <button (click)="loadOtherMedia()" type="button">Load other media list</button>
    <ng-container *etQuery="mediaQuery$ | async as response; cache: true">
      <button *ngIf="response" (click)="loadFirst()" type="button">Load first</button>

      <ul>
        <!-- eslint-disable-next-line @angular-eslint/template/use-track-by-function -->
        <li *ngFor="let item of response?.items">
          {{ item.uuid }}
        </li>
      </ul>
    </ng-container>
    <br /><br />
    <p>Other</p>
    <ng-container *etQuery="mediaOtherQuery$ | async as response; cache: true">
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
  imports: [ReactiveFormsModule, QueryButtonComponent, AsyncPipe, NgForOf, QueryDirective, NgIf, TestDirective],
  hostDirectives: [TestDirective],
})
export class EntityTestComponent implements OnInit {
  private readonly _destroy$ = createDestroy();

  form = new FormGroup({
    username: new FormControl('mario-manager@dyncdx.dev', { nonNullable: true }),
    password: new FormControl('TestTest20-', { nonNullable: true }),
  });

  loginQuery$ = postLogin.createSubject();
  mediaQuery$ = getMediaSearchWithDetails.createSubject();
  mediaOtherQuery$ = getMediaSearchWithDetails.createSubject();
  firstMediaQuery$ = getMediaByUuidWithDetails.createSubject();

  s = inject(TestService);

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

    this.mediaQuery$
      .pipe(
        switchMap((q) => q?._dependentsChanged$ ?? of(null)),
        tap(console.log),
        takeUntil(this._destroy$),
      )
      .subscribe();

    setTimeout(() => {
      this.loadMedia();
    }, 1500);

    setTimeout(() => {
      this.s.media();
    }, 3000);
  }

  login() {
    const query = postLogin.prepare({ body: this.form.getRawValue() }).execute();

    this.loginQuery$.next(query);
  }

  loadMedia() {
    const query = getMediaSearchWithDetails.prepare({ queryParams: {} }).execute();

    this.mediaQuery$.next(query);
  }

  loadOtherMedia() {
    const query = getMediaSearchWithDetails.prepare({ queryParams: { page: 2 } }).execute();

    this.mediaOtherQuery$.next(query);
  }

  loadFirst() {
    if (!isQueryStateSuccess(this.mediaQuery$.value?.rawState)) {
      return;
    }
    const firstItem = this.mediaQuery$.value?.rawState.response.items[0];
    if (!firstItem) {
      return;
    }
    const query = getMediaByUuidWithDetails.prepare({ pathParams: { uuid: firstItem.uuid } }).execute();
    this.firstMediaQuery$.next(query);
  }
}
