import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, finalize, of } from 'rxjs';
import type { AgentEvent, AgentRequest } from '../../host/agent';
import { injectChatStore } from './chat-store';

const host = vi.hoisted(() => ({
  run: vi.fn<(request: AgentRequest) => void>(),
  runs: [] as { events: Subject<AgentEvent>; closed: boolean }[],
}));

vi.mock('../../host/agent', () => ({
  agentList$: () =>
    of([
      { id: 'claude', label: 'Claude Code', binary: 'claude', version: '1', suggestedModels: ['opus'] },
      { id: 'codex', label: 'Codex', binary: 'codex', version: '2', suggestedModels: [] },
    ]),
  agentRun$: (request: AgentRequest): Observable<AgentEvent> => {
    const run = { events: new Subject<AgentEvent>(), closed: false };

    host.run(request);
    host.runs.push(run);

    return run.events.pipe(finalize(() => (run.closed = true)));
  },
}));

vi.mock('../../host/workspace', () => ({ workspaceRoot$: () => of('/repo') }));

const setup = () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  return TestBed.runInInjectionContext(() => injectChatStore());
};

const finish = (session: string) => {
  const run = host.runs.at(-1);

  run?.events.next({ kind: 'session', id: session });
  run?.events.next({ kind: 'message', text: 'Done.' });
  run?.events.next({ kind: 'finished', ok: true, summary: '' });
  run?.events.complete();
};

describe('injectChatStore', () => {
  beforeEach(() => {
    host.run.mockReset();
    host.runs.length = 0;
  });

  afterEach(() => localStorage.clear());

  it('sends a new conversation in the checkout with the first CLI and no tools', () => {
    const store = setup();

    expect(store.send('  Make the header calmer. ')).toBe(true);

    expect(host.run).toHaveBeenCalledWith({
      cli: 'claude',
      model: null,
      prompt: 'Make the header calmer.',
      cwd: '/repo',
      resume: null,
      tools: null,
    });
    expect(store.running()).toBe(true);
    expect(store.entries()).toEqual([{ kind: 'prompt', text: 'Make the header calmer.' }]);
  });

  it('resumes the session of the first run with a follow-up message', () => {
    const store = setup();

    store.send('First.');
    finish('session-1');
    store.send('Second.');

    expect(host.run.mock.calls.at(-1)?.[0].resume).toBe('session-1');
    expect(store.entries().map((entry) => entry.kind)).toEqual(['prompt', 'session', 'message', 'finished', 'prompt']);
  });

  it('refuses a message while a run is going', () => {
    const store = setup();

    store.send('First.');

    expect(store.send('Second.')).toBe(false);
    expect(host.run).toHaveBeenCalledTimes(1);
  });

  it('cancels the run on stop', () => {
    const store = setup();

    store.send('First.');
    store.stop();

    expect(host.runs[0]?.closed).toBe(true);
    expect(store.running()).toBe(false);
  });

  it('starts over on a new chat', () => {
    const store = setup();

    store.send('First.');
    finish('session-1');
    store.newChat();
    store.send('Again.');

    expect(host.run.mock.calls.at(-1)?.[0].resume).toBeNull();
    expect(store.entries()).toEqual([{ kind: 'prompt', text: 'Again.' }]);
  });

  it('starts a new session on another CLI and passes the picked model', () => {
    const store = setup();

    store.send('First.');
    finish('session-1');
    store.pick(store.clis()[1]!);
    store.pickModel('gpt');
    store.send('Second.');

    expect(host.run.mock.calls.at(-1)?.[0]).toMatchObject({ cli: 'codex', model: 'gpt', resume: null });
  });

  it('remembers whether the panel is open', () => {
    const store = setup();

    expect(store.open()).toBe(false);
    store.toggle();

    expect(store.open()).toBe(true);
    expect(JSON.parse(localStorage.getItem('ethlete-studio.call-view') ?? '{}').chatOpen).toBe(true);
  });
});
