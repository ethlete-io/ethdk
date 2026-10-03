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

const CLAUDE = { id: 'claude', label: 'Claude', binary: 'claude', version: '1', suggestedModels: [] };

const sent: { command: string; args: unknown }[] = [];

const stubHost = (overrides: Record<string, () => unknown> = {}) => {
  const answers: Record<string, () => unknown> = {
    design_roots: () => ({ search: '', roots: [CHECKOUT] }),
    design_project: () => PROJECT,
    design_server_state: () => ({ port: 4402, listening: true, managed: false, log: [] }),
    design_check: () => null,
    agent_list: () => [],
    ...overrides,
  };
  let next = 1;

  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value: {
      invoke: (command: string, args: unknown) => {
        sent.push({ command, args });

        return command in answers ? Promise.resolve(answers[command]?.()) : new Promise(() => undefined);
      },
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

const tile = (fixture: ComponentFixture<CallViewComponent>, name: string) =>
  [...element(fixture).querySelectorAll<HTMLButtonElement>('.studio__tile')].find(
    (button) => button.querySelector('.studio__tile-name')?.textContent?.trim() === name,
  );

const button = (fixture: ComponentFixture<CallViewComponent>, selector: string, text: string) =>
  [...element(fixture).querySelectorAll<HTMLButtonElement>(selector)].find(
    (found) => found.textContent?.trim() === text,
  );

const mount = async (slug: string) => {
  localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout: CHECKOUT, project: 'app', slug }));

  const fixture = TestBed.createComponent(CallViewComponent);

  fixture.autoDetectChanges();
  await settle(fixture);

  return fixture;
};

describe('CallViewComponent', () => {
  beforeEach(() => {
    sent.length = 0;
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

  it('runs a composed verb on the variant the card names, not the one on screen', async () => {
    stubHost({ agent_list: () => [CLAUDE] });

    const fixture = await mount(ASKING.slug);

    button(fixture, '.studio__verb', 'Accept')?.click();
    await settle(fixture);
    tile(fixture, 'C')?.click();
    await settle(fixture);
    element(fixture).querySelector<HTMLButtonElement>('.studio__compose .studio__send')?.click();
    await settle(fixture);

    const run = sent.find((entry) => entry.command === 'agent_run')?.args as {
      request: { tools: { variant: string } | null };
    };

    expect(run?.request.tools?.variant).toBe('b');
  });

  it('keeps a draft composed during a run once the run ends', async () => {
    let fail: (error: unknown) => void = () => undefined;

    stubHost({
      agent_list: () => [CLAUDE],
      agent_run: () => new Promise((_, reject) => (fail = reject)),
    });

    const fixture = await mount(ASKING.slug);
    const box = element(fixture).querySelector<HTMLTextAreaElement>('.studio__input textarea');

    if (box) box.value = 'Look at the spacing';
    box?.dispatchEvent(new Event('input'));
    await settle(fixture);
    element(fixture).querySelector<HTMLButtonElement>('.studio__input .studio__send')?.click();
    await settle(fixture);
    button(fixture, '.studio__verb', 'Iterate')?.click();
    await settle(fixture);
    expect(element(fixture).querySelector('.studio__compose')).not.toBeNull();
    fail('The run broke.');
    await settle(fixture);

    expect(element(fixture).querySelector('.studio__compose')).not.toBeNull();
  });

  it('drops the calls of the checkout before when the next one cannot be read', async () => {
    stubHost({
      design_roots: () => ({ search: '', roots: [CHECKOUT, '/broken'] }),
      design_project: () => PROJECT,
    });

    const fixture = await mount(ASKING.slug);
    const picker = element(fixture).querySelector<HTMLSelectElement>('.studio__checkout');

    stubHost({
      design_roots: () => ({ search: '', roots: [CHECKOUT, '/broken'] }),
      design_project: () => Promise.reject('No design config in /broken.'),
    });

    if (picker) picker.value = '/broken';
    picker?.dispatchEvent(new Event('change'));
    await settle(fixture);

    expect(row(fixture, ASKING.slug)).toBeUndefined();
    expect(drawings(fixture)).toEqual([]);
  });

  it('shows the top bar of a call opened after the one before was scrolled down', async () => {
    const fixture = await mount(ASKING.slug);

    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'design-explore:scroll', variant: 'b', y: 400 } }),
    );
    await settle(fixture);
    expect(element(fixture).querySelector('.studio__float--top.studio__float--hidden')).not.toBeNull();

    await openRow(fixture, RESOLVED.slug);
    [...element(fixture).querySelectorAll<HTMLButtonElement>('.studio__fold-line')]
      .find((line) => line.querySelector('.studio__round-key')?.textContent?.trim() === 'r1')
      ?.click();
    await settle(fixture);
    tile(fixture, 'B')?.click();
    await settle(fixture);
    expect(shown(fixture)).toEqual([`${RESOLVED.slug} b`]);

    expect(element(fixture).querySelector('.studio__float--top.studio__float--hidden')).toBeNull();
  }, 20_000);
});
