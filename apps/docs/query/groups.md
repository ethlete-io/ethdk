# Query groups

An overlay with an accept and a decline button runs one of two mutations, and the page shows the outcome of the one the reader pressed last. `createQueryGroup` holds that set of queries and records which member ran last, so the loading state, the error and the retry target always describe it.

```ts
import { createQueryGroup, withArgs } from '@ethlete/query';

@Component({
  template: `
    @if (actions.error(); as error) {
      <et-query-error [error]="error" [query]="actions" />
    }
    <button [etQueryButton]="actions" (click)="actions.members.accept.execute()" et-button>Accept</button>
    <button [etQueryButton]="actions" (click)="actions.members.decline.execute()" et-button>Decline</button>
  `,
})
export class InvitationOverlayComponent {
  private overlayRef = inject(OVERLAY_REF);

  invitationId = input.required<string>();

  actions = createQueryGroup({
    accept: postAcceptInvitation(withArgs(() => ({ pathParams: { id: this.invitationId() } }))),
    decline: postDeclineInvitation(withArgs(() => ({ pathParams: { id: this.invitationId() } }))),
  });

  constructor() {
    this.actions.succeeded$
      .pipe(
        tap(() => this.overlayRef.close()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
```

Call `createQueryGroup` in an injection context, usually a component field. The members are fixed: a group has no `set()`, and it does not swap one query for another.

## Executing a member

Execute a member through `group.members.<key>.execute(...)`. That call runs the query and records the key as the latest. It takes the same arguments as the query's own `execute`. The query object you passed in does not record anything, so keep calling it through `members`.

Declare the args with [`withArgs`](/query/features#withargs) and call `execute()` without arguments, as above. A member whose route takes no `pathParams` can take its args at call time instead: `members.comment.execute({ args: { body } })`.

## What the group reports

| Member       | Type                                   | Description                                                                                                           |
| ------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `members`    | the object you passed in               | The members. Executing one records it as the latest.                                                                  |
| `loading()`  | `HttpRequestLoadingState \| null`      | The loading state of a member that is loading, the latest one first. `null` when none is.                             |
| `error()`    | `QueryErrorResponse \| null`           | The error of the latest member only. When decline fails and accept then succeeds, `error()` is `null`.                |
| `latest()`   | `{ key, response } \| null`            | The member executed last and its current response, typed per key. `null` before the first execution.                  |
| `execute()`  | `(executeArgs?: { options? }) => void` | Re-runs the latest member with the args it last ran with. Does nothing before the first execution.                    |
| `succeeded$` | `Observable<{ key, response }>`        | Emits once for every member execution through the group that succeeds. Completes when the group's scope is destroyed. |

`loading()` covers every member, so a button bound to the group stays busy while an older member is still in flight. `error()` and `latest()` follow the latest member only.

## Binding it to the UI

The group fits [`etQueryButton`](/components/button#query-button) and the `[query]` input of [`<et-query-error>`](/components/query-error) without a wrapper. The error component's retry calls `group.execute()`, so it re-runs the member that failed, with its args.

## When not to use a group

- **One endpoint chosen by context** (invite a player or a team, depending on a signal): select the query in a `computed`. Nothing has to be tracked, because the context already says which query applies.

  ```ts
  inviteQuery = computed(() => (this.isTeam() ? this.inviteTeam : this.inviteOrganisation));
  ```

- **Login, refresh and two-factor steps**: the [bearer auth provider](/query/auth#execution-state) already reports `executionState()` for them.
- **Steps that feed each other**: use a [query sequence](/query/dependent-queries#imperative-waterfalls-dependent-mutations).
- **One mutation over many items**: use a [query batch](/query/batching).
