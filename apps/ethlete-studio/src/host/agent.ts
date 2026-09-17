import { Channel, invoke } from '@tauri-apps/api/core';
import { Observable } from 'rxjs';
import { HostShellMissingError, invokeHost$ } from './invoke';

/** One agent CLI that this machine has installed. */
export type AgentDescriptor = {
  id: string;
  label: string;
  binary: string;
  version: string;
  /** Model names to offer first. A run accepts any other name as well. */
  suggestedModels: string[];
};

/**
 * The call a run draws, so Studio can hand it a tool set that needs no argument. Studio knows all
 * four, so a tool call can never name the wrong call.
 */
export type AgentTools = {
  call: string;
  variant: string;
  port: number;
  callsRoot: string;
};

/** One prompt, sent to one CLI, in one checkout. */
export type AgentRequest = {
  cli: string;
  model: string | null;
  prompt: string;
  cwd: string;
  /** The session to continue. `null` starts a new conversation. */
  resume: string | null;
  /** The call the run works on. `null` leaves the run without Studio's tools. */
  tools: AgentTools | null;
};

/** What the agent did, in the order it did it. */
export type AgentEvent =
  | { kind: 'started'; cli: string; model: string | null }
  | { kind: 'session'; id: string }
  | { kind: 'context'; tokens: number }
  | { kind: 'message'; text: string }
  | { kind: 'action'; action: string; detail: string }
  | { kind: 'failed'; message: string }
  | { kind: 'finished'; ok: boolean; summary: string };

/** Every agent CLI installed on this machine. A CLI that is missing is simply not in the list. */
export const agentList$ = (): Observable<AgentDescriptor[]> => invokeHost$<AgentDescriptor[]>('agent_list');

/**
 * Runs one prompt through an agent CLI and emits each step until the run ends. The stream completes
 * on the `finished` event. Unsubscribing before that stops the run.
 */
export const agentRun$ = (request: AgentRequest): Observable<AgentEvent> =>
  new Observable<AgentEvent>((subscriber) => {
    if (!('__TAURI_INTERNALS__' in globalThis)) {
      subscriber.error(new HostShellMissingError());

      return;
    }

    const stream = new Channel<AgentEvent>();
    let runId: string | null = null;
    let finished = false;
    let cancelled = false;

    stream.onmessage = (event) => {
      subscriber.next(event);

      if (event.kind !== 'finished') return;

      finished = true;
      subscriber.complete();
    };

    invoke<string>('agent_run', { request, stream }).then(
      (id) => {
        runId = id;

        if (cancelled) void invoke('agent_cancel', { runId: id });
      },
      (error: unknown) => subscriber.error(error),
    );

    return () => {
      if (finished) return;

      cancelled = true;

      if (runId) void invoke('agent_cancel', { runId });
    };
  });
