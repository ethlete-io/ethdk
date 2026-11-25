import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { SketchStatus, SketchWithdrawn } from '../sketches/sketches-sample';
import { SketchHeadComponent } from './sketch-head.component';

const HOLD = { until: 'B1', since: 'seit 1 Min' };

@Component({
  imports: [SketchHeadComponent],
  template: `<ethlete-sketch-head
    [(withdrawn)]="withdrawn"
    [(commentMode)]="commentMode"
    [commentable]="commentable"
    [hold]="hold"
    [reasonOpen]="reasonOpen()"
    [status]="status()"
    [autoMerge]="autoMerge()"
    [subSketch]="subSketch()"
    [approved]="approved()"
    [subSketchesOpen]="subSketchesOpen()"
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
  reasonOpen = signal(false);
  status = signal<SketchStatus>('waiting');
  autoMerge = signal(false);
  subSketch = signal(false);
  approved = signal(false);
  subSketchesOpen = signal(false);
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
  // Human decision B728: the bar holds controls and one status, a dot and one short word.
  it('shows at most one status of one word in the bar', async () => {
    const { fixture, root, host } = await setup();
    const shown: string[][] = [];

    for (const status of ['waiting', 'drawing', 'failed', 'paused', 'not-ready'] as const) {
      for (const autoMerge of [false, true]) {
        for (const [subSketch, approved, subSketchesOpen] of [
          [false, false, false],
          [true, false, false],
          [true, true, false],
          [false, false, true],
        ] as const) {
          host.status.set(status);
          host.autoMerge.set(autoMerge);
          host.subSketch.set(subSketch);
          host.approved.set(approved);
          host.subSketchesOpen.set(subSketchesOpen);
          await fixture.whenStable();
          shown.push(
            [...root.querySelectorAll('[data-sk-toolbar] :is([data-sk-status], et-badge)')].map(
              (badge) => badge.textContent?.trim() ?? '',
            ),
          );
        }
      }
    }

    expect(shown.filter((texts) => texts.length > 1 || texts.some((text) => !/^\S+$/.test(text)))).toEqual([]);
    expect(Object.values(SKETCHES_LABELS.status).filter((label) => !/^\S+$/.test(label))).toEqual([]);
  });

  it.each([
    [false, false, 'Wahl'],
    [true, false, 'Freigabe'],
    [true, true, 'Freigegeben'],
  ] as const)('names a waiting sketch (sub-sketch %s, approved %s) %s', async (subSketch, approved, label) => {
    const { fixture, root, host } = await setup();

    host.subSketch.set(subSketch);
    host.approved.set(approved);
    await fixture.whenStable();

    expect(root.querySelector('[data-sk-toolbar] [data-sk-status]')?.textContent?.trim()).toBe(label);
  });

  it('names a parent whose sub-sketches are open Unterteile', async () => {
    const { fixture, root, host } = await setup();

    host.subSketchesOpen.set(true);
    await fixture.whenStable();

    expect(root.querySelector('[data-sk-toolbar] [data-sk-status]')?.textContent?.trim()).toBe('Unterteile');
  });

  // The human decided Studio does not show the new or not-ready badges, the not-ready reason, the last
  // change line or the description line under the title.
  it('shows no not-ready badge, reason, last change or description line', async () => {
    const { fixture, root, host } = await setup();

    host.status.set('not-ready');
    await fixture.whenStable();

    const text = root.textContent ?? '';

    expect(root.querySelector('[data-sk-toolbar] [data-sk-status]')).toBeNull();
    expect(text).not.toContain('Noch nicht bereit');
    expect(text).not.toContain('Grund unbekannt');
    expect(text).not.toContain('Letzte Änderung');
    expect(root.querySelector('[data-sk-not-ready], [data-sk-question]')).toBeNull();
  });

  // The human decided the sketch bar holds only controls and one status, a dot and a short word (B728).
  it.each(['drawing', 'waiting', 'paused', 'failed'] as const)(
    'shows only the %s status as text beside its controls',
    async (status) => {
      const { fixture, root, host } = await setup();

      host.status.set(status);
      host.withdrawnCount.set(0);
      host.listError.set(false);
      await fixture.whenStable();

      const bar = root.querySelector<HTMLElement>('[data-sk-toolbar]');
      const text = [...(bar?.querySelectorAll('*') ?? [])]
        .flatMap((element) => [...element.childNodes])
        .filter(
          (node) =>
            node.nodeType === Node.TEXT_NODE &&
            !node.parentElement?.closest('[hidden]') &&
            (!!node.parentElement?.closest('[data-sk-status]') || !node.parentElement?.closest('button')),
        )
        .map((node) => node.textContent?.trim())
        .filter(Boolean);

      expect(text).toEqual([SKETCHES_LABELS.status[status]]);
      expect(bar?.querySelectorAll('.rounded-full').length).toBe(1);
      expect(bar?.querySelector('svg[ethlete-agent-logo]')).toBeNull();
    },
  );

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

  it('draws no Verwerfen and no hint text when the sketch cannot be discarded', async () => {
    const { fixture, root, host } = await setup();

    host.discardable.set(false);
    await fixture.whenStable();

    expect(root.querySelector('[data-sk-discard]')).toBeNull();
    expect(root.querySelector('[data-sk-toolbar]')?.textContent).not.toContain('Kein Verwerfen');
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
