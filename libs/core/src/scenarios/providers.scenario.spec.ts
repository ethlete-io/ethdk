import { Component, computed, DestroyRef, inject, InjectionToken, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { interval, takeUntil } from 'rxjs';
import {
  createDestroy,
  defineProvider,
  defineRootProvider,
  defineStaticProvider,
  defineStaticRootProvider,
  injectHostElement,
  toInjectFn,
  toProvideFn,
  toToken,
} from '../index';
import { useScenario } from './harness';

type ListConfig = { pageSize: number; sort: 'asc' | 'desc'; label: string };

const LEGACY_LIST_CONFIG = new InjectionToken<ListConfig>('legacy list config');

const LIST_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<ListConfig>(
  { pageSize: 20, sort: 'asc', label: 'Items' },
  { name: 'List Config', extraInjectionToken: LEGACY_LIST_CONFIG },
);
const provideListConfig = /* @__PURE__ */ toProvideFn(LIST_CONFIG_DEF);
const injectListConfig = /* @__PURE__ */ toInjectFn(LIST_CONFIG_DEF);

const FEATURE_FLAGS_DEF = /* @__PURE__ */ defineStaticProvider<string[]>([], { name: 'Feature Flags' });
const provideFeatureFlags = /* @__PURE__ */ toProvideFn(FEATURE_FLAGS_DEF);
const injectFeatureFlags = /* @__PURE__ */ toInjectFn(FEATURE_FLAGS_DEF);

const counters = { detailCreated: 0, detailDestroyed: 0, sessionCreated: 0 };

const SESSION_DEF = /* @__PURE__ */ defineRootProvider(() => {
  counters.sessionCreated++;

  const user = signal<string | null>(null);

  return { user: user.asReadonly(), login: (name: string) => user.set(name) };
});
const provideSession = /* @__PURE__ */ toProvideFn(SESSION_DEF);
const injectSession = /* @__PURE__ */ toInjectFn(SESSION_DEF);

const DETAIL_DEF = /* @__PURE__ */ defineProvider(() => {
  counters.detailCreated++;

  const config = injectListConfig();
  const session = injectSession();
  const id = signal<string | null>(null);
  const ticks = signal(0);
  const timer = setInterval(() => ticks.update((value) => value + 1), 1000);

  inject(DestroyRef).onDestroy(() => {
    clearInterval(timer);
    counters.detailDestroyed++;
  });

  return {
    id,
    ticks: ticks.asReadonly(),
    title: computed(() => `${config.label} ${id() ?? '-'} (${session.user() ?? 'guest'})`),
  };
});
const provideDetail = /* @__PURE__ */ toProvideFn(DETAIL_DEF);
const injectDetail = /* @__PURE__ */ toInjectFn(DETAIL_DEF);
const DETAIL_TOKEN = /* @__PURE__ */ toToken(DETAIL_DEF);

@Component({ selector: 'et-scenario-detail-header', template: '' })
class DetailHeaderComponent {
  detail = injectDetail();
  host = injectHostElement();
  seconds = signal(0);

  constructor() {
    interval(1000)
      .pipe(takeUntil(createDestroy()))
      .subscribe(() => this.seconds.update((value) => value + 1));
  }
}

@Component({
  selector: 'et-scenario-detail-page',
  imports: [DetailHeaderComponent],
  providers: [provideDetail(), provideListConfig({ label: 'Match' }), provideFeatureFlags(['live'])],
  template: '<et-scenario-detail-header />',
})
class DetailPageComponent {
  detail = injectDetail();
  byToken = inject(DETAIL_TOKEN);
  config = injectListConfig();
  legacyConfig = inject(LEGACY_LIST_CONFIG);
  flags = injectFeatureFlags();
}

@Component({ selector: 'et-scenario-unprovided', template: '' })
class UnprovidedComponent {
  detail = injectDetail({ optional: true });
  flags = injectFeatureFlags({ optional: true });
  config = injectListConfig();
}

@Component({ selector: 'et-scenario-own-session', providers: [provideSession()], template: '' })
class OwnSessionComponent {
  session = injectSession();
}

describe('provider definition scenarios', () => {
  const scenario = useScenario();

  beforeEach(() => {
    counters.detailCreated = 0;
    counters.detailDestroyed = 0;
    counters.sessionCreated = 0;
  });

  it('gives every providing subtree its own instance, shared with its children, and tears it down with it', () => {
    const s = scenario();
    const first = TestBed.createComponent(DetailPageComponent);
    const second = TestBed.createComponent(DetailPageComponent);

    s.tick();

    const header = first.debugElement.children[0]?.componentInstance as DetailHeaderComponent;

    expect(counters.detailCreated).toBe(2);
    expect(header.detail).toBe(first.componentInstance.detail);
    expect(first.componentInstance.byToken).toBe(first.componentInstance.detail);
    expect(second.componentInstance.detail).not.toBe(first.componentInstance.detail);
    expect(header.host.tagName).toBe('ET-SCENARIO-DETAIL-HEADER');

    first.componentInstance.detail.id.set('1');
    second.componentInstance.detail.id.set('2');
    s.run(() => injectSession()).login('ada');
    s.tick(3000);

    expect(header.detail.title()).toBe('Match 1 (ada)');
    expect(second.componentInstance.detail.title()).toBe('Match 2 (ada)');
    expect(header.detail.ticks()).toBe(3);
    expect(header.seconds()).toBe(3);

    first.destroy();

    expect(counters.detailDestroyed).toBe(1);

    second.destroy();

    expect(counters.detailDestroyed).toBe(2);
    expect(counters.sessionCreated).toBe(1);
  });

  it('merges a partial static override over the default and aliases it under the extra token', () => {
    scenario();
    const page = TestBed.createComponent(DetailPageComponent).componentInstance;
    const plain = TestBed.createComponent(UnprovidedComponent).componentInstance;

    expect(page.config).toEqual({ pageSize: 20, sort: 'asc', label: 'Match' });
    expect(page.legacyConfig).toBe(page.config);
    expect(page.flags).toEqual(['live']);
    expect(plain.config).toEqual({ pageSize: 20, sort: 'asc', label: 'Items' });
  });

  it('returns null for an optional inject nobody provided, and throws for a required one', () => {
    const s = scenario();
    const plain = TestBed.createComponent(UnprovidedComponent).componentInstance;

    expect(plain.detail).toBeNull();
    expect(plain.flags).toBeNull();
    expect(() => s.consumer().run(() => injectDetail())).toThrow(/No provider/);
  });

  it('lets a subtree override a root provider with an instance of its own', () => {
    const s = scenario();
    const root = s.run(() => injectSession());
    const own = TestBed.createComponent(OwnSessionComponent).componentInstance.session;

    own.login('grace');

    expect(own).not.toBe(root);
    expect(root.user()).toBeNull();
    expect(own.user()).toBe('grace');
    expect(counters.sessionCreated).toBe(2);
  });
});
