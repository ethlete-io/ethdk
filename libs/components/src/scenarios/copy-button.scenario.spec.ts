import { Component, inject, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import {
  COPY_BUTTON_IMPORTS,
  COPY_BUTTON_LABELS,
  CopyButtonDirective,
  DEFAULT_COPY_BUTTON_LABELS,
  IconButtonComponent,
  injectCopyButtonLabels,
  provideCopyButtonLabels,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-share-link',
  imports: [COPY_BUTTON_IMPORTS, IconButtonComponent],
  template: `
    <button
      #copyBtn="etCopyButton"
      [text]="link()"
      (copySuccess)="copies.set(copies() + 1)"
      et-icon-button
      etCopyButton
      resetDelay="500"
      type="button"
      aria-label="Copy link"
    >
      <span class="icon" etIcon>{{ copyBtn.copied() ? 'check' : 'clipboard' }}</span>
    </button>
    <button [text]="serialize" class="json" etCopyButton type="button">Copy JSON</button>
  `,
})
class ShareLinkComponent {
  link = signal('https://team-a.test/match/1');
  copies = signal(0);
  payload = { team: 'team-a' };
  serialize = () => JSON.stringify(this.payload);
}

const stubClipboard = (clipboard: Partial<Clipboard> | undefined) =>
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });

const drain = async (s: Scenario) => {
  await new Promise<void>((resolve) => setImmediate(resolve));
  s.tick();
  s.frame();
};

@Component({
  selector: 'et-scenario-invite-code',
  imports: [CopyButtonDirective],
  template: `<button (copySuccess)="copied.push(code)" etCopyButton text="TEAM-A-42" type="button">Copy code</button>`,
})
class InviteCodeComponent {
  code = 'TEAM-A-42';
  copied: string[] = [];
  copyButton = viewChild.required(CopyButtonDirective);
}

@Component({
  selector: 'et-scenario-copy-label-probe',
  template: `{{ labels().copied }}|{{ token.copied }}`,
})
class CopyLabelProbeComponent {
  labels = injectCopyButtonLabels();
  token = inject(COPY_BUTTON_LABELS);
}

@Component({
  selector: 'et-scenario-localized-copy',
  imports: [CopyButtonDirective, CopyLabelProbeComponent],
  providers: [provideCopyButtonLabels({ copied: 'Kopiert' })],
  template: `
    <button etCopyButton text="TEAM-A-42" type="button">Copy code</button>
    <et-scenario-copy-label-probe />
  `,
})
class LocalizedCopyComponent {}

describe('copy button scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] });

  afterEach(() => {
    stubClipboard(undefined);
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('copies the link, swaps the icon and swaps it back after the reset delay', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    const s = scenario();
    const fixture = TestBed.createComponent(ShareLinkComponent);
    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector<HTMLButtonElement>('[aria-label="Copy link"]')!;

    s.tick();
    expect(button.querySelector('.icon')?.textContent).toBe('clipboard');

    button.click();
    await drain(s);

    expect(writeText).toHaveBeenCalledWith('https://team-a.test/match/1');
    expect(fixture.componentInstance.copies()).toBe(1);
    expect(button.getAttribute('data-copied')).toBe('true');
    expect(button.querySelector('.icon')?.textContent).toBe('check');

    s.tick(499);
    expect(button.querySelector('.icon')?.textContent).toBe('check');

    s.tick(1);
    expect(button.hasAttribute('data-copied')).toBe(false);
    expect(button.querySelector('.icon')?.textContent).toBe('clipboard');
    s.flush();
  });

  it('restarts the countdown when the user copies again before it ran out', async () => {
    stubClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });

    const s = scenario();
    const fixture = TestBed.createComponent(ShareLinkComponent);
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-label="Copy link"]')!;

    s.tick();
    button.click();
    await drain(s);
    s.tick(400);

    button.click();
    await drain(s);
    s.tick(400);

    expect(fixture.componentInstance.copies()).toBe(2);
    expect(button.getAttribute('data-copied')).toBe('true');

    s.tick(100);
    expect(button.hasAttribute('data-copied')).toBe(false);
    s.flush();
  });

  it('reads a getter at click time, not at render time', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    const s = scenario();
    const fixture = TestBed.createComponent(ShareLinkComponent);

    s.tick();
    fixture.componentInstance.payload = { team: 'team-b' };
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.json')!.click();
    await drain(s);
    s.tick(1200);

    expect(writeText).toHaveBeenCalledWith('{"team":"team-b"}');
    s.flush();
  });

  it('falls back to the legacy copy path and keeps focus on the button', async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });

    const s = scenario();
    const fixture = TestBed.createComponent(ShareLinkComponent);
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-label="Copy link"]')!;

    s.tick();
    button.focus();
    button.click();
    await drain(s);

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(fixture.componentInstance.copies()).toBe(1);
    expect(document.activeElement).toBe(button);
    expect(document.body.querySelector('textarea[aria-hidden]')).toBeNull();

    s.tick(500);
    s.flush();
  });

  it('shows no success when nothing reached the clipboard', async () => {
    const execCommand = vi.fn().mockReturnValue(false);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });

    const s = scenario();
    const fixture = TestBed.createComponent(ShareLinkComponent);
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-label="Copy link"]')!;

    s.tick();
    button.click();
    await drain(s);

    expect(fixture.componentInstance.copies()).toBe(0);
    expect(button.hasAttribute('data-copied')).toBe(false);
    s.flush();
  });

  it('copies from a keyboard shortcut through requestCopy, not only from a click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    const s = scenario();
    const fixture = TestBed.createComponent(InviteCodeComponent);
    const app = fixture.componentInstance;

    s.tick();

    expect(app.copyButton().resetDelay()).toBe(1200);

    app.copyButton().requestCopy();
    await drain(s);

    expect(writeText).toHaveBeenCalledWith('TEAM-A-42');
    expect(app.copied).toEqual(['TEAM-A-42']);
    expect(app.copyButton().copied()).toBe(true);

    s.tick(1200);

    expect(app.copyButton().copied()).toBe(false);
    s.flush();
  });

  it('announces the copy with the default label and with a localized one', async () => {
    stubClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });

    const s = scenario();
    const defaults = TestBed.createComponent(InviteCodeComponent);
    const defaultHost = defaults.nativeElement as HTMLElement;

    s.tick();
    defaultHost.querySelector('button')!.click();
    await drain(s);

    expect(defaultHost.querySelector('[role="status"]')?.textContent).toBe(DEFAULT_COPY_BUTTON_LABELS.copied);

    const localized = TestBed.createComponent(LocalizedCopyComponent);
    const host = localized.nativeElement as HTMLElement;

    s.tick();
    host.querySelector('button')!.click();
    await drain(s);

    expect(host.querySelector('[role="status"]')?.textContent).toBe('Kopiert');
    expect(host.querySelector('et-scenario-copy-label-probe')?.textContent).toBe('Kopiert|Kopiert');
    s.flush();
  });
});
