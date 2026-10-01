import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, InjectionToken, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { createQueryGroup, QueryCreator, queryErrorMessage, withArgs } from '../index';
import { Scenario, useScenario } from './harness';

type AcceptArgs = { response: { status: 'accepted' }; pathParams: { invitationId: string } };
type DeclineArgs = { response: { status: 'declined' }; pathParams: { invitationId: string } };
type CommentArgs = { response: { id: number }; body: { text: string } };

const serveInvitations = (s: Scenario, { delay = 0 } = {}) => {
  s.api.on('POST', '/invitations/:id/accept', () => ({ body: { status: 'accepted' }, delay }));
  s.api.on('POST', '/invitations/:id/decline', () => ({ status: 503, body: { message: 'Try again later' }, delay }));
};

const expectHttpError = (s: Scenario, status: number) =>
  s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === status);

describe('query groups', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const buildGroup = (s: Scenario) => {
    const postAccept = s.post<AcceptArgs>((p) => `/invitations/${p.invitationId}/accept`);
    const postDecline = s.post<DeclineArgs>((p) => `/invitations/${p.invitationId}/decline`);
    const postComment = s.post<CommentArgs>('/comments');
    const c = s.consumer();
    const group = c.run(() =>
      createQueryGroup({
        accept: postAccept(withArgs(() => ({ pathParams: { invitationId: '1' } }))),
        decline: postDecline(withArgs(() => ({ pathParams: { invitationId: '1' } }))),
        comment: postComment(),
      }),
    );
    s.tick();

    return { c, group };
  };

  it('B fails, then A succeeds: error() is null', () => {
    const s = scenario();
    serveInvitations(s);
    const { group } = buildGroup(s);

    group.members.decline.execute();
    s.tick();

    expect(group.error()?.code).toBe(503);
    expectHttpError(s, 503);

    group.members.accept.execute();
    s.tick();

    expect(group.error()).toBeNull();
    expect(group.latest()).toEqual({ key: 'accept', response: { status: 'accepted' } });
  });

  it('switches latest to whichever member ran last', () => {
    const s = scenario();
    serveInvitations(s);
    s.api.on('POST', '/comments', () => ({ body: { id: 1 } }));
    const { group } = buildGroup(s);

    expect(group.latest()).toBeNull();

    group.members.accept.execute();
    expect(group.latest()?.key).toBe('accept');

    group.members.comment.execute({ args: { body: { text: 'hi' } } });
    expect(group.latest()?.key).toBe('comment');

    group.members.decline.execute();
    expect(group.latest()?.key).toBe('decline');

    s.tick();
    expectHttpError(s, 503);
  });

  it('retries the latest member with the args it last ran with', () => {
    const s = scenario();
    let fail = true;
    s.api.on('POST', '/comments', ({ body }) =>
      fail ? { status: 503, body: { message: 'down' } } : { body: { id: (body as { text: string }).text.length } },
    );
    serveInvitations(s);
    const { group } = buildGroup(s);

    group.members.accept.execute();
    s.tick();
    group.members.comment.execute({ args: { body: { text: 'hello' } } });
    s.tick();
    expectHttpError(s, 503);

    fail = false;
    group.execute({ options: { allowCache: false } });
    s.tick();

    expect(s.api.requestCount('POST', '/comments')).toBe(2);
    expect(s.api.requestCount('POST', '/invitations/1/accept')).toBe(1);
    expect(s.api.requests.filter((r) => r.method === 'POST' && r.path === '/comments').map((r) => r.body)).toEqual([
      { text: 'hello' },
      { text: 'hello' },
    ]);
    expect(group.error()).toBeNull();
    expect(group.latest()).toEqual({ key: 'comment', response: { id: 5 } });
  });

  it('does nothing on execute() before any member ran', () => {
    const s = scenario();
    serveInvitations(s);
    const { group } = buildGroup(s);

    group.execute();
    s.tick();

    expect(s.api.requests).toEqual([]);
  });

  it('emits succeeded$ once per successful member execution, with its key and response', () => {
    const s = scenario();
    serveInvitations(s);
    s.api.on('POST', '/comments', () => ({ body: { id: 9 } }));
    const { group } = buildGroup(s);
    const seen: unknown[] = [];
    const subscription = group.succeeded$.pipe(tap((success) => seen.push(success))).subscribe();

    group.members.accept.execute();
    s.tick();
    group.members.decline.execute();
    s.tick();
    expectHttpError(s, 503);
    group.members.comment.execute({ args: { body: { text: 'a' } } });
    s.tick();
    group.members.accept.execute();
    s.tick();

    expect(seen).toEqual([
      { key: 'accept', response: { status: 'accepted' } },
      { key: 'comment', response: { id: 9 } },
      { key: 'accept', response: { status: 'accepted' } },
    ]);
    subscription.unsubscribe();
  });

  it('reports loading while any member loads, the latest one first', () => {
    const s = scenario();
    serveInvitations(s, { delay: 100 });
    s.api.on('POST', '/comments', () => ({ body: { id: 1 }, delay: 300 }));
    const { group } = buildGroup(s);

    expect(group.loading()).toBeNull();

    group.members.comment.execute({ args: { body: { text: 'a' } } });
    s.tick(10);
    const commentLoading = group.loading();
    group.members.accept.execute();
    s.tick(10);

    expect(group.loading()).not.toBeNull();
    expect(group.loading()).not.toBe(commentLoading);

    s.tick(100);

    expect(group.latest()?.key).toBe('accept');
    expect(group.loading()).toBe(commentLoading);

    s.tick(300);

    expect(group.loading()).toBeNull();
  });

  it('leaks nothing when its injection context is destroyed with a member in flight', () => {
    const s = scenario();
    serveInvitations(s, { delay: 500 });
    const { c, group } = buildGroup(s);
    let completed = false;
    group.succeeded$.subscribe({ complete: () => (completed = true) });

    group.members.accept.execute();
    s.tick(10);
    c.destroy();
    s.tick(1000);

    expect(completed).toBe(true);
    expect(s.liveQueries()).toEqual([]);
  });
});

type InvitationCreators = { accept: QueryCreator<AcceptArgs>; decline: QueryCreator<DeclineArgs> };

const INVITATION_CREATORS = new InjectionToken<InvitationCreators>('INVITATION_CREATORS');
const INVITATION_ID = new InjectionToken<string>('INVITATION_ID');

@Component({
  template: `
    <p class="status">{{ actions.latest()?.response?.status ?? 'pending' }}</p>
    @if (actions.error(); as error) {
      <p class="error">{{ queryErrorMessage(error) }}</p>
      <button (click)="actions.execute({ options: { allowCache: false } })" class="retry">Retry</button>
    }
    <button [disabled]="actions.loading() !== null" (click)="actions.members.accept.execute()" class="accept">
      Accept
    </button>
    <button [disabled]="actions.loading() !== null" (click)="actions.members.decline.execute()" class="decline">
      Decline
    </button>
  `,
})
class InvitationOverlay {
  private creators = inject(INVITATION_CREATORS);
  private invitationId = inject(INVITATION_ID);

  protected queryErrorMessage = queryErrorMessage;

  readonly closedWith = signal<'accept' | 'decline' | null>(null);

  readonly actions = createQueryGroup({
    accept: this.creators.accept(withArgs(() => ({ pathParams: { invitationId: this.invitationId } }))),
    decline: this.creators.decline(withArgs(() => ({ pathParams: { invitationId: this.invitationId } }))),
  });

  constructor() {
    this.actions.succeeded$
      .pipe(
        tap(({ key }) => this.closedWith.set(key)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}

describe('a consumer: an accept/decline overlay', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('shows the failed decline, retries it, then closes after accept succeeds', () => {
    const s = scenario();
    let declineFails = true;
    s.api.on('POST', '/invitations/:id/accept', () => ({ body: { status: 'accepted' }, delay: 50 }));
    s.api.on('POST', '/invitations/:id/decline', () =>
      declineFails ? { status: 503, body: { message: 'Try again later' } } : { status: 409, body: { message: 'Gone' } },
    );
    const c = s.consumer([
      {
        provide: INVITATION_CREATORS,
        useValue: {
          accept: s.post<AcceptArgs>((p) => `/invitations/${p.invitationId}/accept`),
          decline: s.post<DeclineArgs>((p) => `/invitations/${p.invitationId}/decline`),
        },
      },
      { provide: INVITATION_ID, useValue: '42' },
    ]);
    const ref = s.mount(InvitationOverlay, c.injector);
    const element: HTMLElement = ref.location.nativeElement;
    const button = (name: string) => element.querySelector<HTMLButtonElement>(`button.${name}`);
    s.tick();

    button('decline')?.click();
    s.tick();
    expectHttpError(s, 503);

    expect(element.querySelector('.error')?.textContent).toBe('Try again later');

    declineFails = false;
    button('retry')?.click();
    s.tick();
    expectHttpError(s, 409);

    expect(s.api.requestCount('POST', '/invitations/42/decline')).toBe(2);
    expect(element.querySelector('.error')?.textContent).toBe('Gone');

    button('accept')?.click();
    s.tick(10);

    expect(button('accept')?.disabled).toBe(true);
    expect(element.querySelector('.error')).toBeNull();

    s.tick(50);

    expect(element.querySelector('.status')?.textContent).toBe('accepted');
    expect(button('accept')?.disabled).toBe(false);
    expect(ref.instance.closedWith()).toBe('accept');
  });
});
