import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { SketchAgentRun, SketchStatus, SketchWithdrawn } from '../sketches/sketches-sample';
import { SketchHeadComponent } from './sketch-head.component';

const HOLD = { until: 'B1', since: 'seit 1 Min' };
const OPUS = { short: 'Opus 5.5', id: 'claude-opus-5-5', agent: 'claude' as const };

@Component({
  imports: [SketchHeadComponent],
  template: `<ethlete-sketch-head
    [(withdrawn)]="withdrawn"
    [(commentMode)]="commentMode"
    [commentable]="commentable"
    [hold]="hold"
    [agent]="agent()"
    [reasonOpen]="reasonOpen()"
    [status]="status()"
    [readyReason]="readyReason()"
    [discardable]="discardable()"
    [listError]="listError()"
    [withdrawnCount]="withdrawnCount()"
    [rounds]="rounds"
    (discard)="discards = discards + 1"
    (retry)="retries = retries + 1"
    (roundChange)="picked.push($event)"
    round="r1"
  />`,
})
class HostComponent {
  hold = HOLD;
  agent = signal<SketchAgentRun | null>(null);
  reasonOpen = signal(false);
  status = signal<SketchStatus>('waiting');
  readyReason = signal<string | null>(null);
  discardable = signal(true);
  listError = signal(true);
  withdrawn = signal<SketchWithdrawn>('hidden');
  commentMode = signal(false);
  commentable = true;
  withdrawnCount = signal(3);
  picked: string[] = [];
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

    expect(root.querySelector('[data-sk-toolbar] [data-sk-status]')).toBeNull();
    expect(text).not.toContain('Noch nicht bereit');
    expect(text).not.toContain('Grund unbekannt');
    expect(text).not.toContain('SHOT-NOT-VIEWED');
    expect(text).not.toContain('Letzte Änderung');
    expect(root.querySelector('[data-sk-not-ready], [data-sk-question]')).toBeNull();
  });

  // The human wants the model icon and name in the agent line; keep it.
  it('shows the model icon and name with zeichnet in the agent line', async () => {
    const { fixture, root, host } = await setup();

    host.status.set('drawing');
    host.agent.set({ by: OPUS, since: 'seit 4 Min' });
    await fixture.whenStable();

    const line = root.querySelector('[data-sk-agent]');

    expect(line?.querySelector('svg[ethlete-agent-logo]')).not.toBeNull();
    expect([...(line?.children ?? [])].map((part) => part.textContent?.trim())).toEqual([
      '',
      'Opus 5.5',
      'zeichnet',
      '· seit 4 Min',
    ]);
  });

  // The human decided Studio does not show the agent's model in the hold reason.
  it('shows the hold reason without a model', async () => {
    const { fixture, root, host } = await setup();

    host.status.set('paused');
    host.reasonOpen.set(true);
    await fixture.whenStable();

    const text = root.textContent ?? '';

    expect(text).toContain('Wartet auf B1');
    expect(text).toContain('seit 1 Min');
    expect(root.querySelector('svg[ethlete-agent-logo]')).toBeNull();
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

  // Decision human 23.11. (B703): the head goes away completely, so the part draws no header, title or round select.
  it('draws a floating toolbar without a header, a title or a round select', async () => {
    const { root } = await setup();

    expect(root.querySelector('[role="toolbar"][data-sk-toolbar]')).not.toBeNull();
    expect(root.querySelector('header')).toBeNull();
    expect(root.querySelector('et-select')).toBeNull();
    expect(root.querySelector('.text-ui-lg')).toBeNull();
  });

  // B714: a status outside paused/waiting/failed/drawing leaves nothing before the divider.
  it('draws no lone divider and a symmetric padding when nothing precedes it', async () => {
    const { fixture, root, host } = await setup();

    host.status.set('not-ready');
    host.withdrawnCount.set(0);
    fixture.componentRef.changeDetectorRef.detectChanges();
    await fixture.whenStable();

    expect(root.querySelector('[data-sk-divider]')).toBeNull();
    expect(root.querySelector('[data-sk-toolbar]')?.classList.contains('ps-space-3')).toBe(false);
  });

  // Decision human 23.11. (B703): Kommentar is an icon button in the floating toolbar and still toggles comment mode.
  it('toggles comment mode with the Kommentar icon button', async () => {
    const { fixture, root, host } = await setup();
    const comment = root.querySelector<HTMLElement>('[data-sk-comment]')!;

    expect(comment.classList).toContain('et-icon-button');
    expect(comment.getAttribute('aria-label')).toBe('Kommentar');
    expect(comment.textContent?.trim()).toBe('');

    comment.click();
    await fixture.whenStable();

    expect(host.commentMode()).toBe(true);
    expect(comment.getAttribute('aria-pressed')).toBe('true');
  });

  // Decision human 23.11. (B703): Verwerfen is an icon button in the floating toolbar and still emits the discard.
  it('emits discard from the Verwerfen icon button', async () => {
    const { fixture, root, host } = await setup();
    const discard = root.querySelector<HTMLElement>('[data-sk-discard] button')!;

    expect(discard.classList).toContain('et-icon-button');
    expect(discard.getAttribute('aria-label')).toBe(SKETCHES_LABELS.discard);
    expect(discard.textContent?.trim()).toBe('');

    discard.click();
    await fixture.whenStable();

    expect(host.discards).toBe(1);
  });

  // Decision human 23.11. (B703): the round choice is a history icon button that opens an et-menu to switch the round.
  it('opens the round menu from the history icon button and switches the round', async () => {
    const { fixture, root, host } = await setup();
    const trigger = root.querySelector<HTMLElement>('[data-sk-round] button')!;

    expect(trigger.classList).toContain('et-icon-button');
    expect(trigger.getAttribute('aria-label')).toBe(SKETCHES_LABELS.roundSelect);

    trigger.click();
    await fixture.whenStable();

    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];

    expect(items.map((item) => item.textContent?.trim())).toEqual(['Runde 1', 'Runde 2']);
    expect(items[0]?.getAttribute('aria-checked')).toBe('true');

    items[1]?.click();
    await fixture.whenStable();

    expect(host.picked).toEqual(['r2']);
  });
});
