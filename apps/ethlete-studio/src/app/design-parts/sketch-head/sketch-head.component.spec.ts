import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { SketchStatus, SketchWithdrawn } from '../sketches/sketches-sample';
import { SketchHeadComponent } from './sketch-head.component';

const HOLD = { until: 'B1', by: { short: 'Sol', agent: 'codex' as const }, since: 'seit 1 Min' };

@Component({
  imports: [SketchHeadComponent],
  template: `<ethlete-sketch-head
    [(withdrawn)]="withdrawn"
    [hold]="hold"
    [status]="status()"
    [readyReason]="readyReason()"
    [discardable]="discardable()"
    [listError]="listError()"
    [withdrawnCount]="3"
    [rounds]="rounds"
    (discard)="discards = discards + 1"
    (retry)="retries = retries + 1"
    round="r1"
    heading="pages/home"
  />`,
})
class HostComponent {
  hold = HOLD;
  status = signal<SketchStatus>('waiting');
  readyReason = signal<string | null>(null);
  discardable = signal(true);
  listError = signal(true);
  withdrawn = signal<SketchWithdrawn>('hidden');
  rounds = [
    { value: 'r1', label: 'Runde 1' },
    { value: 'r2', label: 'Runde 2' },
  ];
  discards = 0;
  retries = 0;
}

const setup = async () => {
  // jsdom ignores rules inside `@layer`, so et-choice-field reads `display: inline` and the SDK logs an error.
  const layerShim = Object.assign(document.createElement('style'), { textContent: 'et-choice-field{display:flex}' });

  document.head.append(layerShim);
  onTestFinished(() => layerShim.remove());
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(HostComponent);

  await fixture.whenStable();

  return { fixture, root: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
};

describe('SketchHeadComponent', () => {
  // The human decided Studio does not show the new or not-ready badges, the not-ready reason, the last
  // change line or the description line under the title.
  it('shows no not-ready badge, reason, last change or description line', async () => {
    const { fixture, root, host } = await setup();

    host.status.set('not-ready');
    host.readyReason.set('components/title-bar b: SHOT-NOT-VIEWED default draws a pixel diff nobody viewed');
    await fixture.whenStable();

    const text = root.textContent ?? '';

    expect(root.querySelector('header')?.textContent).toContain('pages/home');
    expect(root.querySelector('header et-badge')).toBeNull();
    expect(text).not.toContain('Noch nicht bereit');
    expect(text).not.toContain('Grund unbekannt');
    expect(text).not.toContain('SHOT-NOT-VIEWED');
    expect(text).not.toContain('Letzte Änderung');
    expect(root.querySelector('[data-sk-not-ready], [data-sk-question]')).toBeNull();
    expect(root.querySelector('header')?.nextElementSibling?.querySelector('et-select')).not.toBeNull();
  });

  it('emits discard and retry, and toggles the withdrawn rows', async () => {
    const { fixture, root, host } = await setup();

    root.querySelector<HTMLElement>('[data-sk-discard] button')?.click();
    root.querySelector<HTMLElement>('[data-sk-retry]')?.click();
    root.querySelector<HTMLElement>('[data-sk-withdrawn-toggle] et-switch')?.click();
    await fixture.whenStable();

    expect(host.discards).toBe(1);
    expect(host.retries).toBe(1);
    expect(host.withdrawn()).toBe('shown');
  });

  it('shows the edit hint in place of Verwerfen when the sketch cannot be discarded', async () => {
    const { fixture, root, host } = await setup();

    host.discardable.set(false);
    await fixture.whenStable();

    expect(root.querySelector('[data-sk-discard]')).toBeNull();
    expect(root.querySelector('[data-sk-edit-hint]')?.textContent?.trim()).toBe(SKETCHES_LABELS.editHint);
  });

  // The round picker is a ghost select with a selected round and no clear button.
  it('shows the round picker as a ghost select without a clear button', async () => {
    const { root } = await setup();
    const field = root.querySelector('et-form-field')!;

    expect(field.getAttribute('data-variant')).toBe('ghost');
    expect(field.querySelector('et-select')?.textContent).toContain('Runde 1');
    expect(field.querySelector('.et-input-clear')).toBeNull();
  });
});
