import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideOverlay } from '@ethlete/components';
import { of } from 'rxjs';
import { injectStudioMenuDialogs } from '../studio-menu/studio-menu-dialogs';

const host = vi.hoisted(() => ({ version: '1.4.0-rc.3+build.20261120.ffeeddccbbaa99887766' }));

vi.mock('../../../host/about', () => ({
  studioVersion$: () => of(host.version),
  openHelp$: () => of(undefined),
}));

@Component({ template: `<button (click)="dialogs.about()" type="button">open</button>` })
class HostComponent {
  public dialogs = injectStudioMenuDialogs();
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const openAbout = async () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideOverlay()] });

  const fixture = TestBed.createComponent(HostComponent);

  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();

  const opener = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;

  opener.focus();
  opener.click();
  await fixture.whenStable();
  await settle();

  const dialog = () => document.querySelector<HTMLElement>('ethlete-about-dialog');

  return { fixture, opener, dialog };
};

describe('AboutDialogComponent', () => {
  afterEach(() => document.querySelectorAll('ethlete-about-dialog').forEach((node) => node.remove()));

  it('shows the title, the product, the running version from the host and the license', async () => {
    const { dialog } = await openAbout();
    const text = dialog()?.textContent?.replace(/\s+/g, ' ');

    expect(dialog()?.closest('[role="dialog"]')?.getAttribute('aria-label')).toBe('Über Studio');
    expect(text).toContain('Über Studio');
    expect(text).toContain('Ethlete Studio');
    expect(text).toContain(`Version ${host.version}`);
    expect(text).toContain('MIT-Lizenz, © 2025 The Authors');
    expect(dialog()?.querySelector('footer, [etOverlayFooter]')).toBeNull();
  });

  it('closes on Schließen and returns focus to the opener', async () => {
    const { fixture, opener, dialog } = await openAbout();

    const close = dialog()?.querySelector<HTMLButtonElement>('button[aria-label="Schließen"]');

    expect(close).not.toBeNull();
    close?.click();
    await fixture.whenStable();
    await settle();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const { fixture, opener, dialog } = await openAbout();

    (document.activeElement ?? document).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    await settle();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
