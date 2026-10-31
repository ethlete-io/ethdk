import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { Observable, of } from 'rxjs';
import type { AgentEvent, AgentRequest } from '../../host/agent';
import { THEMES } from '../../themes';
import { AppComponent } from '../app.component';
import { ChatPanelComponent } from './chat-panel.component';
import { injectViewContext } from './view-context';

const host = vi.hoisted(() => ({
  run: vi.fn<(request: AgentRequest) => void>(),
  emit: vi.fn<(event: AgentEvent) => void>(),
}));

vi.mock('../../host/agent', () => ({
  agentList$: () => of([{ id: 'claude', label: 'Claude Code', binary: 'claude', version: '1', suggestedModels: [] }]),
  agentRun$: (request: AgentRequest) => {
    host.run(request);

    return new Observable<AgentEvent>((subscriber) => {
      host.emit.mockImplementation((event) => subscriber.next(event));
    });
  },
}));

vi.mock('../../host/workspace', () => ({ workspaceRoot$: () => of('/repo') }));

@Component({ selector: 'ethlete-first-page', template: 'first' })
class FirstPageComponent {}

@Component({ selector: 'ethlete-second-page', template: 'second' })
class SecondPageComponent {}

const render = async () => {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ...provideColorThemesWithTailwind4(THEMES),
      provideRouter([
        { path: '', component: FirstPageComponent },
        { path: 'second', component: SecondPageComponent },
      ]),
    ],
  });

  const fixture = TestBed.createComponent(AppComponent);

  fixture.autoDetectChanges();
  await fixture.whenStable();

  return fixture;
};

const element = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

const open = async (fixture: ComponentFixture<unknown>) => {
  element(fixture).querySelector<HTMLButtonElement>('[data-chat-toggle]')?.click();
  await fixture.whenStable();
};

const type = async (fixture: ComponentFixture<unknown>, value: string) => {
  const field = element(fixture).querySelector<HTMLTextAreaElement>('[data-chat-prompt] textarea');

  if (!field) throw new Error('no prompt field');

  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await fixture.whenStable();

  return field;
};

const press = async (fixture: ComponentFixture<unknown>, field: HTMLElement, shiftKey: boolean) => {
  field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey, bubbles: true, cancelable: true }));
  await fixture.whenStable();
};

describe('ChatPanelComponent', () => {
  beforeEach(() => host.run.mockReset());

  afterEach(() => localStorage.clear());

  it('opens from the collapsed strip and hides again', async () => {
    const fixture = await render();

    expect(element(fixture).querySelector('[data-chat-panel]')).toBeNull();
    await open(fixture);
    expect(element(fixture).querySelector('[data-chat-panel]')).not.toBeNull();
    await open(fixture);
    expect(element(fixture).querySelector('[data-chat-panel]')).toBeNull();
  });

  it('sends on Enter and breaks the line on Shift+Enter', async () => {
    const fixture = await render();

    await open(fixture);
    const field = await type(fixture, 'Make the header calmer.');

    await press(fixture, field, true);
    expect(host.run).not.toHaveBeenCalled();

    await press(fixture, field, false);
    expect(host.run).toHaveBeenCalledTimes(1);
    expect(host.run.mock.calls[0]?.[0]).toMatchObject({ prompt: 'Make the header calmer.', tools: null });
    expect(element(fixture).querySelector('[data-chat-entry-text]')?.textContent?.trim()).toBe(
      'Make the header calmer.',
    );
    expect(field.value).toBe('');
  });

  it('clears the field when Enter follows a paste into the empty field before a change detection', async () => {
    const fixture = await render();

    await open(fixture);
    const field = element(fixture).querySelector<HTMLTextAreaElement>('[data-chat-prompt] textarea');

    if (!field) throw new Error('no prompt field');

    field.value = 'Make the header calmer.';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await press(fixture, field, false);

    expect(host.run.mock.calls[0]?.[0]).toMatchObject({ prompt: 'Make the header calmer.' });
    expect(field.value).toBe('');
  });

  it('keeps the panel and its messages when the routed page changes', async () => {
    const fixture = await render();

    await open(fixture);
    await type(fixture, 'Keep me.');
    element(fixture).querySelector<HTMLButtonElement>('[data-chat-send]')?.click();
    await fixture.whenStable();

    const panel = fixture.debugElement.query((node) => node.componentInstance instanceof ChatPanelComponent);

    await TestBed.inject(Router).navigateByUrl('/second');
    await fixture.whenStable();

    expect(element(fixture).textContent).toContain('second');
    expect(fixture.debugElement.query((node) => node.componentInstance instanceof ChatPanelComponent)).toBe(panel);
    expect(element(fixture).querySelector('[data-chat-entry-text]')?.textContent?.trim()).toBe('Keep me.');
  });

  it('shows the view above the prompt field and sends the message without it once removed', async () => {
    const fixture = await render();

    TestBed.runInInjectionContext(() => injectViewContext()).put('system', {
      product: 'Kit',
      part: 'components/button',
    });
    await open(fixture);

    const chip = () => element(fixture).querySelector('[data-chat-context]');

    expect(chip()?.textContent).toContain('Kit › components/button');

    element(fixture).querySelector<HTMLButtonElement>('[data-chat-context-remove]')?.click();
    await fixture.whenStable();

    expect(chip()).toBeNull();

    await type(fixture, 'Plain.');
    element(fixture).querySelector<HTMLButtonElement>('[data-chat-send]')?.click();
    await fixture.whenStable();

    expect(host.run.mock.calls[0]?.[0]).toMatchObject({ prompt: 'Plain.' });
    expect(element(fixture).querySelector('[data-chat-entry-context]')).toBeNull();
    expect(chip()).not.toBeNull();
  });

  it('renders agent messages as a markdown subset and nothing else', async () => {
    const fixture = await render();

    await open(fixture);
    await type(fixture, 'Hi');
    element(fixture).querySelector<HTMLButtonElement>('[data-chat-send]')?.click();
    await fixture.whenStable();
    host.emit({
      kind: 'message',
      text: [
        'Use `yarn build` and **carefully** <b>raw</b> [l](http://x)',
        '',
        '- one',
        '- two',
        '',
        '2. first',
        '3. second',
        '',
        '```ts',
        'const a = "<i>x</i>";',
        '```',
      ].join('\n'),
    });
    await fixture.whenStable();

    const message = element(fixture).querySelector('[data-chat-entry="message"]');

    expect(message?.querySelector('p code')?.textContent).toBe('yarn build');
    expect(message?.querySelector('p strong')?.textContent).toBe('carefully');
    expect(message?.querySelector('p')?.textContent).toContain('<b>raw</b> [l](http://x)');
    expect(message?.querySelector('b, a, i')).toBeNull();
    expect([...(message?.querySelectorAll('ul > li') ?? [])].map((li) => li.textContent?.trim())).toEqual([
      'one',
      'two',
    ]);
    expect(message?.querySelector('ol')?.getAttribute('start')).toBe('2');
    expect(message?.querySelectorAll('ol > li')).toHaveLength(2);
    expect(message?.querySelector('pre')?.getAttribute('data-language')).toBe('ts');
    expect(message?.querySelector('pre code')?.textContent).toBe('const a = "<i>x</i>";');
  });
});
