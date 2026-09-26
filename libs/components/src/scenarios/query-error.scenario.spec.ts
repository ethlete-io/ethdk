import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, getDebugNode, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectLocale, provideColorThemes } from '@ethlete/core';
import {
  createGetQuery,
  createQueryClient,
  def,
  RequestError,
  V2QueryClient,
  withDefaultRetry,
  withSymfonyErrors,
} from '@ethlete/query';
import {
  DEFAULT_QUERY_ERROR_LABELS,
  GERMAN_QUERY_ERROR_LABELS,
  injectQueryErrorLabels,
  legacyQueryErrorSource,
  provideQueryErrorLabels,
  QUERY_ERROR_ERROR_CODES,
  QUERY_ERROR_IMPORTS,
  QUERY_ERROR_LABELS,
  QUERY_ERROR_TOKEN,
  QueryErrorActionsDirective,
  QueryErrorComponent,
  QueryErrorDirective,
  queryErrorLabelsForLocale,
  queryErrorResponseFromLegacyError,
  QueryErrorTitleDirective,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

type Team = { id: number; name: string };

const client = createQueryClient({
  baseUrl: 'https://api.example.com',
  name: 'query-error-scenario',
  features: [withSymfonyErrors(), withDefaultRetry({ maxAttempts: 1, baseDelayMs: 100, jitter: 0 })],
});
const getTeams = createGetQuery(client)<{ response: Team[] }>('/teams');

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

@Component({
  selector: 'et-scenario-team-list',
  imports: [QUERY_ERROR_IMPORTS],
  template: `
    @if (teams.error(); as error) {
      <et-query-error
        [error]="error"
        [query]="teams"
        [alwaysAllowRetry]="alwaysAllowRetry()"
        (retryRequest)="retries = retries + 1"
      />
    } @else {
      <ul class="teams">
        @for (team of teams.response(); track team.id) {
          <li>{{ team.name }}</li>
        }
      </ul>
    }
  `,
})
class TeamListComponent {
  teams = getTeams();
  retries = 0;
  alwaysAllowRetry = signal(false);
}

@Component({
  selector: 'et-scenario-team-sign-in-error',
  imports: [QUERY_ERROR_IMPORTS],
  template: `
    <div #queryError="etQueryError" [error]="teams.error()" alwaysAllowRetry etQueryError>
      @if (queryError.view(); as view) {
        <strong class="headline">{{ view.title }}</strong>
        <span class="status">{{ view.status }}</span>
        <button (click)="queryError.retry()" class="again" type="button">
          {{ queryError.resolvedLabels().retry }}
        </button>
      }
    </div>

    @if (teams.error(); as error) {
      <et-query-error [error]="error" [labels]="{ retry: 'Reload teams' }" alwaysAllowRetry>
        <ng-template etQueryErrorTitle let-view>
          {{ view.status === 401 ? 'You are signed out' : view.title }}
        </ng-template>
        <ng-template etQueryErrorActions let-view>
          <a class="support" href="/support">Contact support ({{ view.status }})</a>
          <button (click)="reach()" class="custom-retry" type="button">Try again</button>
        </ng-template>
      </et-query-error>
    }
  `,
})
class TeamSignInErrorComponent {
  teams = getTeams();
  retried = 0;

  reach() {
    this.retried++;
  }
}

@Component({
  selector: 'et-scenario-label-reader',
  template: `{{ labels().retry }}`,
})
class LabelReaderComponent {
  labels = injectQueryErrorLabels();
  token = inject(QUERY_ERROR_LABELS);
}

@Component({
  selector: 'et-scenario-stray-title',
  imports: [QueryErrorTitleDirective, QueryErrorActionsDirective],
  template: `<ng-template etQueryErrorTitle>Lost</ng-template>`,
})
class StrayTitleComponent {}

const legacyError = (status: number, body: unknown): RequestError => {
  const httpErrorResponse = new HttpErrorResponse({ error: body, status, statusText: 'x', url: '/teams' });

  return { url: '/teams', status, statusText: 'x', detail: body, httpErrorResponse };
};

@Component({
  selector: 'et-scenario-legacy-teams',
  imports: [QUERY_ERROR_IMPORTS],
  template: `
    @if (source.error(); as error) {
      <et-query-error [error]="error" [query]="source.retryTarget" alwaysAllowRetry />
    }
  `,
})
class LegacyTeamsComponent {
  failure = signal<RequestError | null>(null);
  teams = new V2QueryClient({ baseRoute: 'https://api.example.com' })
    .get({ route: '/teams', types: { response: def<Team[]>() } })
    .prepare({ mock: { delay: 5, response: [] } });
  source = legacyQueryErrorSource({ error: () => this.failure(), query: () => this.teams });
}

const settle = (s: Scenario) => {
  s.tick();
  s.frame(2);
};

describe('query error scenarios', () => {
  const scenario = useScenario({
    providers: [provideColorThemes(TEST_COLOR_THEMES), provideHttpClient(), provideHttpClientTesting()],
  });

  it('shows a final failure without a retry and replaces a message that repeats the title', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TeamListComponent);
    const host = fixture.nativeElement as HTMLElement;

    settle(s);
    http.expectOne('https://api.example.com/teams').flush({ message: 'Not found' }, { status: 404, statusText: 'x' });
    settle(s);
    s.errors.splice(0);

    const panel = query('.et-query-error', host);

    expect(getDebugNode(query('et-query-error', host))?.componentInstance).toBeInstanceOf(QueryErrorComponent);
    expect(panel.getAttribute('role')).toBe('alert');
    expect(panel.getAttribute('data-status')).toBe('404');
    expect(text(query('.et-query-error-title', host))).toBe('Not found');
    expect(text(query('.et-query-error-message', host))).toBe(`${DEFAULT_QUERY_ERROR_LABELS.message(404)} (Code: 404)`);
    expect(host.querySelector('.et-query-error-actions')).toBeNull();
    expect(query('et-banner', host).getAttribute('data-type')).toBe('error');

    fixture.destroy();
    http.verify();
  });

  const failTwice = (s: Scenario, http: HttpTestingController, status: number, body: object | null) => {
    settle(s);
    http.expectOne('https://api.example.com/teams').flush(body, { status, statusText: 'x' });
    settle(s);
    s.tick(200);
    http.expectOne('https://api.example.com/teams').flush(body, { status, statusText: 'x' });
    settle(s);
    s.errors.splice(0);
  };

  it('retries a transient failure automatically before it shows, and retries on request bypassing the cache', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TeamListComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.alwaysAllowRetry.set(true);
    settle(s);
    http.expectOne('https://api.example.com/teams').flush({ message: 'Try later' }, { status: 503, statusText: 'x' });
    settle(s);

    expect(host.querySelector('.et-query-error')).toBeNull();

    s.tick(200);
    http.expectOne('https://api.example.com/teams').flush({ message: 'Try later' }, { status: 503, statusText: 'x' });
    settle(s);
    s.errors.splice(0);

    expect(text(query('.et-query-error-message', host))).toBe('Try later');

    const retry = query<HTMLButtonElement>('.et-query-error-actions button', host);

    expect(text(retry)).toBe('Retry');
    retry.click();
    settle(s);

    expect(fixture.componentInstance.retries).toBe(1);
    http.expectOne('https://api.example.com/teams').flush([{ id: 1, name: 'team-a' }]);
    settle(s);

    expect(host.querySelector('.et-query-error')).toBeNull();
    expect(text(query('.teams', host))).toBe('team-a');

    fixture.destroy();
    http.verify();
  });

  it.fails('offers a retry for a transient failure once the automatic retries are exhausted', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TeamListComponent);
    const host = fixture.nativeElement as HTMLElement;

    failTwice(s, http, 503, { message: 'Try later' });

    const directive = getDebugNode(query('et-query-error', host))?.injector.get(QueryErrorDirective);

    try {
      expect(directive?.canRetry()).toBe(true);
      expect(host.querySelector('.et-query-error-actions button')).not.toBeNull();
    } finally {
      fixture.destroy();
      http.verify();
    }
  });

  it('renders a violation list as a list', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TeamListComponent);
    const host = fixture.nativeElement as HTMLElement;

    settle(s);
    http
      .expectOne('https://api.example.com/teams')
      .flush(
        { violations: [{ message: 'Name is required' }, { message: 'Coach is invalid' }] },
        { status: 422, statusText: 'x' },
      );
    settle(s);
    s.errors.splice(0);

    expect(query('.et-query-error', host).hasAttribute('data-list')).toBe(true);
    expect(Array.from(host.querySelectorAll('.et-query-error-list-item')).map(text)).toEqual([
      'Name is required',
      'Coach is invalid',
    ]);
    expect(host.querySelector('.et-query-error-message')).toBeNull();

    fixture.destroy();
    http.verify();
  });

  it('replaces the title and the actions row through slots, and drives a headless error', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TeamSignInErrorComponent);
    const host = fixture.nativeElement as HTMLElement;

    settle(s);
    http.expectOne('https://api.example.com/teams').flush(null, { status: 401, statusText: 'x' });
    settle(s);
    s.errors.splice(0);

    const component = query('et-query-error', host);
    const node = getDebugNode(component);

    expect(node?.injector.get(QUERY_ERROR_TOKEN)).toBe(node?.injector.get(QueryErrorDirective));
    expect(text(query('.et-query-error-title', component))).toBe('You are signed out');
    expect(text(query('.support', component))).toBe('Contact support (401)');
    expect(component.querySelector('.et-query-error-actions button:not(.custom-retry)')).toBeNull();

    query('.custom-retry', component).click();
    expect(fixture.componentInstance.retried).toBe(1);

    expect(text(query('.headline', host))).toBe(DEFAULT_QUERY_ERROR_LABELS.title(401));
    expect(text(query('.status', host))).toBe('401');
    expect(text(query('.again', host))).toBe('Retry');

    const headless = getDebugNode(query('[etQueryError]', host))?.injector.get(QueryErrorDirective);

    expect(headless?.canRetry()).toBe(true);
    expect(node?.injector.get(QueryErrorDirective).resolvedLabels().retry).toBe('Reload teams');

    query('.again', host).click();
    settle(s);
    http.expectNone('https://api.example.com/teams');

    fixture.destroy();
    http.verify();
  });

  it('reports a slot template placed outside a query error', () => {
    const s = scenario();

    TestBed.createComponent(StrayTitleComponent);
    s.tick(1);

    const messages = s.errors.splice(0).map((entry) => String(entry.error));

    expect(messages.filter((message) => message.startsWith('Error: ET'))).toEqual([
      expect.stringContaining(`ET${QUERY_ERROR_ERROR_CODES.PART_OUTSIDE_QUERY_ERROR}`),
    ]);
  });

  it('bridges a legacy query error into the same panel and retries without the cache', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LegacyTeamsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;
    const execute = vi.spyOn(app.teams, 'execute').mockReturnValue(app.teams);

    settle(s);
    expect(host.querySelector('.et-query-error')).toBeNull();

    const failure = legacyError(503, { message: 'Directory offline' });

    expect(queryErrorResponseFromLegacyError(failure).code).toBe(503);

    app.failure.set(failure);
    settle(s);

    expect(text(query('.et-query-error-message', host))).toBe('Directory offline');

    query<HTMLButtonElement>('.et-query-error-actions button', host).click();
    expect(execute).toHaveBeenCalledWith({ skipCache: true });

    fixture.destroy();
    s.tick(10);
  });
});

describe('query error label scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideColorThemes(TEST_COLOR_THEMES),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideQueryErrorLabels(queryErrorLabelsForLocale),
    ],
  });

  it('follows the locale into the shipped German labels', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const reader = TestBed.createComponent(LabelReaderComponent);

    s.tick();
    expect(text(reader.nativeElement)).toBe('Retry');
    expect(reader.componentInstance.token).toBeTruthy();

    TestBed.runInInjectionContext(() => injectLocale().currentLocale.set('de-DE'));
    const fixture = TestBed.createComponent(TeamListComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.alwaysAllowRetry.set(true);

    settle(s);
    http.expectOne('https://api.example.com/teams').flush(null, { status: 503, statusText: 'x' });
    s.tick(200);
    http.expectOne('https://api.example.com/teams').flush(null, { status: 503, statusText: 'x' });
    settle(s);
    s.errors.splice(0);

    expect(text(reader.nativeElement)).toBe(GERMAN_QUERY_ERROR_LABELS.retry);
    expect(text(query('.et-query-error-title', host))).toBe('Dienst nicht verfügbar');
    expect(text(query('.et-query-error-message', host))).toBe(`${GERMAN_QUERY_ERROR_LABELS.message(503)} (Code: 503)`);
    expect(text(query('.et-query-error-actions button', host))).toBe('Erneut versuchen');

    fixture.destroy();
    http.verify();
  });
});
