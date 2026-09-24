import { Component, ComponentRef, inject, InjectionToken, WritableSignal, signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  def,
  provideQueryClientForDevtools,
  queryComputed,
  QueryDevtoolsComponent,
  queryStateResponseSignal,
  V2QueryClient,
} from '../index';
import { Scenario, useScenario } from './harness';

type User = { id: string };

const API_CLIENT = new InjectionToken<V2QueryClient>('API_CLIENT');
const USER_ID = new InjectionToken<WritableSignal<string>>('USER_ID');

const STORAGE_KEY = 'ethlete:query:devtools';

@Component({
  selector: 'app-user-page',
  template: `<span data-slot="user">{{ user()?.id ?? '-' }}</span>`,
})
class UserPage {
  private readonly getUser = inject(API_CLIENT).get({
    route: (p: { id: string }) => `/users/${p.id}` as const,
    types: { args: def<{ pathParams: { id: string } }>(), response: def<User>() },
  });
  private readonly id = inject(USER_ID);

  readonly userQuery = queryComputed(() => this.getUser.prepare({ pathParams: { id: this.id() } }).execute());
  readonly user = queryStateResponseSignal(this.userQuery);
}

@Component({
  imports: [QueryDevtoolsComponent, UserPage],
  template: `
    <app-user-page />
    <et-query-devtools />
  `,
})
class AppRoot {}

const panel = (ref: ComponentRef<unknown>) => {
  const host = (ref.location.nativeElement as HTMLElement).querySelector('et-query-devtools');
  const root = host?.shadowRoot ?? host;

  if (!root) throw new Error('et-query-devtools is not rendered');

  return root;
};

const buttonByText = (ref: ComponentRef<unknown>, text: string | RegExp) => {
  const button = Array.from(panel(ref).querySelectorAll('button')).find((candidate) => {
    const label = (candidate.textContent ?? '').trim();

    return typeof text === 'string' ? label === text : text.test(label);
  });

  if (!button) throw new Error(`No devtools button labelled ${text}`);

  return button;
};

const liveCount = (ref: ComponentRef<unknown>) =>
  Number(/Live Queries \((\d+)\)/.exec(buttonByText(ref, /^Live Queries/).textContent ?? '')?.[1]);

const createClients = (s: Scenario) => {
  const owner = s.consumer();
  const api = owner.run(() => new V2QueryClient({ baseRoute: 'https://api.test' }));
  const contentful = owner.run(() => new V2QueryClient({ baseRoute: 'https://cdn.test' }));

  const destroy = () => {
    for (const client of [api, contentful]) {
      client._store.forEach((query, key) => {
        query.stopPolling();
        query.abort();
        client._store.remove(key);
      });
    }

    owner.destroy();
  };

  return { api, contentful, destroy };
};

describe('legacy <et-query-devtools> mounted next to the app', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  beforeEach(() => window.localStorage.removeItem(STORAGE_KEY));
  afterEach(() => window.localStorage.removeItem(STORAGE_KEY));

  it('lists the live queries as args change and re-runs them from the refresh buttons', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 50 }));

    const clients = createClients(s);
    const id = signal('1');
    const c = s.consumer([
      provideQueryClientForDevtools({ client: clients.api, displayName: 'GG API Client' }),
      provideQueryClientForDevtools({ client: clients.contentful, displayName: 'Contentful Client' }),
      { provide: API_CLIENT, useValue: clients.api },
      { provide: USER_ID, useValue: id },
    ]);
    const ref = s.mount(AppRoot, c.injector);

    s.tick(1000);
    buttonByText(ref, 'Query Devtools').click();
    s.tick(10);

    expect(panel(ref).querySelector('.et-qd-client__title')?.textContent?.trim()).toBe('GG API Client');
    expect(liveCount(ref)).toBe(1);

    for (const next of ['2', '3', '4']) {
      id.set(next);
      s.tick(1000);

      expect((ref.location.nativeElement as HTMLElement).querySelector('[data-slot="user"]')?.textContent).toBe(next);
      expect(liveCount(ref)).toBe(Number(next));
    }

    for (const done of ['1', '2', '3', '4']) {
      expect(s.api.requestCount('GET', `/users/${done}`)).toBe(1);
    }

    buttonByText(ref, 'Refresh all (ignore caches)').click();
    s.tick(1000);
    expect(s.api.requestCount('GET', '/users/4')).toBe(2);
    expect(s.api.requestCount('GET', '/users/3')).toBe(1);

    const listed = Array.from(panel(ref).querySelectorAll<HTMLButtonElement>('.et-qd-queries__browser-list button'));
    listed.find((button) => button.textContent?.includes('4'))?.click();
    s.tick(10);
    buttonByText(ref, 'Execute (ignore cache)').click();
    s.tick(1000);
    expect(s.api.requestCount('GET', '/users/4')).toBe(3);

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ isOpen: true });

    ref.destroy();
    c.destroy();
    clients.destroy();
  });

  it('restores the open panel from storage and switches clients', () => {
    const s = scenario();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ isOpen: true, selectedClientId: 1 }));
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 50 }));

    const clients = createClients(s);
    const c = s.consumer([
      provideQueryClientForDevtools({ client: clients.api, displayName: 'GG API Client' }),
      provideQueryClientForDevtools({ client: clients.contentful, displayName: 'Contentful Client' }),
      { provide: API_CLIENT, useValue: clients.api },
      { provide: USER_ID, useValue: signal('1') },
    ]);
    const ref = s.mount(AppRoot, c.injector);

    s.tick(1000);
    expect(panel(ref).querySelector('.et-qd-client__title')?.textContent?.trim()).toBe('Contentful Client');
    expect(liveCount(ref)).toBe(0);

    const select = panel(ref).querySelector<HTMLSelectElement>('#et-query-client-instance');
    if (!select) throw new Error('No client select');
    select.value = '0';
    select.dispatchEvent(new Event('change'));
    s.tick(10);

    expect(panel(ref).querySelector('.et-qd-client__title')?.textContent?.trim()).toBe('GG API Client');
    expect(liveCount(ref)).toBe(1);

    ref.destroy();
    c.destroy();
    clients.destroy();
  });
});
