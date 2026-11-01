import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { PartApproval } from '../../host/design-part-approval';
import { STUDIO_LABELS } from '../i18n/studio-labels';
import { THEMES } from '../../themes';
import { PartApprovalComponent } from './part-approval.component';

const LABELS = STUDIO_LABELS.approval;

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

const settle = async (fixture: ComponentFixture<PartApprovalComponent>) => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
};

type Server = { approval: PartApproval; answer?: (path: string) => Promise<Response> };

const render = async (server: Server) => {
  const posts: { path: string; body: unknown }[] = [];

  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;

    if (path === '/__design/open-points') return json(server.approval);

    posts.push({ path, body: JSON.parse(String(init?.body)) });

    return server.answer ? server.answer(path) : json({});
  });

  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(PartApprovalComponent);
  const approved = vi.fn();

  fixture.componentRef.setInput('port', 4999);
  fixture.componentRef.setInput('product', 'studio');
  fixture.componentRef.setInput('part', 'components/button');
  fixture.componentInstance.approve.subscribe(approved);
  await settle(fixture);

  const element = fixture.nativeElement as HTMLElement;
  const click = async (selector: string) => {
    element.querySelector<HTMLButtonElement>(selector)?.click();
    await settle(fixture);
  };

  return { fixture, posts, element, approved, click };
};

const GO = { hash: 'h1', by: 'user', at: 'now' };

describe('PartApprovalComponent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('gives a go at the hash it showed, then shows the go as given', async () => {
    const server: Server = { approval: { hash: 'h1', go: null, directEdit: false } };
    const { element, posts, approved, click } = await render(server);

    expect(element.querySelector('[data-part-give-go]')?.textContent?.trim()).toBe(LABELS.giveGo);
    expect(element.querySelector('[data-part-accept]')).toBeNull();

    server.approval = { ...server.approval, go: GO };
    await click('[data-part-give-go]');

    expect(posts).toEqual([{ path: '/__design/part-go', body: { part: 'components/button', hash: 'h1' } }]);
    expect(approved).toHaveBeenCalledTimes(1);
    expect(element.querySelector('[data-part-give-go]')).toBeNull();
    expect(element.querySelector('[data-part-go-given]')?.textContent?.trim()).toBe(LABELS.goGiven);
  });

  it('accepts a direct edit and shows it as accepted', async () => {
    const server: Server = { approval: { hash: 'h1', go: GO, directEdit: true } };
    const { element, posts, click } = await render(server);

    server.approval = { ...server.approval, directEdit: false };
    await click('[data-part-accept]');

    expect(posts).toEqual([{ path: '/__design/part-accept', body: { part: 'components/button', hash: 'h1' } }]);
    expect(element.querySelector('[data-part-accept]')).toBeNull();
    expect(element.querySelector('[data-part-accepted]')?.textContent?.trim()).toBe(LABELS.accepted);
  });

  it('shows a refusal in German in place, with the findings, and keeps the button', async () => {
    const { element, approved, click } = await render({
      approval: { hash: 'h1', go: GO, directEdit: true },
      answer: () =>
        json({ error: 'x has problems', reason: 'findings', findings: ['CLASS-UNDEFINED hero.ts: bg-x'] }, 422),
    });

    await click('[data-part-accept]');

    const refusal = element.querySelector('[data-part-approval-refusal]');

    expect(refusal?.querySelector('p')?.textContent?.trim()).toBe(LABELS.refused['findings']);
    expect(refusal?.querySelector('li')?.textContent).toBe('CLASS-UNDEFINED hero.ts: bg-x');
    expect(approved).not.toHaveBeenCalled();
    expect(element.querySelector('[data-part-accept]')).not.toBeNull();
  });

  it('names a changed part, and falls back to the server text for an unknown refusal', async () => {
    const server: Server = {
      approval: { hash: 'h1', go: null, directEdit: false },
      answer: () => json({ error: 'changed', reason: 'changed' }, 409),
    };
    const { element, click } = await render(server);

    await click('[data-part-give-go]');

    expect(element.querySelector('[data-part-approval-refusal] p')?.textContent?.trim()).toBe(
      LABELS.refused['changed'],
    );

    server.answer = () => json({ error: 'disk full' }, 500);
    await click('[data-part-give-go]');

    expect(element.querySelector('[data-part-approval-refusal] p')?.textContent?.trim()).toBe(
      LABELS.failed('disk full'),
    );
  });
});
