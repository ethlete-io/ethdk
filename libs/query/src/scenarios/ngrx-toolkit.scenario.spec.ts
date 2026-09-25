import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, Injectable, Injector } from '@angular/core';
import {
  ActionCallArgs,
  CallState,
  joinErrors,
  joinLoading,
  MappedEntityState,
  NgRxToolkitModule,
  SuspenseMultiPipe,
  SuspensePipe,
  toolkitCall,
  ToolkitError,
  toolkitSelect,
} from '@ethlete/query/ngrx-toolkit';
import { Observable, Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { QueryCreator } from '../index';
import { useScenario } from './harness';

type Team = { id: string; name: string; revision: number };
type GetTeamArgs = { response: Team; pathParams: { teamId: string }; queryParams?: { expand?: string } };
type PostMemberArgs = {
  response: { ok: boolean };
  pathParams: { teamId: string };
  queryParams: { notify: string };
  body: { name: string };
};

type Api = {
  getTeam: QueryCreator<GetTeamArgs>;
  postMember: QueryCreator<PostMemberArgs>;
};

let api: Api;

@Injectable({ providedIn: 'root' })
class TeamFacade {
  private injector = inject(Injector);

  getTeam(args: ActionCallArgs<Api['getTeam']>) {
    return toolkitCall(api.getTeam, args, { injector: this.injector });
  }

  postMember(args: ActionCallArgs<Api['postMember']>) {
    return toolkitCall(api.postMember, args, { injector: this.injector });
  }

  select(args: ActionCallArgs<Api['getTeam']>) {
    return toolkitSelect(api.getTeam, args, { injector: this.injector });
  }
}

const record = <T>(source: Observable<T>) => {
  const values: T[] = [];
  const subscription = source.subscribe((value) => values.push(value));

  return { values, subscription };
};

const useTeamScenario = () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  beforeEach(() => {
    const s = scenario();
    let revision = 0;

    s.api.on('GET', '/teams/:teamId', ({ params }) => {
      if (params['teamId'] === 'missing') return { status: 404, body: { detail: 'No such team' } };
      if (params['teamId'] === 'broken') return { status: 500, body: null };

      return { body: { id: params['teamId'], name: `Team ${params['teamId']}`, revision: ++revision }, delay: 100 };
    });

    api = {
      getTeam: s.get<GetTeamArgs>((p) => `/teams/${p.teamId}`),
      postMember: s.post<PostMemberArgs>((p) => `/teams/${p.teamId}/members`),
    };
  });

  return scenario;
};

describe('ngrx-toolkit interop', () => {
  const scenario = useTeamScenario();

  const facade = () => scenario().run(() => inject(TeamFacade));

  it('exposes the toolkit handle members over one call', () => {
    const s = scenario();
    const store = facade().getTeam({ queryParams: { teamId: '1' } });

    const response = record(store.response$);
    const cached = record(store.cachedResponse$);
    const loading = record(store.isLoading$);
    const success = record(store.isSuccess$);
    const callState = record(store.callState$);
    const args = record(store.args$);
    const init = record(store.isInit$);
    const timestamp = record(store.timestamp$);

    expect(loading.values).toEqual([true]);
    expect(response.values).toEqual([null]);

    s.tick(100);

    expect(response.values).toEqual([null, { id: '1', name: 'Team 1', revision: 1 }]);
    expect(cached.values).toEqual([{ id: '1', name: 'Team 1', revision: 1 }]);
    expect(loading.values).toEqual([true, false]);
    expect(success.values).toEqual([false, true]);
    expect(callState.values).toEqual([CallState.LOADING, CallState.SUCCESS]);
    expect(args.values).toEqual([{ queryParams: { teamId: '1' } }]);
    expect(init.values).toEqual([false]);
    expect(timestamp.values.every((value) => typeof value === 'number')).toBe(true);

    for (const r of [response, cached, loading, success, callState, args, init, timestamp])
      r.subscription.unsubscribe();
  });

  it('returns the same handle for equal args, sends a new request, and nulls response$ while cachedResponse$ keeps the last one', () => {
    const s = scenario();
    const first = facade().getTeam({ queryParams: { teamId: '1' } });
    s.tick(100);

    const response = record(first.response$);
    const cached = record(first.cachedResponse$);

    const second = facade().getTeam({ queryParams: { teamId: '1' } });

    expect(second).toBe(first);
    s.tick(50);

    expect(response.values).toEqual([{ id: '1', name: 'Team 1', revision: 1 }, null]);
    expect(cached.values).toEqual([{ id: '1', name: 'Team 1', revision: 1 }]);

    s.tick(50);

    expect(s.api.requestCount('GET', '/teams/1')).toBe(2);
    expect(response.values.at(-1)).toEqual({ id: '1', name: 'Team 1', revision: 2 });
    expect(cached.values).toEqual([
      { id: '1', name: 'Team 1', revision: 1 },
      { id: '1', name: 'Team 1', revision: 2 },
    ]);

    expect(facade().getTeam({ queryParams: { teamId: '2' } })).not.toBe(first);
    s.tick(100);

    response.subscription.unsubscribe();
    cached.subscription.unsubscribe();
  });

  it('re-runs the last args on refresh() and resets the entry on remove()', () => {
    const s = scenario();
    const store = facade().getTeam({ queryParams: { teamId: '1' } });
    s.tick(100);

    store.refresh();
    s.tick(100);
    expect(s.api.requestCount('GET', '/teams/1')).toBe(2);

    const callState = record(store.callState$);
    const args = record(store.args$);
    const response = record(store.response$);

    store.remove();
    s.tick();

    expect(callState.values).toEqual([CallState.SUCCESS, null]);
    expect(args.values).toEqual([{ queryParams: { teamId: '1' } }, null]);
    expect(response.values).toEqual([{ id: '1', name: 'Team 1', revision: 2 }, null]);

    store.refresh();
    s.tick(100);
    expect(s.api.requestCount('GET', '/teams/1')).toBe(2);

    for (const r of [callState, args, response]) r.subscription.unsubscribe();
  });

  it('polls through refresh() until the kill switch fires, and stops on stopPolling()', () => {
    const s = scenario();
    const store = facade().getTeam({ queryParams: { teamId: '1' } });
    s.tick(100);

    const killSwitch = new Subject<boolean>();
    store.startPolling({ intervalDuration: 1000, killSwitch });
    store.startPolling({ intervalDuration: 1000, killSwitch });

    s.tick(3000);
    expect(s.api.requestCount('GET', '/teams/1')).toBe(4);

    killSwitch.next(true);
    s.tick(3000);
    expect(s.api.requestCount('GET', '/teams/1')).toBe(4);

    store.startPolling({ intervalDuration: 500, killSwitch: new Subject<boolean>() });
    s.tick(1000);
    expect(s.api.requestCount('GET', '/teams/1')).toBe(6);

    store.stopPolling();
    s.tick(3000);
    expect(s.api.requestCount('GET', '/teams/1')).toBe(6);
  });

  it('refreshes a request another component started through the handle of its args', () => {
    const s = scenario();
    const observed = facade().select({ queryParams: { teamId: '1' } });
    const response = record(observed.response$);

    expect(response.values).toEqual([null]);

    const started = facade().getTeam({ queryParams: { teamId: '1' } });
    s.tick(100);

    expect(started).toBe(observed);
    expect(response.values.at(-1)).toEqual({ id: '1', name: 'Team 1', revision: 1 });

    const expanded = facade().getTeam({ params: { expand: 'members' }, queryParams: { teamId: '1' } });
    s.tick(100);

    facade()
      .select({ queryParams: { teamId: '1' }, params: { expand: 'members' } })
      .refresh();
    s.tick(100);

    expect(facade().select({ queryParams: { teamId: '1' }, params: { expand: 'members' } })).toBe(expanded);
    expect(s.api.requests.map((request) => request.url)).toEqual([
      'https://api.test/teams/1',
      'https://api.test/teams/1?expand=members',
      'https://api.test/teams/1?expand=members',
    ]);

    response.subscription.unsubscribe();
  });

  it('finds the handle a facade started with wider args, ignoring keys that never reach the request', () => {
    const s = scenario();
    const legacyArgs = { queryParams: { teamId: '1' }, skipCache: true };

    const started = facade().getTeam(legacyArgs);
    s.tick(100);

    expect(facade().select({ queryParams: { teamId: '1' } })).toBe(started);
  });

  it('maps toolkit args to path params, query string, body and per-call headers', () => {
    const s = scenario();
    s.api.on('POST', '/teams/:teamId/members', () => ({ body: { ok: true } }));

    const store = facade().postMember({
      queryParams: { teamId: '7' },
      params: { notify: 'yes' },
      body: { name: 'Ada' },
      actionOptions: { headers: { 'x-ssr': '1' } },
    });
    const response = record(store.response$);
    s.tick();

    const [request] = s.api.requests;
    expect(request?.path).toBe('/teams/7/members');
    expect(request?.query).toEqual({ notify: 'yes' });
    expect(request?.body).toEqual({ name: 'Ada' });
    expect(request?.headers.get('x-ssr')).toBe('1');
    expect(response.values.at(-1)).toEqual({ ok: true });

    response.subscription.unsubscribe();
  });

  it('maps a failed request to the toolkit error shape', () => {
    const s = scenario();
    const store = facade().getTeam({ queryParams: { teamId: 'missing' } });
    const error = record(store.error$);
    const isError = record(store.isError$);
    const response = record(store.response$);
    s.tick();

    const last = error.values.at(-1) as ToolkitError<{ detail: string }>;
    expect(last.status).toBe(404);
    expect(last.data).toEqual({ detail: 'No such team' });
    expect(last.message).toContain('404');
    expect(isError.values).toEqual([false, true]);
    expect(response.values).toEqual([null]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 404);
    for (const r of [error, isError, response]) r.subscription.unsubscribe();
  });

  it('joins loading and error streams the way the toolkit helpers do', () => {
    const s = scenario();
    const ok = facade().getTeam({ queryParams: { teamId: '1' } });
    const bad = facade().getTeam({ queryParams: { teamId: 'broken' } });
    const loading = record(joinLoading([ok.isLoading$, null, bad.isLoading$]));
    const errors = record(joinErrors([ok.error$, bad.error$, undefined]));

    s.tick();
    expect(loading.values.at(-1)).toBe(true);
    expect(errors.values.at(-1)?.map((error) => error.status)).toEqual([500]);

    s.tick(100);
    expect(loading.values.at(-1)).toBe(false);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    loading.subscription.unsubscribe();
    errors.subscription.unsubscribe();
  });

  it('requires an injector outside an injection context', () => {
    expect(() => toolkitCall(api.getTeam, { queryParams: { teamId: '1' } })).toThrow(/injection context/);
  });
});

@Component({
  selector: 'et-toolkit-team-view',
  imports: [SuspensePipe],
  template: `
    @let state = store | suspense;
    <p class="loading">{{ state?.isLoading }}</p>
    <p class="name">{{ state?.response?.name ?? '-' }}</p>
    <p class="cached">{{ state?.cachedResponse?.revision ?? '-' }}</p>
    <button (click)="open('1')" class="open">Open</button>
    <button (click)="state?.refresh()" class="refresh">Refresh</button>
  `,
})
class TeamViewComponent {
  private facade = inject(TeamFacade);

  store: MappedEntityState<Api['getTeam']> | null = null;

  open(teamId: string) {
    this.store = this.facade.getTeam({ queryParams: { teamId } });
  }
}

@Component({
  selector: 'et-toolkit-teams-view',
  imports: [SuspenseMultiPipe],
  template: `
    @let stores = { first, second } | suspenseMulti;
    <p class="first">{{ stores.first?.response?.name ?? '-' }}</p>
    <p class="second">{{ stores.second?.isLoading }}</p>
    <button (click)="open()">Open</button>
  `,
})
class TeamsViewComponent {
  private facade = inject(TeamFacade);

  first: MappedEntityState<Api['getTeam']> | null = null;
  second: MappedEntityState<Api['getTeam']> | null = null;

  open() {
    this.first = this.facade.getTeam({ queryParams: { teamId: '1' } });
    this.second = this.facade.getTeam({ queryParams: { teamId: '2' } });
  }
}

@Component({
  selector: 'et-toolkit-module-view',
  imports: [NgRxToolkitModule],
  template: `
    <p class="single">{{ (store | suspense)?.response?.name ?? '-' }}</p>
    <p class="multi">{{ ({ store } | suspenseMulti).store?.response?.name ?? '-' }}</p>
    <button (click)="open()">Open</button>
  `,
})
class ModuleViewComponent {
  private facade = inject(TeamFacade);

  store: MappedEntityState<Api['getTeam']> | null = null;

  open() {
    this.store = this.facade.getTeam({ queryParams: { teamId: '3' } });
  }
}

describe('ngrx-toolkit interop pipes', () => {
  const scenario = useTeamScenario();

  const text = (host: HTMLElement, selector: string) => host.querySelector(selector)?.textContent?.trim();

  it('renders a handle through the suspense pipe, keeping cachedResponse through a refetch', () => {
    const s = scenario();
    const ref = s.mount(TeamViewComponent);
    const host = ref.location.nativeElement as HTMLElement;
    s.tick();

    expect(text(host, '.loading')).toBe('false');

    host.querySelector<HTMLButtonElement>('.open')?.click();
    s.tick();
    expect(text(host, '.loading')).toBe('true');
    expect(text(host, '.name')).toBe('-');

    s.tick(100);
    expect(text(host, '.loading')).toBe('false');
    expect(text(host, '.name')).toBe('Team 1');
    expect(text(host, '.cached')).toBe('1');

    host.querySelector<HTMLButtonElement>('.refresh')?.click();
    s.tick(50);
    expect(text(host, '.loading')).toBe('true');
    expect(text(host, '.name')).toBe('-');
    expect(text(host, '.cached')).toBe('1');

    s.tick(50);
    expect(text(host, '.name')).toBe('Team 1');
    expect(text(host, '.cached')).toBe('2');

    ref.destroy();
  });

  it('renders a record of handles through suspenseMulti', () => {
    const s = scenario();
    const ref = s.mount(TeamsViewComponent);
    const host = ref.location.nativeElement as HTMLElement;

    host.querySelector('button')?.click();
    s.tick();
    expect(text(host, '.second')).toBe('true');

    s.tick(100);
    expect(text(host, '.first')).toBe('Team 1');
    expect(text(host, '.second')).toBe('false');

    ref.destroy();
  });

  it('declares both pipes on NgRxToolkitModule', () => {
    const s = scenario();
    const ref = s.mount(ModuleViewComponent);
    const host = ref.location.nativeElement as HTMLElement;

    host.querySelector('button')?.click();
    s.tick(100);

    expect(text(host, '.single')).toBe('Team 3');
    expect(text(host, '.multi')).toBe('Team 3');

    ref.destroy();
  });
});
