import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  TOOLBAR_IMPORTS,
  TOOLBAR_ORIENTATIONS,
  ToolbarComponent,
  ToolbarDirective,
  ToolbarOrientation,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-editor-toolbar',
  imports: [TOOLBAR_IMPORTS],
  template: `
    <et-toolbar [orientation]="orientation()" aria-label="Text formatting">
      <button (click)="log.push('bold')" type="button">Bold</button>
      <button [disabled]="italicDisabled()" type="button">Italic</button>
      @for (tool of extraTools(); track tool) {
        <button type="button">{{ tool }}</button>
      }
      <a href="/help">Help</a>
      <div aria-label="Alignment" etToolbar>
        <button type="button">Left</button>
        <button type="button">Right</button>
      </div>
    </et-toolbar>
    <button class="after" type="button">After</button>
  `,
})
class EditorToolbarComponent {
  orientation = signal<ToolbarOrientation>(TOOLBAR_ORIENTATIONS.HORIZONTAL);
  italicDisabled = signal(false);
  extraTools = signal(['Link']);
  log: string[] = [];
}

const text = (element: Element | null) => element?.textContent?.trim() ?? '';

const focused = () => text(document.activeElement);

const press = (key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

  document.activeElement!.dispatchEvent(event);

  return event;
};

const tabStops = (host: Element) =>
  Array.from(host.querySelectorAll<HTMLElement>('button, a'))
    .filter((control) => control.tabIndex === 0)
    .map(text);

@Component({
  selector: 'et-scenario-player-controls',
  imports: [ToolbarComponent, ToolbarDirective],
  template: `
    <div et-toolbar aria-label="Player">
      <button type="button">Play</button>
      <button type="button">Mute</button>
    </div>
    <div #zoom class="custom" role="toolbar" aria-label="Zoom" etToolbar orientation="vertical">
      <button type="button">In</button>
      <button type="button">Out</button>
    </div>
  `,
})
class PlayerControlsComponent {
  toolbar = viewChild.required(ToolbarComponent, { read: ToolbarDirective });
  zoom = viewChild.required('zoom', { read: ToolbarDirective });
}

describe('toolbar scenarios', () => {
  const scenario = useScenario();

  it('is one labelled tab stop that the arrow keys move through and wrap around', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(EditorToolbarComponent);
    const host = fixture.nativeElement as HTMLElement;
    const toolbar = host.querySelector('et-toolbar')!;

    document.body.appendChild(host);
    s.tick();

    expect(toolbar.getAttribute('role')).toBe('toolbar');
    expect(toolbar.getAttribute('aria-orientation')).toBe('horizontal');
    expect(toolbar.getAttribute('aria-label')).toBe('Text formatting');
    expect(tabStops(host)).toEqual(['Bold', 'Left', 'After']);

    host.querySelector<HTMLButtonElement>('button')!.focus();
    expect(press('ArrowRight').defaultPrevented).toBe(true);
    expect(focused()).toBe('Italic');

    press('ArrowRight');
    press('ArrowRight');
    expect(focused()).toBe('Help');

    press('ArrowRight');
    expect(focused()).toBe('Bold');

    press('ArrowLeft');
    expect(focused()).toBe('Help');

    press('Home');
    expect(focused()).toBe('Bold');

    press('End');
    expect(focused()).toBe('Help');
    expect(tabStops(host)).toEqual(['Help', 'Left', 'After']);

    expect(press('ArrowDown').defaultPrevented).toBe(false);
    expect(press('Enter').defaultPrevented).toBe(false);
    expect(focused()).toBe('Help');
  });

  it('keeps a nested toolbar to itself', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(EditorToolbarComponent);
    const host = fixture.nativeElement as HTMLElement;

    document.body.appendChild(host);
    s.tick();

    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => text(button) === 'Left')!
      .focus();

    press('ArrowRight');
    expect(focused()).toBe('Right');

    press('ArrowRight');
    expect(focused()).toBe('Left');
    expect(tabStops(host)).toEqual(['Bold', 'Left', 'After']);
  });

  it('skips disabled controls, picks up new ones and moves the tab stop off a removed one', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(EditorToolbarComponent);
    const page = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    document.body.appendChild(host);
    page.italicDisabled.set(true);
    s.tick();

    host.querySelector<HTMLButtonElement>('button')!.focus();
    press('ArrowRight');
    expect(focused()).toBe('Link');

    page.extraTools.set(['Link', 'Quote']);
    s.tick();

    press('ArrowRight');
    expect(focused()).toBe('Quote');
    expect(tabStops(host)).toEqual(['Quote', 'Left', 'After']);

    page.extraTools.set([]);
    s.tick();

    expect(document.activeElement).toBe(document.body);
    expect(tabStops(host)).toEqual(['Bold', 'Left', 'After']);

    page.italicDisabled.set(false);
    s.tick();

    expect(tabStops(host)).toEqual(['Bold', 'Left', 'After']);

    host.querySelector<HTMLButtonElement>('button')!.focus();
    press('ArrowRight');
    expect(focused()).toBe('Italic');
  });

  it('navigates a vertical toolbar with the up and down keys', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(EditorToolbarComponent);
    const page = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    document.body.appendChild(host);
    page.orientation.set(TOOLBAR_ORIENTATIONS.VERTICAL);
    s.tick();

    expect(host.querySelector('et-toolbar')?.getAttribute('aria-orientation')).toBe('vertical');

    host.querySelector<HTMLButtonElement>('button')!.focus();

    expect(press('ArrowRight').defaultPrevented).toBe(false);
    expect(focused()).toBe('Bold');

    press('ArrowDown');
    expect(focused()).toBe('Italic');

    press('ArrowUp');
    press('ArrowUp');
    expect(focused()).toBe('Help');

    host.querySelector<HTMLButtonElement>('button')!.click();
    expect(page.log).toEqual(['bold']);
  });

  it('jumps back to the first control on demand, from the component or a plain etToolbar', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlayerControlsComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    document.body.appendChild(host);
    s.tick();

    host.querySelectorAll<HTMLButtonElement>('[et-toolbar] button')[0]!.focus();
    press('ArrowRight');
    s.tick();

    expect(focused()).toBe('Mute');

    app.toolbar().focusFirst();

    expect(focused()).toBe('Play');

    const zoom = host.querySelector<HTMLElement>('.custom')!;

    expect(zoom.getAttribute('aria-orientation')).toBe('vertical');

    app.zoom().focusFirst();
    expect(focused()).toBe('In');

    press('ArrowDown');
    s.tick();

    expect(focused()).toBe('Out');
    expect(tabStops(zoom)).toEqual(['Out']);
  });
});
