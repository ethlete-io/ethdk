import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { EMPTY, Subscription, catchError, finalize, of, tap } from 'rxjs';
import { AgentDescriptor, AgentEvent, agentList$, agentRun$ } from '../../host/agent';
import { workspaceRoot$ } from '../../host/workspace';
import { rememberView, rememberedView } from '../studio-view/remembered';

/** One line of the chat: a prompt the user sent, or an event of the agent run that answered it. */
export type ChatEntry = { kind: 'prompt'; text: string } | AgentEvent;

const CHAT_STORE_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const destroyRef = inject(DestroyRef);
  const clis = signal<AgentDescriptor[]>([]);
  const trouble = signal('');
  const cli = signal<AgentDescriptor | null>(null);
  const model = signal('');
  const root = signal('');
  const entries = signal<ChatEntry[]>([]);
  const running = signal(false);
  const session = signal<string | null>(null);
  const open = signal(rememberedView().chatOpen ?? false);
  let run: Subscription | null = null;

  const fail = (error: unknown) => {
    trouble.set(String(error));

    return EMPTY;
  };

  agentList$()
    .pipe(
      tap((found) => {
        clis.set(found);
        if (!cli()) cli.set(found[0] ?? null);
      }),
      catchError(fail),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  workspaceRoot$()
    .pipe(
      tap((found) => root.set(found)),
      catchError(fail),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  const record = (entry: ChatEntry) => {
    if (entry.kind === 'session') session.set(entry.id);
    entries.update((list) => [...list, entry]);
  };

  const stop = () => {
    run?.unsubscribe();
    run = null;
  };

  const send = (prompt: string) => {
    const picked = cli();
    const text = prompt.trim();

    if (!picked || !root() || !text || running()) return false;

    record({ kind: 'prompt', text });
    running.set(true);
    run = agentRun$({
      cli: picked.id,
      model: model() || null,
      prompt: text,
      cwd: root(),
      resume: session(),
      tools: null,
    })
      .pipe(
        tap(record),
        catchError((error: unknown) => {
          record({ kind: 'failed', message: String(error) });

          return of(null);
        }),
        finalize(() => running.set(false)),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();

    return true;
  };

  return {
    /** The agent CLIs this machine has installed. */
    clis: clis.asReadonly(),
    /** Why the CLI list or the checkout could not be read, or an empty string. */
    trouble: trouble.asReadonly(),
    cli: cli.asReadonly(),
    /** The model to run, or an empty string for the CLI default. */
    model: model.asReadonly(),
    /** The checkout the agent works in. */
    root: root.asReadonly(),
    entries: entries.asReadonly(),
    running: running.asReadonly(),
    /** The agent session a follow-up message resumes, or `null` before the first run reported one. */
    session: session.asReadonly(),
    open: open.asReadonly(),
    /** Picks the CLI for the next message. Another CLI cannot resume this session, so it starts a new one. */
    pick: (next: AgentDescriptor) => {
      if (next.id !== cli()?.id) session.set(null);
      cli.set(next);
      model.set('');
    },
    pickModel: (next: string) => model.set(next),
    /** Sends a prompt into the running chat. Returns whether it was sent. */
    send,
    stop,
    newChat: () => {
      stop();
      entries.set([]);
      session.set(null);
    },
    toggle: () => {
      open.update((shown) => !shown);
      rememberView({ chatOpen: open() });
    },
  };
});

/** The one global Studio chat, kept across navigation. */
export const injectChatStore = /* @__PURE__ */ toInjectFn(CHAT_STORE_DEF);
