import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { NEVER, of } from 'rxjs';
import type { AgentRequest } from '../../host/agent';
import { THEMES } from '../../themes';
import { AppComponent } from '../app.component';
import { ChatPanelComponent } from './chat-panel.component';

const host = vi.hoisted(() => ({ run: vi.fn<(request: AgentRequest) => void>() }));

vi.mock('../../host/agent', () => ({
  agentList$: () => of([{ id: 'claude', label: 'Claude Code', binary: 'claude', version: '1', suggestedModels: [] }]),
  agentRun$: (request: AgentRequest) => {
    host.run(request);

    return NEVER;
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
    expect(element(fixture).querySelector('[data-chat-entry="prompt"]')?.textContent?.trim()).toBe(
      'Make the header calmer.',
    );
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
    expect(element(fixture).querySelector('[data-chat-entry="prompt"]')?.textContent?.trim()).toBe('Keep me.');
  });
});
