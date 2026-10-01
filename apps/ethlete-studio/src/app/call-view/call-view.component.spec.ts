import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Call, CallVariant, Project, Verdict } from '../../host/design';
import { CallViewComponent } from './call-view.component';

const CHECKOUT = '/checkout';

const variant = (key: string, round: string, verdict: Verdict | null): CallVariant => ({
  key,
  name: key.toUpperCase(),
  round,
  verdict,
  claim: '',
  cost: '',
});

const call = (slug: string, variants: CallVariant[]): Call => ({
  slug,
  feature: 'The picker',
  eyebrow: slug,
  headline: slug,
  intro: '',
  frameWidth: 360,
  mode: 'design',
  handoff: false,
  touched: 1,
  rounds: [...new Set(variants.map((entry) => entry.round ?? ''))].map((key) => ({ key, title: key })),
  variants,
});

const RESOLVED = call('app/00-resolved', [
  variant('a', 'r1', 'rejected'),
  variant('b', 'r1', 'chosen'),
  variant('c', 'r1', 'rejected'),
  variant('d', 'r2', 'rejected'),
  variant('e', 'r2', 'chosen'),
]);

const ASKING = call('app/01-asking', [
  variant('a', 'r1', 'rejected'),
  variant('b', 'r1', null),
  variant('c', 'r1', null),
]);

const PROJECT: Project = { callsRoot: `${CHECKOUT}/calls`, port: 4402, defaultCall: null, calls: [RESOLVED, ASKING] };

const stubHost = () => {
  const answers: Record<string, () => unknown> = {
    design_roots: () => ({ search: '', roots: [CHECKOUT] }),
    design_project: () => PROJECT,
    design_server_state: () => ({ port: 4402, listening: true, managed: false, log: [] }),
    design_check: () => null,
    agent_list: () => [],
  };
  let next = 1;

  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value: {
      invoke: (command: string) =>
        command in answers ? Promise.resolve(answers[command]?.()) : new Promise(() => undefined),
      transformCallback: () => next++,
      unregisterCallback: () => undefined,
    },
  });
};

const settle = async (fixture: ComponentFixture<CallViewComponent>) => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
};

const element = (fixture: ComponentFixture<CallViewComponent>) => fixture.nativeElement as HTMLElement;

const drawings = (fixture: ComponentFixture<CallViewComponent>) => [
  ...element(fixture).querySelectorAll<HTMLIFrameElement>('.studio__drawing'),
];

const shown = (fixture: ComponentFixture<CallViewComponent>) => {
  const on = drawings(fixture).filter((frame) => !frame.classList.contains('studio__drawing--off'));

  return on
    .map((frame) => new URL(frame.src))
    .map((url) => `${url.searchParams.get('call')} ${url.searchParams.get('variant')}`);
};

const row = (fixture: ComponentFixture<CallViewComponent>, slug: string) =>
  [...element(fixture).querySelectorAll<HTMLButtonElement>('.studio__row')].find((button) =>
    button.textContent?.includes(slug),
  );

const openRow = async (fixture: ComponentFixture<CallViewComponent>, slug: string) => {
  if (!row(fixture, slug)) {
    element(fixture).querySelector<HTMLButtonElement>('.studio__group-head')?.click();
    await settle(fixture);
  }

  row(fixture, slug)?.click();
  await settle(fixture);
};

const mount = async (slug: string) => {
  localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout: CHECKOUT, project: 'app', slug }));

  const fixture = TestBed.createComponent(CallViewComponent);

  fixture.autoDetectChanges();
  await settle(fixture);

  return fixture;
};

describe('CallViewComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    stubHost();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('opens a resolved call on its result, not on its first variant', async () => {
    const fixture = await mount(RESOLVED.slug);

    expect(shown(fixture)).toEqual([`${RESOLVED.slug} e`]);
  });

  it('opens a call that still asks on its first open variant', async () => {
    const fixture = await mount(RESOLVED.slug);

    await openRow(fixture, ASKING.slug);

    expect(shown(fixture)).toEqual([`${ASKING.slug} b`]);
  });

  it('draws a switched-to call in new frames, never in the frames of the call before', async () => {
    const fixture = await mount(RESOLVED.slug);
    const before = drawings(fixture);

    await openRow(fixture, ASKING.slug);

    expect(drawings(fixture).length).toBe(ASKING.variants.length);
    expect(drawings(fixture).some((frame) => before.includes(frame))).toBe(false);
  });

  it('comes back to the variant the reader picked in a call', async () => {
    const fixture = await mount(RESOLVED.slug);
    const tile = [...element(fixture).querySelectorAll<HTMLButtonElement>('.studio__tile')].find(
      (button) => button.querySelector('.studio__tile-name')?.textContent?.trim() === 'D',
    );

    tile?.click();
    await settle(fixture);
    await openRow(fixture, ASKING.slug);
    await openRow(fixture, RESOLVED.slug);

    expect(shown(fixture)).toEqual([`${RESOLVED.slug} d`]);
  });

  it('says what the count of a call row counts', async () => {
    const fixture = await mount(RESOLVED.slug);

    expect(row(fixture, ASKING.slug)?.querySelector('.studio__count')?.textContent?.trim()).toBe('1 of 3 ruled');
  });
});
