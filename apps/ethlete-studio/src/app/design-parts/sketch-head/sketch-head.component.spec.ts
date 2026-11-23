import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { SketchWithdrawn } from '../sketches/sketches-sample';
import { SketchHeadComponent } from './sketch-head.component';

const HOLD = { until: 'B1', by: { short: 'Sol', agent: 'codex' as const }, since: 'seit 1 Min' };
const IDLE = { by: 'Sol', since: 'seit 2 Min' };

@Component({
  imports: [SketchHeadComponent],
  template: `<ethlete-sketch-head
    [(withdrawn)]="withdrawn"
    [hold]="hold"
    [lastChange]="idle"
    [question]="question()"
    [discardable]="discardable()"
    [listError]="listError()"
    [withdrawnCount]="3"
    (discard)="discards = discards + 1"
    (retry)="retries = retries + 1"
    heading="pages/home"
  />`,
})
class HostComponent {
  hold = HOLD;
  idle = IDLE;
  question = signal('Welche Farbe bekommt der Rahmen der gewählten Variante, wenn sie gerade gezeichnet wird?');
  discardable = signal(true);
  listError = signal(true);
  withdrawn = signal<SketchWithdrawn>('hidden');
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
  it('shows a long question on one truncated line and moves the picker below it', async () => {
    const { fixture, root, host } = await setup();
    const line = root.querySelector<HTMLElement>('[data-sk-question]')!;

    expect(root.querySelector('header')?.textContent).toContain('pages/home');
    expect(line.textContent?.trim()).toBe(host.question());
    expect(line.classList).toContain('truncate');
    expect(line.nextElementSibling?.querySelector('et-select')).not.toBeNull();

    host.question.set('');
    await fixture.whenStable();

    expect(root.querySelector('[data-sk-question]')).toBeNull();
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
});
