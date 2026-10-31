import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, finalize, of } from 'rxjs';
import type { AgentEvent, AgentRequest } from '../../host/agent';
import { injectChatStore } from './chat-store';
import { injectViewContext } from './view-context';

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

const viewContext = () => TestBed.runInInjectionContext(() => injectViewContext());

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

  it('puts the view in front of the prompt and shows it on the prompt entry', () => {
    const store = setup();

    viewContext().put('system', {
      product: 'Kit',
      part: 'components/button',
      partFile: '.ethlete/design/kit/components/button/button.ts',
      sketch: 'components/button',
      sketchDir: '.ethlete/design/kit/sketches/components-button',
    });
    viewContext().put('sketch', { variant: 'b', picked: 'a', selection: 'b hover' });
    store.send('Make it calmer.');

    expect(host.run.mock.calls[0]?.[0].prompt).toBe(
      'Studio view: product Kit, part components/button (file .ethlete/design/kit/components/button/button.ts),' +
        ' sketch components/button (dir .ethlete/design/kit/sketches/components-button), variant b, picked a,' +
        ' selected frame b hover.\n\nMake it calmer.',
    );
    expect(store.entries()).toEqual([
      {
        kind: 'prompt',
        text: 'Make it calmer.',
        context: 'Kit › components/button › sketch · variant b · picked a · frame b hover',
      },
    ]);
  });

  it('leaves a removed view out until the view changes, and brings it back after a send', () => {
    const store = setup();
    const context = viewContext();

    context.put('system', { product: 'Kit', part: 'components/button' });
    context.remove();
    store.send('First.');
    finish('session-1');

    expect(host.run.mock.calls[0]?.[0].prompt).toBe('First.');
    expect(store.entries()[0]).toEqual({ kind: 'prompt', text: 'First.' });
    expect(context.shown()).not.toBeNull();

    context.remove();
    context.put('system', { product: 'Kit', part: 'components/button' });

    expect(context.shown()).toBeNull();

    context.put('system', { product: 'Kit', part: 'components/select' });
    store.send('Second.');

    expect(host.run.mock.calls[1]?.[0].prompt).toBe('Studio view: product Kit, part components/select.\n\nSecond.');
  });
  it('does not repeat the last message as the summary of the run', () => {
    const store = setup();

    store.send('Make it bolder.');

    const run = host.runs.at(-1);

    run?.events.next({ kind: 'message', text: 'I made the label bolder.' });
    run?.events.next({ kind: 'context', tokens: 1200 });
    run?.events.next({ kind: 'finished', ok: true, summary: 'I made the label bolder.' });
    run?.events.next({ kind: 'finished', ok: false, summary: 'The CLI exited.' });

    expect(store.entries().slice(-2)).toEqual([
      { kind: 'finished', ok: true, summary: '' },
      { kind: 'finished', ok: false, summary: 'The CLI exited.' },
    ]);
  });
});
