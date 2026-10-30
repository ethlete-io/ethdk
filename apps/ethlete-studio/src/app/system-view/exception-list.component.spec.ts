import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { ListedException, openExceptionsOf } from '../../host/design-exceptions';
import { THEMES } from '../../themes';
import { ExceptionListComponent } from './exception-list.component';

const LISTED: ListedException[] = [
  { key: 'components/button.submit.focus', state: 'pending', reason: 'never takes focus' },
  {
    key: 'components/button.icon.touch',
    state: 'reopened',
    reason: 'icon only',
    approval: { by: 'designer', at: '2026-10-30T10:00:00.000Z', hash: 'old' },
  },
  {
    key: 'components/button.label.hover',
    state: 'approved',
    reason: 'static',
    approval: { by: 'designer', at: '2026-10-30T10:00:00.000Z', hash: 'h1' },
  },
  { key: 'components/buttons.row.focus', state: 'pending', reason: 'another part' },
];

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

const settle = async (fixture: ComponentFixture<ExceptionListComponent>) => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
};

const render = async (approve?: (body: { key: string; by: string }) => Promise<Response>) => {
  const posts: unknown[] = [];

  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    if (url.includes('/__design/exception-approve')) {
      const body = JSON.parse(String(init?.body)) as { key: string; by: string };

      posts.push(body);

      return approve
        ? approve(body)
        : json({ reason: 'x', requested: 'y', approval: { by: body.by, at: 'now', hash: 'h2' } });
    }

    return json(LISTED);
  });

  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(ExceptionListComponent);

  fixture.componentRef.setInput('port', 4999);
  fixture.componentRef.setInput('product', 'studio');
  fixture.componentRef.setInput('part', 'components/button');
  await settle(fixture);

  const element = fixture.nativeElement as HTMLElement;

  element.querySelector<HTMLButtonElement>('[data-exceptions-toggle]')?.click();
  await settle(fixture);

  return { fixture, posts, element };
};

const keysOf = (element: HTMLElement) =>
  [...element.querySelectorAll('[data-exception]')].map((entry) => entry.getAttribute('data-exception'));

describe('openExceptionsOf', () => {
  it('keeps the pending and reopened exceptions of the part only', () => {
    expect(openExceptionsOf(LISTED, 'components/button').map(({ key }) => key)).toEqual([
      'components/button.submit.focus',
      'components/button.icon.touch',
    ]);
  });
});

describe('ExceptionListComponent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists the pending and reopened exceptions of the part with their reason and state', async () => {
    const { element } = await render();

    expect(element.querySelector('[data-exceptions-toggle]')?.textContent?.trim()).toBe('Exceptions 2');
    expect(keysOf(element)).toEqual(['components/button.submit.focus', 'components/button.icon.touch']);
    expect(element.textContent).toContain('never takes focus');
    expect([...element.querySelectorAll('[data-exception-state]')].map((state) => state.textContent?.trim())).toEqual([
      'pending',
      'reopened - the part changed',
    ]);
  });

  it('approves an exception as the designer and drops it from the list', async () => {
    const { element, fixture, posts } = await render();

    element.querySelector<HTMLButtonElement>('[data-exception-approve]')?.click();
    await settle(fixture);

    expect(posts).toEqual([{ key: 'components/button.submit.focus', by: 'designer' }]);
    expect(keysOf(element)).toEqual(['components/button.icon.touch']);
  });

  it('keeps the exception and shows the refusal when the server refuses', async () => {
    const { element, fixture } = await render(() => json({ error: 'no exception was requested' }, 404));

    element.querySelector<HTMLButtonElement>('[data-exception-approve]')?.click();
    await settle(fixture);

    expect(element.querySelector('[data-exceptions-error]')?.textContent?.trim()).toBe('no exception was requested');
    expect(keysOf(element)).toHaveLength(2);
  });

  it('draws nothing while the part has no open exception', async () => {
    vi.stubGlobal('fetch', () => json([LISTED[2]]));
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(ExceptionListComponent);

    fixture.componentRef.setInput('port', 4999);
    fixture.componentRef.setInput('product', 'studio');
    fixture.componentRef.setInput('part', 'components/button');
    await settle(fixture);

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-exceptions-toggle]')).toBeNull();
  });
});
