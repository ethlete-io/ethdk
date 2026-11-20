import { Component, outputBinding, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectOverlayManager, provideOverlay } from '@ethlete/components';
import { ShortcutsDialogComponent } from './shortcuts-dialog.component';
import { injectStudioMenuDialogs } from '../studio-menu/studio-menu-dialogs';

const host = vi.hoisted(() => ({ helpOpened: 0 }));

vi.mock('../../../host/about', async () => {
  const { defer, of: emit } = await import('rxjs');

  return {
    studioVersion$: () => emit(''),
    openHelp$: () =>
      defer(() => {
        host.helpOpened += 1;

        return emit(undefined);
      }),
  };
});

@Component({
  template: `
    <button (click)="dialogs.shortcuts()" type="button">shortcuts</button>
    <button (click)="dialogs.help()" type="button">help</button>
  `,
})
class HostComponent {
  public dialogs = injectStudioMenuDialogs();
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const render = async () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideOverlay()] });

  const fixture = TestBed.createComponent(HostComponent);

  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();

  const [shortcuts, help] = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
  const dialogs = () => document.querySelectorAll<HTMLElement>('ethlete-shortcuts-dialog');
  const press = async (init: KeyboardEventInit) => {
    (document.activeElement ?? document).dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
    );
    await fixture.whenStable();
    await settle();
  };

  return { fixture, shortcuts: shortcuts as HTMLButtonElement, help: help as HTMLButtonElement, dialogs, press };
};

describe('ShortcutsDialogComponent', () => {
  afterEach(() => document.querySelectorAll('ethlete-shortcuts-dialog').forEach((node) => node.remove()));

  it('opens on Ctrl+/ and lists every Studio shortcut by group', async () => {
    const { dialogs, press } = await render();

    await press({ key: '/', code: 'Slash', ctrlKey: true });

    const dialog = dialogs()[0];
    const rows = [...(dialog?.querySelectorAll('dl > div') ?? [])].map((row) => row.querySelector('dt')?.textContent);

    expect(dialogs()).toHaveLength(1);
    expect(dialog?.closest('[role="dialog"]')?.getAttribute('aria-label')).toBe('Tastenkürzel');
    expect([...(dialog?.querySelectorAll('h3') ?? [])].map((heading) => heading.textContent)).toEqual([
      'Allgemein',
      'Canvas',
    ]);
    expect(rows).toEqual([
      'Suche und Befehle',
      'Tastenkürzel',
      'Alle Frames zeigen',
      'Gewählten Frame zeigen',
      'Auf 100 % zoomen',
      'Verschieben beim Ziehen',
      'Auswahl aufheben',
    ]);
    expect(dialog?.querySelectorAll('et-kbd')).toHaveLength(7);
  });

  it('opens one dialog however often it is asked', async () => {
    const { fixture, shortcuts, dialogs, press } = await render();

    shortcuts.click();
    await fixture.whenStable();
    await settle();
    await press({ key: '/', code: 'Slash', ctrlKey: true });

    expect(dialogs()).toHaveLength(1);
  });

  it('closes on Escape and returns focus to the opener, then opens again', async () => {
    const { fixture, shortcuts, dialogs, press } = await render();

    shortcuts.focus();
    shortcuts.click();
    await fixture.whenStable();
    await settle();
    await press({ key: 'Escape', code: 'Escape' });

    expect(dialogs()).toHaveLength(0);
    expect(document.activeElement).toBe(shortcuts);

    shortcuts.click();
    await fixture.whenStable();
    await settle();

    expect(dialogs()).toHaveLength(1);
  });

  it('ignores / without Ctrl', async () => {
    const { dialogs, press } = await render();

    await press({ key: '/', code: 'Slash' });

    expect(dialogs()).toHaveLength(0);
  });

  it('asks the host to open the help page', async () => {
    const { fixture, help } = await render();

    help.click();
    await fixture.whenStable();

    expect(host.helpOpened).toBe(1);
  });

  it('emits close from the close button', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideOverlay()] });

    const closed = vi.fn();
    const ref = TestBed.runInInjectionContext(() =>
      injectOverlayManager().open(ShortcutsDialogComponent, {
        role: 'dialog',
        ariaLabel: 'x',
        bindings: [outputBinding('close', closed)],
      }),
    );

    await settle();
    document.querySelector<HTMLButtonElement>('button[aria-label="Schließen"]')?.click();

    expect(closed).toHaveBeenCalledTimes(1);

    ref.close();
    await settle();
  });
});
