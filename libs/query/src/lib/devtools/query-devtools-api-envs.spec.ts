import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  QueryDevtoolsApiEnvSwitch,
  queryDevtoolsApiEnvs,
  queryDevtoolsApiEnvValues,
  setQueryDevtoolsApiEnv,
  setQueryDevtoolsApiEnvs,
} from './query-devtools-api-envs';

const HUB: QueryDevtoolsApiEnvSwitch = {
  name: 'Hub API',
  storageKey: 'hubApiEnv',
  fallback: 'staging',
  envs: [
    { id: 'local', url: 'http://localhost:8040' },
    { id: 'staging', url: '/hub-api/staging' },
  ],
};

const HUB_WITH_PRODUCTION: QueryDevtoolsApiEnvSwitch = {
  name: 'Hub API',
  storageKey: 'hubApiEnv',
  fallback: 'staging',
  envs: [
    { id: 'staging', url: '/hub-api/staging' },
    { id: 'production', url: '/hub-api/production', production: true },
  ],
};

import { QueryDevtoolsAuthPillRow, setQueryDevtoolsAuthPill } from './query-devtools-pills';
import { provideQueryDevtools } from './query-devtools-registry';
import { setQueryDevtoolsUiMounted } from './query-devtools-ui';

const pill = () => document.getElementById('et-query-devtools-pill')?.shadowRoot;

const authRow = (): QueryDevtoolsAuthPillRow => ({
  name: 'Hub',
  current: 'admin',
  tabLocal: false,
  options: [{ value: 'session:1', label: 'admin', title: 'Switch to admin', selected: true, disabled: false }],
  pick: () => undefined,
  toggleTabLocal: () => undefined,
});

@Component({ template: '' })
class BlankComponent {}

describe('query devtools api envs', () => {
  beforeEach(() => {
    localStorage.clear();
    setQueryDevtoolsApiEnvs(undefined);
  });

  it('should declare nothing until an application does', () => {
    expect(queryDevtoolsApiEnvs()).toEqual([]);
    expect(queryDevtoolsApiEnvValues()).toEqual({});
  });

  it('should read what each declared key already holds', () => {
    localStorage.setItem('hubApiEnv', 'local');
    setQueryDevtoolsApiEnvs([HUB]);

    expect(queryDevtoolsApiEnvs()).toEqual([HUB]);
    expect(queryDevtoolsApiEnvValues()).toEqual({ hubApiEnv: 'local' });
  });

  it('should read an unwritten key as null', () => {
    setQueryDevtoolsApiEnvs([HUB]);

    expect(queryDevtoolsApiEnvValues()).toEqual({ hubApiEnv: null });
  });

  it('should write the plain string the application reads, not a JSON-encoded one', () => {
    setQueryDevtoolsApiEnvs([HUB]);
    setQueryDevtoolsApiEnv('hubApiEnv', 'local');

    expect(localStorage.getItem('hubApiEnv')).toBe('local');
    expect(queryDevtoolsApiEnvValues()).toEqual({ hubApiEnv: 'local' });
  });

  it('should write a typed URL as it is', () => {
    setQueryDevtoolsApiEnvs([HUB]);
    setQueryDevtoolsApiEnv('hubApiEnv', 'http://192.168.0.2:8040');

    expect(localStorage.getItem('hubApiEnv')).toBe('http://192.168.0.2:8040');
  });

  it('should remove the key on null, so the application falls back', () => {
    localStorage.setItem('hubApiEnv', 'local');
    setQueryDevtoolsApiEnvs([HUB]);
    setQueryDevtoolsApiEnv('hubApiEnv', null);

    expect(localStorage.getItem('hubApiEnv')).toBeNull();
    expect(queryDevtoolsApiEnvValues()).toEqual({ hubApiEnv: null });
  });

  it('should paint the pill onto the body, outside any component tree', () => {
    setQueryDevtoolsApiEnvs([HUB]);

    const shadow = document.getElementById('et-query-devtools-pill')?.shadowRoot;
    const options = [...(shadow?.querySelectorAll('option') ?? [])].map((option) => option.value);

    expect(shadow?.querySelectorAll('select').length).toBe(1);
    expect(options).toEqual(['', 'local', 'staging']);
  });

  it('should paint one pill only, however often the switches are declared', () => {
    setQueryDevtoolsApiEnvs([HUB]);
    setQueryDevtoolsApiEnvs([HUB]);

    expect(document.querySelectorAll('#et-query-devtools-pill').length).toBe(1);
  });

  it('should paint no pill until an application declares a switch', () => {
    setQueryDevtoolsApiEnvs([HUB]);
    setQueryDevtoolsApiEnvs(undefined);

    expect(document.getElementById('et-query-devtools-pill')).toBeNull();
  });

  it('should show a typed URL the pill has no env for', () => {
    localStorage.setItem('hubApiEnv', 'http://192.168.0.2:8040');
    setQueryDevtoolsApiEnvs([HUB]);

    const shadow = document.getElementById('et-query-devtools-pill')?.shadowRoot;
    const selected = [...(shadow?.querySelectorAll('option') ?? [])].filter((option) => option.selected);

    expect(selected.map((option) => option.value)).toEqual(['http://192.168.0.2:8040']);
  });

  it('should warn on the pill while a production env is the pick', () => {
    localStorage.setItem('hubApiEnv', 'production');
    setQueryDevtoolsApiEnvs([HUB_WITH_PRODUCTION]);

    expect(pill()?.querySelector('.pill[data-production]')).not.toBeNull();
    expect(pill()?.querySelector('.frame')).not.toBeNull();
  });

  it('should leave the pill alone while a production env is only on offer', () => {
    setQueryDevtoolsApiEnvs([HUB_WITH_PRODUCTION]);

    expect(pill()?.querySelector('.pill[data-production]')).toBeNull();
    expect(pill()?.querySelector('.frame')).toBeNull();
  });

  it('should warn on the pill while the fallback behind an unwritten key is production', () => {
    setQueryDevtoolsApiEnvs([{ ...HUB_WITH_PRODUCTION, fallback: 'production' }]);

    expect(pill()?.querySelector('.pill[data-production]')).not.toBeNull();
    expect(pill()?.querySelector('.frame')).not.toBeNull();
  });

  it('should leave the pill alone for a typed URL, which names no env', () => {
    localStorage.setItem('hubApiEnv', 'http://192.168.0.2:8040');
    setQueryDevtoolsApiEnvs([HUB_WITH_PRODUCTION]);

    expect(pill()?.querySelector('.pill[data-production]')).toBeNull();
  });

  it('should mark a production env in the dropdown as well as the pick', () => {
    setQueryDevtoolsApiEnvs([HUB_WITH_PRODUCTION]);

    const labels = [...(pill()?.querySelectorAll('option') ?? [])].map((option) => option.textContent);

    expect(labels).toEqual(['default (staging)', 'staging', '⚠ production']);
  });

  it('should fold the pill into a summary chip until somebody unfolds it', () => {
    localStorage.setItem('hubApiEnv', 'local');
    setQueryDevtoolsApiEnvs([HUB]);

    expect(document.getElementById('et-query-devtools-pill')?.hasAttribute('data-collapsed')).toBe(true);
    expect(pill()?.querySelector('.chip .values')?.textContent).toBe('local');
  });

  it('should unfold the pill on a click on the chip, and remember it', () => {
    setQueryDevtoolsApiEnvs([HUB]);
    pill()?.querySelector<HTMLButtonElement>('.chip')?.click();

    expect(document.getElementById('et-query-devtools-pill')?.hasAttribute('data-collapsed')).toBe(false);

    setQueryDevtoolsApiEnvs([HUB]);

    expect(document.getElementById('et-query-devtools-pill')?.hasAttribute('data-collapsed')).toBe(false);
  });

  it('should unfold the pill and drop the chip while a production env is the pick', () => {
    localStorage.setItem('hubApiEnv', 'production');
    setQueryDevtoolsApiEnvs([HUB_WITH_PRODUCTION]);

    expect(document.getElementById('et-query-devtools-pill')?.hasAttribute('data-collapsed')).toBe(false);
    expect(pill()?.querySelector('.chip')).toBeNull();
  });

  it('should leave the other switches alone', () => {
    const items: QueryDevtoolsApiEnvSwitch = { name: 'Items API', storageKey: 'itemsApiEnv', envs: [{ id: 'local' }] };

    setQueryDevtoolsApiEnvs([HUB, items]);
    setQueryDevtoolsApiEnv('hubApiEnv', 'local');

    expect(queryDevtoolsApiEnvValues()).toEqual({ hubApiEnv: 'local', itemsApiEnv: null });
  });

  it('should not rebuild the pill when a rotation changes nothing it renders', () => {
    setQueryDevtoolsApiEnvs([HUB]);
    setQueryDevtoolsAuthPill({ rows: [authRow()] });

    const host = document.getElementById('et-query-devtools-pill');
    const select = pill()?.querySelector('select[aria-label="Hub session"]');

    setQueryDevtoolsAuthPill({ rows: [authRow()] });

    expect(document.getElementById('et-query-devtools-pill')).toBe(host);
    expect(pill()?.querySelector('select[aria-label="Hub session"]')).toBe(select);

    setQueryDevtoolsAuthPill({ rows: [{ ...authRow(), tabLocal: true }] });

    expect(document.getElementById('et-query-devtools-pill')).not.toBe(host);

    setQueryDevtoolsAuthPill({ rows: [] });
  });

  // Keep last: a rendered application is module state nothing here can take back, so every test after
  // this one would find no pills at all.
  it('should stop painting the pills once the app has rendered without a devtools UI', async () => {
    // An application that polls or holds a session keeps a repeating timer, so under zone.js it never
    // becomes stable. The pills must not wait for that.
    vi.spyOn(ApplicationRef.prototype, 'whenStable').mockReturnValue(new Promise<void>(() => undefined));

    TestBed.configureTestingModule({ providers: [provideQueryDevtools({ apiEnvs: [HUB] })] });

    expect(document.getElementById('et-query-devtools-pill')).not.toBeNull();

    TestBed.createComponent(BlankComponent);
    TestBed.tick();

    await vi.waitFor(() => expect(document.getElementById('et-query-devtools-pill')).toBeNull());

    setQueryDevtoolsUiMounted(true);

    expect(document.getElementById('et-query-devtools-pill')).not.toBeNull();
  });
});
