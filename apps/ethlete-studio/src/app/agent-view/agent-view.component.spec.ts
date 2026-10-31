import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of } from 'rxjs';
import type { AgentRequest } from '../../host/agent';
import { AgentViewComponent } from './agent-view.component';

const host = vi.hoisted(() => ({ run: vi.fn<(request: AgentRequest) => unknown>() }));

vi.mock('../../host/agent', () => ({
  agentList$: () => of([{ id: 'claude', label: 'Claude Code', binary: 'claude', version: '1', suggestedModels: [] }]),
  agentRun$: (request: AgentRequest) => {
    host.run(request);

    return NEVER;
  },
}));

vi.mock('../../host/workspace', () => ({ workspaceRoot$: () => of('/repo') }));

const render = () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });

  const fixture = TestBed.createComponent(AgentViewComponent);

  fixture.detectChanges();

  return fixture.nativeElement as HTMLElement;
};

const type = (element: HTMLElement, selector: string, value: string) => {
  const field = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);

  if (!field) throw new Error(`no ${selector}`);

  field.value = value;
  field.dispatchEvent(new Event('input'));
};

const sendFrom = (element: HTMLElement) => {
  element.querySelector<HTMLButtonElement>('button')?.click();
  type(element, '[data-agent-prompt]', 'Make the header calmer.');
  element.querySelector<HTMLButtonElement>('[data-agent-send]')?.click();

  return host.run.mock.calls.at(-1)?.[0];
};

describe('AgentViewComponent', () => {
  beforeEach(() => host.run.mockReset());

  it('sends the call and the variant as tools and names them in the prompt', () => {
    const element = render();

    type(element, '[data-agent-call]', 'studio/01-workbench');
    type(element, '[data-agent-variant]', 'b');

    const request = sendFrom(element);

    expect(request?.tools).toEqual({ call: 'studio/01-workbench', variant: 'b' });
    expect(request?.cwd).toBe('/repo');
    expect(request?.prompt).toContain('call "studio/01-workbench"');
    expect(request?.prompt).toContain('variant "b"');
    expect(request?.prompt).toContain('Make the header calmer.');
  });

  it('sends no tools without a call and a variant', () => {
    const element = render();

    type(element, '[data-agent-call]', 'studio/01-workbench');

    const request = sendFrom(element);

    expect(request?.tools).toBeNull();
    expect(request?.prompt).toBe('Make the header calmer.');
  });
});
