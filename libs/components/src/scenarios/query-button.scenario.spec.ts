import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AnyV2Query,
  createPostQuery,
  createQueryClient,
  createQueryGroup,
  def,
  V2QueryClient,
  withArgs,
} from '@ethlete/query';
import { ButtonComponent, QueryButtonDirective, queryButtonSourceFromV2Query } from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

type SaveArgs = { response: { id: number }; body: { title: string } };
type PublishArgs = { response: { ok: boolean } };

const client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'query-button-scenario' });
const postSave = createPostQuery(client)<SaveArgs>('/drafts');
const postPublish = createPostQuery(client)<PublishArgs>('/drafts/publish');
const postArchive = createPostQuery(client)<PublishArgs>('/drafts/archive');

const legacyClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
const legacySave = legacyClient.post({
  route: '/legacy-drafts',
  types: { args: def<{ body: { title: string } }>(), response: def<{ id: number }>() },
});

@Component({
  selector: 'et-scenario-draft-actions',
  imports: [ButtonComponent, QueryButtonDirective],
  template: `
    <button [etQueryButton]="save" (click)="clicks.save = clicks.save + 1" class="save" et-button>Save</button>
    <button [etQueryButton]="actions" (click)="clicks.actions = clicks.actions + 1" class="actions" et-button>
      Publish
    </button>
    <button [etQueryButton]="legacySource" (click)="clicks.legacy = clicks.legacy + 1" class="legacy" et-button>
      Legacy save
    </button>
  `,
})
class DraftActionsComponent {
  clicks = { save: 0, actions: 0, legacy: 0 };
  save = postSave();
  actions = createQueryGroup({
    publish: postPublish(withArgs(() => ({}))),
    archive: postArchive(withArgs(() => ({}))),
  });
  legacyQuery = signal<AnyV2Query | null>(null);
  legacySource = queryButtonSourceFromV2Query(this.legacyQuery);
}

const buttonOf = (host: HTMLElement, name: string) => {
  const button = host.querySelector<HTMLButtonElement>(`button.${name}`);

  if (!button) throw new Error(`no ${name} button`);

  return button;
};

const expectBusy = (button: HTMLButtonElement, busy: boolean) => {
  expect(button.hasAttribute('data-loading')).toBe(busy);
  expect(button.getAttribute('aria-busy')).toBe(busy ? 'true' : null);
};

describe('query button scenarios', () => {
  const scenario = useScenario({ providers: [provideHttpClient(), provideHttpClientTesting()] });

  const setup = (s: Scenario) => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(DraftActionsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    return { http, fixture, host, app: fixture.componentInstance };
  };

  it('shows the busy state of a v3 query while it is pending and blocks a second click', () => {
    const s = scenario();
    const { http, fixture, host, app } = setup(s);
    const button = buttonOf(host, 'save');

    expectBusy(button, false);

    app.save.execute({ args: { body: { title: 'Draft' } } });
    s.tick();

    expectBusy(button, true);
    expect(button.getAttribute('aria-disabled')).toBe('true');

    button.click();
    s.tick();

    expect(app.clicks.save).toBe(0);
    http.expectOne('https://api.example.com/drafts').flush({ id: 1 });
    s.tick();

    expectBusy(button, false);

    button.click();

    expect(app.clicks.save).toBe(1);
    http.verify();
    fixture.destroy();
    s.tick(1000);
    s.frame(4);
  });

  it('follows whichever member of a query group ran last', () => {
    const s = scenario();
    const { http, fixture, host, app } = setup(s);
    const button = buttonOf(host, 'actions');

    app.actions.members.publish.execute();
    s.tick();

    expectBusy(button, true);

    button.click();

    expect(app.clicks.actions).toBe(0);
    http.expectOne('https://api.example.com/drafts/publish').flush({ ok: true });
    s.tick();

    expectBusy(button, false);

    app.actions.members.archive.execute();
    s.tick();

    expectBusy(button, true);
    http.expectOne('https://api.example.com/drafts/archive').flush({ ok: true });
    s.tick();

    expectBusy(button, false);
    http.verify();
    fixture.destroy();
    s.tick(1000);
    s.frame(4);
  });

  it('shows the busy state of a legacy v2 query through queryButtonSourceFromV2Query', () => {
    const s = scenario();
    const { fixture, host, app } = setup(s);
    const button = buttonOf(host, 'legacy');
    const prepared = legacySave.prepare({
      body: { title: 'Draft' },
      mock: { delay: 50, response: { id: 2 } },
    }) as unknown as AnyV2Query;

    app.legacyQuery.set(prepared);
    prepared.execute();
    s.tick();

    expectBusy(button, true);

    button.click();

    expect(app.clicks.legacy).toBe(0);

    s.tick(100);

    expectBusy(button, false);

    button.click();

    expect(app.clicks.legacy).toBe(1);
    fixture.destroy();
    s.tick(1000);
    s.frame(4);
  });
});
